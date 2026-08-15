import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, PenLine, Camera, Circle, ChevronRight, MessageCircleHeart, CheckCircle2 } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { fetchMemoryInviteChapters } from '@/lib/memoryChapters';

interface Chapter {
  id: string;
  chapter_number: number;
  title: string;
  status: string;
  photo_urls: string[] | null;
  content: string | null;
  seed_content: string | null;
  reference_text: string | null;
  review_status: string | null;
  review_note: string | null;
  is_photo_chapter: boolean | null;
  photo_declined: boolean | null;
  reading_reward_decision: string | null;
}

interface Memory {
  id: string;
  chapter_id: string | null;
}

type PileKey = 'rewrite' | 'photos' | 'memories' | 'kept' | 'short' | 'notyet';

const PILE_META: Record<string, { title: string; subtitle: string; Icon: typeof PenLine }> = {
  rewrite:  { title: 'Needs editing',       subtitle: 'chapters you marked as needing editing', Icon: PenLine },
  photos:   { title: 'Photos & Decisions', subtitle: 'photo spots and the reading-reward decision', Icon: Camera },
  memories: { title: 'Memories',           subtitle: 'chapters that would love a memory', Icon: MessageCircleHeart },
  kept:     { title: 'Kept',               subtitle: 'everything is kept by default', Icon: Circle },
  notyet:   { title: 'Not yet read',       subtitle: 'chapters you have not read through yet', Icon: Circle },
};

const hasReward = (c: Chapter) => /<mark\b/i.test(`${c.seed_content || ''}\n${c.content || ''}`);

const ReviewPile = () => {
  const { bookId, pile: rawPile } = useParams<{ bookId: string; pile: PileKey }>();
  const navigate = useNavigate();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [memoryChapters, setMemoryChapters] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  // "short" was the old name for the Photos & Decisions basket.
  const pile = rawPile === 'short' ? 'photos' : rawPile;

  useEffect(() => {
    if (!bookId) return;
    (async () => {
      const [{ data: chapData }, { data: memData }, inviteChapters] = await Promise.all([
        supabase
          .from('chapters')
          .select('id, chapter_number, title, status, photo_urls, content, seed_content, reference_text, review_status, review_note, is_photo_chapter, photo_declined, reading_reward_decision')
          .eq('book_id', bookId)
          .gt('chapter_number', 0)
          .order('chapter_number'),
        supabase.from('memories').select('id, chapter_id').eq('book_id', bookId).or('entry_type.is.null,entry_type.eq.memory'),
        fetchMemoryInviteChapters(),
      ]);
      setChapters((chapData as Chapter[]) || []);
      setMemories((memData as Memory[]) || []);
      setMemoryChapters(inviteChapters);
      setLoading(false);
    })();
  }, [bookId]);

  const meta = pile && PILE_META[pile] ? PILE_META[pile] : null;

  const hasPhoto = (c: Chapter) => !!(c.photo_urls && c.photo_urls.length > 0);
  const chapterMemoryCount = (c: Chapter) => memories.filter(m => m.chapter_id === c.id).length;

  const list = useMemo(() => {
    if (!meta) return [] as Chapter[];
    switch (pile) {
      case 'rewrite':
        return chapters.filter(c => c.review_status === 'rewrite');
      case 'photos':
        // Pre-populated: every photo chapter plus the reading-reward chapter.
        return chapters.filter(c => c.is_photo_chapter || hasReward(c));
      case 'memories':
        // Pre-populated: the curated memory-invitation chapters.
        return chapters.filter(c => memoryChapters.includes(c.chapter_number));
      case 'kept':
        return chapters.filter(c => c.review_status !== 'add' && c.review_status !== 'rewrite');
      case 'notyet':
        return chapters.filter(c => !c.review_status);
      default:
        return [];
    }
  }, [chapters, memories, memoryChapters, pile, meta]);

  const doneFor = (c: Chapter): string | null => {
    if (pile === 'photos') {
      const photoOk = !c.is_photo_chapter || hasPhoto(c) || !!c.photo_declined;
      const rewardOk = !hasReward(c) || !!c.reading_reward_decision;
      return photoOk && rewardOk ? 'Handled' : null;
    }
    if (pile === 'memories') return chapterMemoryCount(c) > 0 ? 'Memory added' : null;
    return null;
  };

  const waitingFor = (c: Chapter): string => {
    if (pile === 'photos') {
      const needsPhoto = c.is_photo_chapter && !hasPhoto(c) && !c.photo_declined;
      const needsReward = hasReward(c) && !c.reading_reward_decision;
      if (needsPhoto && needsReward) return 'A photo and a reading-reward choice';
      if (needsPhoto) return 'Waiting for a photo (or skip it)';
      if (needsReward) return 'Waiting for your reading-reward choice';
      return 'Nothing left here';
    }
    if (pile === 'memories') return 'A memory would sit beautifully here';
    if (pile === 'add') return c.review_note ? `You wanted to add: ${c.review_note}` : 'You marked this one to add to';
    if (pile === 'rewrite') return 'You marked this one as needing editing';
    return '';
  };

  const openChapter = (c: Chapter) => {
    if (pile === 'notyet') {
      navigate(`/book/${bookId}/overview#ch-${c.chapter_number}`);
      return;
    }
    const returnTo = encodeURIComponent(`/book/${bookId}/pile/${rawPile}`);
    const returnLabel = encodeURIComponent(meta?.title || 'basket');
    const extra = pile === 'photos' ? '&focus=photo' : pile === 'memories' ? '&memory=1' : '';
    navigate(`/book/${bookId}/chapter/${c.id}?returnTo=${returnTo}&returnLabel=${returnLabel}${extra}`);
  };

  if (!meta) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <p className="text-muted-foreground">Unknown basket.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(`/book/${bookId}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to dashboard
          </Button>
        </div>
      </div>
    );
  }

  const { Icon, title, subtitle } = meta;
  const openCount = list.filter(c => !doneFor(c)).length;

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
          <span className="font-heading text-2xl font-bold text-muted-foreground">{openCount}</span>
        </div>
        <p className="text-sm text-muted-foreground mb-6">{subtitle} — all optional, nothing blocks printing.</p>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : list.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <p className="text-muted-foreground">
              {pile === 'add'
                ? 'Nothing here yet — mark “Add to it” while you read and it lands here.'
                : pile === 'rewrite'
                  ? 'Nothing here yet — mark “Replace” while you read and it lands here.'
                  : 'All done here — nothing left in this basket.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {list.map((c) => {
              const done = doneFor(c);
              return (
                <li key={c.id} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                  <button
                    type="button"
                    onClick={() => openChapter(c)}
                    className={`w-full text-left group px-4 py-4 flex items-center justify-between gap-4 hover:bg-muted/40 transition-colors ${done ? 'opacity-60' : ''}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-muted-foreground">Chapter {c.chapter_number}</div>
                      <div className="font-heading text-base font-semibold text-foreground truncate">{c.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {done || waitingFor(c)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {done ? (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      ) : (
                        <span className="text-sm font-medium text-primary group-hover:text-primary/80 hidden sm:inline">
                          Work on it
                        </span>
                      )}
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ReviewPile;
