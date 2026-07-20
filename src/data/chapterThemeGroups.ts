// Topic groups for the "Start Here" read-through.
// Chapters are matched by TITLE (case/punct-insensitive) so step-version books,
// which shift chapter numbers by +1 (they open with "I Got You"), still map to
// the right group.
//
// Order below IS the presentation order (1 → 10). Do not alphabetize.
// See chapter_theme_groups.md_1 spec for the arc rationale.

export interface ThemeGroup {
  slug: string;
  title: string;
  subtitle: string;
  chapterTitles: string[];
}

export const THEME_GROUPS: ThemeGroup[] = [
  {
    slug: 'identity',
    title: 'Who You Are',
    subtitle: 'Identity & Worth',
    chapterTitles: [
      "Don't Compare Yourself to Others",
      'Wow! You Are Special',
      'Confidence',
      'The Only Measurement',
    ],
  },
  {
    slug: 'faith',
    title: 'Your Faith',
    subtitle: 'Walking with God',
    chapterTitles: [
      'The Bible',
      'Fear',
      'Jesus is Lord and Savior',
      'Praying',
    ],
  },
  {
    slug: 'character',
    title: 'Character & Integrity',
    subtitle: 'The person you\u2019re becoming',
    chapterTitles: [
      'Character',
      'Lying',
      'Consequences',
      'Pride',
      'Humility',
    ],
  },
  {
    slug: 'words',
    title: 'Words & How You Treat People',
    subtitle: 'What you say, how you say it',
    chapterTitles: [
      'Forgiveness',
      'Words',
      'Gossip',
      'Respect',
    ],
  },
  {
    slug: 'friends',
    title: 'Friends & Finding Your Voice',
    subtitle: 'Who you keep close',
    chapterTitles: [
      'Seeking Advice from Others',
      'Leadership',
      '"Old" Friends',
      'Old Friends',
      'Cut Your Losses',
      'New College Friends',
      'A Great Communicator',
      'Sometimes No Advice is Better',
    ],
  },
  {
    slug: 'money',
    title: 'Money & Work',
    subtitle: 'Earning it, spending it, keeping perspective',
    chapterTitles: [
      'Money',
      'Working Hard',
      'Money is a Tool',
      'Treating the Things You Own',
      'Work to Live',
    ],
  },
  {
    slug: 'making-your-way',
    title: 'Making Your Way',
    subtitle: 'Everyday wisdom',
    chapterTitles: [
      'Healthy Eating',
      'The Perfect College Day',
      'Travel',
      'The Gift of Being Bored',
      'Being An Adult',
      'Being an Adult',
    ],
  },
  {
    slug: 'love',
    title: 'Love, Dating & Marriage',
    subtitle: 'How to love and be loved',
    chapterTitles: [
      'Treat You Like a "Queen"',
      'Treat You Like a Queen',
      'Men and Their Moms',
      'Men and their Moms',
      'What Men Say',
      'What Men Say\u2026',
      'Marry a Godly Man',
      'Love Language',
      'Manipulation',
    ],
  },
  {
    slug: 'hard',
    title: 'The Hard Conversations',
    subtitle: 'Read these closely \u2014 they go out in your voice',
    chapterTitles: [
      'Pornography',
      'Danger',
      'Abortion',
      'Never Ever',
      'Alcohol, Drugs & Tobacco',
      'Alcohol Drugs and Tobacco',
      'Sex and Guys',
    ],
  },
  {
    slug: 'heart',
    title: 'From My Heart to Yours',
    subtitle: 'How this book ends \u2014 on love',
    chapterTitles: [
      'Anger',
      'Crying',
      'Memories',
      'I Love You Anyway',
      'Embarrassment',
      'My Thoughts',
    ],
  },
];

const normalizeTitle = (s: string): string =>
  (s || '')
    .toLowerCase()
    .replace(/[\u2018\u2019\u201C\u201D"']/g, '')
    .replace(/[\u2026]/g, '...')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const titleToGroupSlug = new Map<string, string>();
for (const g of THEME_GROUPS) {
  for (const t of g.chapterTitles) {
    titleToGroupSlug.set(normalizeTitle(t), g.slug);
  }
}

export function getGroupSlugForTitle(title: string | null | undefined): string | null {
  if (!title) return null;
  return titleToGroupSlug.get(normalizeTitle(title)) || null;
}

export function getGroupBySlug(slug: string | null | undefined): ThemeGroup | null {
  if (!slug) return null;
  return THEME_GROUPS.find(g => g.slug === slug) || null;
}
