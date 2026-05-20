// Shared logic to compute Page 2 fullness for a chapter.
// Used by the chapter grid, dashboard table of contents, and the
// in-editor memory suggestion.

export const WORD_BUDGETS: Record<string, number> = {
  all_words: 450,
  photo_top: 350,
  photo_second: 350,
  letter: 200,
};

export type Page2Status = 'full' | 'has_room' | 'needs_content';

export interface Page2StatusInfo {
  status: Page2Status;
  label: string;
  color: string; // hex, used for the dot
  remaining: number;
  budget: number;
  totalWords: number;
}

// Word/KDP-style word counter: em-dashes (—) and en-dashes (–) split words
// (so "character—and" counts as 2). Hyphens still join ("rock-solid" = 1).
// Single source of truth — used everywhere words are counted or limited.
export const countWords = (s: string | null | undefined): number => {
  if (!s) return 0;
  return s
    .replace(/[—–]/g, ' ')
    .replace(/\n/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
};

const wordCount = countWords;

export const computeChapterTotalWords = (chapter: {
  content?: string | null;
  reference_text?: string | null;
  chapter_template?: string | null;
}, memoryCount = 0): number => {
  const refWords = wordCount(chapter.reference_text);
  const contentWords = wordCount(chapter.content);
  // Pure content accounting (matches the editor's "words available" math):
  // paragraph breaks are layout, not content. Real placed memories still
  // carry their 40-word conservative buffer.
  return refWords + contentWords + memoryCount * 40;
};

export const getPage2Status = (
  totalWords: number,
  template: string | null | undefined,
): Page2StatusInfo => {
  const budget = WORD_BUDGETS[template || 'all_words'] || WORD_BUDGETS.all_words;
  const remaining = budget - totalWords;

  // Spec:
  // Green (Full)         — within 30 words of budget   (remaining <= 30)
  // Yellow (Has room)    — 50–30 words under            -> actually: 30 < remaining; "200-420 of 450"
  //                       => remaining between 30 and 200 (exclusive of 200, inclusive of 30 exclusive)
  // Red (Needs content)  — more than 200 words under    (remaining > 200)
  //
  // For a 350 budget the spec says 320+ green, 150-320 yellow, under 150 red,
  // which scales the same boundaries (30 / 200 from top).

  let status: Page2Status;
  let label: string;
  let color: string;

  if (remaining <= 30) {
    status = 'full';
    label = 'Full';
    color = '#16A34A'; // green
  } else if (remaining <= 200) {
    status = 'has_room';
    label = 'Has room';
    color = '#D97706'; // amber/yellow
  } else {
    status = 'needs_content';
    label = 'Needs content';
    color = '#DC2626'; // red
  }

  return { status, label, color, remaining, budget, totalWords };
};
