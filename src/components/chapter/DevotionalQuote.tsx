import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

interface Props {
  text: string;
  attribution: string;
  onTextChange: (v: string) => void;
  onAttrChange: (v: string) => void;
  onFindAlternatives: () => void;
  editing: boolean;
  onToggleEdit: () => void;
  previewMode?: boolean;
}

const DevotionalQuote = ({ text, attribution, onTextChange, onAttrChange, onFindAlternatives, editing, onToggleEdit, previewMode }: Props) => {
  if (editing) {
    return (
      <div className="py-3 space-y-2 rounded-sm transition-all duration-200" style={{ borderLeft: '3px solid #C9A84C', background: '#FDFAF4', margin: '0 -8px', padding: '12px 8px 12px 19px' }}>
        <Textarea
          placeholder="Enter the quote..."
          value={text}
          onChange={e => onTextChange(e.target.value)}
          rows={2}
          className="border-0 border-b border-border/50 bg-transparent resize-none focus-visible:ring-0 focus-visible:border-primary/40 rounded-none px-0 text-[0.9rem] italic"
          style={{ fontFamily: 'var(--font-devotional)' }}
          autoFocus
        />
        <Input
          placeholder='Who said it? (e.g. "Grandpa Joe")'
          value={attribution}
          onChange={e => onAttrChange(e.target.value)}
          className="border-0 border-b border-border/50 bg-transparent focus-visible:ring-0 focus-visible:border-primary/40 rounded-none px-0 text-xs h-7"
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
            className="text-[0.6rem] uppercase tracking-[0.12em] text-primary/60 hover:text-primary transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Find Another Quote
          </button>
        </div>
      </div>
    );
  }

  if (!text) {
    return (
      <div className="py-3 cursor-pointer" onClick={onToggleEdit}>
        <div className="border-l-[3px] border-primary/20 pl-4 py-1">
          <p
            className="text-[0.9rem] italic leading-relaxed text-muted-foreground/30"
            style={{ fontFamily: 'var(--font-devotional)' }}
          >
            "A wisdom quote for this chapter…"
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-3 cursor-pointer group" onClick={onToggleEdit}>
      <div 
        className="transition-all duration-200" 
        style={{ 
          borderLeft: `2.5px solid #C4788A`,
          margin: '1.3em 0',
          paddingLeft: '1.5em',
        }}
      >
        <p
          className="italic"
          style={{ 
            fontFamily: 'var(--font-devotional)',
            fontSize: '11pt',
            lineHeight: '1.7',
            color: 'rgba(29, 38, 48, 0.7)',
            margin: 0,
          }}
        >
          "{text}"
        </p>
        <div className="mt-1.5 flex items-center gap-3">
          {attribution && (
            <p 
              className="uppercase tracking-[0.12em]" 
              style={{ 
                fontFamily: 'Source Sans 3, system-ui, sans-serif',
                fontSize: '8pt',
                color: 'rgba(106, 117, 129, 0.5)'
              }}
            >
              — {attribution}
            </p>
          )}
          {!previewMode && (
            <button
              onClick={e => { e.stopPropagation(); onFindAlternatives(); }}
              className="text-[0.6rem] uppercase tracking-[0.1em] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              find another quote
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DevotionalQuote;
