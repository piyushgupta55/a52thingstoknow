/**
 * Canonical 4-way gender codes stored in books.gender and chapter_templates.gender.
 * The human-readable label lives in books.recipient_gender.
 */
export type BookGender = 'female' | 'male' | 'stepdaughter' | 'stepson';

/** The relationships an author can pick, in display order. */
export const RELATIONSHIP_OPTIONS = [
  'Daughter',
  'Son',
  'Stepdaughter',
  'Stepson',
  'Granddaughter',
  'Grandson',
  'Niece',
  'Nephew',
  'Grandchild',
  'Family Friend',
  'Mentee',
  'Other',
] as const;

/** Human-readable gender labels stored in books.recipient_gender. */
export const GENDER_LABELS: Record<BookGender, string> = {
  female: 'Girl/Young Woman',
  male: 'Boy/Young Man',
  stepdaughter: 'Stepdaughter',
  stepson: 'Stepson',
};

/**
 * Relationships that fully determine the book version. When one of these is
 * chosen the gender question is not asked at all, so the two fields can never
 * contradict each other.
 */
const IMPLIED_GENDER: Record<string, BookGender> = {
  Daughter: 'female',
  Son: 'male',
  Stepdaughter: 'stepdaughter',
  Stepson: 'stepson',
  Granddaughter: 'female',
  Grandson: 'male',
  Niece: 'female',
  Nephew: 'male',
};

/** The book version a relationship implies, or null when it must be asked. */
export function impliedBookGender(relationship: string | null | undefined): BookGender | null {
  return IMPLIED_GENDER[(relationship || '').trim()] ?? null;
}


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
