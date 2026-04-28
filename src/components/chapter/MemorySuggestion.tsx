import { Button } from '@/components/ui/button';

interface PoolMemory {
  id: string;
  memory_text: string;
  contributor_name: string;
}

interface Props {
  memories: PoolMemory[];
  onPlace: (memoryId: string) => void;
  placingId?: string | null;
}

const MemorySuggestion = ({ memories, onPlace, placingId }: Props) => {
  return (
    <div
      className="mt-6 rounded-lg border border-dashed border-[#C9A84C]/50 bg-[#FDFAF4] px-4 py-4"
      style={{ fontFamily: 'var(--font-body)' }}
    >
      <p className="text-sm text-foreground/70 mb-3">
        💭 This chapter has room for a memory.
      </p>

      {memories.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          No memories in pool yet — use the 💭 button above to add one.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {memories.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onPlace(m.id)}
              disabled={placingId !== null && placingId !== undefined}
              className="text-left rounded-md bg-white/60 border border-border/50 hover:border-[#C9A84C] hover:bg-white transition-colors px-3 py-3 disabled:opacity-50"
            >
              <p
                className="leading-snug text-foreground/90"
                style={{ fontFamily: "'Caveat', cursive", fontSize: '1.15rem' }}
              >
                <span className="text-[#C9A84C] mr-1">✦</span>
                {m.memory_text}
              </p>
              <p className="mt-1 text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground/60">
                — {m.contributor_name}
                {placingId === m.id && (
                  <span className="ml-2 normal-case tracking-normal">Placing…</span>
                )}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MemorySuggestion;
