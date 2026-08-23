// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Chapter {
  id: string;
  chapter_number: number;
  title: string;
  content?: string;
  reference_text?: string;
  chapter_template?: string;
  status: string;
}

type Issue = {
  id: string;
  chapter_id: string;
  chapter_number: number;
  chapter_title: string;
  type: "typo" | "name_mismatch" | "cut_off" | "double_space" | "empty_page_2" | "missing_punctuation";
  snippet: string;
  message: string;
};

// Editor markers (<mark>…</mark> Reading Rewards, <review>…</review> spans) are
// structural, not prose — strip the wrappers everywhere before any check so a
// sentence ending in a tag isn't mis-read and tags never leak into excerpts.
const stripMarkers = (s: string): string =>
  (s || "").replace(/<\/?mark\b[^>]*>/gi, "").replace(/<\/?review\b[^>]*>/gi, "");

const wordCount = (s: string): number =>
  s ? s.replace(/[—–]/g, " ").trim().split(/\s+/).filter(Boolean).length : 0;


// Sentence-final punctuation. Colons and semicolons are valid endings
// (they introduce lists), so they count as terminated sentences.
const SENTENCE_END = /[.!?…:;]/;

// Page 1 (reference_text) and page 2 (content) are two halves of one flowing
// chapter. Only insert a paragraph break when page 1 actually ends a sentence;
// otherwise the two halves belong to the SAME sentence and must join with a
// single space, or the checks see a manufactured mid-sentence break.
const joinPages = (ref: string, content: string): string => {
  const a = (ref || "").replace(/\s+$/, "");
  const b = (content || "").replace(/^\s+/, "");
  if (!a) return b;
  if (!b) return a;
  const last = a.replace(/[)\]"'”’»]+$/u, "").slice(-1);
  return a + (SENTENCE_END.test(last) ? "\n\n" : " ") + b;
};


// Return the whole sentence(s) surrounding [start, end) in `text`, so excerpts
// never begin or end mid-sentence (or mid-word).
const sentenceWindow = (text: string, start: number, end: number, maxLen = 300): string => {
  if (!text) return "";
  const s = Math.max(0, Math.min(start, text.length));
  const e = Math.max(s, Math.min(end, text.length));

  // Walk backwards to the end of the previous sentence / paragraph break.
  let from = 0;
  for (let i = s - 1; i >= 0; i--) {
    const c = text[i];
    if (c === "\n" || (SENTENCE_END.test(c) && /\s/.test(text[i + 1] ?? " "))) {
      from = i + 1;
      break;
    }
  }
  // Walk forwards to the end of the sentence containing the match.
  let to = text.length;
  for (let i = e; i < text.length; i++) {
    const c = text[i];
    if (c === "\n") { to = i; break; }
    if (SENTENCE_END.test(c) && /\s|$/.test(text[i + 1] ?? "")) {
      // include trailing closing quotes/brackets
      let j = i + 1;
      while (j < text.length && /["')\]”’»]/.test(text[j])) j++;
      to = j;
      break;
    }
  }
  let out = text.slice(from, to).trim();
  if (out.length > maxLen) {
    // Still too long: trim on a word boundary rather than mid-word.
    out = out.slice(0, maxLen).replace(/\s+\S*$/, "") + "…";
  }
  return out;
};

// Locate an AI-supplied snippet in the real text and widen it to whole sentences.
const widenSnippet = (text: string, snippet: string): string => {
  const s = (snippet || "").trim();
  if (!s) return "";
  if (!text) return s;
  let idx = text.indexOf(s);
  if (idx < 0) {
    // Try a shortened probe in case the model paraphrased the tail.
    const probe = s.slice(0, 40);
    idx = probe ? text.indexOf(probe) : -1;
  }
  if (idx < 0) return s.slice(0, 300);
  return sentenceWindow(text, idx, idx + s.length);
};

// Words that are never correct English in any context.
const ALWAYS_MISSPELLED = [
  "alot", "definately", "seperate", "recieve", "occured", "untill", "becuase",
  "thier", "freind", "beleive", "wich", "acheive", "arguement", "concious",
  "embarass", "existance", "goverment", "grateful ness", "harrass", "independant",
  "neccessary", "occassion", "perseverence", "priviledge", "publically",
  "reccommend", "rythm", "supress", "tommorow", "truely", "wierd",
];

// Homophone pairs an author genuinely confuses. Detected deterministically,
// then confirmed one-by-one by a narrowly-scoped AI pass so correct uses stay silent.
const HOMOPHONES = [
  "your", "you're", "its", "it's", "their", "they're",
  "whose", "who's", "then", "than", "too", "lose", "loose",
  "were", "we're",
];

const escapeRe = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Two snippets overlap when one contains the other (or they share the same
// normalized sentence) — one problem should never be reported twice.
const normSnip = (s: string) => (s || "").toLowerCase().replace(/\s+/g, " ").replace(/[^a-z0-9 ]/g, "").trim();

const dedupeOverlapping = (list: Issue[]): Issue[] => {
  const kept: Issue[] = [];
  for (const iss of list) {
    const n = normSnip(iss.snippet);
    if (!n) { kept.push(iss); continue; }
    const clash = kept.find(
      (k) =>
        k.chapter_id === iss.chapter_id &&
        (() => {
          const kn = normSnip(k.snippet);
          return !!kn && (kn === n || kn.includes(n) || n.includes(kn));
        })(),
    );
    if (clash) continue;
    kept.push(iss);
  }
  return kept;
};




serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { bookId, chapterId } = await req.json();
    if (!bookId) {
      return new Response(JSON.stringify({ error: "bookId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: book } = await supabase
      .from("books")
      .select("recipient_name")
      .eq("id", bookId)
      .single();

    if (!book) {
      return new Response(JSON.stringify({ error: "Book not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // When chapterId is provided we re-scan only that one chapter. Otherwise
    // scan every chapter in the book.
    let chaptersQuery = supabase
      .from("chapters")
      .select("id, chapter_number, title, content, reference_text, chapter_template")
      .eq("book_id", bookId)
      .order("chapter_number");

    if (chapterId) {
      chaptersQuery = chaptersQuery.eq("id", chapterId);
    }


    const { data: chapters } = await chaptersQuery;

    const recipientName = (book.recipient_name || "").trim();
    const issues: Issue[] = [];
    let idCounter = 0;
    const mkId = () => `iss_${Date.now()}_${++idCounter}`;

    const completedChapters = (chapters || []) as Chapter[];

    // Homophone confusions ("you're" for "your") are collected while scanning and
    // confirmed by a single narrowly-scoped AI pass afterwards.
    const homophoneCandidates: { ch: Chapter; word: string; snippet: string }[] = [];

    // Deterministic checks
    for (const ch of completedChapters) {
      const ref = stripMarkers((ch.reference_text || "") as string);
      const content = stripMarkers((ch.content || "") as string);
      const combined = joinPages(ref, content);



      // Empty page 2 (content section empty / near-empty)
      if (wordCount(content) < 5) {
        issues.push({
          id: mkId(),
          chapter_id: ch.id,
          chapter_number: ch.chapter_number,
          chapter_title: ch.title,
          type: "empty_page_2",
          snippet: "(Page 2 is empty)",
          message: "This chapter is marked complete but Page 2 has no personal wisdom.",
        });
      }

      // Double / extra spaces (within a line)
      const dsRe = /[^\n]  +[^\n]/g;
      const seen = new Set<string>();
      let dsMatch: RegExpExecArray | null;
      let dsCount = 0;
      while ((dsMatch = dsRe.exec(combined)) !== null && dsCount < 3) {
        const snip = sentenceWindow(combined, dsMatch.index, dsMatch.index + dsMatch[0].length);
        if (!snip || seen.has(snip)) continue;
        seen.add(snip);
        dsCount++;
        issues.push({
          id: mkId(),
          chapter_id: ch.id,
          chapter_number: ch.chapter_number,
          chapter_title: ch.title,
          type: "double_space",
          snippet: snip,
          message: "Extra spacing detected.",
        });
      }

      // Missing ending punctuation (paragraph-level)
      const paragraphs = combined.split(/\n+/).map((p) => p.trim()).filter(Boolean);
      const punctSeen = new Set<string>();
      for (const para of paragraphs) {
        // Skip short lines (likely headings/titles) — fewer than 5 words
        if (wordCount(para) < 5) continue;
        // Strip trailing closing quotes/brackets to find the real terminal char
        const stripped = para.replace(/[)\]"'”’»]+$/u, "");
        const last = stripped.slice(-1);
        if (!SENTENCE_END.test(last)) {
          const idx = combined.indexOf(para);
          const snip = idx >= 0
            ? sentenceWindow(combined, Math.max(idx, idx + para.length - 1), idx + para.length)
            : para.slice(-200);
          if (punctSeen.has(snip)) continue;
          punctSeen.add(snip);
          issues.push({
            id: mkId(),
            chapter_id: ch.id,
            chapter_number: ch.chapter_number,
            chapter_title: ch.title,
            type: "missing_punctuation",
            snippet: snip,
            message: "This sentence appears to be missing ending punctuation.",
          });
          if (punctSeen.size >= 5) break;
        }
      }

      // Always-wrong spellings ("alot", "definately"): no judgement needed.
      const spellSeen = new Set<string>();
      for (const w of ALWAYS_MISSPELLED) {
        const re = new RegExp(`(^|[^A-Za-z'’])(${escapeRe(w)})([^A-Za-z'’]|$)`, "gi");
        let m: RegExpExecArray | null;
        while ((m = re.exec(combined)) !== null) {
          const at = m.index + m[1].length;
          const snip = sentenceWindow(combined, at, at + w.length);
          const key = `${w}|${snip}`;
          if (spellSeen.has(key)) continue;
          spellSeen.add(key);
          issues.push({
            id: mkId(),
            chapter_id: ch.id,
            chapter_number: ch.chapter_number,
            chapter_title: ch.title,
            type: "typo",
            snippet: snip,
            message: `"${m[2]}" appears to be misspelled.`,
          });
          break; // one flag per misspelling per chapter
        }
      }

      // Homophone candidates — collected here, confirmed by AI below.
      for (const w of HOMOPHONES) {
        const re = new RegExp(`(^|[^A-Za-z'’])(${escapeRe(w)})([^A-Za-z'’]|$)`, "gi");
        let m: RegExpExecArray | null;
        while ((m = re.exec(combined)) !== null) {
          const at = m.index + m[1].length;
          const snip = sentenceWindow(combined, at, at + w.length);
          if (!snip) continue;
          homophoneCandidates.push({ ch, word: m[2], snippet: snip });
        }
      }

    }


    // AI checks (misspellings, recipient-name mismatches, and a deliberately
    // conservative "reads oddly" grammar flag that never proposes wording)
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY && completedChapters.length > 0) {
      const payload = completedChapters.map((ch: Chapter) => ({
        chapter_id: ch.id,
        chapter_number: ch.chapter_number,
        title: ch.title,
        text: stripMarkers(joinPages(ch.reference_text || "", ch.content || "")).trim(),
      }));

      const systemPrompt = `You are a cautious proofreader for a personalized printed book written for "${recipientName}". Your bias is silence: when in doubt, say nothing. A false alarm is far worse than a missed issue, because the author may "fix" correct writing and make the book worse.

Report ONLY these issue types:
- "typo": a MISSPELLED WORD — a sequence of letters that is not a real English word (or a clearly misspelled proper noun). Example: "recieve", "beleive", "freind".
- "name_mismatch": a different person's first name is used where the recipient should be addressed (e.g. "I hope you remember this, Sarah" when the recipient is "${recipientName}"). Ignore names of third parties (grandparents, friends, teachers, historical or biblical figures). Only flag when the wrong name is clearly standing in for the recipient's name.
- "reads_oddly": a genuine grammatical error that a careful editor would DEFINITELY correct — a missing or duplicated word, a broken subject-verb agreement, a mangled or unfinished clause. Only flag when the sentence is actually wrong, not merely unusual. If you are less than certain, stay silent.

HARD RULES — violating any of these is a failure:
- Never propose replacement text, a rewrite, or "clearer" wording anywhere in your output. Only point at the sentence.
- Never flag idioms or figurative language ("nursing grudges", "as you think it is", "carry a torch"). Real idioms are correct English.
- Never flag style, tone, rhythm, sentence length, word choice, preposition choice, or fragments used for effect.
- Never flag capitalization, consistency, or house-style ("godly" vs "Godly", "Mom" vs "mom"). Never flag punctuation, spacing, commas, or oxford commas.
- Never flag second-person address. Titles and sentences that speak to the reader as "you" are intentional — never propose replacing "you" with "${recipientName}".
- Never flag archaic, poetic, biblical, or regional wording.
- Returning zero issues is the correct and expected answer for well-written text.

Return STRICT JSON only with this shape:
{ "issues": [ { "chapter_id": "<id>", "type": "typo|name_mismatch|reads_oddly", "snippet": "<verbatim excerpt: one complete sentence from the text, never cut mid-word>", "message": "<one short sentence naming the misspelled word or wrong name; for reads_oddly leave this empty>" } ] }

If no issues, return { "issues": [] }. Never invent issues.`;



      const userPrompt = `Recipient name: ${recipientName}\n\nChapters:\n${JSON.stringify(payload)}`;

      try {
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            response_format: { type: "json_object" },
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          const raw = data?.choices?.[0]?.message?.content || "{}";
          let parsed: any = {};
          try { parsed = JSON.parse(raw); } catch (_) { parsed = {}; }
          const aiIssues = Array.isArray(parsed.issues) ? parsed.issues : [];
          const chMap = new Map<string, Chapter>(completedChapters.map((c: Chapter) => [c.id, c]));
          // Collect candidates first; typos get a second, independent
          // spelling verification before they are allowed through.
          type Candidate = { ch: Chapter; type: string; snippet: string; message: string; word: string };
          const candidates: Candidate[] = [];
          for (const ai of aiIssues) {
            const ch = chMap.get(ai.chapter_id);
            if (!ch) continue;
            const type = ["typo", "name_mismatch", "reads_oddly"].includes(ai.type) ? ai.type : null;
            if (!type) continue;
            const fullText = stripMarkers(joinPages(ch.reference_text || "", ch.content || "")).trim();
            const snippet = widenSnippet(fullText, String(ai.snippet || ""));
            // "reads oddly" is always phrased as a question and never carries
            // model-authored wording — the author decides what (if anything) to change.
            const message = type === "reads_oddly"
              ? "This sentence reads oddly — worth a look?"
              : String(ai.message || "").slice(0, 240);
            // The flagged word must be named in the message AND actually
            // present in the chapter text — otherwise it's a rewrite
            // suggestion dressed up as a typo.
            const quoted = message.match(/["'“‘]([A-Za-z][A-Za-z'’-]*)["'”’]/);
            const word = quoted ? quoted[1] : "";
            if (type === "typo") {
              if (!word) continue;
              const present = new RegExp(`(^|[^A-Za-z])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Za-z]|$)`).test(fullText);
              if (!present) continue;
            }
            candidates.push({ ch, type, snippet, message, word });

          }

          // Second pass: keep a "typo" only if the named word is genuinely
          // not a real English word. Correct spellings used in idioms,
          // capitalization variants and proper nouns are all real words.
          const typoWords = [...new Set(candidates.filter((c) => c.type === "typo").map((c) => c.word))];
          let realWords = new Set<string>();
          if (typoWords.length > 0) {
            try {
              const vr = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash",
                  messages: [
                    {
                      role: "system",
                      content:
                        `For each candidate, decide only one thing: is it a real, correctly spelled English word, or a legitimate proper noun or name? Ignore capitalization entirely ("Godly" and "godly" are both real). Ignore meaning, style and context. Answer "real" unless the letters do not form a word at all (e.g. "recieve", "freind"). Return STRICT JSON: { "real": ["<words that ARE real>"] }`,
                    },
                    { role: "user", content: JSON.stringify(typoWords) },
                  ],
                  response_format: { type: "json_object" },
                }),
              });
              if (vr.ok) {
                const vd = await vr.json();
                const vp = JSON.parse(vd?.choices?.[0]?.message?.content || "{}");
                realWords = new Set((Array.isArray(vp.real) ? vp.real : []).map((w: string) => String(w).toLowerCase()));
              } else {
                // Verification unavailable: suppress typos rather than risk bad advice.
                realWords = new Set(typoWords.map((w) => w.toLowerCase()));
              }
            } catch (_) {
              realWords = new Set(typoWords.map((w) => w.toLowerCase()));
            }
          }

          // Second opinion for "reads oddly": an independent pass that only
          // confirms sentences containing an actual grammatical error. Anything
          // merely unusual, idiomatic or stylistic is dropped.
          const oddSentences = candidates.filter((c) => c.type === "reads_oddly").map((c) => c.snippet);
          let confirmedOdd = new Set<string>();
          if (oddSentences.length > 0) {
            try {
              const gr = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash",
                  messages: [
                    {
                      role: "system",
                      content:
                        `For each sentence, answer one question only: does it contain an outright grammatical ERROR — a missing or duplicated word, broken subject-verb agreement, or a mangled/unfinished clause? Idioms, informal phrasing, fragments for effect, second-person address, capitalization, punctuation and style are NOT errors. If the sentence is grammatical, it is fine. When unsure, say it is fine. Return STRICT JSON with the 0-based indexes of only the sentences containing a real error: { "errors": [<index>] }`,
                    },
                    { role: "user", content: JSON.stringify(oddSentences) },
                  ],
                  response_format: { type: "json_object" },
                }),
              });
              if (gr.ok) {
                const gd = await gr.json();
                const gp = JSON.parse(gd?.choices?.[0]?.message?.content || "{}");
                const idxs = Array.isArray(gp.errors) ? gp.errors : [];
                confirmedOdd = new Set(idxs.map((i: number) => oddSentences[i]).filter(Boolean));
              }
            } catch (_) {
              // Verification unavailable: stay silent rather than risk bad advice.
            }
          }

          for (const c of candidates) {
            if (c.type === "typo" && realWords.has(c.word.toLowerCase())) continue;
            if (c.type === "reads_oddly" && !confirmedOdd.has(c.snippet)) continue;

            issues.push({
              id: mkId(),
              chapter_id: c.ch.id,
              chapter_number: c.ch.chapter_number,
              chapter_title: c.ch.title,
              type: c.type as Issue["type"],
              snippet: c.snippet,
              message: c.message,
            });
          }


        } else {
          console.error("AI gateway error:", resp.status, await resp.text());
        }
      } catch (e) {
        console.error("AI call failed:", e);
      }
    }

    return new Response(
      JSON.stringify({
        chaptersScanned: completedChapters.length,
        issues,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("book-review error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
