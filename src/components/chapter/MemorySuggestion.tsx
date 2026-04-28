import { Button } from '@/components/ui/button';

interface PoolMemory {
  id: string;
  memory_text: string;
  contributor_name: string;
}

interface Props {
  suggestion: PoolMemory | null;
  poolEmpty: boolean;
  onPlace: () => void;
  onShowAnother: () => void;
}

const MemorySuggestion = ({ suggestion, poolEmpty, onPlace, onShowAnother }: Props) => {
  return (
    <div
      className="mt-6 rounded-lg border border-dashed border-[#C9A84C]/50 bg-[#FDFAF4] px-4 py-4"
      style={{ fontFamily: 'var(--font-body)' }}
    >
      <p className="text-sm text-foreground/70 mb-3">
        💭 This chapter has room for a memory.
      </p>

      {poolEmpty || !suggestion ? (
        <p className="text-xs text-muted-foreground italic">
          No memories in pool yet — add one using the 💭 button above.
        </p>
      ) : (
        <>
          <div
            className="rounded-md bg-white/60 border border-border/50 px-3 py-3 mb-3"
          >
            <p
              className="leading-snug text-foreground/90"
              style={{ fontFamily: "'Caveat', cursive", fontSize: '1.15rem' }}
            >
              {suggestion.memory_text}
            </p>
            <p className="mt-1 text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground/60">
              — {suggestion.contributor_name}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={onShowAnother}>
              Show another
            </Button>
            <Button type="button" size="sm" onClick={onPlace}>
              Place it here
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default MemorySuggestion;
