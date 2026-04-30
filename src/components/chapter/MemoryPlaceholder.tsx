interface Props {
  recipientName: string;
  realistic?: boolean;
}

const REALISTIC_MEMORIES = [
  {
    text: "I still remember the day you figured out how to ride your bike without me holding on. You didn't even notice I had let go. You just kept pedaling, laughing into the wind.",
    words: 32,
  },
  {
    text: "You were maybe five years old when you told me very seriously that you were going to be a veterinarian, a firefighter, and a pizza chef — all at the same time. I believed every word.",
    words: 34,
  },
  {
    text: "The morning of your first day of high school, you came downstairs trying so hard to look like it was no big deal. But I saw your hands shaking just a little. I wanted to tell you that you were going to be great — but I think you already knew.",
    words: 46,
  },
];

const MemoryPlaceholder = ({ recipientName, realistic = false }: Props) => {
  if (realistic) {
    // Pick a random-ish memory based on the name length for consistency
    const idx = (recipientName?.length || 0) % REALISTIC_MEMORIES.length;
    const memory = REALISTIC_MEMORIES[idx];
    return (
      <div
        className="my-6 px-4 py-4 rounded-lg"
        style={{
          backgroundColor: '#F5F0E8',
          fontFamily: "'Caveat', cursive",
          fontSize: '1.1rem',
          color: 'hsl(210 25% 15% / 0.75)',
        }}
      >
        <p className="leading-relaxed">
          <span className="text-[#C9A84C] mr-1">✦</span>
          {memory.text}
        </p>
        <div className="mt-2 flex items-center justify-end">
          <span
            className="text-[0.55rem] text-muted-foreground/30"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            ~{memory.words} words
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="my-6 px-4 py-4 rounded-lg"
      style={{
        backgroundColor: '#F5F0E8',
        fontFamily: "'Caveat', cursive",
        fontSize: '1.1rem',
        color: 'hsl(210 25% 15% / 0.75)',
      }}
    >
      <p className="leading-relaxed">
        <span className="text-[#C9A84C] mr-1">✦</span>
        A memory will go here — a short story from someone who loves {recipientName || 'them'} that they'll keep forever.
      </p>
      <p
        className="mt-2 text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground/50"
        style={{ fontFamily: 'var(--font-body)', fontSize: '0.6rem' }}
      >
        — Contributor Name
      </p>
    </div>
  );
};

export default MemoryPlaceholder;
