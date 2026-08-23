import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  AlertTriangle, CheckCircle2, Loader2, ImageOff, FileText, Sparkles,
  ArrowRight, ShoppingCart, Wand2,
} from 'lucide-react';
import { fetchOpenPassageChapters } from '@/lib/passageVariants';

// The pre-print approval gate. It shows, it never blocks: nothing here
// prevents the author from ordering. Its job is to make sure they had the
// chance to see what was still open, and to record what they were shown.

interface ChapterRow {
  id: string;
  chapter_number: number;
  title: string;
  content: string | null;
  reference_text: string | null;
  seed_content: string | null;
  photo_urls: string[] | null;
  is_photo_chapter: boolean | null;
  photo_declined: boolean | null;
  reading_reward_decision: string | null;
  review_status: string | null;
  read_at: string | null;
  template_key: string | null;
}

export interface CopyIssue {
  id: string;
  chapter_id: string;
  type: string;
}

type PrintProblem = {
  key: string;
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
  kind: 'empty_chapter' | 'broken_image' | 'low_res_image';
  detail: string;
};

const wordCount = (s: string | null | undefined) =>
  s ? s.replace(/[—–]/g, ' ').trim().split(/\s+/).filter(Boolean).length : 0;

const MIN_LONG_EDGE = 1200;
const MIN_SHORT_EDGE = 800;

const inspectImage = (url: string) =>
  new Promise<{ url: string; ok: boolean; w: number; h: number }>(resolve => {
    const img = new Image();
    img.onload = () => resolve({ url, ok: true, w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ url, ok: false, w: 0, h: 0 });
    img.src = url;
  });

const chapterLabel = (n: number, title: string) =>
  n > 0 ? `Chapter ${n}: ${title}` : title;

interface Props {
  bookId: string;
  /** Copy-check issues from the book-review function; null while still running. */
  copyIssues: CopyIssue[] | null;
  copyLoading: boolean;
  onCleanedUp: () => void;
}

const PrePrintGate = ({ bookId, copyIssues, copyLoading, onCleanedUp }: Props) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [bookStatus, setBookStatus] = useState<string | null>(null);
  const [approvedAt, setApprovedAt] = useState<string | null>(null);
  const [openPassageKeys, setOpenPassageKeys] = useState<Set<string>>(new Set());
  const [imageProblems, setImageProblems] = useState<PrintProblem[]>([]);
  const [imagesChecking, setImagesChecking] = useState(true);
  const [approving, setApproving] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  const load = useCallback(async () => {
    const { data: book } = await supabase
      .from('books')
      .select('id, gender, status')
      .eq('id', bookId)
      .single();

    const { data: chs } = await supabase
      .from('chapters')
      .select('id, chapter_number, title, content, reference_text, seed_content, photo_urls, is_photo_chapter, photo_declined, reading_reward_decision, review_status, read_at, template_key')
      .eq('book_id', bookId)
      .order('chapter_number');

    const { data: approval } = await supabase
      .from('book_print_approvals')
      .select('approved_at')
      .eq('book_id', bookId)
      .order('approved_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let openKeys = new Set<string>();
    if (book?.gender) {
      try { openKeys = await fetchOpenPassageChapters(bookId, book.gender); } catch { /* non-fatal */ }
    }

    if (!mounted.current) return;
    setBookStatus(book?.status ?? null);
    setApprovedAt(approval?.approved_at ?? null);
    setChapters((chs || []) as ChapterRow[]);
    setOpenPassageKeys(openKeys);
    setLoading(false);
  }, [bookId]);

  useEffect(() => { load(); }, [load]);

  // Image checks run in the browser after the page is already on screen.
  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    (async () => {
      setImagesChecking(true);
      const jobs: { ch: ChapterRow; url: string }[] = [];
      chapters.forEach(ch => (ch.photo_urls || []).forEach(url => jobs.push({ ch, url })));
      const found: PrintProblem[] = [];
      for (let i = 0; i < jobs.length; i += 4) {
        const batch = jobs.slice(i, i + 4);
        const results = await Promise.all(batch.map(j => inspectImage(j.url)));
        results.forEach((r, idx) => {
          const { ch } = batch[idx];
          if (!r.ok) {
            found.push({
              key: `broken_${ch.id}_${idx}_${i}`,
              chapterId: ch.id, chapterNumber: ch.chapter_number, chapterTitle: ch.title,
              kind: 'broken_image',
              detail: "This photo can't be loaded — it would print as a blank frame.",
            });
            return;
          }
          const longEdge = Math.max(r.w, r.h);
          const shortEdge = Math.min(r.w, r.h);
          if (longEdge < MIN_LONG_EDGE || shortEdge < MIN_SHORT_EDGE) {
            found.push({
              key: `lowres_${ch.id}_${idx}_${i}`,
              chapterId: ch.id, chapterNumber: ch.chapter_number, chapterTitle: ch.title,
              kind: 'low_res_image',
              detail: `This photo is ${r.w}×${r.h}px — below the ${MIN_LONG_EDGE}×${MIN_SHORT_EDGE}px we recommend, so it may look soft in print.`,
            });
          }
        });
        if (cancelled) return;
      }
      if (cancelled || !mounted.current) return;
      setImageProblems(found);
      setImagesChecking(false);
    })();
    return () => { cancelled = true; };
  }, [loading, chapters]);

  const numbered = useMemo(() => chapters.filter(c => c.chapter_number > 0), [chapters]);

  // ── Tier 1: would damage the printed book ──────────────────────────────
  const emptyChapters = useMemo<PrintProblem[]>(
    () => chapters
      .filter(c => wordCount(c.content) < 5)
      .map(c => ({
        key: `empty_${c.id}`,
        chapterId: c.id, chapterNumber: c.chapter_number, chapterTitle: c.title,
        kind: 'empty_chapter' as const,
        detail: 'This chapter has no writing on page 2 — it would print as a blank page.',
      })),
    [chapters],
  );

  const tier1 = useMemo(
    () => [...emptyChapters, ...imageProblems].sort((a, b) => a.chapterNumber - b.chapterNumber),
    [emptyChapters, imageProblems],
  );

  // ── Tier 2: the copy check ─────────────────────────────────────────────
  // Empty pages are already reported in Tier 1, so they don't count twice.
  const copyCount = (copyIssues || []).filter(i => i.type !== 'empty_page_2').length;
  const mechanical = (copyIssues || []).filter(i => i.type === 'double_space');

  // ── Tier 3: what they left open ────────────────────────────────────────
  const neverRead = numbered.filter(c => !c.read_at).length;
  const openPhotoSpots = numbered.filter(
    c => c.is_photo_chapter && !(c.photo_urls && c.photo_urls.length > 0) && !c.photo_declined,
  ).length;
  const flagged = chapters.filter(c => c.review_status === 'rewrite').length;
  const openRewards = numbered.filter(
    c => /<mark\b/i.test(`${c.seed_content || ''}\n${c.content || ''}`) && !c.reading_reward_decision,
  ).length;
  const openPassages = numbered.filter(c => c.template_key && openPassageKeys.has(c.template_key)).length;

  const tier3: { label: string; count: number; to: string }[] = [
    { label: 'chapters you haven\u2019t opened yet', count: neverRead, to: `/book/${bookId}/preview?review=1` },
    { label: 'photo spots still empty', count: openPhotoSpots, to: `/book/${bookId}/review-pile` },
    { label: 'chapters flagged for editing', count: flagged, to: `/book/${bookId}/review-pile` },
    { label: 'reading reward decisions', count: openRewards, to: `/book/${bookId}/review-pile` },
    { label: 'optional passage decisions', count: openPassages, to: `/book/${bookId}/review-pile` },
  ].filter(r => r.count > 0);

  const handleCleanUp = async () => {
    const ids = Array.from(new Set(mechanical.map(i => i.chapter_id)));
    if (ids.length === 0) return;
    setCleaning(true);
    try {
      const targets = chapters.filter(c => ids.includes(c.id));
      await Promise.all(targets.map(c => {
        const squash = (s: string | null) =>
          s == null ? s : s.split('\n').map(line => line.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+$/g, '')).join('\n');
        return supabase
          .from('chapters')
          .update({ content: squash(c.content), reference_text: squash(c.reference_text) })
          .eq('id', c.id);
      }));
      toast({ title: 'Cleaned up', description: `Extra spacing removed in ${targets.length} chapter${targets.length === 1 ? '' : 's'}.` });
      await load();
      onCleanedUp();
    } catch (e: any) {
      toast({ title: "Couldn't clean up", description: e.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setCleaning(false);
    }
  };

  const buildSnapshot = () => ({
    version: 1,
    captured_at: new Date().toISOString(),
    print_problems: tier1.map(p => ({
      kind: p.kind, chapter_id: p.chapterId, chapter_number: p.chapterNumber,
      chapter_title: p.chapterTitle, detail: p.detail,
    })),
    copy_check: {
      status: copyLoading ? 'running' : copyIssues ? 'complete' : 'unavailable',
      count: copyCount,
      by_type: (copyIssues || []).reduce<Record<string, number>>((acc, i) => {
        acc[i.type] = (acc[i.type] || 0) + 1; return acc;
      }, {}),
    },
    left_open: {
      chapters_never_opened: neverRead,
      empty_photo_spots: openPhotoSpots,
      chapters_flagged: flagged,
      open_reward_decisions: openRewards,
      open_passage_decisions: openPassages,
    },
    totals: {
      chapters: chapters.length,
      chapters_with_photos: chapters.filter(c => (c.photo_urls || []).length > 0).length,
      images_checked: imagesChecking ? null : chapters.reduce((n, c) => n + (c.photo_urls || []).length, 0),
    },
  });

  const handleApprove = async () => {
    setApproving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const snapshot = buildSnapshot();
      const { error: insErr } = await supabase
        .from('book_print_approvals')
        .insert({ book_id: bookId, user_id: user?.id, snapshot });
      if (insErr) throw insErr;
      const { error: upErr } = await supabase
        .from('books')
        .update({ status: 'approved_for_print' })
        .eq('id', bookId);
      if (upErr) throw upErr;
      setBookStatus('approved_for_print');
      setApprovedAt(snapshot.captured_at);
      toast({ title: 'Approved for print', description: 'We\u2019ve saved exactly what was open when you approved.' });
    } catch (e: any) {
      toast({ title: "Couldn't record your approval", description: e.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-7 w-7 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Checking your book…</p>
        </CardContent>
      </Card>
    );
  }

  const approved = bookStatus === 'approved_for_print';

  return (
    <div className="space-y-6">
      {/* Tier 1 */}
      <Card className={tier1.length > 0 ? 'border-destructive/40' : undefined}>
        <CardContent className="py-6">
          <div className="flex items-start gap-3">
            {tier1.length > 0
              ? <AlertTriangle className="h-6 w-6 text-destructive mt-0.5 shrink-0" />
              : <CheckCircle2 className="h-6 w-6 text-primary mt-0.5 shrink-0" />}
            <div className="flex-1">
              <p className="font-semibold text-foreground">
                {tier1.length > 0
                  ? `${tier1.length} thing${tier1.length === 1 ? '' : 's'} that would show up in the printed book`
                  : 'Nothing found that would damage the printed book'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {tier1.length > 0
                  ? 'Blank pages and photo problems are the ones worth fixing before you print. You can still order as-is.'
                  : imagesChecking
                    ? 'Still checking your photos…'
                    : 'No blank pages, and every photo loads at print quality.'}
              </p>

              {tier1.length > 0 && (
                <div className="mt-4 space-y-2">
                  {tier1.map(p => (
                    <div key={p.key} className="flex items-start justify-between gap-3 border border-border rounded-lg p-3 bg-muted/30">
                      <div className="flex items-start gap-2 min-w-0">
                        {p.kind === 'empty_chapter'
                          ? <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          : <ImageOff className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {chapterLabel(p.chapterNumber, p.chapterTitle)}
                          </p>
                          <p className="text-sm text-muted-foreground">{p.detail}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => navigate(`/book/${bookId}/chapter/${p.chapterId}?returnTo=${encodeURIComponent(`/book/${bookId}/review?mode=order`)}`)}
                      >
                        Fix <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tier 2 — a count and a link, never a list */}
      <Card>
        <CardContent className="py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-foreground">
                {copyLoading
                  ? 'Reading through your writing…'
                  : !copyIssues
                    ? "We couldn't finish the copy check"
                    : copyCount === 0
                      ? 'No copy suggestions — your writing reads clean'
                      : `${copyCount} small copy suggestion${copyCount === 1 ? '' : 's'} — take a look.`}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {copyLoading
                  ? 'This runs in the background — you don\u2019t have to wait for it.'
                  : 'Typos, spacing and punctuation. None of these stop you printing.'}
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {mechanical.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleCleanUp} disabled={cleaning}>
                {cleaning ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 mr-1" />}
                Clean these up
              </Button>
            )}
            {!copyLoading && copyCount > 0 && (
              <Button size="sm" variant="secondary" onClick={() => navigate(`/book/${bookId}/review`)}>
                Take a look
              </Button>
            )}
            {copyLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground self-center" />}
          </div>
        </CardContent>
      </Card>

      {/* Tier 3 — optional */}
      {tier3.length > 0 && (
        <Card>
          <CardContent className="py-6">
            <p className="font-semibold text-foreground">What you left open</p>
            <p className="text-sm text-muted-foreground mt-1">
              All optional. Plenty of finished books have some of these.
            </p>
            <div className="mt-4 space-y-2">
              {tier3.map(row => (
                <div key={row.label} className="flex items-center justify-between gap-3 border border-border rounded-lg px-3 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="secondary" className="shrink-0">{row.count}</Badge>
                    <span className="text-sm text-foreground truncate">{row.label}</span>
                  </div>
                  <button
                    className="text-sm text-primary hover:underline shrink-0"
                    onClick={() => navigate(row.to)}
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* The accept */}
      <Card className="border-primary/40 shadow-lg">
        <CardContent className="py-6">
          {approved ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-primary mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">Approved for print</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {approvedAt ? `You approved this on ${new Date(approvedAt).toLocaleString()}.` : 'Your approval is recorded.'}
                    {' '}We saved a record of everything that was open at that moment.
                  </p>
                </div>
              </div>
              <Button className="shrink-0" onClick={() => navigate(`/book/${bookId}/checkout`)}>
                <ShoppingCart className="h-4 w-4 mr-1.5" /> Continue to checkout
              </Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-foreground">Ready when you are</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Nothing above has to be finished. When you approve, we record exactly what was open.
                </p>
              </div>
              <Button size="lg" className="shrink-0" onClick={handleApprove} disabled={approving}>
                {approving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Yes, print it as it is
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PrePrintGate;
