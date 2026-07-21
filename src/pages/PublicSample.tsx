import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Camera, Sparkles } from "lucide-react";

const CREAM = "#F5F0E8";
const GOLD = "#BBA96A";
const SERIF = "'Lora', 'Georgia', 'Times New Roman', serif";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

interface Chapter {
  id: string;
  title: string;
  chapter_number: number;
  bible_verse_text: string | null;
  bible_verse_reference: string | null;
  quote_text: string | null;
  quote_attribution: string | null;
  reference_content: string | null;
  is_photo_chapter: boolean;
}

export default function PublicSample() {
  const { templateId } = useParams<{ templateId: string }>();
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/public-preview?id=${encodeURIComponent(templateId!)}`, {
          headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setChapter(data.chapter);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
  }, [templateId]);

  const paragraphs = (chapter?.reference_content || "").split(/\n\n+/).filter(Boolean);

  return (
    <div className="min-h-screen" style={{ background: CREAM, fontFamily: SERIF }}>
      <div className="container mx-auto max-w-2xl px-4 py-10">
        <Link to="/samples" className="inline-flex items-center gap-1.5 text-sm mb-6" style={{ color: "#8a7560" }}>
          <ArrowLeft className="h-4 w-4" /> All samples
        </Link>

        {error && <div className="text-sm text-red-700">Could not load sample: {error}</div>}
        {!chapter && !error && <div className="text-muted-foreground">Loading…</div>}

        {chapter && (
          <article>
            <p className="uppercase tracking-[0.3em] text-xs mb-2" style={{ color: GOLD }}>Sample chapter</p>
            <h1 className="font-heading text-4xl md:text-5xl font-bold mb-6" style={{ color: "#2a1f1a" }}>
              {chapter.title}
            </h1>

            {chapter.is_photo_chapter && (
              <div className="rounded-xl border border-dashed p-6 mb-6 text-center" style={{ borderColor: "rgba(187,169,106,0.6)", background: "rgba(187,169,106,0.08)" }}>
                <Camera className="h-6 w-6 mx-auto mb-2" style={{ color: GOLD }} />
                <p className="text-sm" style={{ color: "#5a4632" }}>
                  In your book, a photo of your child would appear here.
                </p>
              </div>
            )}

            {chapter.bible_verse_text && (
              <blockquote className="italic border-l-2 pl-4 mb-6" style={{ borderColor: GOLD, color: "#5a4632" }}>
                "{chapter.bible_verse_text}"
                {chapter.bible_verse_reference && (
                  <div className="not-italic text-xs mt-1" style={{ color: "#8a7560" }}>— {chapter.bible_verse_reference}</div>
                )}
              </blockquote>
            )}

            <div className="prose prose-lg max-w-none" style={{ color: "#2a1f1a" }}>
              {paragraphs.map((p, i) => (
                <p key={i} className="leading-relaxed mb-4">{p}</p>
              ))}
            </div>

            {chapter.quote_text && (
              <blockquote className="mt-8 p-4 rounded-xl" style={{ background: "rgba(187,169,106,0.10)", color: "#5a4632" }}>
                "{chapter.quote_text}"
                {chapter.quote_attribution && (
                  <div className="text-xs mt-1" style={{ color: "#8a7560" }}>— {chapter.quote_attribution}</div>
                )}
              </blockquote>
            )}

            <div className="mt-12 rounded-2xl p-6 text-center" style={{ background: "rgba(187,169,106,0.12)", border: "1px solid rgba(187,169,106,0.35)" }}>
              <Sparkles className="h-5 w-5 mx-auto mb-2" style={{ color: GOLD }} />
              <h2 className="font-heading text-2xl font-bold mb-2" style={{ color: "#2a1f1a" }}>
                Make it yours
              </h2>
              <p className="text-sm mb-4" style={{ color: "#5a4632" }}>
                Sign up free — read 10 chapters across every theme, edit one yourself, then unlock the printed keepsake for someone you love.
              </p>
              <Link to="/register">
                <Button size="lg" style={{ background: GOLD, color: "#fff" }}>Create a free account</Button>
              </Link>
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
