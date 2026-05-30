import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

interface Props {
  text: string;
  reference: string;
  onTextChange: (v: string) => void;
  onRefChange: (v: string) => void;
  onFindAlternatives: () => void;
  editing: boolean;
  onToggleEdit: () => void;
  previewMode?: boolean;
}

const DevotionalVerse = ({ text, reference, onTextChange, onRefChange, onFindAlternatives, editing, onToggleEdit, previewMode }: Props) => {
  if (editing) {
    return (
      <div className="py-3 space-y-2 rounded-sm transition-all duration-200" style={{ borderLeft: '3px solid #C9A84C', background: '#FDFAF4', margin: '0 -8px', padding: '12px 8px 12px 19px' }}>
        <Textarea
          placeholder="Enter the verse text..."
          value={text}
          onChange={e => onTextChange(e.target.value)}
          rows={2}
          className="border-0 border-b border-border/50 bg-transparent resize-none focus-visible:ring-0 focus-visible:border-[#C9A84C] rounded-none px-0 text-[0.9rem] italic"
          style={{ fontFamily: 'var(--font-devotional)' }}
          autoFocus
        />
        <Input
          placeholder="Reference (e.g. Matthew 6:14)"
          value={reference}
          onChange={e => onRefChange(e.target.value)}
          className="border-0 border-b border-border/50 bg-transparent focus-visible:ring-0 focus-visible:border-[#C9A84C] rounded-none px-0 text-xs h-7"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleEdit}
            className="text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Done
          </button>
          <button
            onClick={e => { e.stopPropagation(); onFindAlternatives(); }}
            className="text-[0.6rem] uppercase tracking-[0.12em] text-[#C9A84C]/60 hover:text-[#C9A84C] transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Swap Verse
          </button>
        </div>
      </div>
    );
  }

  // Always render the verse in its styled form (even if empty, show a subtle prompt)
  if (!text) {
    return (
      <div className="py-3 cursor-pointer" onClick={onToggleEdit}>
        <div className="border-l-[3px] border-[#C9A84C]/30 pl-4 py-1">
          <p
            className="text-[0.9rem] italic leading-relaxed text-muted-foreground/30"
            style={{ fontFamily: 'var(--font-devotional)' }}
          >
            "A verse for this chapter…"
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-3 cursor-pointer group" onClick={onToggleEdit}>
      <div 
        className="pl-3 py-1 transition-all duration-200" 
        style={{ 
          borderLeft: `2.5px solid #C9A84C`,
        }}
      >
        <p
          className="italic"
          style={{ 
            fontFamily: 'var(--font-devotional)',
            fontSize: '14.4px',
            lineHeight: '1.7',
            color: '#1D2630B2'
          }}
        >
          "{text}"
        </p>
        <div className="mt-1.5 flex items-center gap-3">
          {reference && (
            <p 
              className="uppercase tracking-[0.12em]" 
              style={{ 
                fontFamily: 'var(--font-body)',
                fontSize: '10.4px',
                color: '#6A758180'
              }}
            >
              — {reference}
            </p>
          )}
          {!previewMode && (
            <button
              onClick={e => { e.stopPropagation(); onFindAlternatives(); }}
              className="text-[0.6rem] uppercase tracking-[0.1em] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              swap verse
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DevotionalVerse;
