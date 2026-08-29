// Normalize a video URL (Loom or Descript, share or embed) to an embeddable URL.
// Returns '' for empty input so the caller can show a placeholder.
export const normalizeLoomUrl = (raw: string): string => {
  const url = (raw || '').trim();
  if (!url) return '';

  const loom = url.match(/loom\.com\/(?:share|embed|v)\/([a-zA-Z0-9]+)/);
  if (loom) return `https://www.loom.com/embed/${loom[1]}`;

  // Descript share pages block iframes; their /embed/ form is embeddable.
  const descript = url.match(/share\.descript\.com\/(?:view|embed)\/([a-zA-Z0-9]+)/);
  if (descript) return `https://share.descript.com/embed/${descript[1]}`;

  return url; // unknown host — pass through so admin sees it
};
