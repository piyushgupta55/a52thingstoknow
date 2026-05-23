import { PDFDocument, PDFName, PDFStream, PDFNumber } from 'pdf-lib';
import type { ValidationWarning } from './pagination';

const TARGET_WIDTH = 441; // 6.125 inches * 72 pt/in
const TARGET_HEIGHT = 666; // 9.25 inches * 72 pt/in
const TOLERANCE = 5; // allow up to 5 points variance

export function validatePdfDimensions(pdfDoc: PDFDocument, chapterNumber: number = -1): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const pages = pdfDoc.getPages();

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();
    
    const isLandscape = width > height;

    if (isLandscape) {
      warnings.push({
        chapterNumber,
        type: 'pdf_landscape',
        message: `Uploaded PDF page ${i + 1} is landscape (${Math.round(width)}x${Math.round(height)}pt). The book uses a portrait layout (${TARGET_WIDTH}x${TARGET_HEIGHT}pt). It will be scaled to fit.`
      });
      continue;
    }

    const widthDiff = Math.abs(width - TARGET_WIDTH);
    const heightDiff = Math.abs(height - TARGET_HEIGHT);

    if (widthDiff > TOLERANCE || heightDiff > TOLERANCE) {
      warnings.push({
        chapterNumber,
        type: 'pdf_wrong_dimensions',
        message: `Uploaded PDF page ${i + 1} has dimensions ${Math.round(width)}x${Math.round(height)}pt. Expected ~${TARGET_WIDTH}x${TARGET_HEIGHT}pt. It will be scaled to fit, which may result in white borders.`
      });
    }
  }

  // --- NEW: DPI Heuristic Validation ---
  let maxImageWidth = 0;
  
  const context = pdfDoc.context;
  const indirectObjects = context.enumerateIndirectObjects();
  
  for (const [ref, obj] of indirectObjects) {
    if (obj instanceof PDFStream) {
      const dict = obj.dict;
      if (dict.get(PDFName.of('Type')) === PDFName.of('XObject') && 
          dict.get(PDFName.of('Subtype')) === PDFName.of('Image')) {
          
        const widthObj = dict.get(PDFName.of('Width'));
        if (widthObj instanceof PDFNumber) {
          const width = widthObj.asNumber();
          if (width > maxImageWidth) {
            maxImageWidth = width;
          }
        }
      }
    }
  }

  // Assume the largest image spans the entire width (6.125 inches)
  if (maxImageWidth > 0) {
    const effectiveDpi = Math.round(maxImageWidth / 6.125);
    if (effectiveDpi < 250) {
      warnings.push({
        chapterNumber,
        type: 'pdf_low_dpi',
        message: `Uploaded PDF contains a scanned image with an estimated resolution of ${effectiveDpi} DPI. Recommended minimum is 250 DPI. It may appear blurry in print.`
      });
    }
  }

  return warnings;
}
