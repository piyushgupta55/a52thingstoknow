import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sparkles, AlertCircle, CheckCircle2, ArrowRight, Loader2, BookOpen,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import PrePrintGate from '@/components/review/PrePrintGate';

interface Issue {
  id: string;
  chapter_id: string;
  chapter_number: number;
  chapter_title: string;
  type: 'typo' | 'name_mismatch' | 'cut_off' | 'double_space' | 'empty_page_2' | 'missing_punctuation' | 'reads_oddly';
  snippet: string;
  message: string;
}

const TYPE_LABEL: Record<Issue['type'], string> = {
  typo: 'Typo',
  missing_punctuation: 'Missing punctuation',
  name_mismatch: 'Name mismatch',
  cut_off: 'Cut-off sentence',
  double_space: 'Extra spacing',
  empty_page_2: 'Empty Page 2',
  reads_oddly: 'Worth a look',
};


const cacheKey = (bookId: string) => `bookReview:${bookId}`;
const chapterIssuesKey = (chapterId: string) => `bookReview:chapterIssues:${chapterId}`;

const callReview = async (bookId: string, chapterId?: string) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/book-review`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ bookId, ...(chapterId ? { chapterId } : {}) }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error || 'Review failed');
  return data as { chaptersScanned: number; issues: Issue[] };
};

const BookReview = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = searchParams.get('mode'); // 'order' | null
  const orderMode = mode === 'order';
  const forceRescan = searchParams.get('rescan') !== null && searchParams.get('rescan') !== '';
  const rescanChapter = searchParams.get('rescanChapter');

  const [loading, setLoading] = useState(true);
  const [rescanning, setRescanning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [copyReady, setCopyReady] = useState(false);
  const [chaptersScanned, setChaptersScanned] = useState(0);

  // Persist current issues so we can return to the same report after Fix It.
  useEffect(() => {
    if (!bookId || loading) return;
    try {
      sessionStorage.setItem(
        cacheKey(bookId),
        JSON.stringify({ issues, chaptersScanned }),
      );
    } catch {}
  }, [bookId, issues, chaptersScanned, loading]);

  // Initial load: cache first, otherwise full scan.
  // In order mode the scan never blocks the screen — the approval gate renders
  // immediately and the copy-check row fills in when the scan lands.
  useEffect(() => {
    if (!bookId) return;
    // Targeted re-scan path runs in its own effect; don't load here.
    if (rescanChapter) return;

    if (!forceRescan) {
      try {
        const raw = sessionStorage.getItem(cacheKey(bookId));
        if (raw) {
          const cached = JSON.parse(raw);
          setIssues(cached.issues || []);
          setChaptersScanned(cached.chaptersScanned || 0);
          setCopyReady(true);
          setLoading(false);
          return;
        }
      } catch {}
    }

    const run = async () => {
      if (!orderMode) setLoading(true);
      setCopyReady(false);
      setError(null);
      try {
        const data = await callReview(bookId);
        setIssues(data.issues || []);
        setChaptersScanned(data.chaptersScanned || 0);
        setCopyReady(true);
      } catch (e: any) {
        if (!orderMode) setError(e.message || 'Something went wrong');
      } finally {
        setLoading(false);
      }
    };
    if (orderMode) setLoading(false);
    run();
  }, [bookId, forceRescan, rescanChapter, orderMode]);

  // Targeted re-scan after returning from Fix It on a specific chapter.
  useEffect(() => {
    if (!bookId || !rescanChapter) return;

    // Seed from cache so the rest of the report stays visible while we scan.
    try {
      const raw = sessionStorage.getItem(cacheKey(bookId));
      if (raw) {
        const cached = JSON.parse(raw);
        setIssues(cached.issues || []);
        setChaptersScanned(cached.chaptersScanned || 0);
      }
    } catch {}
    setLoading(false);
    setRescanning(rescanChapter);

    (async () => {
      try {
        const data = await callReview(bookId, rescanChapter);
        const fresh = data.issues || [];
        setIssues(prev => {
          const others = prev.filter(i => i.chapter_id !== rescanChapter);
          return [...others, ...fresh].sort((a, b) => a.chapter_number - b.chapter_number);
        });
      } catch (e: any) {
        setError(e.message || 'Re-scan failed');
      } finally {
        setRescanning(null);
        // Clean up so leaving and returning doesn't re-trigger.
        try { sessionStorage.removeItem(chapterIssuesKey(rescanChapter)); } catch {}
        const next = new URLSearchParams(searchParams);
        next.delete('rescanChapter');
        setSearchParams(next, { replace: true });
      }
    })();
  }, [bookId, rescanChapter]); // eslint-disable-line react-hooks/exhaustive-deps

  const grouped = useMemo(() => {
    const map = new Map<string, { chapter_id: string; chapter_number: number; chapter_title: string; items: Issue[] }>();
    for (const i of issues) {
      const key = i.chapter_id;
      if (!map.has(key)) {
        map.set(key, { chapter_id: i.chapter_id, chapter_number: i.chapter_number, chapter_title: i.chapter_title, items: [] });
      }
      map.get(key)!.items.push(i);
    }
    return Array.from(map.values()).sort((a, b) => a.chapter_number - b.chapter_number);
  }, [issues]);

  const issueCount = issues.length;
  const chaptersWithIssues = grouped.length;

  const handleFixIt = (group: { chapter_id: string; items: Issue[] }) => {
    // Stash every issue for this chapter so the editor can highlight them all.
    try {
      sessionStorage.setItem(
        chapterIssuesKey(group.chapter_id),
        JSON.stringify(group.items),
      );
    } catch {}
    const returnTo = `/book/${bookId}/review?rescanChapter=${group.chapter_id}${mode ? `&mode=${mode}` : ''}`;
    navigate(`/book/${bookId}/chapter/${group.chapter_id}?returnTo=${encodeURIComponent(returnTo)}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <button
            onClick={() => navigate(`/book/${bookId}`)}
            className="text-sm text-muted-foreground hover:text-foreground mb-3"
          >
            ← Back to dashboard
          </button>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                {orderMode ? 'Before you print' : 'Review My Book'}
              </h1>
              <p className="text-muted-foreground mt-1">
                {orderMode
                  ? "Here's everything still open in your book. None of it has to be finished — this is just so nothing surprises you in print."
                  : 'We scan every chapter for typos, name mismatches, cut-off sentences, spacing issues, and empty pages.'}
              </p>
            </div>
            {!loading && !orderMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!bookId) return;
                  try { sessionStorage.removeItem(cacheKey(bookId)); } catch {}
                  const params = new URLSearchParams(searchParams);
                  params.set('rescan', String(Date.now()));
                  params.delete('rescanChapter');
                  navigate(`/book/${bookId}/review?${params.toString()}`, { replace: true });
                  window.location.reload();
                }}
              >
                Re-scan All
              </Button>
            )}
          </div>
        </div>

        {orderMode && bookId && (
          <PrePrintGate
            bookId={bookId}
            copyIssues={copyReady ? issues : null}
            copyLoading={!copyReady && !error}
            onCleanedUp={() => {
              try { sessionStorage.removeItem(cacheKey(bookId)); } catch {}
              setIssues(prev => prev.filter(i => i.type !== 'double_space'));
            }}
          />
        )}

        {!orderMode && loading && (
          <Card>
            <CardContent className="py-16 flex flex-col items-center gap-4 text-center">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <div>
                <p className="font-medium text-foreground">Reviewing your book…</p>
                <p className="text-sm text-muted-foreground mt-1">This usually takes a few seconds.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {!orderMode && !loading && error && (
          <Card>
            <CardContent className="py-10 text-center">
              <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
              <p className="text-foreground font-medium">Couldn't complete the review</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
              <Button className="mt-4" onClick={() => window.location.reload()}>Try again</Button>
            </CardContent>
          </Card>
        )}

        {!orderMode && !loading && !error && (
          <>
            {/* Summary */}
            <Card className="mb-6">
              <CardContent className="py-6">
                {chaptersScanned === 0 ? (
                  <div className="flex items-start gap-3">
                    <BookOpen className="h-6 w-6 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground">Nothing to scan yet</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Add some writing to your chapters — then we'll check them for you.
                      </p>
                    </div>
                  </div>
                ) : issueCount === 0 ? (
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-primary mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground">Your book looks great — no issues found!</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        We scanned {chaptersScanned} chapter{chaptersScanned === 1 ? '' : 's'}.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-6 w-6 text-accent mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground">
                        {issueCount} issue{issueCount === 1 ? '' : 's'} found across {chaptersWithIssues} chapter{chaptersWithIssues === 1 ? '' : 's'}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Scanned {chaptersScanned} chapter{chaptersScanned === 1 ? '' : 's'}. Tap "Fix It" to open the chapter with every flag highlighted — we'll re-check it automatically when you return.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Issues grouped by chapter */}
            <div className="space-y-4">
              {grouped.map(group => {
                const isRescanning = rescanning === group.chapter_id;
                return (
                <Card key={group.chapter_id} className={isRescanning ? 'opacity-60' : ''}>
                  <CardContent className="py-5">
                    <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                      <h3 className="font-heading text-lg font-semibold text-foreground">
                        {group.chapter_number > 0 ? `Chapter ${group.chapter_number}: ` : ''}{group.chapter_title}
                      </h3>
                      <div className="flex items-center gap-2">
                        {isRescanning && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Re-checking…
                          </span>
                        )}
                        <Badge variant="secondary">{group.items.length} issue{group.items.length === 1 ? '' : 's'}</Badge>
                      </div>
                    </div>
                    <div className="space-y-3 mb-4">
                      {group.items.map(issue => (
                        <div key={issue.id} className="border border-border rounded-lg p-4 bg-muted/30">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <Badge variant="outline" className="text-xs">{TYPE_LABEL[issue.type]}</Badge>
                          </div>
                          <p className="text-sm text-foreground mb-1">{issue.message}</p>
                          {issue.snippet && (
                            <p className="text-sm text-muted-foreground italic border-l-2 border-border pl-3 mt-2">
                              "{issue.snippet}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleFixIt(group)}
                      disabled={isRescanning}
                    >
                      Fix It <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              );})}
            </div>

          </>
        )}
      </div>
    </div>
  );
};

export default BookReview;
