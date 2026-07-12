// Normalize any Loom URL (share, embed, or with query params) to an embed URL.
// Returns '' for empty/unrecognized input so the caller can show a placeholder.
export const normalizeLoomUrl = (raw: string): string => {
  const url = (raw || '').trim();
  if (!url) return '';
  const match = url.match(/loom\.com\/(?:share|embed|v)\/([a-zA-Z0-9]+)/);
  if (!match) return url; // unknown host — pass through so admin sees it
  return `https://www.loom.com/embed/${match[1]}`;
};
