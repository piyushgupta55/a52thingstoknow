import { generatePDF } from './generatePDF';
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

async function verify() {
  const bookData = {
    title: 'A Verification of Wisdom',
    author: 'Verification Agent',
    chapters: [
      {
        chapter_number: 0,
        title: 'Introduction',
        content: '<p>Standard introduction letter content that is short and fits on one page.</p>',
        chapter_template: 'letter',
        photo_urls: []
      },
      {
        chapter_number: 1,
        title: 'Chapter A: The Core Principles',
        chapter_template: 'classic',
        content: `
          <p>This is paragraph 1 of the core principles. It provides standard wisdom guidelines.</p>
          <p>This is paragraph 2 of the core principles. It has some more text to fill up space but should stay within a 2-page spread.</p>
        `,
        memories: [
          { memory_text: 'Verification memory 1.', contributor_name: 'Verifier' }
        ]
      },
      {
        chapter_number: 2,
        title: 'Chapter B: Scenic Heights',
        chapter_template: 'horizontal_photo',
        photo_urls: ['https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=1000&auto=format&fit=crop'],
        content: `
          <p>Scenic heights and horizontal photo layouts should behave nicely under two-pass pagination.</p>
        `
      }
    ],
    ancestryText: 'This is ancestry textual background information.',
    ancestryPdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
  };

  console.log('--- STARTING ROBUST PHASE 8 VERIFICATION ---');

  // Intercept console.log to capture engine mappings and coordinates
  const originalLog = console.log;
  let pass1Mapping: Record<string, number> = {};
  let pass1Total = 0;
  
  const pass1Coords: string[] = [];
  const pass2Coords: string[] = [];
  let isPass2 = false;

  console.log = function (...args: any[]) {
    const msg = args.join(' ');
    
    if (msg.includes('Pass 2: Re-rendering layout')) {
      isPass2 = true;
    }
    
    if (msg.includes('Calculated Chapter Page Mapping:')) {
      pass1Mapping = args[1] as Record<string, number>;
    }
    
    if (msg.includes('Total pages calculated:')) {
      const match = msg.match(/Total pages calculated: (\d+)/);
      if (match) {
        pass1Total = parseInt(match[1]);
      }
    }

    if (msg.includes('PUPPETEER PAGE LOG: splitPageIfNeeded')) {
      const coordMatch = msg.match(/(splitPageIfNeeded \[ch=\w+, depth=\d+\]: pageRect\.top=\d+)/);
      if (coordMatch) {
        if (isPass2) {
          pass2Coords.push(coordMatch[1]);
        } else {
          pass1Coords.push(coordMatch[1]);
        }
      }
    }
    
    originalLog.apply(console, args);
  };

  // Generate PDF
  const pdfBuffer = await generatePDF(bookData);

  // Restore original logger
  console.log = originalLog;

  const outputPath = path.join(process.cwd(), 'verify-output.pdf');
  fs.writeFileSync(outputPath, pdfBuffer);
  console.log(`Saved PDF for analysis to ${outputPath}`);

  // 1. Validate TOC mapping and coordinate matching (Risk 1: TOC Drift)
  console.log('\n--- VERIFYING RISK 1: TOC DRIFT ---');
  console.log('Pass 1 Chapter Mapping:', pass1Mapping);
  console.log('Pass 1 Coordinates:', pass1Coords);
  console.log('Pass 2 Coordinates:', pass2Coords);

  if (pass1Coords.length === 0 || pass2Coords.length === 0) {
    throw new Error('Verification failed: No coordinate logs captured.');
  }

  let driftDetected = false;
  if (pass1Coords.length !== pass2Coords.length) {
    console.error(`[FAIL] Coordinate count mismatch: Pass 1 has ${pass1Coords.length}, Pass 2 has ${pass2Coords.length}`);
    driftDetected = true;
  } else {
    for (let i = 0; i < pass1Coords.length; i++) {
      if (pass1Coords[i] !== pass2Coords[i]) {
        console.error(`[FAIL] Coordinate mismatch at index ${i}: Pass 1 has '${pass1Coords[i]}', Pass 2 has '${pass2Coords[i]}'`);
        driftDetected = true;
      } else {
        console.log(`[PASS] Coordinate match: ${pass1Coords[i]}`);
      }
    }
  }

  if (driftDetected) {
    throw new Error('Verification failed: TOC drift detected.');
  }
  console.log('[SUCCESS] Proven: Zero layout/TOC drift between rendering passes!');

  // 2. Validate Page Count and Merged PDF structure (Risk 3)
  console.log('\n--- VERIFYING RISK 3: MERGED PAGE COUNTS & ALIGNMENT ---');
  const mainPdfDoc = await PDFDocument.load(pdfBuffer);
  const totalPageCount = mainPdfDoc.getPageCount();
  console.log(`Total PDF Pages: ${totalPageCount}`);
  
  // Puppeteer calculated 6 pages, and we merge a 1-page dummy PDF.
  // The final PDF must contain exactly 7 pages.
  const expectedTotalPages = pass1Total + 1;
  if (totalPageCount !== expectedTotalPages) {
    throw new Error(`Verification failed: Page count mismatch. Expected ${expectedTotalPages} pages, got ${totalPageCount}`);
  }
  console.log(`[PASS] Page count matches exactly: Calculated ${pass1Total} + Appended 1 = ${totalPageCount} pages`);

  // Let's verify page sizes are uniform (6.125in x 9.25in = 441 x 666 pt)
  let dimensionsMatch = true;
  for (let i = 0; i < totalPageCount; i++) {
    const page = mainPdfDoc.getPage(i);
    const { width, height } = page.getSize();
    const wRounded = Math.round(width);
    const hRounded = Math.round(height);
    if (wRounded !== 441 || hRounded !== 666) {
      console.error(`[FAIL] Page ${i + 1} has wrong dimensions: ${wRounded}x${hRounded}pt (Expected 441x666pt)`);
      dimensionsMatch = false;
    } else {
      console.log(`[PASS] Page ${i + 1} dimensions match perfectly: ${wRounded}x${hRounded}pt`);
    }
  }

  if (!dimensionsMatch) {
    throw new Error('Verification failed: Dimension mismatch on merged pages.');
  }

  console.log('\n--- VERIFICATION SUCCESSFUL ---');
}

verify().catch((err) => {
  console.error(err);
  process.exit(1);
});
