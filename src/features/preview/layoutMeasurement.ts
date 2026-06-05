export interface PageLayoutMeasurement {
  pageIndex: number;
  chapter: string | null;
  isOverflowPage: boolean;
  fillPercent: number;
  remainingPx: number;
  contentPx: number;
  capacityPx: number;
  overflows: boolean;
}

export interface LayoutMeasurementResult {
  pageCount: number;
  overflowPageCount: number;
  overflowDetected: boolean;
  totalPages: number;
  pages: PageLayoutMeasurement[];
  overflowPageIndexes: number[];
}

export interface ExactChapterSplitResult {
  page1: string;
  page2: string;
}

const parsePx = (value: string | null | undefined) => {
  if (!value) return 0;
  const next = Number.parseFloat(value);
  return Number.isFinite(next) ? next : 0;
};

const isRenderablePage = (page: HTMLElement) => {
  const hasText = (page.textContent || '').replace(/\s+/g, '').length > 0;
  const hasMedia = page.querySelector('img, svg, .chapter-photo, .memory-item, .cover-frame') !== null;
  return hasText || hasMedia;
};

export const measureLayout = (doc: Document): LayoutMeasurementResult => {
  const pages = Array.from(doc.querySelectorAll<HTMLElement>('.page'));
  const view = doc.defaultView;

  const metrics = pages.map((page, pageIndex) => {
    const rect = page.getBoundingClientRect();
    const styles = view ? view.getComputedStyle(page) : null;
    const paddingTop = parsePx(styles?.paddingTop);
    const paddingBottom = parsePx(styles?.paddingBottom);
    const capacityPx = Math.max(0, rect.height - paddingTop - paddingBottom);
    const pageTop = rect.top + paddingTop;

    let maxBottom = pageTop;
    Array.from(page.children).forEach((child) => {
      const el = child as HTMLElement;
      if (el.classList.contains('page-number')) return;
      const childRect = el.getBoundingClientRect();
      if (childRect.bottom > maxBottom) maxBottom = childRect.bottom;
    });

    const contentPx = Math.max(0, maxBottom - pageTop);
    const fillPercent = capacityPx > 0 ? Math.max(0, Math.min(100, (contentPx / capacityPx) * 100)) : 0;
    const remainingPx = Math.max(0, capacityPx - contentPx);

    return {
      pageIndex,
      chapter: page.getAttribute('data-chapter'),
      isOverflowPage: page.classList.contains('page-overflow'),
      fillPercent,
      remainingPx,
      contentPx,
      capacityPx,
      overflows: contentPx > capacityPx,
    } satisfies PageLayoutMeasurement;
  });

  const overflowPageIndexes = metrics
    .filter((m) => m.isOverflowPage || m.overflows)
    .map((m) => m.pageIndex);
  const overflowPageCount = overflowPageIndexes.length;
  const overflowDetected = overflowPageCount > 0;
  const totalPages = pages.length;

  return {
    pageCount: pages.length,
    overflowPageCount,
    overflowDetected,
    totalPages,
    pages: metrics,
    overflowPageIndexes,
  };
};

const normalizeRenderedText = (value: string) => value
  .replace(/\u00A0/g, ' ')
  .replace(/\r\n?/g, '\n');

const normalizeExtractedText = (value: string) => normalizeRenderedText(value).trimStart();

const extractWisdomText = (wisdom: HTMLElement | null) => {
  if (!wisdom) return '';

  const clone = wisdom.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.quote-wrapper, .memories-section, .chapter-photo, .page-number, .intro-footer-separator, .letter-signature').forEach((node) => {
    node.remove();
  });

  return normalizeExtractedText(clone.innerText || clone.textContent || '');
};

export const extractExactChapterSplit = (doc: Document, chapterKey: string): ExactChapterSplitResult => {
  const pages = Array.from(doc.querySelectorAll<HTMLElement>(`.page[data-chapter="${chapterKey}"]`)).filter(isRenderablePage);

  if (pages.length === 0) {
    return { page1: '', page2: '' };
  }

  const pageTexts = pages.map((page) => extractWisdomText(page.querySelector<HTMLElement>('.wisdom-text')));

  return {
    page1: pageTexts[0] || '',
    page2: normalizeExtractedText(pageTexts.slice(1).join('')),
  };
};
