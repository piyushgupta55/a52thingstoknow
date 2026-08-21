// Shared helpers for the Read-Through + piles routing model.
// A chapter routes to the Photos & Decisions bin if it is either:
//   (a) a photo chapter (is_photo_chapter) that has not been resolved
//       (no uploaded photo AND photo_declined is not true), OR
//   (b) the Reading Reward chapter (detected by a <mark> tag in its
//       seed_content or current content) that has not had its Keep/Change/Remove
//       decision made yet.
// Detection is by <mark> tag, NEVER by chapter_number, because the reward chapter
// shifts between bio (Ch 4) and step (Ch 5) versions.

export interface ChapterLike {
  id: string;
  chapter_number: number;
  title: string;
  photo_urls: string[] | null;
  content: string | null;
  seed_content?: string | null;
  is_photo_chapter?: boolean;
  photo_declined?: boolean;
  reading_reward_decision?: string | null;
  review_status?: string | null;
}

export function hasRewardMark(c: ChapterLike): boolean {
  const haystack = `${c.seed_content || ''}\n${c.content || ''}`;
  return /<mark\b/i.test(haystack);
}

export function isPhotoChapter(c: ChapterLike): boolean {
  return !!c.is_photo_chapter;
}

export function photoUnresolved(c: ChapterLike): boolean {
  if (!isPhotoChapter(c)) return false;
  const hasPhoto = Array.isArray(c.photo_urls) && c.photo_urls.length > 0;
  return !hasPhoto && !c.photo_declined;
}

export function rewardUnresolved(c: ChapterLike): boolean {
  return hasRewardMark(c) && !c.reading_reward_decision;
}

// Belongs to the Photos & Decisions bin (visible while unresolved and not yet complete).
export function inPhotosDecisionsBin(c: ChapterLike): boolean {
  return photoUnresolved(c) || rewardUnresolved(c);
}

// A chapter is a photo/decision-routed chapter (any read-through choice sends it to the bin).
export function isPhotoOrRewardChapter(c: ChapterLike): boolean {
  return isPhotoChapter(c) || hasRewardMark(c);
}

// What the bin item is waiting on, for row copy.
export function binWaitingOn(c: ChapterLike): 'photo' | 'reward' | 'both' | null {
  const p = photoUnresolved(c);
  const r = rewardUnresolved(c);
  if (p && r) return 'both';
  if (p) return 'photo';
  if (r) return 'reward';
  return null;
}

// Regular piles: exclude photo/reward chapters (they live in the bin).
export function inKeptPile(c: ChapterLike): boolean {
  return c.review_status === 'keep' && !isPhotoOrRewardChapter(c);
}
/** @deprecated The "To add to" pile is retired; 'add' was migrated to 'rewrite'. */
export function inAddPile(_c: ChapterLike): boolean {
  return false;
}
export function inRewritePile(c: ChapterLike): boolean {
  return c.review_status === 'rewrite';
}

// Can this chapter be safely marked complete right now?
// A photo chapter needs photo OR photo_declined; the reward chapter needs a decision.
export function canMarkComplete(c: ChapterLike): { ok: true } | { ok: false; reason: 'photo' | 'reward' | 'both' } {
  const p = photoUnresolved(c);
  const r = rewardUnresolved(c);
  if (p && r) return { ok: false, reason: 'both' };
  if (p) return { ok: false, reason: 'photo' };
  if (r) return { ok: false, reason: 'reward' };
  return { ok: true };
}
