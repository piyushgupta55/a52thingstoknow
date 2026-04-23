import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Heart, CheckCircle2, Loader2 } from 'lucide-react';

interface InviteContext {
  book_id: string;
  recipient_name: string;
  author_name: string;
}

const MemoryInvite = () => {
  const { token } = useParams<{ token: string }>();
  const [ctx, setCtx] = useState<InviteContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fromName, setFromName] = useState('');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        const { data, error } = await supabase.rpc('get_invite_context', { _token: token });
        if (error) throw error;
        if (!data || data.length === 0) {
          setError("This invite link isn't valid anymore.");
        } else {
          setCtx(data[0] as InviteContext);
        }
      } catch (err: any) {
        setError(err?.message || 'Could not load this invite.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromName.trim() || !text.trim() || !token) return;
    setSubmitting(true);
    setSubmitError(null);
    const { error } = await supabase.rpc('submit_memory_via_invite', {
      _token: token,
      _from_name: fromName.trim(),
      _memory_text: text.trim(),
    });
    setSubmitting(false);
    if (error) {
      setSubmitError(error.message || 'Something went wrong. Please try again.');
      return;
    }
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
            Your memory has been sent to {ctx.author_name}. It will find its way into {ctx.recipient_name}'s book.
          </p>
          <Button
            variant="ghost"
            className="mt-6"
            onClick={() => { setSubmitted(false); setText(''); setFromName(''); }}
          >
            Share another
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
            Share a memory of {ctx.recipient_name}
          </h1>
          <p className="text-muted-foreground mt-3 leading-relaxed">
            {ctx.author_name} is creating a book for {ctx.recipient_name} and would love a memory from you.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-5">
          <div>
            <Label htmlFor="invite-from" className="text-xs uppercase tracking-wider text-muted-foreground">
              Your name
            </Label>
            <Input
              id="invite-from"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="e.g. Aunt Sarah, Coach Davis"
              className="mt-1"
              maxLength={80}
              required
            />
          </div>

          <div>
            <Label htmlFor="invite-text" className="text-xs uppercase tracking-wider text-muted-foreground">
              Your memory
            </Label>
            <Textarea
              id="invite-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Share a moment — funny, proud, quiet, brave. The smaller and more specific, the better."
              rows={6}
              className="mt-1"
              maxLength={5000}
              required
            />
            <p className="text-[0.65rem] text-muted-foreground/60 mt-1.5 text-right">
              {text.length} / 5000
            </p>
          </div>

          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={submitting || !fromName.trim() || !text.trim()}
          >
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…</> : 'Send memory'}
          </Button>

          <p className="text-[0.65rem] text-muted-foreground/60 text-center">
            {ctx.author_name} will see your submission and decide whether it goes into the book.
          </p>
        </form>
      </div>
    </div>
  );
};

export default MemoryInvite;
