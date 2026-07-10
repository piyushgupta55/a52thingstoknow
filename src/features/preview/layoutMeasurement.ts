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

export const isRenderablePage = (page: HTMLElement) => {
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
    const pageTop = rect.top + paddingTop;
    
    // Match backend exact logic: maxBottom = pageRect.top + (800 * scale)
    const scale = (rect.height / 828) || 1;
    const backendMaxBottom = rect.top + (800 * scale);
    const capacityPx = Math.max(0, backendMaxBottom - pageTop);

    let maxBottom = pageTop;
    Array.from(page.children).forEach((child) => {
      const el = child as HTMLElement;
      if (el.classList.contains('page-number')) return;
      
      // Ignore ghost containers left behind by backend splitting
      if (el.classList.contains('memories-section') && el.querySelectorAll('.memory-item').length === 0) return;
      if (el.classList.contains('wisdom-text') && el.innerHTML.trim() === '') return;
      
      let effectiveBottom = el.getBoundingClientRect().bottom;
      
      // The backend PDF layout engine measures individual paragraph <p> units, not the .wisdom-text wrapper.
      // Due to CSS margin collapse rules, the wrapper's bounding box can artificially extend ~12px past its last paragraph.
      // By measuring the last child, we perfectly align our capacity measurement with the backend's logic.
      if (el.classList.contains('wisdom-text') && el.lastElementChild) {
        effectiveBottom = el.lastElementChild.getBoundingClientRect().bottom;
      }
      
      if (effectiveBottom > maxBottom) maxBottom = effectiveBottom;
    });

    const contentPx = Math.max(0, maxBottom - pageTop);
    let fillPercent = capacityPx > 0 ? Math.max(0, Math.min(100, (contentPx / capacityPx) * 100)) : 0;
    if (fillPercent >= 96 && fillPercent < 100) {
      fillPercent = 100;
    }
    const remainingPx = Math.max(0, capacityPx - contentPx);

    // Be strict about overflow, but allow a tiny 1px variance for floating point rounding
    const overflows = contentPx > capacityPx + 1;

    return {
      pageIndex,
      chapter: page.getAttribute('data-chapter'),
      isOverflowPage: page.classList.contains('page-overflow'),
      fillPercent,
      remainingPx,
      contentPx,
      capacityPx,
      overflows,
    } satisfies PageLayoutMeasurement;
  });

  const overflowPageIndexes = metrics
    .filter((m) => m.overflows)
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

  // Replace dropcap containers with their actual letter attribute so textContent extracts it correctly
  clone.querySelectorAll('.dropcap-svg-container').forEach((node) => {
    const letter = node.getAttribute('data-dropcap-letter') || '';
    node.replaceWith(letter);
  });

  // Replace <br> and <br /> elements with newlines to preserve manual line breaks
  clone.querySelectorAll('br').forEach((br) => {
    br.replaceWith('\n');
  });

  // Extract text from <p> tags if present to preserve paragraphs
  const pTags = Array.from(clone.querySelectorAll('p'));
  if (pTags.length > 0) {
    return pTags
      .map((p) => p.textContent || '')
      .join('\n\n')
      .trim();
  }

  return normalizeExtractedText(clone.textContent || '');
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
