/**
 * Replaces personalization tokens in book content.
 *
 * Supported tokens:
 *   [RECIPIENT_NAME]    → recipient's first name
 *   [AUTHOR_RELATIONSHIP] → how the recipient refers to the author (Mom, Dad, etc.)
 *   [HIS_HER]           → possessive pronoun based on recipient gender
 *   [HIM_HER]           → objective pronoun based on recipient gender
 *   [SON_DAUGHTER]       → relationship noun based on recipient gender
 */

interface TokenContext {
  recipientName: string;
  /** e.g. "Girl/Young Woman" or "Boy/Young Man" */
  recipientGender: string;
  /** e.g. "Mom", "Dad", "Grandpa" */
  authorLabel?: string | null;
}

const FEMALE_GENDER = 'Girl/Young Woman';

export function replaceTokens(text: string, ctx: TokenContext): string {
  if (!text) return text;

  const isFemale = ctx.recipientGender === FEMALE_GENDER;

  return text
    .replace(/\[RECIPIENT_NAME\]/g, ctx.recipientName || 'your child')
    .replace(/\[AUTHOR_RELATIONSHIP\]/g, ctx.authorLabel || 'your parent')
    .replace(/\[HIS_HER\]/g, isFemale ? 'her' : 'his')
    .replace(/\[HIM_HER\]/g, isFemale ? 'her' : 'him')
    .replace(/\[SON_DAUGHTER\]/g, isFemale ? 'daughter' : 'son');
}
