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

const pronounFromGender = (gender?: string): 'him' | 'her' | 'them' => {
  if (!gender) return 'them';
  const g = gender.toLowerCase();
  if (g.includes('girl') || g.includes('woman') || g === 'female') return 'her';
  if (g.includes('boy') || g.includes('man') || g === 'male') return 'him';
  return 'them';
};

interface Props {
  open: boolean;
  onClose: () => void;
  bookId: string;
  /** Current chapter id — required to support "Place in this chapter" from the toolbar */
  chapterId?: string;
  defaultFromName: string;
  /**
   * 'manual' — toolbar overlay: From + textarea + Add to pool / Place in this chapter
   * 'guided' — post-completion AI flow: 1 prompt, then "Want to add another?" (max 2)
   */
  mode: 'manual' | 'guided';
  recipientName?: string;
  recipientGender?: string;
  onSaved?: () => void;
}

const MemoryCaptureOverlay = ({
  open,
  onClose,
  bookId,
  chapterId,
  defaultFromName,
  mode,
  recipientName = 'them',
  recipientGender,
  onSaved,
}: Props) => {
  const [fromName, setFromName] = useState(defaultFromName);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  // Guided-mode state
  // 'prompt' = show textarea, 'ask-another' = Yes/No, 'farewell' = closing line
  const [stage, setStage] = useState<'prompt' | 'ask-another' | 'farewell'>('prompt');
  const [savedCount, setSavedCount] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Manual-mode: pool browsing
  // 'choose' = list of unplaced memories; 'compose' = the From + textarea form
  const [manualView, setManualView] = useState<'choose' | 'compose'>('choose');
  const [pool, setPool] = useState<Array<{ id: string; memory_text: string; contributor_name: string }>>([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [placingId, setPlacingId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFromName(defaultFromName);
      setText('');
      setSaving(false);
      setStage('prompt');
      setSavedCount(0);
      setManualView('choose');
      setPlacingId(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, defaultFromName]);

  // Load unplaced memories from the pool (manual mode only)
  useEffect(() => {
    if (!open || mode !== 'manual') return;
    let cancelled = false;
    (async () => {
      setPoolLoading(true);
      const { data } = await supabase
        .from('memories')
        .select('id, memory_text, contributor_name')
        .eq('book_id', bookId)
        .eq('status', 'unplaced')
        .order('created_at', { ascending: false });
      if (cancelled) return;
      const items = data || [];
      setPool(items);
      // If pool is empty, drop straight into compose
      if (items.length === 0) setManualView('compose');
      setPoolLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, mode, bookId]);

  if (!open) return null;

  const pronoun = pronounFromGender(recipientGender);

  const PROMPT = `Nice work on that chapter. While ${recipientName} is on your mind — tell me one thing you remember about ${pronoun}. It doesn't have to be long. Just a moment.`;

  const saveMemory = async (placeInChapter = false): Promise<boolean> => {
    if (!text.trim() || !fromName.trim()) return false;
    setSaving(true);
    const shouldPlace = placeInChapter && !!chapterId;
    const { error } = await supabase.from('memories').insert({
      book_id: bookId,
      contributor_name: fromName.trim(),
      contributor_type: 'author',
      memory_text: text.trim(),
      size_tag: sizeFromText(text),
      status: shouldPlace ? 'placed' : 'unplaced',
      chapter_id: shouldPlace ? chapterId : null,
      placed_at: shouldPlace ? new Date().toISOString() : null,
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Could not save memory', description: error.message, variant: 'destructive' });
      return false;
    }
    onSaved?.();
    return true;
  };

  const handleAddToPool = async () => {
    const ok = await saveMemory(false);
    if (ok) {
      toast({ title: 'Memory added to pool' });
      onClose();
    }
  };

  const handlePlaceHere = async () => {
    const ok = await saveMemory(true);
    if (ok) {
      toast({ title: 'Memory placed in this chapter' });
      onClose();
    }
  };

  const placeFromPool = async (memoryId: string) => {
    if (!chapterId) return;
    setPlacingId(memoryId);
    const { error } = await supabase
      .from('memories')
      .update({
        chapter_id: chapterId,
        status: 'placed',
        placed_at: new Date().toISOString(),
      })
      .eq('id', memoryId);
    setPlacingId(null);
    if (error) {
      toast({ title: 'Could not place memory', description: error.message, variant: 'destructive' });
      return;
    }
    onSaved?.();
    toast({ title: 'Memory placed in this chapter' });
    onClose();
  };

  const handleGuidedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await saveMemory(false);
    if (!ok) return;
    const nextCount = savedCount + 1;
    setSavedCount(nextCount);
    setText('');
    if (nextCount >= 2) {
      // Already at max — go straight to farewell
      setStage('farewell');
      return;
    }
    setStage('ask-another');
  };

  const handleAnotherYes = () => {
    setStage('prompt');
    setText('');
    setTimeout(() => inputRef.current?.focus(), 50);
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

        {mode === 'manual' && manualView === 'choose' && chapterId && (
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Choose from pool
              </p>
              <button
                type="button"
                onClick={() => setManualView('compose')}
                className="text-xs text-primary hover:underline"
              >
                + New memory
              </button>
            </div>

            {poolLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 inline animate-spin mr-2" /> Loading…
              </div>
            ) : pool.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No memories in pool yet — add one below.
              </div>
            ) : (
              <div className="max-h-[50vh] overflow-y-auto space-y-2 -mx-1 px-1">
                {pool.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => placeFromPool(m.id)}
                    disabled={placingId !== null}
                    className="w-full text-left rounded-xl border border-border hover:border-primary/50 hover:bg-accent/30 transition-colors p-3 disabled:opacity-50"
                  >
                    <p
                      className="text-[15px] leading-snug text-foreground/90"
                      style={{ fontFamily: "'Caveat', cursive", fontSize: '1.1rem' }}
                    >
                      {m.memory_text}
                    </p>
                    <p
                      className="mt-1 text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground/60"
                      style={{ fontFamily: 'var(--font-body)' }}
                    >
                      — {m.contributor_name}
                      {placingId === m.id && (
                        <span className="ml-2 normal-case tracking-normal">Placing…</span>
                      )}
                    </p>
                  </button>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            </div>
          </div>
        )}

        {mode === 'manual' && (manualView === 'compose' || !chapterId) && (
          <div className="p-5 space-y-4">
            {chapterId && pool.length > 0 && (
              <button
                type="button"
                onClick={() => setManualView('choose')}
                className="text-xs text-primary hover:underline"
              >
                ← Choose from pool
              </button>
            )}
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
            <div className="flex flex-wrap gap-2 justify-end">
              <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleAddToPool}
                disabled={saving || !text.trim() || !fromName.trim()}
              >
                {saving ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Saving…</> : 'Add to pool'}
              </Button>
              {chapterId && (
                <Button
                  type="button"
                  onClick={handlePlaceHere}
                  disabled={saving || !text.trim() || !fromName.trim()}
                >
                  {saving ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Saving…</> : 'Place in this chapter'}
                </Button>
              )}
            </div>
          </div>
        )}

        {mode === 'guided' && (
          <div className="p-5 space-y-4">
            {stage === 'prompt' && (
              <>
                <div
                  className="rounded-xl px-4 py-3 text-sm leading-relaxed"
                  style={{
                    background: 'hsl(var(--secondary))',
                    color: 'hsl(var(--foreground))',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  {PROMPT}
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
                      onClick={onClose}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {savedCount >= 1 ? 'Done for now' : 'Maybe later'}
                    </button>
                    <Button type="submit" disabled={saving || !text.trim()}>
                      {saving ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Saving…</> : 'Save memory'}
                    </Button>
                  </div>
                </form>
              </>
            )}

            {stage === 'ask-another' && (
              <>
                <div
                  className="rounded-xl px-4 py-3 text-sm leading-relaxed"
                  style={{
                    background: 'hsl(var(--secondary))',
                    color: 'hsl(var(--foreground))',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  Want to add another?
                </div>
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Done for now
                  </button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStage('farewell')}>No</Button>
                    <Button onClick={handleAnotherYes}>Yes</Button>
                  </div>
                </div>
              </>
            )}

            {stage === 'farewell' && (
              <>
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
