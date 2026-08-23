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

const wordCount = (s: string): number =>
  s ? s.replace(/[—–]/g, " ").trim().split(/\s+/).filter(Boolean).length : 0;

// Sentence-final punctuation. Colons and semicolons are valid endings
// (they introduce lists), so they count as terminated sentences.
const SENTENCE_END = /[.!?…:;]/;

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

    // Deterministic checks
    for (const ch of completedChapters) {
      const ref = (ch.reference_text || "") as string;
      const content = (ch.content || "") as string;
      const combined = `${ref}\n\n${content}`;

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

    }

    // AI checks (typos, name mismatches, cut-off sentences)
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY && completedChapters.length > 0) {
      const payload = completedChapters.map((ch: Chapter) => ({
        chapter_id: ch.id,
        chapter_number: ch.chapter_number,
        title: ch.title,
        text: `${ch.reference_text || ""}\n\n${ch.content || ""}`.trim(),
      }));

      const systemPrompt = `You are a careful proofreader for a personalized printed book written for "${recipientName}".

Scan each chapter and report ONLY these issue types:
- "typo": clear spelling errors or obvious misspellings (NOT stylistic preferences).
- "name_mismatch": a first name of a person appears that is clearly NOT "${recipientName}" and is being used as if addressing the recipient (e.g., "I hope you remember this, Sarah" when the recipient is "${recipientName}"). Ignore names of other people that are clearly being referenced as third parties (grandparents, friends, historical figures). Only flag when the wrong name appears to be used in place of the recipient's name.
- "cut_off": a sentence in the FULL chapter text that is genuinely truncated mid-thought (trails off, ends mid-word, or stops without any terminal punctuation). The text you receive is complete and untruncated — never assume an excerpt was cut. A sentence ending in a period, question mark, exclamation point, ellipsis, colon or semicolon is NOT cut off; colons and semicolons legitimately introduce lists.

Do NOT flag: style, grammar choices, capitalization preferences, double spaces, empty sections, comma placement, oxford commas, or sentences ending in a colon or semicolon.

Return STRICT JSON only with this shape:
{ "issues": [ { "chapter_id": "<id>", "type": "typo|name_mismatch|cut_off", "snippet": "<verbatim excerpt: one complete sentence from the text, never cut mid-word>", "message": "<one short sentence describing the issue>" } ] }


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
          for (const ai of aiIssues) {
            const ch = chMap.get(ai.chapter_id);
            if (!ch) continue;
            const type = ["typo", "name_mismatch", "cut_off"].includes(ai.type) ? ai.type : null;
            if (!type) continue;
            issues.push({
              id: mkId(),
              chapter_id: ch.id,
              chapter_number: ch.chapter_number,
              chapter_title: ch.title,
              type,
              snippet: String(ai.snippet || "").slice(0, 200),
              message: String(ai.message || "").slice(0, 240),
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
