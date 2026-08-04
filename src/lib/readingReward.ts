/**
 * The Reading-Reward line is authored as a `<mark>…</mark>` paragraph inside the
 * chapter's frozen `seed_content`. Some save paths (exact page-splitting from the
 * rendered preview DOM) extract *plain text*, which silently drops the `<mark>`
 * wrapper — so the edit view loses the highlight and the author can't tell which
 * line is the special one.
 *
 * `restoreMarkTags` re-wraps the reward text in the working copy whenever the
 * marker was lost, using the seed as the source of truth. Whitespace differences
 * are tolerated; if the author reworded or deleted the line, nothing is restored.
 */

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Build a whitespace-tolerant matcher for an exact inner string. */
const looseMatcher = (inner: string) =>
  new RegExp(
    inner
      .trim()
      .split(/\s+/)
      .map(escapeRe)
      .join('\\s+'),
    'i',
  );

export const hasMarkTag = (text: string | null | undefined) => /<mark\b/i.test(text || '');

export const restoreMarkTags = (
  text: string,
  seedContent: string | null | undefined,
): string => {
  if (!text || !seedContent || !hasMarkTag(seedContent)) return text;

  let out = text;
  const re = /<mark[^>]*>([\s\S]*?)<\/mark>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(seedContent)) !== null) {
    const inner = m[1];
    if (!inner.trim()) continue;
    // Already wrapped somewhere in the working copy — leave it alone.
    if (new RegExp(`<mark[^>]*>\\s*${escapeRe(inner.trim())}`, 'i').test(out)) continue;
    const matcher = looseMatcher(inner);
    const found = matcher.exec(out);
    if (!found) continue; // author reworded or removed it — respect that
    out = out.slice(0, found.index) + `<mark>${found[0]}</mark>` + out.slice(found.index + found[0].length);
  }
  return out;
};
