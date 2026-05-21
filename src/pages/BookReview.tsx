import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sparkles, AlertCircle, CheckCircle2, ArrowRight, X, Loader2, BookOpen, ShoppingCart,
} from 'lucide-react';
import Navbar from '@/components/Navbar';

interface Issue {
  id: string;
  chapter_id: string;
  chapter_number: number;
  chapter_title: string;
  type: 'typo' | 'name_mismatch' | 'cut_off' | 'double_space' | 'empty_page_2' | 'missing_punctuation';
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
};

const cacheKey = (bookId: string) => `bookReview:${bookId}`;
const dismissedKey = (bookId: string) => `bookReview:dismissed:${bookId}`;

const BookReview = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode'); // 'order' | null
  const forceRescan = searchParams.get('rescan') === '1';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [chaptersScanned, setChaptersScanned] = useState(0);
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = sessionStorage.getItem(dismissedKey(window.location.pathname.split('/')[2] || ''));
      return new Set<string>(raw ? JSON.parse(raw) : []);
    } catch { return new Set(); }
  });

  // Persist dismissed
  useEffect(() => {
    if (!bookId) return;
    try {
      sessionStorage.setItem(dismissedKey(bookId), JSON.stringify(Array.from(dismissed)));
    } catch {}
  }, [bookId, dismissed]);

  useEffect(() => {
    if (!bookId) return;

    // Try to use cached results so returning from the editor doesn't trigger a re-scan.
    if (!forceRescan) {
      try {
        const raw = sessionStorage.getItem(cacheKey(bookId));
        if (raw) {
          const cached = JSON.parse(raw);
          setIssues(cached.issues || []);
          setChaptersScanned(cached.chaptersScanned || 0);
          setLoading(false);
          return;
        }
      } catch {}
    }

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
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
          body: JSON.stringify({ bookId }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.error || 'Review failed');
        const nextIssues: Issue[] = data.issues || [];
        const scanned = data.chaptersScanned || 0;
        setIssues(nextIssues);
        setChaptersScanned(scanned);
        try {
          sessionStorage.setItem(cacheKey(bookId), JSON.stringify({ issues: nextIssues, chaptersScanned: scanned }));
        } catch {}
      } catch (e: any) {
        setError(e.message || 'Something went wrong');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [bookId, forceRescan]);

  const visibleIssues = useMemo(
    () => issues.filter(i => !dismissed.has(i.id)),
    [issues, dismissed],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, { chapter_id: string; chapter_number: number; chapter_title: string; items: Issue[] }>();
    for (const i of visibleIssues) {
      const key = i.chapter_id;
      if (!map.has(key)) {
        map.set(key, { chapter_id: i.chapter_id, chapter_number: i.chapter_number, chapter_title: i.chapter_title, items: [] });
      }
      map.get(key)!.items.push(i);
    }
    return Array.from(map.values()).sort((a, b) => a.chapter_number - b.chapter_number);
  }, [visibleIssues]);

  const issueCount = visibleIssues.length;
  const chaptersWithIssues = grouped.length;

  const handleOrder = () => {
    // Placeholder — order flow not yet implemented.
    alert('Order flow coming soon.');
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
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Review My Book
          </h1>
          <p className="text-muted-foreground mt-1">
            We scan every completed chapter for typos, name mismatches, cut-off sentences, spacing issues, and empty pages.
          </p>
        </div>

        {loading && (
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

        {!loading && error && (
          <Card>
            <CardContent className="py-10 text-center">
              <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
              <p className="text-foreground font-medium">Couldn't complete the review</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
              <Button className="mt-4" onClick={() => window.location.reload()}>Try again</Button>
            </CardContent>
          </Card>
        )}

        {!loading && !error && (
          <>
            {/* Summary */}
            <Card className="mb-6">
              <CardContent className="py-6">
                {chaptersScanned === 0 ? (
                  <div className="flex items-start gap-3">
                    <BookOpen className="h-6 w-6 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground">No completed chapters yet</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Mark chapters as complete to include them in the review.
                      </p>
                    </div>
                  </div>
                ) : issueCount === 0 ? (
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-primary mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground">Your book looks great — no issues found!</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        We scanned {chaptersScanned} completed chapter{chaptersScanned === 1 ? '' : 's'}.
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
                        Scanned {chaptersScanned} completed chapter{chaptersScanned === 1 ? '' : 's'}. Tap "Fix It" to jump to the chapter, or "Ignore" to dismiss.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Issues grouped by chapter */}
            <div className="space-y-4">
              {grouped.map(group => (
                <Card key={group.chapter_id}>
                  <CardContent className="py-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-heading text-lg font-semibold text-foreground">
                        {group.chapter_number > 0 ? `Chapter ${group.chapter_number}: ` : ''}{group.chapter_title}
                      </h3>
                      <Badge variant="secondary">{group.items.length} issue{group.items.length === 1 ? '' : 's'}</Badge>
                    </div>
                    <div className="space-y-3">
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
                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              onClick={() => navigate(`/book/${bookId}/chapter/${issue.chapter_id}?returnTo=${encodeURIComponent(`/book/${bookId}/review${mode ? `?mode=${mode}` : ''}`)}`)}
                            >
                              Fix It <ArrowRight className="h-3.5 w-3.5 ml-1" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDismissed(prev => new Set(prev).add(issue.id))}
                            >
                              <X className="h-3.5 w-3.5 mr-1" /> Ignore
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Order mode footer */}
            {mode === 'order' && (
              <div className="mt-8 sticky bottom-4">
                <Card className="border-primary/40 shadow-lg">
                  <CardContent className="py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground flex items-center gap-2">
                        <ShoppingCart className="h-4 w-4 text-primary" /> Ready to print?
                      </p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {issueCount === 0
                          ? 'No issues found — you\'re good to go.'
                          : 'Fix the issues above for the cleanest print, or order as-is.'}
                      </p>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      {issueCount > 0 && (
                        <Button variant="outline" onClick={() => navigate(`/book/${bookId}`)}>
                          Fix Issues First
                        </Button>
                      )}
                      <Button onClick={handleOrder}>
                        {issueCount > 0 ? 'Order Anyway' : 'Place Order'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BookReview;
