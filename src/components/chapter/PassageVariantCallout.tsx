import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Check, Undo2 } from 'lucide-react';
import {
  PassageGroup,
  TokenCtx,
  appendPassage,
  fetchPassageGroups,
  markPassageSeen,
  personalizeBody,
  savePassageSelection,
  swapPassage,
} from '@/lib/passageVariants';

interface Props {
  bookId: string;
  chapterId: string;
  chapterNumber: number;
  /** Book gender key (male | female | stepson | stepdaughter). */
  gender: string;
  tokenCtx: TokenCtx;
  /** Live chapter text as it stands in the editor. */
  currentText: string;
  /** Replace the editor text (caller marks unsaved / saves). */
  onApplyText: (next: string) => void;
}

/**
 * Optional-passage chooser, surfaced the same way as the Reading Reward.
 * Fully generic: it renders whatever passages the library holds for this
 * chapter and gender, so a second passage needs no new code.
 */
const PassageVariantCallout = ({
  bookId,
  chapterId,
  chapterNumber,
  gender,
  tokenCtx,
  currentText,
  onApplyText,
}: Props) => {
  const { toast } = useToast();
  const [groups, setGroups] = useState<PassageGroup[]>([]);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState<{ passageKey: string; variantKey: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!chapterId || !gender) return;
    (async () => {
      const g = await fetchPassageGroups(chapterId, gender, chapterNumber);
      if (!cancelled) setGroups(g);
    })();
    return () => { cancelled = true; };
  }, [chapterId, gender, chapterNumber]);

  const ctx = useMemo(() => tokenCtx, [tokenCtx.recipientName, tokenCtx.recipientGender, tokenCtx.authorLabel]);

  if (groups.length === 0) return null;

  const refresh = async () => setGroups(await fetchPassageGroups(chapterId, gender, chapterNumber));

  const applyVariant = async (group: PassageGroup, variantKey: string, mode: 'swap' | 'append') => {
    const next = group.variants.find(v => v.variant_key === variantKey);
    if (!next || busy) return;
    const nextBody = personalizeBody(next.body, ctx);
    const currentBody = group.selection?.applied_body || personalizeBody(group.current?.body || '', ctx);

    let text: string;
    if (mode === 'swap') {
      const res = swapPassage(currentText, currentBody, nextBody);
      if (!res.ok) {
        setConflict({ passageKey: group.passageKey, variantKey });
        return;
      }
      text = res.text;
    } else {
      text = appendPassage(currentText, nextBody);
    }

    setBusy(true);
    const { error } = await savePassageSelection({
      bookId,
      chapterId,
      passageKey: group.passageKey,
      variantKey,
      appliedBody: nextBody,
      previousContent: currentText,
    });
    setBusy(false);
    if (error) {
      toast({ title: "Couldn't switch that", description: error.message, variant: 'destructive' });
      return;
    }
    setConflict(null);
    onApplyText(text);
    await refresh();
    toast({
      title: mode === 'swap' ? `Switched to "${next.label}"` : 'Added below for comparison',
      description: mode === 'swap' ? 'You can switch back at any time.' : 'Both versions are in the chapter — delete the one you do not want.',
    });
  };

  const undo = async (group: PassageGroup) => {
    const prev = group.selection?.previous_content;
    if (!prev || busy) return;
    onApplyText(prev);
    toast({ title: 'Reverted', description: 'The chapter text is back to how it was before the switch.' });
  };

  const confirmSeen = async (group: PassageGroup) => {
    if (busy) return;
    setBusy(true);
    const { error } = await markPassageSeen({
      bookId,
      chapterId,
      passageKey: group.passageKey,
      variantKey: group.current?.variant_key || '',
      appliedBody: group.selection?.applied_body || personalizeBody(group.current?.body || '', ctx),
    });
    setBusy(false);
    if (error) {
      toast({ title: "Couldn't save that", description: error.message, variant: 'destructive' });
      return;
    }
    await refresh();
    toast({ title: 'Got it — this decision is cleared from your basket.' });
  };

  return (
    <>
      {groups.map(group => {
        const seen = !!group.selection?.seen_at;
        const currentKey = group.current?.variant_key;
        const explanation = group.current?.explanation || group.variants[0]?.explanation || '';
        const inConflict = conflict?.passageKey === group.passageKey;

        return (
          <div key={group.passageKey} className="mx-auto max-w-[600px] mb-4">
            <div
              className="rounded-sm p-5"
              style={{ background: '#FDF7E6', border: '1px solid #E6D49A', borderLeft: '3px solid #C9A84C' }}
            >
              <p className="text-[15px] font-semibold text-foreground mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
                There's a choice in this chapter
              </p>
              <p className="text-[13px] leading-relaxed text-foreground/75 mb-3" style={{ fontFamily: 'var(--font-body)' }}>
                {explanation}
              </p>

              <div className="space-y-2 mb-3">
                {group.variants.map(v => {
                  const isCurrent = v.variant_key === currentKey;
                  return (
                    <div key={v.id} className="flex items-start gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={isCurrent ? 'default' : 'outline'}
                        disabled={busy || isCurrent}
                        onClick={() => applyVariant(group, v.variant_key, 'swap')}
                        className="min-w-[92px]"
                      >
                        {isCurrent ? (
                          <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5" /> In the book</span>
                        ) : (
                          'Use this'
                        )}
                      </Button>
                      <div className="pt-1">
                        <p className="text-[13px] text-foreground/85" style={{ fontFamily: 'var(--font-body)' }}>
                          {v.label}
                        </p>
                        {!isCurrent && v.explanation && (
                          <p className="text-[12px] text-foreground/55" style={{ fontFamily: 'var(--font-body)' }}>
                            {v.explanation}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {inConflict && (
                <div className="rounded-sm p-3 mb-3" style={{ background: '#FFF', border: '1px solid #E6D49A' }}>
                  <p className="text-[13px] text-foreground/80 mb-2" style={{ fontFamily: 'var(--font-body)' }}>
                    You've edited this part of the chapter, so I can't swap it out without touching your writing.
                    Keep what you wrote, or add the other version below it so you can compare.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setConflict(null)}>
                      Keep my writing
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy}
                      onClick={() => applyVariant(group, conflict!.variantKey, 'append')}
                    >
                      Add it below
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {!seen && (
                  <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => confirmSeen(group)}>
                    Got it — keep the current version
                  </Button>
                )}
                {group.selection?.previous_content && (
                  <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => undo(group)}>
                    <Undo2 className="h-3.5 w-3.5 mr-1" /> Undo this switch
                  </Button>
                )}
              </div>
              {!seen && (
                <p className="text-[11px] text-muted-foreground/70 mt-2" style={{ fontFamily: 'var(--font-body)' }}>
                  Choose a version — or confirm the current one — and this clears from your Photos &amp; Decisions basket.
                </p>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
};

export default PassageVariantCallout;
