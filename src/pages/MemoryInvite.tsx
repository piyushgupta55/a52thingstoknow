import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Heart, CheckCircle2, Loader2, Plus, X } from 'lucide-react';

interface InviteContext {
  book_id: string;
  recipient_name: string;
  author_name: string;
}

type EntryType = 'memory' | 'wisdom';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MemoryInvite = () => {
  const { token } = useParams<{ token: string }>();
  const [ctx, setCtx] = useState<InviteContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [memories, setMemories] = useState<string[]>(['']);
  const [wisdoms, setWisdoms] = useState<string[]>(['']);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { data, error } = await supabase.rpc('get_invite_context', { _token: token });
        if (error) throw error;
        if (!data || data.length === 0) setError("This invite link isn't valid anymore.");
        else setCtx(data[0] as InviteContext);
      } catch (err: any) {
        setError(err?.message || 'Could not load this invite.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const updateEntry = (list: string[], setter: (l: string[]) => void, i: number, v: string) => {
    const next = [...list]; next[i] = v; setter(next);
  };
  const addEntry = (list: string[], setter: (l: string[]) => void) => setter([...list, '']);
  const removeEntry = (list: string[], setter: (l: string[]) => void, i: number) => {
    if (list.length === 1) { setter(['']); return; }
    setter(list.filter((_, idx) => idx !== i));
  };

  const hasAnyEntry =
    memories.some(t => t.trim().length > 0) || wisdoms.some(t => t.trim().length > 0);
  const emailValid = emailRegex.test(fromEmail.trim());
  const canSubmit = fromName.trim().length > 0 && emailValid && hasAnyEntry && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !token || !ctx) return;
    setSubmitting(true);
    setSubmitError(null);

    const entries: { type: EntryType; text: string }[] = [
      ...memories.filter(t => t.trim().length > 0).map(t => ({ type: 'memory' as const, text: t.trim() })),
      ...wisdoms.filter(t => t.trim().length > 0).map(t => ({ type: 'wisdom' as const, text: t.trim() })),
    ];

    const { error } = await supabase.rpc('submit_family_contributions', {
      _token: token,
      _from_name: fromName.trim(),
      _from_email: fromEmail.trim(),
      _entries: entries,
    });

    if (error) {
      setSubmitting(false);
      setSubmitError(error.message || 'Something went wrong. Please try again.');
      return;
    }

    // Fire-and-forget notification to author (once per submission)
    try {
      await supabase.functions.invoke('notify-author-family-contribution', {
        body: {
          book_id: ctx.book_id,
          contributor_name: fromName.trim(),
          entry_type: entries[0]?.type,
        },
      });
    } catch (err) {
      console.warn('notify-author-family-contribution failed', err);
    }

    setSubmitting(false);
    setSubmitted(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--devotional-bg))]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !ctx) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--devotional-bg))] p-6">
        <div className="bg-card border border-border rounded-xl p-8 max-w-md text-center shadow-sm">
          <h1 className="font-heading text-xl font-bold text-foreground mb-2">Invite unavailable</h1>
          <p className="text-sm text-muted-foreground">{error || 'This link is no longer active.'}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--devotional-bg))] p-6">
        <div className="bg-card border border-border rounded-xl p-8 max-w-md text-center shadow-sm">
          <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="font-heading text-2xl font-bold text-foreground mb-2">Thank you</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Everything you shared has been sent to {ctx.author_name}. It will find its way into {ctx.recipient_name}'s book.
          </p>
          <Button
            variant="ghost"
            className="mt-6"
            onClick={() => { setSubmitted(false); setMemories(['']); setWisdoms(['']); }}
          >
            Share something else
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--devotional-bg))] py-12 px-4">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <Heart className="h-8 w-8 text-primary mx-auto mb-3" />
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">
            Share something for {ctx.recipient_name}
          </h1>
          <p className="text-muted-foreground mt-3 leading-relaxed">
            {ctx.author_name} is creating a keepsake book for {ctx.recipient_name} and would love your voice in it.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-6">
          {/* Name */}
          <div>
            <Label htmlFor="invite-from" className="text-xs uppercase tracking-wider text-muted-foreground">
              Your name
            </Label>
            <Input
              id="invite-from"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="e.g. Grandpa, Aunt Mary, George"
              className="mt-1"
              maxLength={80}
              required
            />
            <p className="text-[0.7rem] text-muted-foreground/70 mt-1.5">
              This is how you'll be credited in the book (for example, "— Grandpa").
            </p>
          </div>

          {/* Email */}
          <div>
            <Label htmlFor="invite-email" className="text-xs uppercase tracking-wider text-muted-foreground">
              Your email
            </Label>
            <Input
              id="invite-email"
              type="email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1"
              maxLength={200}
              required
            />
          </div>

          {/* Memories */}
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-semibold text-foreground">Share a memory (or a few)</Label>
              <p className="text-[0.75rem] text-muted-foreground/80 mt-1 leading-relaxed">
                A memory is a specific moment you remember — just a sentence or two is perfect.
                For example: <em>"I'll never forget when {ctx.recipient_name} caught a fish for the first time
                and made every one of us come look at it for a whole hour. That joy is so {ctx.recipient_name}."</em>{' '}
                Have more than one? Add as many as you'd like.
              </p>
            </div>
            {memories.map((m, i) => (
              <div key={i} className="relative">
                <Textarea
                  value={m}
                  onChange={(e) => updateEntry(memories, setMemories, i, e.target.value)}
                  placeholder="Start with 'I remember when...'"
                  rows={4}
                  maxLength={5000}
                />
                {memories.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeEntry(memories, setMemories, i)}
                    className="absolute top-2 right-2 text-muted-foreground/60 hover:text-destructive"
                    aria-label="Remove memory"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => addEntry(memories, setMemories)}
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Add another memory
            </button>
          </div>

          {/* Wisdom */}
          <div className="space-y-3 pt-2 border-t border-border/60">
            <div>
              <Label className="text-sm font-semibold text-foreground">Share some wisdom or advice (or a few)</Label>
              <p className="text-[0.75rem] text-muted-foreground/80 mt-1 leading-relaxed">
                Something you'd want {ctx.recipient_name} to carry — a lesson, a saying, a piece of advice.
                It can be your own, or something you've heard someone else say.
                For example: <em>"Grandpa always says: never go to bed angry, and always call your mother."</em>{' '}
                Write a little, or write a lot — and add as many as you'd like.
              </p>
            </div>
            {wisdoms.map((w, i) => (
              <div key={i} className="relative">
                <Textarea
                  value={w}
                  onChange={(e) => updateEntry(wisdoms, setWisdoms, i, e.target.value)}
                  placeholder="The one thing I'd want you to know is..."
                  rows={4}
                  maxLength={5000}
                />
                {wisdoms.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeEntry(wisdoms, setWisdoms, i)}
                    className="absolute top-2 right-2 text-muted-foreground/60 hover:text-destructive"
                    aria-label="Remove wisdom"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => addEntry(wisdoms, setWisdoms)}
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Add another
            </button>
          </div>

          {submitError && <p className="text-sm text-destructive">{submitError}</p>}

          <Button type="submit" className="w-full" size="lg" disabled={!canSubmit}>
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…</> : `Send to ${ctx.author_name}`}
          </Button>

          <p className="text-[0.7rem] text-muted-foreground/70 text-center leading-relaxed">
            {ctx.author_name} will see everything you share and decide how to include it in the book.
            Share one thing or many — write as little or as much as you'd like — it's all a gift.
          </p>
        </form>
      </div>
    </div>
  );
};

export default MemoryInvite;
