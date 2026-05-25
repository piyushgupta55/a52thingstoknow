import { BookData } from './types/pdf';
import { renderBook } from './templates/shared/layout';
import { pdfConfig } from '../config/pdfConfig';
import { createEngine } from './engines';
import { validateChapterLength } from './utils/pagination';
import { validateImages } from './utils/imageValidation';
import { PDFDocument } from 'pdf-lib';
import { validatePdfDimensions } from './utils/pdfValidation';

export async function generatePDF(bookData: BookData): Promise<Buffer> {
  const validation = validateChapterLength(bookData);
  const imageWarnings = await validateImages(bookData);
  
  const allWarnings = [...validation.warnings, ...imageWarnings];

  if (allWarnings.length > 0) {
    console.warn("--- CONTENT BUDGET & PRINT WARNINGS ---");
    allWarnings.forEach(w => console.warn(`[WARN] ${w.type}: ${w.message}`));
    console.warn("---------------------------------------");
  }

  // 1. Instantiate Engine (swappable later)
  const engine = createEngine(pdfConfig.engine);

  // 2. Generate Main PDF Buffer via Two-Pass Callback
  const mainPdfBuffer = await engine.generate({
    renderHtml: (chapterPages) => renderBook(bookData, chapterPages),
  });

  // 4. Merge Ancestry PDF if provided
  if (bookData.ancestryPdfUrl) {
    try {
      console.log(`Fetching uploaded ancestry PDF from ${bookData.ancestryPdfUrl}...`);
      const response = await fetch(bookData.ancestryPdfUrl);
      if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.statusText}`);
      const uploadedPdfBuffer = await response.arrayBuffer();

      console.log('Merging uploaded PDF with main PDF...');
      const mainPdfDoc = await PDFDocument.load(mainPdfBuffer);
      const uploadedPdfDoc = await PDFDocument.load(uploadedPdfBuffer);

      const pdfWarnings = validatePdfDimensions(uploadedPdfDoc, -1);
      if (pdfWarnings.length > 0) {
        console.warn("--- UPLOADED PDF WARNINGS ---");
        pdfWarnings.forEach(w => console.warn(`[WARN] ${w.type}: ${w.message}`));
        console.warn("-----------------------------");
      }

      const embeddedPages = await mainPdfDoc.embedPages(uploadedPdfDoc.getPages());
      const TARGET_WIDTH = 441; // 6.125 inches
      const TARGET_HEIGHT = 666; // 9.25 inches

      embeddedPages.forEach((embeddedPage) => {
        const newPage = mainPdfDoc.addPage([TARGET_WIDTH, TARGET_HEIGHT]);
        const { width, height } = embeddedPage;
        
        // Scale to fit
        const scale = Math.min(TARGET_WIDTH / width, TARGET_HEIGHT / height);
        const scaledWidth = width * scale;
        const scaledHeight = height * scale;

        // Center on the page
        const x = (TARGET_WIDTH - scaledWidth) / 2;
        const y = (TARGET_HEIGHT - scaledHeight) / 2;

        newPage.drawPage(embeddedPage, {
          x,
          y,
          width: scaledWidth,
          height: scaledHeight,
        });
      });

      const mergedPdfBytes = await mainPdfDoc.save();
      return Buffer.from(mergedPdfBytes);
    } catch (err) {
      console.error('Failed to merge ancestry PDF:', err);
      // Fallback: return the main PDF without the broken ancestry section
      return mainPdfBuffer;
    }
  }

  return mainPdfBuffer;
}
