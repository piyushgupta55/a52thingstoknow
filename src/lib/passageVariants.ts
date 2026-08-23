// Generic optional-passage system.
//
// A "passage" is an optional block of chapter text that ships in several
// author-selectable versions. Versions live in `chapter_passage_variants`
// (keyed by passage_key + gender + template_key), and the author's choice
// lives in `chapter_passage_selections`.
//
// Nothing here is specific to any one passage or chapter: adding a second
// passage to the library later needs no new code.

import { supabase } from '@/lib/supabase';
import { replaceTokens } from '@/lib/tokenReplacer';
import { normalizeWhitespace } from '@/features/chapter-editor/textSplit';

export interface PassageVariant {
  id: string;
  passage_key: string;
  gender: string;
  chapter_number: number;
  /** Stable chapter identity — survives renumbering and reordering. */
  template_key: string | null;
  variant_key: string;
  label: string;
  explanation: string | null;
  body: string;
  is_default: boolean;
  sort_order: number;
}

export interface PassageSelection {
  id: string;
  book_id: string;
  chapter_id: string;
  passage_key: string;
  variant_key: string;
  applied_body: string | null;
  previous_content: string | null;
  seen_at: string | null;
}

export interface PassageGroup {
  passageKey: string;
  variants: PassageVariant[];
  selection: PassageSelection | null;
  /** The variant currently in the book (selection, else the library default). */
  current: PassageVariant | null;
}

export interface TokenCtx {
  recipientName: string;
  recipientGender: string;
  authorLabel?: string | null;
}

export const personalizeBody = (body: string, ctx: TokenCtx) =>
  normalizeWhitespace(replaceTokens(body || '', ctx));

/** All variants available for one chapter of one book gender, grouped by passage. */
export async function fetchPassageGroups(
  chapterId: string,
  gender: string,
  templateKey: string | null,
): Promise<PassageGroup[]> {
  if (!templateKey) return [];
  const [{ data: variants }, { data: selections }] = await Promise.all([
    supabase
      .from('chapter_passage_variants')
      .select('*')
      .eq('gender', gender)
      .eq('template_key', templateKey)
      .order('sort_order'),
    supabase.from('chapter_passage_selections').select('*').eq('chapter_id', chapterId),
  ]);

  const byKey = new Map<string, PassageVariant[]>();
  ((variants || []) as PassageVariant[]).forEach(v => {
    const list = byKey.get(v.passage_key) || [];
    list.push(v);
    byKey.set(v.passage_key, list);
  });

  return Array.from(byKey.entries()).map(([passageKey, list]) => {
    const selection =
      ((selections || []) as PassageSelection[]).find(s => s.passage_key === passageKey) || null;
    const current =
      (selection && list.find(v => v.variant_key === selection.variant_key)) ||
      list.find(v => v.is_default) ||
      list[0] ||
      null;
    return { passageKey, variants: list, selection, current };
  });
}

/** Template keys that carry any optional passage for this book gender. */
export async function fetchPassageChapters(gender: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('chapter_passage_variants')
    .select('template_key')
    .eq('gender', gender);
  return new Set(
    ((data || []) as { template_key: string | null }[])
      .map(r => r.template_key)
      .filter((k): k is string => !!k),
  );
}

/**
 * Template keys in this book that carry an optional passage the author has
 * not looked at yet. Used to pre-populate the Photos & Decisions basket.
 */
export async function fetchOpenPassageChapters(
  bookId: string,
  gender: string,
): Promise<Set<string>> {
  const [{ data: variants }, { data: selections }] = await Promise.all([
    supabase.from('chapter_passage_variants').select('template_key, passage_key').eq('gender', gender),
    supabase.from('chapter_passage_selections').select('passage_key, seen_at, chapter_id').eq('book_id', bookId),
  ]);
  if (!variants || variants.length === 0) return new Set();

  const seenKeys = new Set(
    ((selections || []) as { passage_key: string; seen_at: string | null }[])
      .filter(s => !!s.seen_at)
      .map(s => s.passage_key),
  );

  const open = new Set<string>();
  (variants as { template_key: string | null; passage_key: string }[]).forEach(v => {
    if (v.template_key && !seenKeys.has(v.passage_key)) open.add(v.template_key);
  });
  return open;
}

/**
 * Swap one passage body for another inside the chapter text.
 * Only swaps on a verbatim match — if the author has rewritten the passage we
 * report `not_found` and let the caller ask what to do. Nothing is discarded.
 */
export function swapPassage(
  text: string,
  currentBody: string,
  nextBody: string,
): { ok: boolean; text: string } {
  const haystack = normalizeWhitespace(text || '');
  const needle = normalizeWhitespace(currentBody || '');
  if (!needle) return { ok: false, text: haystack };
  const idx = haystack.indexOf(needle);
  if (idx === -1) return { ok: false, text: haystack };
  return {
    ok: true,
    text: normalizeWhitespace(
      haystack.slice(0, idx) + normalizeWhitespace(nextBody || '') + haystack.slice(idx + needle.length),
    ),
  };
}

/** Add a version at the end so the author can compare and delete the loser. */
export function appendPassage(text: string, nextBody: string): string {
  return normalizeWhitespace(`${text || ''}\n\n${nextBody || ''}`);
}

export async function savePassageSelection(params: {
  bookId: string;
  chapterId: string;
  passageKey: string;
  variantKey: string;
  appliedBody: string | null;
  previousContent: string | null;
}) {
  return supabase
    .from('chapter_passage_selections')
    .upsert(
      {
        book_id: params.bookId,
        chapter_id: params.chapterId,
        passage_key: params.passageKey,
        variant_key: params.variantKey,
        applied_body: params.appliedBody,
        previous_content: params.previousContent,
        seen_at: new Date().toISOString(),
      },
      { onConflict: 'chapter_id,passage_key' },
    )
    .select()
    .single();
}

export async function markPassageSeen(params: {
  bookId: string;
  chapterId: string;
  passageKey: string;
  variantKey: string;
  appliedBody: string | null;
}) {
  return supabase
    .from('chapter_passage_selections')
    .upsert(
      {
        book_id: params.bookId,
        chapter_id: params.chapterId,
        passage_key: params.passageKey,
        variant_key: params.variantKey,
        applied_body: params.appliedBody,
        seen_at: new Date().toISOString(),
      },
      { onConflict: 'chapter_id,passage_key' },
    )
    .select()
    .single();
}
