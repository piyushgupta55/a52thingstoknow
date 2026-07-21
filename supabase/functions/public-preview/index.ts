// Public, no-auth endpoint that returns marketing sample chapters. It reads the
// admin-managed `preview_sets.website_samples` list from app_settings and
// returns matching chapter_templates. Never returns user data.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const normalizeTitle = (s: string): string =>
  (s || "")
    .toLowerCase()
    .replace(/[\u2018\u2019\u201C\u201D"']/g, "")
    .replace(/[\u2026]/g, "...")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const templateId = url.searchParams.get("id");

    const { data: settingRow } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "preview_sets")
      .maybeSingle();

    const sample: string[] = ((settingRow?.value ?? {}) as any).website_samples ?? [];
    const wanted = new Set(sample.map(normalizeTitle));

    // Deduplicate by title; prefer female-variant when both exist (arbitrary
    // stable pick). Templates are keyed by (chapter_number, gender, title).
    const { data: templates } = await supabase
      .from("chapter_templates")
      .select("id, chapter_number, title, gender, bible_verse_text, bible_verse_reference, quote_text, quote_attribution, reference_content, is_photo_chapter")
      .order("chapter_number");

    const byTitle = new Map<string, any>();
    for (const t of templates ?? []) {
      const key = normalizeTitle(t.title);
      if (!wanted.has(key)) continue;
      // Prefer female as canonical marketing sample if not already stored.
      if (!byTitle.has(key) || t.gender === "female") byTitle.set(key, t);
    }
    const samples = Array.from(byTitle.values());

    if (templateId) {
      const one = samples.find((s) => s.id === templateId);
      if (!one) {
        return new Response(JSON.stringify({ error: "Not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ chapter: one }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Index — return just enough for the list view.
    const index = samples.map((t) => ({
      id: t.id,
      title: t.title,
      chapter_number: t.chapter_number,
      bible_verse_reference: t.bible_verse_reference,
      is_photo_chapter: t.is_photo_chapter,
    }));
    return new Response(JSON.stringify({ samples: index }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("public-preview error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
