/**
 * Replaces personalization tokens in book content.
 *
 * Supported tokens:
 *   [RECIPIENT_NAME]      → recipient's first name
 *   [AUTHOR_RELATIONSHIP] → how the recipient refers to the author (Mom, Dad, etc.)
 *   [HIS_HER]             → possessive pronoun based on recipient gender
 *   [HIM_HER]             → objective pronoun based on recipient gender
 *   [SON_DAUGHTER]         → relationship noun based on recipient gender
 */

import { toBookGender, isFeminine, sonDaughterNoun } from './genderMap';

interface TokenContext {
  recipientName: string;
  /** UI label ("Girl/Young Woman", "Stepson", ...) OR canonical code. */
  recipientGender: string;
  /** e.g. "Mom", "Dad", "Grandpa" */
  authorLabel?: string | null;
}

export function replaceTokens(text: string, ctx: TokenContext): string {
  if (!text) return text;

  const g = toBookGender(ctx.recipientGender);
  const feminine = isFeminine(g);

  return text
    .replace(/\[RECIPIENT_NAME\]/g, ctx.recipientName || 'your child')
    .replace(/\[AUTHOR_RELATIONSHIP\]/g, ctx.authorLabel || 'your parent')
    .replace(/\[HIS_HER\]/g, feminine ? 'her' : 'his')
    .replace(/\[HIM_HER\]/g, feminine ? 'her' : 'him')
    .replace(/\[SON_DAUGHTER\]/g, sonDaughterNoun(g));
}
