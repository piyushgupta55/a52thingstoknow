interface Props {
  text: string;
  fromName: string;
  onRemove?: () => void;
}

// Strip placeholder/auto-generated attribution strings so we never display them
const cleanFromName = (name: string | null | undefined): string => {
  if (!name) return '';
  const trimmed = name.trim();
  if (!trimmed) return '';
  if (/someone who loves/i.test(trimmed)) return '';
  if (/^a memory from/i.test(trimmed)) return '';
  if (/^contributor name$/i.test(trimmed)) return '';
  return trimmed;
};

const PlacedMemory = ({ text, fromName, onRemove }: Props) => {
  const cleaned = cleanFromName(fromName);
  return (
    <div
      className="my-6 px-4 py-4 rounded-lg relative group"
      style={{
        backgroundColor: '#F5F0E8',
        fontFamily: "'Caveat', cursive",
        fontSize: '15px',
        color: 'hsl(210 25% 15% / 0.85)',
        width: '100%',
        maxWidth: '28em',
        marginLeft: 'auto',
        marginRight: 'auto',
        boxSizing: 'border-box',
      }}
    >
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove memory"
          title="Remove memory from chapter"
          className="absolute top-2 right-2 h-6 w-6 rounded-full bg-white/70 hover:bg-white border border-border/50 hover:border-[#C9A84C] text-foreground/60 hover:text-foreground flex items-center justify-center text-xs leading-none transition-colors opacity-60 hover:opacity-100"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          ✕
        </button>
      )}
      <p className="leading-relaxed whitespace-pre-wrap">
        <span className="text-[#C9A84C] mr-1">✦</span>
        {text}
      </p>
      {cleaned && (
        <p
          className="mt-2 text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground/60"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          — {cleaned}
        </p>
      )}
    </div>
  );
};

export default PlacedMemory;
