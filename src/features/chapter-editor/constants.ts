export const MAX_CONTENT_LENGTH = 5000;

export const WORD_BUDGETS: Record<string, number> = {
  all_words: 450,
  photo_top: 350,
  photo_second: 350,
  letter: 200,
};

export const PAGE_1_WORD_LIMITS = {
  all_words: 170,
  photo_top: 130,
  photo_second: 85,
} as const;

export const MIN_PAGE_1_WORD_LIMIT = 35;

export const ISSUE_LABEL: Record<string, string> = {
  typo: 'Typo',
  missing_punctuation: 'Missing punctuation',
  name_mismatch: 'Name',
  cut_off: 'Cut-off sentence',
  double_space: 'Extra spacing',
  empty_page_2: 'Empty Page 2',
  reads_oddly: 'Worth a look',
};

