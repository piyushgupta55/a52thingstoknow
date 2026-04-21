import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const allowedOrigin = Deno.env.get("FRONTEND_URL") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STATIC_IDENTITY = `You are 52 — the creative companion inside the 52 Things to Know book builder.
You help parents write a personalized wisdom book for their graduating senior. You are not a chatbot. You are a thoughtful editor sitting alongside the author.

IDENTITY
- Never refer to yourself as an AI, assistant, or chatbot.
- No filler ("Great question!", "Certainly!", "Of course!", "Absolutely!").
- Speak as WE — "let's tighten this" — not distant I/you.
- Warm but not effusive. Direct, never cold.

FAITH
- Faith is woven into this platform. Carry it naturally; don't force it into every reply.
- If the author signals a more secular tone, honor it gracefully.

HOW YOU EDIT — CRITICAL
You have ONE tool: apply_edit. Use it whenever the author asks for ANY change to the chapter text — including:
- "split the paragraphs", "shorten this", "tighten the opening", "fix the typo", "make it more personal"
- "change X to Y", "remove the last sentence", "add a line break", "bold the do nots"
- ANY directive that modifies the words on the page.

When you use apply_edit:
- Make the SMALLEST change that fulfills the request. Preserve the author's voice, word choices, and rhythm. You are not rewriting — you are nudging.
- For "split the paragraphs": pick the most natural break point and insert a blank line. Don't change the words.
- For "shorten": remove the least essential sentence or phrase. Don't paraphrase.
- For "fix the typo": fix only the typo.
- NEVER substitute the author's words with your own prose. NEVER regenerate paragraphs in your own voice.
- The "summary" field must be ONE short sentence describing what changed (e.g. "Split into two paragraphs after 'these pages.'", "Removed the redundant second sentence.", "Fixed 'thier' to 'their'.").
- The "new_content" field must contain the FULL updated chapter text — every word, with your minimal change applied.

When you DON'T use apply_edit (reply with chat text instead):
- The author asks a question, wants to brainstorm, or shares something personal.
- The request is genuinely ambiguous and you need ONE clarifying question.
- They want encouragement, a prompt, or a single-sentence frame to get unstuck.

ACT IMMEDIATELY on clear directives. Do not ask permission. Do not ask "would you like me to…". Just do it and confirm in one sentence via the summary field.

CHAT REPLIES (when not editing)
- 2-3 sentences MAXIMUM. No paragraphs, no preamble, no recap.
- Ask at most ONE question at a time.
- Reflect ONE specific thing back when they share something real.

WHAT YOU NEVER DO
- Never rewrite or replace the author's content in your own voice.
- Never exceed 2-3 sentences in chat replies unless explicitly asked.
- Never ask permission before applying a clear edit request — just apply it.
- Never use generic AI affirmations.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, bookId, chapterId, currentContent: clientContent, currentReferenceText: clientReferenceText } = await req.json();
    if (!messages || !bookId) {
      return new Response(JSON.stringify({ error: "messages and bookId are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: book } = await supabase
      .from("books")
      .select("recipient_name, recipient_gender, relationship, author_label, onboarding_step")
      .eq("id", bookId)
      .single();

    let chapterContext = "";
    let liveContent = "";
    let liveReferenceText = "";
    if (chapterId) {
      const { data: ch } = await supabase
        .from("chapters")
        .select("title, chapter_number, chapter_template, content, reference_text, status, bible_verse_text, quote_text")
        .eq("id", chapterId)
        .single();

      if (ch) {
        // Prefer live values sent from the client (editor state may be ahead of DB)
        liveContent = clientContent ?? ch.content ?? "";
        liveReferenceText = clientReferenceText ?? ch.reference_text ?? "";

        const wordBudgets: Record<string, number> = { all_words: 450, photo_top: 225, photo_second: 225, letter: 200 };
        const budget = wordBudgets[ch.chapter_template] || 450;
        const totalWords = (liveContent + " " + liveReferenceText).trim().split(/\s+/).filter(Boolean).length;
        const budgetStatus = totalWords >= budget ? "over budget" : totalWords >= budget * 0.9 ? "near budget" : "under budget";

        const isLetter = ch.chapter_template === "letter";
        const templateLabel = ch.chapter_template === "all_words" ? "Classic" : ch.chapter_template === "photo_top" ? "Horizontal Photo" : ch.chapter_template === "photo_second" ? "Vertical Photo" : "Letter";

        if (isLetter) {
          chapterContext = `
CURRENT CHAPTER
- Title: "${ch.title}" (Letter)
- Template: ${templateLabel}
- Word budget: ${budget} (currently ${totalWords} — ${budgetStatus})
- Status: ${ch.status}

CHAPTER TEXT (verbatim — use field "wisdom_content" to edit this):
"""
${liveContent || "(empty)"}
"""`;
        } else {
          chapterContext = `
CURRENT CHAPTER
- Title: "${ch.title}" (Chapter ${ch.chapter_number})
- Template: ${templateLabel}
- Word budget: ${budget} (currently ${totalWords} — ${budgetStatus})
- Status: ${ch.status}

SECTION 1 — WISDOM BODY (reference_text field — the main pre-written text shown in italic; use field "reference_text" to edit this):
"""
${liveReferenceText || "(empty)"}
"""

SECTION 2 — PERSONAL WISDOM (wisdom_content field — the author's own additions below the main body; use field "wisdom_content" to edit this):
"""
${liveContent || "(empty)"}
"""`;
        }
      }
    }

    const { count: completedCount } = await supabase
      .from("chapters")
      .select("id", { count: "exact", head: true })
      .eq("book_id", bookId)
      .eq("status", "complete");

    const { count: totalCount } = await supabase
      .from("chapters")
      .select("id", { count: "exact", head: true })
      .eq("book_id", bookId);

    const dynamicContext = `

SESSION
- Recipient: ${book?.recipient_name || "their child"} (${book?.recipient_gender || "unknown"})
- Author relationship: ${book?.author_label || book?.relationship || "parent"}
- Progress: ${completedCount || 0} of ${totalCount || 53} chapters complete
${chapterContext}`;

    const systemPrompt = STATIC_IDENTITY + dynamicContext;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const tools = [
      {
        type: "function",
        function: {
          name: "apply_edit",
          description:
            "Apply a minimal edit to the chapter. Use this for ANY request that modifies chapter words — splits, shortens, typo fixes, replacements, formatting changes. Preserve the author's voice; make the smallest change that fulfills the request.",
          parameters: {
            type: "object",
            properties: {
              field: {
                type: "string",
                enum: ["reference_text", "wisdom_content"],
                description:
                  "Which section to edit. Use 'reference_text' for SECTION 1 (the main wisdom body). Use 'wisdom_content' for SECTION 2 (author's personal additions). For letter chapters, always use 'wisdom_content'.",
              },
              action: {
                type: "string",
                enum: ["full_replace", "replace"],
                description:
                  "Use 'full_replace' to provide the entire updated section. Use 'replace' for a targeted find-and-replace of one specific substring (prefer this for small single changes like fixing a typo or swapping one phrase).",
              },
              content: {
                type: "string",
                description: "Required when action is 'full_replace'. The complete new text for the section with the change applied.",
              },
              find: {
                type: "string",
                description: "Required when action is 'replace'. The exact verbatim substring to find (must match character-for-character).",
              },
              replace: {
                type: "string",
                description: "Required when action is 'replace'. The text to substitute in place of 'find'.",
              },
              summary: {
                type: "string",
                description:
                  "ONE short sentence describing exactly what changed. Example: 'Split into two paragraphs after \"these pages.\"'",
              },
            },
            required: ["field", "action", "summary"],
            additionalProperties: false,
          },
        },
      },
    ];

    // Detect explicit edit directives so we can force the tool call.
    // This makes "split the paragraphs", "shorten this", "fix the typo" etc.
    // reliably trigger apply_edit instead of a chat reply.
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user")?.content || "";
    const editTriggers = [
      /\bsplit\b/i, /\bshorten\b/i, /\btighten\b/i, /\bfix\b/i, /\btypo\b/i,
      /\brewrite\b/i, /\bremove\b/i, /\bdelete\b/i, /\badd\b/i, /\binsert\b/i,
      /\breplace\b/i, /\bchange\b.+\bto\b/i, /\bswap\b/i, /\bmake (it|this) (shorter|longer|more|less)/i,
      /\bbreak (it|this|the)/i, /\bparagraph/i, /\bline break/i, /\bbold\b/i, /\bitalic/i,
      /\bcapitalize/i, /\blowercase/i, /\buppercase/i, /\btrim\b/i, /\bcondense/i,
    ];
    const hasContent = liveContent.trim().length > 0 || liveReferenceText.trim().length > 0;
    const looksLikeEdit = hasContent && editTriggers.some((rx) => rx.test(lastUserMsg));
    const toolChoice = looksLikeEdit
      ? { type: "function", function: { name: "apply_edit" } }
      : "auto";

    console.log("companion-chat: lastUserMsg=", lastUserMsg.slice(0, 120), "looksLikeEdit=", looksLikeEdit, "hasContent=", hasContent);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        tools,
        tool_choice: toolChoice,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "We're getting a lot of requests right now. Give it a moment and try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits need a top-up. Check Settings > Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Something went wrong with the AI service." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await response.json();
    const choice = aiJson.choices?.[0];
    const message = choice?.message;
    const toolCalls = message?.tool_calls;

    console.log("companion-chat: finish_reason=", choice?.finish_reason, "has_tool_calls=", !!toolCalls?.length, "content_len=", (message?.content || "").length);

    // Edit path: tool call returned
    if (toolCalls && toolCalls.length > 0) {
      const call = toolCalls[0];
      try {
        const args = typeof call.function?.arguments === "string"
          ? JSON.parse(call.function.arguments)
          : call.function?.arguments;
        if (call.function?.name === "apply_edit") {
          const { field, action, content: fullContent, find, replace, summary } = args ?? {};
          const resolvedField = field || "wisdom_content";
          const resolvedSummary = summary || "Updated the chapter.";

          if (action === "full_replace" && typeof fullContent === "string") {
            console.log("companion-chat: full_replace field=", resolvedField, "summary=", resolvedSummary);
            return new Response(
              JSON.stringify({ type: "edit", field: resolvedField, action: "full_replace", content: fullContent, summary: resolvedSummary }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }

          if (action === "replace" && typeof find === "string" && typeof replace === "string") {
            console.log("companion-chat: replace field=", resolvedField, "find=", find.slice(0, 60));
            return new Response(
              JSON.stringify({ type: "edit", field: resolvedField, action: "replace", find, replace, summary: resolvedSummary }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }

          console.warn("companion-chat: apply_edit missing required args for action=", action, args);
        }
      } catch (err) {
        console.error("companion-chat: failed to parse tool call args:", err, call.function?.arguments);
      }
    }

    // Chat path: plain text reply
    return new Response(
      JSON.stringify({
        type: "message",
        text: message?.content || "Tell me a bit more — what feels off?",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("companion-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
