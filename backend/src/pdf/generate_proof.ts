import { generatePDF } from './generatePDF';
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

async function generateProof() {
  const bookData = {
    title: 'A Century of Wisdom',
    author: 'Eleanor Vance',
    chapters: [
      {
        chapter_number: 0,
        title: 'Author Letter',
        content: '<p>Dear Reader, this letter serves as the beginning of a long journey. May these pages offer insight, comfort, and direction. We compiled these stories over many decades, drawing from experiences that shaped our understanding of nature, patience, and love.</p><p>As you read through these pages, we invite you to reflect on your own journey, remembering that wisdom is not a destination but a way of traveling. Enjoy every single step.</p>',
        chapter_template: 'letter',
        photo_urls: []
      },
      {
        chapter_number: 1,
        title: 'Chapter A: The Path of Patience',
        chapter_template: 'classic',
        content: `
          <p>Wisdom begins with listening, not speaking. In a world filled with endless noise, the quiet mind becomes a sanctuary for truth. When we take the time to pause and reflect on the moments that define our lives, we discover that the most profound lessons are often found in the quietest spaces.</p>
          <p>To build a life of meaning, one must cultivate patience. Patience is not merely the ability to wait, but the attitude we maintain while waiting. It is the understanding that growth takes time, like a seed developing under the dark soil before it breaks through to the light. We cannot rush the seasons of our lives, and attempting to do so only leads to frustration and missed opportunities.</p>
          <p>Gratitude is the lens that transforms ordinary days into thanksgiving. When we focus on what we lack, our world shrinks. But when we focus on what we have, our hearts expand. Gratitude is not a response to good fortune; it is a choice to see the beauty in every circumstance, to find the silver linings even when the sky is covered in clouds.</p>
          <p>Kindness is a language that the deaf can hear and the blind can see. A simple act of kindness, no matter how small, has a ripple effect that can change the course of someone's day. It requires no wealth, no status, and no special talent—only a willing heart and a moment of genuine presence.</p>
          <p>Finally, failure is not the opposite of success, but a stepping stone toward it. Every setback is an opportunity to learn, to adjust our course, and to grow stronger. Those who never fail are those who never try. Embrace the challenges, for they are the very things that shape our character and build our resilience.</p>
        `,
        memories: [
          { memory_text: 'I remember when you showed me how to listen to the wind in the trees. It taught me to appreciate the silence.', contributor_name: 'Sarah' },
          { memory_text: 'Your patience during my hardest years was a beacon of hope.', contributor_name: 'James' }
        ]
      },
      {
        chapter_number: 2,
        title: 'Chapter B: Scenic Heights',
        chapter_template: 'horizontal_photo',
        photo_urls: ['https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=1000&auto=format&fit=crop'],
        content: `
          <p>There is a unique clarity that comes from standing on the peak of a mountain, looking out over the vast expanse below. The challenges that seemed so large from the valley suddenly appear small and manageable. Nature has a way of restoring our perspective if we are willing to step away and listen.</p>
          <p>When we align our path with the natural rhythms of life, we find a sense of peace that no material success can replicate. Let the mountains teach you strength, and let the rivers teach you flow.</p>
        `,
        quote_text: 'In all things of nature there is something of the marvelous.',
        quote_attribution: 'Aristotle',
        bible_verse_text: 'The heavens declare the glory of God; the skies proclaim the work of his hands.',
        bible_verse_reference: 'Psalm 19:1'
      },
      {
        chapter_number: 3,
        title: 'Chapter C: Vertical Horizons',
        chapter_template: 'vertical_photo',
        photo_urls: ['https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=1000&auto=format&fit=crop'],
        content: `
          <p>A vertical portrait photo creates a tall, elegant margin framing on the page. Combining this layout with a clean text block produces a beautifully balanced page design that feels premium and print-ready.</p>
        `,
        quote_text: 'Look deep into nature, and then you will understand everything better.',
        quote_attribution: 'Albert Einstein',
        memories: [
          { memory_text: 'Your advice on vertical focus changed the way I work.', contributor_name: 'David' }
        ]
      },
      {
        chapter_number: 4,
        title: 'Chapter D: A Short Thought',
        chapter_template: 'classic',
        content: `
          <p>This is a very short chapter. It has only one paragraph, and it should easily fit on a single page without overflowing. The engine should clean up any empty page 2 for this chapter.</p>
        `,
        memories: []
      }
    ],
    ancestryText: 'Where You Come From contains ancestry history, records, and merged scans showing the lineage of the Vance family.',
    ancestryPdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
  };

  console.log('=== STARTING PRINT VALIDATION & PROOFING ===');

  // Capture logging output to audit alignment
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

  const pdfBuffer = await generatePDF(bookData);

  // Restore logger
  console.log = originalLog;

  const outputPath = path.join(process.cwd(), 'test-proof.pdf');
  fs.writeFileSync(outputPath, pdfBuffer);
  console.log(`\nSaved Final Proof PDF to: ${outputPath}`);

  // --- QA ASSERTIONS ---

  console.log('\n--- PRINT-SAFE QA VALIDATIONS ---');

  // Assertion 1: TOC Drift Audit
  console.log('1. Auditing TOC Drift...');
  if (pass1Coords.length === 0 || pass2Coords.length === 0) {
    throw new Error('[FAIL] No coordinate logs captured.');
  }

  let drift = false;
  for (let i = 0; i < pass1Coords.length; i++) {
    if (pass1Coords[i] !== pass2Coords[i]) {
      console.error(`  [FAIL] Coordinate mismatch at index ${i}: Pass 1='${pass1Coords[i]}', Pass 2='${pass2Coords[i]}'`);
      drift = true;
    }
  }
  if (drift) {
    throw new Error('[FAIL] Print Validation Failed: TOC drift detected.');
  }
  console.log('  [PASS] Zero layout/TOC drift between rendering passes verified.');

  // Assertion 2: Merged Page Counts
  console.log('2. Auditing Page Counts...');
  const mainPdfDoc = await PDFDocument.load(pdfBuffer);
  const totalPageCount = mainPdfDoc.getPageCount();
  const expectedPages = pass1Total + 1; // Main pages + 1 ancestry PDF page
  if (totalPageCount !== expectedPages) {
    throw new Error(`[FAIL] Page count mismatch. Expected ${expectedPages} pages, got ${totalPageCount}`);
  }
  console.log(`  [PASS] Page count matches expected: Calculated ${pass1Total} + Appended 1 = ${totalPageCount} pages`);

  // Assertion 3: Page Dimensions & Bleed Validation
  console.log('3. Auditing Trim Dimensions & Safe Areas...');
  let dimensionsMatch = true;
  for (let i = 0; i < totalPageCount; i++) {
    const page = mainPdfDoc.getPage(i);
    const { width, height } = page.getSize();
    const wRounded = Math.round(width);
    const hRounded = Math.round(height);
    if (wRounded !== 441 || hRounded !== 666) {
      console.error(`  [FAIL] Page ${i + 1} dimensions: ${wRounded}x${hRounded}pt (Expected 441x666pt)`);
      dimensionsMatch = false;
    }
  }
  if (!dimensionsMatch) {
    throw new Error('[FAIL] Print Validation Failed: Dimensional trim discrepancy detected.');
  }
  console.log('  [PASS] All pages conform to the strict 6.125in x 9.25in (441x666pt) print box.');

  console.log('\n=============================================');
  console.log('✅ PRINT VALIDATION & QA CHECKS PASSED SUCCESFULLY!');
  console.log('=============================================');
}

generateProof().catch(err => {
  console.error(err);
  process.exit(1);
});
