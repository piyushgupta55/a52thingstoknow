import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronRight, CheckCircle2, BookOpen, Lock } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { BookLockBanner } from '@/components/BookLockBanner';
import { useBookUnlocked } from '@/hooks/useBookUnlocked';
import { THEME_GROUPS, getGroupSlugForTitle } from '@/data/chapterThemeGroups';
import { usePreviewSets, isInSet } from '@/lib/previewSets';


const CREAM = '#F5F0E8';
const GOLD = '#BBA96A';
const SERIF = "'Lora', 'Georgia', 'Times New Roman', serif";

interface Chapter {
  id: string;
  chapter_number: number;
  title: string;
  status: string;
  review_status: string | null;
}

const QuickReadHub = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const unlocked = useBookUnlocked(bookId);
  const { sets } = usePreviewSets();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [recipientName, setRecipientName] = useState<string>('');


  useEffect(() => {
    if (!bookId) return;
    (async () => {
      const [{ data: bookData }, { data: chapData }] = await Promise.all([
        supabase.from('books').select('recipient_name').eq('id', bookId).single(),
        supabase
          .from('chapters')
          .select('id, chapter_number, title, status, review_status')
          .eq('book_id', bookId)
          .gt('chapter_number', 0)
          .order('chapter_number'),
      ]);
      if (bookData?.recipient_name) {
        setRecipientName(bookData.recipient_name.trim().split(/\s+/).map((w: string) =>
          w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
      }
      setChapters((chapData as Chapter[]) || []);
      setLoading(false);
    })();
  }, [bookId]);

  const byGroup = useMemo(() => {
    const map = new Map<string, Chapter[]>();
    for (const g of THEME_GROUPS) map.set(g.slug, []);
    for (const c of chapters) {
      const slug = getGroupSlugForTitle(c.title);
      if (slug && map.has(slug)) map.get(slug)!.push(c);
    }
    return map;
  }, [chapters]);

  const totals = useMemo(() => {
    const reviewed = chapters.filter(c => !!c.review_status).length;
    return { reviewed, total: chapters.length };
  }, [chapters]);

  const nextGroupSlug = useMemo(() => {
    for (const g of THEME_GROUPS) {
      const list = byGroup.get(g.slug) || [];
      if (list.some(c => !c.review_status)) return g.slug;
    }
    return null;
  }, [byGroup]);

  const allDone = totals.total > 0 && totals.reviewed === totals.total;

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: CREAM, fontFamily: SERIF }}>
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: CREAM, fontFamily: SERIF }}>
      <Navbar />
      <BookLockBanner bookId={bookId!} />
      <div className="container mx-auto px-4 py-8 max-w-3xl">

        <Button
          variant="ghost"
          size="sm"
          className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
          onClick={() => navigate(`/book/${bookId}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to dashboard
        </Button>

        <div className="mb-8">
          <p className="uppercase tracking-[0.3em] text-xs mb-2" style={{ color: GOLD }}>Start Here</p>
          <h1 className="font-heading text-3xl md:text-4xl font-bold" style={{ color: '#2a1f1a' }}>
            {recipientName ? `${recipientName}'s book, one theme at a time` : 'Your read-through'}
          </h1>
          <p className="mt-3 text-sm md:text-base leading-relaxed" style={{ color: '#5a4632' }}>
            Ten themed groups. Read through one at a time — each is a short, finishable chunk. At the end of every
            chapter, tell us how it feels: keep it, add to it, or rewrite it later.
          </p>

          <div className="mt-5 flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(187,169,106,0.2)' }}>
              <div
                className="h-full transition-all duration-500"
                style={{ width: `${totals.total ? (totals.reviewed / totals.total) * 100 : 0}%`, background: GOLD }}
              />
            </div>
            <span className="text-sm font-semibold" style={{ color: '#5a4632' }}>
              {totals.reviewed} of {totals.total} reviewed
            </span>
          </div>
        </div>

        {allDone ? (
          <div className="bg-white/60 border rounded-xl p-6 text-center" style={{ borderColor: 'rgba(187,169,106,0.35)' }}>
            <CheckCircle2 className="h-6 w-6 mx-auto mb-2" style={{ color: GOLD }} />
            <p className="font-semibold" style={{ color: '#2a1f1a' }}>All 52 reviewed — beautiful work.</p>
            <p className="text-sm mt-1" style={{ color: '#5a4632' }}>
              The work from here is finishing chapters. Open a pile from the dashboard.
            </p>
            <Button className="mt-4" onClick={() => navigate(`/book/${bookId}`)}>Back to dashboard</Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {THEME_GROUPS.map((g, i) => {
              const list = byGroup.get(g.slug) || [];
              const reviewed = list.filter(c => !!c.review_status).length;
              const total = list.length;
              const done = total > 0 && reviewed === total;
              const started = reviewed > 0 && !done;
              const isNext = g.slug === nextGroupSlug;

              // Per-chapter access: a chapter is accessible if the book is
              // unlocked, or if its title is in the admin trial readable OR
              // editable sets.
              const openCount = unlocked
                ? total
                : list.filter(c => isInSet(c.title, sets.trial_readable) || isInSet(c.title, sets.trial_editable)).length;
              const fullyLocked = !unlocked && openCount === 0;
              const partiallyLocked = !unlocked && openCount > 0 && openCount < total;

              return (
                <li key={g.slug}>
                  <button
                    type="button"
                    onClick={() => fullyLocked ? navigate(`/book/${bookId}/unlock`) : navigate(`/book/${bookId}/quick-read/${g.slug}`)}
                    disabled={total === 0}
                    className="w-full text-left rounded-xl border transition-all group hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: done ? 'rgba(187,169,106,0.10)' : '#fff',
                      borderColor: isNext && !fullyLocked ? GOLD : 'rgba(187,169,106,0.25)',
                      boxShadow: isNext && !fullyLocked ? '0 0 0 2px rgba(187,169,106,0.25)' : 'none',
                      opacity: fullyLocked ? 0.7 : 1,
                    }}
                  >

                    <div className="p-4 md:p-5 flex items-center gap-4">
                      <div
                        className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center font-heading text-sm font-bold"
                        style={{
                          background: done ? GOLD : (started ? 'rgba(187,169,106,0.2)' : 'rgba(187,169,106,0.1)'),
                          color: done ? '#fff' : '#5a4632',
                        }}
                      >
                        {done ? <CheckCircle2 className="h-5 w-5" /> : i + 1}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="font-heading text-lg md:text-xl font-bold" style={{ color: '#2a1f1a' }}>
                            {g.title}
                          </span>
                          <span className="text-xs md:text-sm" style={{ color: '#8a7560' }}>
                            — {g.subtitle}
                          </span>
                        </div>
                        <div className="mt-1 text-sm" style={{ color: '#5a4632' }}>
                          {total === 0 ? (
                            <span className="italic">no chapters in this book</span>
                          ) : done ? (
                            <span className="font-semibold">Complete · {total} chapters</span>
                          ) : partiallyLocked ? (
                            <span><span className="font-semibold">{openCount} of {total} open</span> — unlock the rest</span>
                          ) : started ? (
                            <span><span className="font-semibold">{reviewed} of {total} read</span></span>
                          ) : (
                            <span>{total} chapters · not started</span>
                          )}
                          {isNext && !done && (
                            <span className="ml-2 uppercase tracking-widest text-[0.65rem] font-semibold" style={{ color: GOLD }}>
                              Next
                            </span>
                          )}
                        </div>
                      </div>

                      {fullyLocked ? <Lock className="h-5 w-5 flex-shrink-0" style={{ color: GOLD }} /> : <ChevronRight className="h-5 w-5 flex-shrink-0" style={{ color: isNext ? GOLD : '#8a7560' }} />}
                    </div>

                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-8 flex items-center justify-center gap-2 text-xs" style={{ color: '#8a7560' }}>
          <BookOpen className="h-3.5 w-3.5" />
          <span>Every choice is reversible. You can jump between groups anytime.</span>
        </div>
      </div>
    </div>
  );
};

export default QuickReadHub;
