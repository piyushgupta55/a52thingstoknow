/** Reading-Reward markers are metadata, never author-visible content. */

export const hasMarkTag = (text: string | null | undefined) => /<mark\b/i.test(text || '');

/**
 * Remove balanced, lone, and HTML-escaped marker tags while preserving their
 * inner prose. This is applied at every editor boundary so an author can never
 * type, save, or accidentally print an orphaned `</mark>`.
 */
export const stripMarkTags = (text: string | null | undefined): string =>
  (text || '')
    .replace(/<\/?mark\b[^>]*>/gi, '')
    .replace(/&lt;\/?mark\b.*?&gt;/gi, '');
