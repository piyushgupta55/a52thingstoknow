import type { ReviewAction } from '@/lib/reviewTags';

interface Props {
  text: string;
  tagIndex: number;
  action: ReviewAction;
  onChange: (tagIndex: number, action: ReviewAction) => void;
}

/**
 * Editor-only inline callout for `<review>` spans.
 * - Amber-tinted background, small pill "Direct content — review".
 * - Keep (default) / Soften / Remove actions.
 * - Never shown in the child's book — stripped by applyReviewFlags at render.
 */
const ReviewCallout = ({ text, tagIndex, action, onChange }: Props) => {
  const isMuted = action === 'soften' || action === 'remove';

  const btnBase =
    'px-2 py-0.5 text-[10px] uppercase tracking-wide rounded-sm transition-colors';
  const btnActive = 'bg-amber-600 text-white';
  const btnIdle = 'bg-amber-100 text-amber-900 hover:bg-amber-200';

  return (
    <span
      className={`relative inline-block align-baseline px-2 py-1 my-1 rounded-sm border border-amber-400/60 ${
        isMuted ? 'bg-amber-50/40 line-through text-foreground/40' : 'bg-amber-50'
      }`}
      style={{ boxDecorationBreak: 'clone' }}
    >
      <span
        className="absolute -top-2 right-2 bg-amber-500 text-white text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded-sm select-none"
        contentEditable={false}
      >
        Direct content — review
      </span>
      <span>{text}</span>
      <span className="ml-2 inline-flex gap-1" contentEditable={false}>
        {(['keep', 'soften', 'remove'] as ReviewAction[]).map(a => (
          <button
            key={a}
            type="button"
            onClick={() => onChange(tagIndex, a)}
            className={`${btnBase} ${action === a ? btnActive : btnIdle}`}
            aria-pressed={action === a}
          >
            {a}
          </button>
        ))}
      </span>
    </span>
  );
};

export default ReviewCallout;
