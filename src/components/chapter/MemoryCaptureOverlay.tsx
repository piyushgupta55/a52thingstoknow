import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';

const sizeFromText = (text: string): 'small' | 'medium' | 'full' => {
  const sentences = text.trim().split(/[.!?]+\s+/).filter(Boolean).length;
  if (sentences <= 1) return 'small';
  if (sentences <= 3) return 'medium';
  return 'full';
};

interface Props {
  open: boolean;
  onClose: () => void;
  bookId: string;
  defaultFromName: string;
  /**
   * 'manual' — toolbar overlay: From + textarea + Add to pool
   * 'guided' — post-completion AI flow: scripted prompts, up to 3 memories
   */
  mode: 'manual' | 'guided';
  recipientName?: string;
  onSaved?: () => void;
}

const PROMPTS = [
  (name: string) =>
    `Nice work on that chapter. While ${name} is on your mind — tell me one thing you remember about them. It doesn't have to be long. Just a moment.`,
  () => `That's a keeper. One more — do you have a funny one?`,
  () => `One last one if it comes to you — anything that made you proud, or quiet, or surprised.`,
];
const FAREWELL =
  `These will find their way into the book wherever there's space. You can always add more from your dashboard anytime.`;

const MemoryCaptureOverlay = ({
  open,
  onClose,
  bookId,
  defaultFromName,
  mode,
  recipientName = 'them',
  onSaved,
}: Props) => {
  const [fromName, setFromName] = useState(defaultFromName);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  // Guided-mode state
  const [step, setStep] = useState(0); // 0..2 = prompt index, 3 = farewell
  const [savedCount, setSavedCount] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setFromName(defaultFromName);
      setText('');
      setSaving(false);
      setStep(0);
      setSavedCount(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, defaultFromName]);

  if (!open) return null;

  const saveMemory = async (): Promise<boolean> => {
    if (!text.trim() || !fromName.trim()) return false;
    setSaving(true);
    const { error } = await supabase.from('memories').insert({
      book_id: bookId,
      contributor_name: fromName.trim(),
      contributor_type: 'author',
      memory_text: text.trim(),
      size_tag: sizeFromText(text),
      status: 'unplaced',
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Could not save memory', description: error.message, variant: 'destructive' });
      return false;
    }
    onSaved?.();
    return true;
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await saveMemory();
    if (ok) {
      toast({ title: 'Memory added to pool' });
      onClose();
    }
  };

  const handleGuidedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await saveMemory();
    if (!ok) return;
    const nextCount = savedCount + 1;
    setSavedCount(nextCount);
    setText('');
    if (nextCount >= 3) {
      setStep(3);
      return;
    }
    setStep(s => s + 1);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSkipGuided = () => {
    if (step >= 1 && savedCount >= 1) {
      // After at least one memory, allow finishing early
      setStep(3);
    } else {
      onClose();
    }
  };

  const titleText =
    mode === 'manual' ? '💭 Add a memory' : `💭 A moment about ${recipientName}`;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4"
      >
        <div
          className="flex items-center justify-between px-5 py-3 border-b border-border"
          style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
        >
          <span className="font-semibold text-sm" style={{ fontFamily: 'var(--font-body)' }}>
            {titleText}
          </span>
          <button onClick={onClose} className="hover:opacity-70 transition-opacity p-1" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {mode === 'manual' && (
          <form onSubmit={handleManualSubmit} className="p-5 space-y-4">
            <div>
              <Label htmlFor="mc-from" className="text-xs uppercase tracking-wider text-muted-foreground">From</Label>
              <Input
                id="mc-from"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Your name (or who this memory is from)"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="mc-text" className="text-xs uppercase tracking-wider text-muted-foreground">
                What do you remember?
              </Label>
              <Textarea
                id="mc-text"
                ref={inputRef as any}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="A moment, a story, a small thing…"
                rows={4}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving || !text.trim() || !fromName.trim()}>
                {saving ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Saving…</> : 'Add to pool'}
              </Button>
            </div>
          </form>
        )}

        {mode === 'guided' && (
          <div className="p-5 space-y-4">
            {step < 3 ? (
              <>
                <div
                  className="rounded-xl px-4 py-3 text-sm leading-relaxed"
                  style={{
                    background: 'hsl(var(--secondary))',
                    color: 'hsl(var(--foreground))',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  {PROMPTS[step](recipientName)}
                </div>
                <form onSubmit={handleGuidedSubmit} className="space-y-3">
                  <Textarea
                    ref={inputRef as any}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Type the memory…"
                    rows={3}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={handleSkipGuided}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {savedCount >= 1 ? 'Done for now' : 'Maybe later'}
                    </button>
                    <Button type="submit" disabled={saving || !text.trim()}>
                      {saving ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Saving…</> : 'Save & continue'}
                    </Button>
                  </div>
                  {savedCount > 0 && (
                    <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground/60 text-center">
                      {savedCount} saved · {3 - savedCount} more if you'd like
                    </p>
                  )}
                </form>
              </>
            ) : (
              <>
                <div
                  className="rounded-xl px-4 py-3 text-sm leading-relaxed"
                  style={{
                    background: 'hsl(var(--secondary))',
                    color: 'hsl(var(--foreground))',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  {FAREWELL}
                </div>
                <div className="flex justify-end">
                  <Button onClick={onClose}>Close</Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default MemoryCaptureOverlay;
