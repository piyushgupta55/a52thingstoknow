import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';

interface Props {
  chapterId: string;
  recipientName: string;
  /** Existing acknowledgment timestamp, if already recorded. */
  acknowledgedAt?: string | null;
  onAcknowledged?: () => void;
}

/**
 * Friendly, can't-miss heads-up shown on the Reading Reward (Forgiveness) chapter.
 * The chapter is detected by its <mark> reward line, never by chapter number.
 */
const ReadingRewardCallout = ({ chapterId, recipientName, acknowledgedAt, onAcknowledged }: Props) => {
  const { toast } = useToast();
  const [acked, setAcked] = useState(!!acknowledgedAt);
  const [saving, setSaving] = useState(false);
  const name = recipientName || 'your child';

  const acknowledge = async (checked: boolean) => {
    if (!checked || acked || saving) return;
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('chapters')
      .update({
        reading_reward_decision: 'acknowledged',
        reading_reward_ack_at: new Date().toISOString(),
        reading_reward_ack_by: userData?.user?.id ?? null,
      })
      .eq('id', chapterId);
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save that", description: error.message, variant: 'destructive' });
      return;
    }
    setAcked(true);
    onAcknowledged?.();
    toast({ title: 'Got it — the secret is safe with you 🤫' });
  };

  return (
    <div className="mx-auto max-w-[600px] mb-4">
      <div
        className="rounded-sm p-5"
        style={{ background: '#FDF7E6', border: '1px solid #E6D49A', borderLeft: '3px solid #C9A84C' }}
      >
        <p
          className="text-[15px] font-semibold text-foreground mb-2"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          There's a secret in this chapter 🤫
        </p>
        <p className="text-[13px] leading-relaxed text-foreground/75 mb-2" style={{ fontFamily: 'var(--font-body)' }}>
          Tucked into these pages is a hidden reward — {name} gets $10 for reading closely enough to catch it,
          saying "forgiveness," and giving you a high five. Half the fun is seeing how long it takes each of your
          kids to come collect.
        </p>
        <p className="text-[13px] leading-relaxed text-foreground/60 mb-4" style={{ fontFamily: 'var(--font-body)' }}>
          Keep it, change it, or take it out — it's yours, just like any other chapter.
        </p>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <Checkbox
            checked={acked}
            disabled={acked || saving}
            onCheckedChange={(v) => acknowledge(v === true)}
            className="mt-0.5"
          />
          <span className="text-[13px] text-foreground/80" style={{ fontFamily: 'var(--font-body)' }}>
            Got it — this reward is just a fun thing between me and {name}.
          </span>
        </label>
        {!acked && (
          <p className="text-[11px] text-muted-foreground/70 mt-2 ml-7" style={{ fontFamily: 'var(--font-body)' }}>
            Tick this and it clears from your Photos &amp; Decisions basket.
          </p>
        )}
      </div>
    </div>
  );
};

export default ReadingRewardCallout;
