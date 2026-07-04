/**
 * Canonical 4-way gender codes stored in books.gender and chapter_templates.gender.
 * The human-readable label lives in books.recipient_gender.
 */
export type BookGender = 'female' | 'male' | 'stepdaughter' | 'stepson';

/**
 * Map the UI/human recipient_gender string to the canonical short code.
 * Falls back to 'male' only when no match is found (legacy books).
 */
export function toBookGender(recipient_gender: string | null | undefined): BookGender {
  switch ((recipient_gender || '').trim()) {
    case 'Girl/Young Woman':
      return 'female';
    case 'Boy/Young Man':
      return 'male';
    case 'Stepdaughter':
      return 'stepdaughter';
    case 'Stepson':
      return 'stepson';
    default:
      // Support books already stored with canonical codes
      if (recipient_gender === 'female' || recipient_gender === 'male' || recipient_gender === 'stepdaughter' || recipient_gender === 'stepson') {
        return recipient_gender;
      }
      return 'male';
  }
}

/** True for daughter-line genders. Used for pronouns and template selection. */
export function isFeminine(g: BookGender): boolean {
  return g === 'female' || g === 'stepdaughter';
}

/** Relationship noun for the [SON_DAUGHTER] token. */
export function sonDaughterNoun(g: BookGender): string {
  switch (g) {
    case 'female': return 'daughter';
    case 'male': return 'son';
    case 'stepdaughter': return 'stepdaughter';
    case 'stepson': return 'stepson';
  }
}
