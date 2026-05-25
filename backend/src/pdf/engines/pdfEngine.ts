export enum EngineType {
  Puppeteer = 'puppeteer',
  PrinceXML = 'prince',
}

/**
 * PDFEngine abstraction for rendering PDFs.
 * The `generate` method performs a two‑pass rendering workflow:
 *   1. Calls `renderHtml` (optionally with chapter page mapping) to obtain the HTML for the first pass.
 *   2. Calculates layout information (page count, chapter mappings).
 *   3. Calls `renderHtml` again with the mapping to produce final HTML.
 *   4. Generates the PDF and returns it as a Buffer.
 */
export interface PDFEngine {
  generate(options: {
    /**
     * Callback that should return the HTML string for a rendering pass.
     * The optional `chapterPages` argument contains a mapping of chapter identifiers
     * to their starting page numbers, which is populated after the first pass.
     */
    renderHtml: (chapterPages?: Record<string, number>) => Promise<string>;
  }): Promise<Buffer>;
}
