import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle2, BookOpen, Lock, ChevronRight } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { BookLockBanner } from '@/components/BookLockBanner';
import { useBookUnlocked } from '@/hooks/useBookUnlocked';
import { THEME_GROUPS, getGroupSlugForTitle } from '@/data/chapterThemeGroups';
import { usePreviewSets, isInSet } from '@/lib/previewSets';


const CREAM = '#F5F0E8';
const GOLD = '#BBA96A';
const TEAL = 'hsl(187, 82%, 31%)';
const TEAL_SOFT = 'hsl(187, 82%, 31%, 0.08)';
const TEAL_BORDER = 'hsl(187, 82%, 31%, 0.35)';
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

  const isAccessible = (c: Chapter) =>
    unlocked === true
    || isInSet(c.title, sets.trial_readable)
    || isInSet(c.title, sets.trial_editable);

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
            {recipientName ? `${recipientName}'s book — the whole map` : 'Your read-through'}
          </h1>
          <p className="mt-3 text-sm md:text-base leading-relaxed" style={{ color: '#5a4632' }}>
            Every chapter of the book, grouped by theme. Tap the ones that are open to read them and tell us how
            they feel. Locked chapters unlock when you get the full book.
          </p>

          <div className="mt-5 flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(187,169,106,0.2)' }}>
              <div
                className="h-full transition-all duration-500"
                style={{ width: `${totals.total ? (totals.reviewed / totals.total) * 100 : 0}%`, background: GOLD }}
              />
            </div>
            <span className="text-sm font-semibold whitespace-nowrap" style={{ color: '#5a4632' }}>
              {totals.reviewed} of {totals.total} reviewed
            </span>
          </div>
        </div>

        <div className="space-y-8">
          {THEME_GROUPS.map((g, gi) => {
            const list = byGroup.get(g.slug) || [];
            if (list.length === 0) return null;
            const openInGroup = list.filter(isAccessible).length;

            return (
              <section key={g.slug}>
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="uppercase tracking-[0.2em] text-[0.65rem] font-semibold" style={{ color: GOLD }}>
                        Part {gi + 1}
                      </span>
                      <h2 className="font-heading text-xl md:text-2xl font-bold" style={{ color: '#2a1f1a' }}>
                        {g.title}
                      </h2>
                    </div>
                    <p className="text-xs md:text-sm" style={{ color: '#8a7560' }}>{g.subtitle}</p>
                  </div>
                  {!unlocked && (
                    <span className="text-[0.65rem] uppercase tracking-widest whitespace-nowrap" style={{ color: '#8a7560' }}>
                      {openInGroup} of {list.length} open
                    </span>
                  )}
                </div>

                <ul className="rounded-xl overflow-hidden border bg-white/60" style={{ borderColor: 'rgba(187,169,106,0.25)' }}>
                  {list.map((c, ci) => {
                    const accessible = isAccessible(c);
                    const reviewed = !!c.review_status;
                    const onClick = () => {
                      if (accessible) {
                        navigate(`/book/${bookId}/quick-read/${g.slug}?chapterId=${c.id}`);
                      } else {
                        navigate(`/book/${bookId}/unlock`);
                      }
                    };
                    return (
                      <li key={c.id} className={ci > 0 ? 'border-t' : ''} style={{ borderColor: 'rgba(187,169,106,0.2)' }}>
                        <button
                          type="button"
                          onClick={onClick}
                          className="w-full text-left px-4 md:px-5 py-3.5 flex items-center gap-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          style={{
                            background: accessible ? TEAL_SOFT : 'rgba(0,0,0,0.02)',
                            cursor: 'pointer',
                            borderLeft: accessible ? `3px solid ${TEAL}` : '3px solid transparent',
                          }}
                          aria-label={`${c.title}${accessible ? '' : ' — locked'}`}
                        >
                          <div
                            className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold"
                            style={{
                              background: reviewed && accessible ? TEAL : accessible ? '#fff' : 'rgba(0,0,0,0.05)',
                              color: reviewed && accessible ? '#fff' : accessible ? TEAL : '#a89478',
                              border: accessible && !reviewed ? `1.5px solid ${TEAL}` : 'none',
                            }}
                          >
                            {reviewed && accessible ? <CheckCircle2 className="h-4 w-4" /> : c.chapter_number}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div
                              className="font-heading text-base md:text-lg font-semibold truncate"
                              style={{
                                color: accessible ? '#2a1f1a' : '#b8a894',
                              }}
                            >
                              {c.title}
                            </div>
                            {accessible ? (
                              reviewed ? (
                                <div className="text-xs mt-0.5" style={{ color: TEAL }}>
                                  Reviewed · {c.review_status === 'keep' ? 'Kept' : c.review_status === 'add' ? 'Add to it' : 'Rewrite'}
                                </div>
                              ) : (
                                <div className="text-xs mt-0.5" style={{ color: '#5a4632' }}>
                                  Tap to read
                                </div>
                              )
                            ) : (
                              <div className="text-xs mt-0.5" style={{ color: '#b8a894' }}>
                                Locked — unlock the full book
                              </div>
                            )}
                          </div>

                          {accessible ? (
                            <span
                              className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.7rem] font-semibold uppercase tracking-wider"
                              style={{
                                background: TEAL,
                                color: '#fff',
                                border: `1px solid ${TEAL}`,
                              }}
                            >
                              {reviewed ? 'Open' : 'Read'}
                              <ChevronRight className="h-3 w-3" />
                            </span>
                          ) : (
                            <Lock className="h-4 w-4 flex-shrink-0" style={{ color: '#c9b8a4' }} />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        <div className="mt-10 flex items-center justify-center gap-2 text-xs" style={{ color: '#8a7560' }}>
          <BookOpen className="h-3.5 w-3.5" />
          <span>Every choice is reversible. Jump around freely.</span>
        </div>
      </div>
    </div>
  );
};

export default QuickReadHub;
