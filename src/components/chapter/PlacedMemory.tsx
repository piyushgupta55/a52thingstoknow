interface Props {
  text: string;
  fromName: string;
}

const PlacedMemory = ({ text, fromName }: Props) => {
  return (
    <div
      className="my-6 px-4 py-4 rounded-lg"
      style={{
        backgroundColor: '#F5F0E8',
        fontFamily: "'Caveat', cursive",
        fontSize: '1.15rem',
        color: 'hsl(210 25% 15% / 0.85)',
      }}
    >
      <p className="leading-relaxed whitespace-pre-wrap">
        <span className="text-[#C9A84C] mr-1">✦</span>
        {text}
      </p>
      <p
        className="mt-2 text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground/60"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        — {fromName}
      </p>
    </div>
  );
};

export default PlacedMemory;
