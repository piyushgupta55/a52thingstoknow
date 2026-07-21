import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BookOpen, ArrowRight } from "lucide-react";

const CREAM = "#F5F0E8";
const GOLD = "#BBA96A";
const SERIF = "'Lora', 'Georgia', 'Times New Roman', serif";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

interface Sample {
  id: string;
  title: string;
  chapter_number: number;
  bible_verse_reference: string | null;
  is_photo_chapter: boolean;
}

export default function PublicSamples() {
  const [samples, setSamples] = useState<Sample[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/public-preview`, {
          headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setSamples(data.samples || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
  }, []);

  return (
    <div className="min-h-screen" style={{ background: CREAM, fontFamily: SERIF }}>
      <div className="container mx-auto max-w-3xl px-4 py-14">
        <p className="uppercase tracking-[0.3em] text-xs mb-2" style={{ color: GOLD }}>Read the book</p>
        <h1 className="font-heading text-4xl md:text-5xl font-bold mb-4" style={{ color: "#2a1f1a" }}>
          Sample chapters
        </h1>
        <p className="text-lg leading-relaxed mb-8" style={{ color: "#5a4632" }}>
          Real chapters from the book — read as many as you like, no signup required. When you're ready to build your own for someone you love, create a free account.
        </p>

        {error && <div className="text-sm text-red-700 mb-6">Could not load samples: {error}</div>}
        {!samples && !error && <div className="text-muted-foreground">Loading…</div>}

        <ul className="space-y-3">
          {samples?.map((s) => (
            <li key={s.id}>
              <Link
                to={`/sample/${s.id}`}
                className="block rounded-xl border bg-white/70 p-5 hover:shadow-md transition"
                style={{ borderColor: "rgba(187,169,106,0.35)" }}
              >
                <div className="flex items-center gap-4">
                  <BookOpen className="h-5 w-5 flex-shrink-0" style={{ color: GOLD }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-heading text-xl font-bold" style={{ color: "#2a1f1a" }}>
                      {s.title}
                    </div>
                    {s.bible_verse_reference && (
                      <div className="text-xs mt-0.5" style={{ color: "#8a7560" }}>{s.bible_verse_reference}</div>
                    )}
                  </div>
                  <ArrowRight className="h-5 w-5 flex-shrink-0" style={{ color: GOLD }} />
                </div>
              </Link>
            </li>
          ))}
          {samples && samples.length === 0 && (
            <li className="text-muted-foreground">No samples published yet.</li>
          )}
        </ul>

        <div className="mt-12 rounded-2xl p-6 text-center" style={{ background: "rgba(187,169,106,0.12)", border: "1px solid rgba(187,169,106,0.35)" }}>
          <h2 className="font-heading text-2xl font-bold mb-2" style={{ color: "#2a1f1a" }}>Build your own</h2>
          <p className="text-sm mb-4" style={{ color: "#5a4632" }}>
            Sign up free — read 10 chapters across every theme, edit one yourself, then unlock the printed keepsake.
          </p>
          <Link to="/register">
            <Button size="lg" style={{ background: GOLD, color: "#fff" }}>Create a free account</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
