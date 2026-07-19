import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Heart, Plus, PenLine, Camera, Circle, ChevronRight } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { toast } from 'sonner';

interface Chapter {
  id: string;
  chapter_number: number;
  title: string;
  status: string;
  photo_urls: string[] | null;
  content: string | null;
  reference_text: string | null;
  review_status: string | null;
}

interface Memory {
  id: string;
  chapter_id: string | null;
}

type PileKey = 'kept' | 'add' | 'rewrite' | 'short' | 'notyet';
type ReviewChoice = 'keep' | 'add' | 'rewrite';

const PILE_META: Record<PileKey, { title: string; subtitle: string; Icon: typeof Heart }> = {
  kept:    { title: 'Kept',       subtitle: 'tap a chapter to open it and keep working', Icon: Heart },
  add:     { title: 'To add to',  subtitle: 'tap a chapter to open it and add your words', Icon: Plus },
  rewrite: { title: 'To rewrite', subtitle: 'tap a chapter to open it and rewrite', Icon: PenLine },
  short:   { title: 'Short ones', subtitle: 'tap a chapter to open it and add a photo or memory', Icon: Camera },
  notyet:  { title: 'Not yet',    subtitle: 'waiting for you',                           Icon: Circle },
};

const SHORT_WORD_THRESHOLD = 180;

const ReviewPile = () => {
  const { bookId, pile } = useParams<{ bookId: string; pile: PileKey }>();
  const navigate = useNavigate();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!bookId) return;
    (async () => {
      const [{ data: chapData }, { data: memData }] = await Promise.all([
        supabase
          .from('chapters')
          .select('id, chapter_number, title, status, photo_urls, content, reference_text, review_status')
          .eq('book_id', bookId)
          .gt('chapter_number', 0)
          .order('chapter_number'),
        supabase.from('memories').select('id, chapter_id').eq('book_id', bookId).or('entry_type.is.null,entry_type.eq.memory'),
      ]);
      setChapters((chapData as Chapter[]) || []);
      setMemories((memData as Memory[]) || []);
      setLoading(false);
    })();
  }, [bookId]);

  const meta = pile && PILE_META[pile] ? PILE_META[pile] : null;

  const list = useMemo(() => {
    if (!meta) return [] as Chapter[];
    switch (pile) {
      case 'kept':
        return chapters.filter(c => c.review_status === 'keep' && c.status !== 'complete');
      case 'add':
        return chapters.filter(c => c.review_status === 'add' && c.status !== 'complete');
      case 'rewrite':
        return chapters.filter(c => c.review_status === 'rewrite' && c.status !== 'complete');
      case 'short':
        return chapters.filter(c => {
          if (c.review_status !== 'keep' || c.status === 'complete') return false;
          const text = `${c.reference_text || ''} ${c.content || ''}`.trim();
          const wc = text ? text.split(/\s+/).length : 0;
          const hasPhoto = c.photo_urls && c.photo_urls.length > 0;
          const hasMemory = memories.some(m => m.chapter_id === c.id);
          return wc < SHORT_WORD_THRESHOLD && !hasPhoto && !hasMemory;
        });
      case 'notyet':
        return chapters.filter(c => !c.review_status && c.status !== 'complete');
      default:
        return [];
    }
  }, [chapters, memories, pile, meta]);

  const openChapter = (c: Chapter) => {
    if (pile === 'notyet') {
      navigate(`/book/${bookId}/quick-read?chapterId=${c.id}`);
    } else {
      const returnTo = encodeURIComponent(`/book/${bookId}/pile/${pile}`);
      const returnLabel = encodeURIComponent(meta?.title || 'pile');
      navigate(`/book/${bookId}/chapter/${c.id}?returnTo=${returnTo}&returnLabel=${returnLabel}`);
    }
  };

  const changeChoice = async (c: Chapter, choice: ReviewChoice) => {
    if (c.review_status === choice) return;
    setUpdatingId(c.id);
    const prev = c.review_status;
    setChapters(list => list.map(x => x.id === c.id ? { ...x, review_status: choice } : x));
    const { error } = await supabase
      .from('chapters')
      .update({ review_status: choice })
      .eq('id', c.id);
    setUpdatingId(null);
    if (error) {
      setChapters(list => list.map(x => x.id === c.id ? { ...x, review_status: prev } : x));
      toast.error("Couldn't update — try again");
      return;
    }
    const label = choice === 'keep' ? 'Kept' : choice === 'add' ? 'To add to' : 'To rewrite';
    toast.success(`Moved to ${label}`);
  };

  if (!meta) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <p className="text-muted-foreground">Unknown pile.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(`/book/${bookId}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to dashboard
          </Button>
        </div>
      </div>
    );
  }

  const { Icon, title, subtitle } = meta;
  const showChoiceControls = pile === 'kept' || pile === 'add' || pile === 'rewrite';

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
          onClick={() => navigate(`/book/${bookId}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to dashboard
        </Button>

        <div className="flex items-center gap-3 mb-1">
          <Icon className="h-6 w-6 text-primary" />
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">{title}</h1>
          <span className="font-heading text-2xl font-bold text-muted-foreground">{list.length}</span>
        </div>
        <p className="text-sm text-muted-foreground mb-6">{subtitle}</p>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : list.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <p className="text-muted-foreground">All done here — nothing left in this pile.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {list.map((c) => {
              const isUpdating = updatingId === c.id;
              return (
                <li
                  key={c.id}
                  className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => openChapter(c)}
                    className="w-full text-left group px-4 py-4 flex items-center justify-between gap-4 hover:bg-muted/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-muted-foreground">Chapter {c.chapter_number}</div>
                      <div className="font-heading text-base font-semibold text-foreground truncate">
                        {c.title}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-medium text-primary group-hover:text-primary/80 hidden sm:inline">
                        Work on it
                      </span>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </button>

                  {showChoiceControls && (
                    <div className="px-4 pb-4 pt-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground mr-1">Change choice:</span>
                        <ChoiceChip
                          active={c.review_status === 'keep'}
                          disabled={isUpdating}
                          onClick={() => changeChoice(c, 'keep')}
                          Icon={Heart}
                          label="Keep"
                        />
                        <ChoiceChip
                          active={c.review_status === 'add'}
                          disabled={isUpdating}
                          onClick={() => changeChoice(c, 'add')}
                          Icon={Plus}
                          label="Add to it"
                        />
                        <ChoiceChip
                          active={c.review_status === 'rewrite'}
                          disabled={isUpdating}
                          onClick={() => changeChoice(c, 'rewrite')}
                          Icon={PenLine}
                          label="Rewrite"
                        />
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

function ChoiceChip({
  active,
  disabled,
  onClick,
  Icon,
  label,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  Icon: typeof Heart;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors',
        active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-background text-foreground border-border hover:bg-muted',
        disabled ? 'opacity-60 cursor-not-allowed' : '',
      ].join(' ')}
      aria-pressed={active}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

export default ReviewPile;
