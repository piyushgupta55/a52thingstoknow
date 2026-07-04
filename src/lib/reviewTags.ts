/**
 * `<review>...</review>` editor-tag utilities.
 *
 * Semantics:
 *   - Editor UI shows a "Direct content — review" callout for each span.
 *   - The wrapper is stripped at render time; only the inner text prints.
 *   - Per-span action: 'keep' (default), 'soften', 'remove'.
 *
 * `<mark>` is a different feature (yellow Reading Reward) and untouched.
 */

export type ReviewAction = 'keep' | 'soften' | 'remove';

export interface ReviewSpan {
  /** 0-based index of this <review> span in the raw body */
  tagIndex: number;
  /** Character offsets in the original text (inclusive start, exclusive end) */
  start: number;
  end: number;
  /** Inner text between the tags */
  text: string;
}

const REVIEW_RE = /<review>([\s\S]*?)<\/review>/gi;

/** Parse all `<review>` spans out of a body. Ordinal is stable per position in text. */
export function parseReviewSpans(body: string): ReviewSpan[] {
  if (!body) return [];
  const spans: ReviewSpan[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(REVIEW_RE);
  let i = 0;
  while ((m = re.exec(body)) !== null) {
    spans.push({
      tagIndex: i++,
      start: m.index,
      end: m.index + m[0].length,
      text: m[1],
    });
  }
  return spans;
}

/**
 * Apply flags to a raw body and return plain text.
 * Default (no flag / 'keep'): unwrap the tags, keep inner text.
 * 'soften' / 'remove': drop the wrapped text entirely.
 * (Phase 1 treats 'soften' == 'remove'; a future pass wires it into an AI rewrite.)
 */
export function applyReviewFlags(body: string, flags: Record<number, ReviewAction> = {}): string {
  if (!body) return body;
  let idx = 0;
  return body.replace(REVIEW_RE, (_full, inner) => {
    const action = flags[idx++] ?? 'keep';
    if (action === 'keep') return inner;
    return ''; // soften | remove
  });
}

/** Convenience: strip all review wrappers keeping inner text (used when flags aren't available). */
export function stripReviewWrappers(body: string): string {
  return applyReviewFlags(body, {});
}
