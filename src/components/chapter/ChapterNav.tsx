import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ArrowRight, Check, Circle, BookOpen, Camera, Mail } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ChapterInfo {
  id: string;
  chapter_number: number;
  title: string;
  /** 'keep' | 'rewrite' | null — the author's review choice. */
  review_status?: string | null;
  is_photo_chapter?: boolean;
  has_photo?: boolean;
}

interface Props {
  currentChapter: number;
  totalChapters: number;
  chapters: ChapterInfo[];
  onNavigate: (chapterId: string) => void;
  memoryCountsByChapter?: Record<string, number>;
  ancestryStatus?: string;
  onNavigateAncestry?: () => void;
  familyHistoryStatus?: string;
  onNavigateFamilyHistory?: () => void;
}

const StatusIndicator = ({ status }: { status?: string | null }) => {
  if (status === 'keep') {
    return (
      <div className="flex items-center justify-center h-4 w-4 flex-shrink-0" title="Kept">
        <Check className="h-3.5 w-3.5 text-teal-500" />
      </div>
    );
  }
  if (status === 'rewrite') {
    return (
      <div className="flex items-center justify-center h-4 w-4 flex-shrink-0" title="Needs editing">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="6" stroke="#C9A84C" strokeWidth="1.5" fill="none" />
          <path d="M7 1 A6 6 0 0 1 7 13" fill="#C9A84C" />
        </svg>
      </div>
    );
  }
  // undecided
  return (
    <div className="flex items-center justify-center h-4 w-4 flex-shrink-0" title="Not decided yet">
      <Circle className="h-3 w-3 text-muted-foreground/25" />
    </div>
  );
};

const ChapterNav = ({ currentChapter, totalChapters, chapters, onNavigate, memoryCountsByChapter = {}, ancestryStatus, onNavigateAncestry, familyHistoryStatus, onNavigateFamilyHistory }: Props) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const sorted = [...chapters].sort((a, b) => a.chapter_number - b.chapter_number);
  const currentIdx = sorted.findIndex(c => c.chapter_number === currentChapter);
  const prevChapter = currentIdx > 0 ? sorted[currentIdx - 1] : null;
  const nextChapter = currentIdx < sorted.length - 1 ? sorted[currentIdx + 1] : null;
  const isLetter = currentChapter === 0;

  const handleBlur = (e: React.FocusEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(e.relatedTarget as Node)) {
      setDropdownOpen(false);
    }
  };

  return (
    <div className="flex items-center gap-1" onBlur={handleBlur}>
      <button
        onClick={() => prevChapter && onNavigate(prevChapter.id)}
        disabled={!prevChapter}
        className={`p-1 rounded-sm transition-colors ${
          prevChapter ? 'text-muted-foreground hover:text-foreground' : 'text-muted-foreground/20 cursor-not-allowed'
        }`}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-1 px-2 py-1 text-[0.65rem] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          {isLetter ? 'Letter' : `Chapter ${currentChapter} of ${totalChapters}`}
          <ChevronDown className={`h-3 w-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {dropdownOpen && (
          <div
            className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 w-[280px] max-h-[400px] overflow-y-auto bg-background border border-[hsl(var(--devotional-border))] rounded-sm shadow-lg z-50"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {sorted.map(ch => {
              const isActive = ch.chapter_number === currentChapter;
              const hasMemories = (memoryCountsByChapter[ch.id] || 0) > 0;
              const isLetterCh = ch.chapter_number === 0;
              return (
                <button
                  key={ch.id}
                  onClick={() => { onNavigate(ch.id); setDropdownOpen(false); }}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2 text-[0.75rem] transition-colors ${
                    isActive
                      ? 'bg-primary/5 text-foreground font-medium'
                      : 'text-foreground/70 hover:bg-muted/50'
                  }`}
                >
                  <StatusIndicator status={ch.review_status} />
                  {isLetterCh ? (
                    <Mail className="h-3 w-3 text-primary/60 flex-shrink-0" />
                  ) : (
                    <>
                      {hasMemories && (
                        <BookOpen className="h-3 w-3 text-amber-500/70 flex-shrink-0 -ml-0.5" />
                      )}
                      <span className="text-muted-foreground/40 w-5 text-right flex-shrink-0">{ch.chapter_number}</span>
                    </>
                  )}
                  <span className="truncate flex-1">{ch.title}</span>
                  {ch.is_photo_chapter && !isLetterCh && (
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Camera className={`h-3 w-3 flex-shrink-0 ml-auto ${ch.has_photo ? 'text-primary fill-primary/20' : 'text-muted-foreground/30'}`} />
                        </TooltipTrigger>
                        <TooltipContent side="left" className="text-xs">
                          {ch.has_photo ? 'Photo uploaded' : 'Photo chapter — no photo yet'}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </button>
              );
            })}

            {onNavigateAncestry && (
              <button
                onClick={() => { onNavigateAncestry(); setDropdownOpen(false); }}
                className="w-full text-left px-3 py-2 flex items-center gap-2 text-[0.75rem] text-foreground/70 hover:bg-muted/50 border-t border-[hsl(var(--devotional-border))] transition-colors"
              >
                <StatusIndicator status={ancestryStatus} />
                <BookOpen className="h-3 w-3 text-primary/60 flex-shrink-0" />
                <span className="truncate flex-1">Where You Come From</span>
              </button>
            )}
          </div>
        )}
      </div>

      <button
        onClick={() => nextChapter && onNavigate(nextChapter.id)}
        disabled={!nextChapter}
        title={nextChapter ? `Next chapter — ${nextChapter.title}` : 'Last chapter'}
        className={`ml-1 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          nextChapter
            ? 'border-border bg-background text-foreground hover:bg-muted/60 hover:border-primary/40'
            : 'border-border/40 text-muted-foreground/40 cursor-not-allowed'
        }`}
        style={{ fontFamily: 'var(--font-body)' }}
      >
        <span>Next chapter</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

export default ChapterNav;
