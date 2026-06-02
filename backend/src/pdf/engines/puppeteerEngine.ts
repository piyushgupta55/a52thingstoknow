import puppeteer from 'puppeteer';
import { PDFEngine } from './pdfEngine';
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

const getDebugHtmlDir = () => path.join(process.cwd(), 'debug', 'html');

const writeDebugHtml = (filename: string, html: string) => {
  const dir = getDebugHtmlDir();
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, html, 'utf8');
  return filePath;
};

export class PuppeteerEngine implements PDFEngine {
  async generate(options: {
    renderHtml: (chapterPages?: Record<string, number>) => Promise<string>;
  }): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      page.setDefaultNavigationTimeout(120000);
      page.setDefaultTimeout(120000);
      page.on('console', msg => console.log('PUPPETEER PAGE LOG:', msg.text()));
      page.on('pageerror', (err: any) => console.error('PUPPETEER PAGE ERROR:', err.message || err));

      
      // Pass 1: Render layout to calculate page numbers
      console.log('Pass 1: Rendering layout to calculate page numbers...');
      const htmlPass1 = await options.renderHtml();
      
      try {
        const debugPath = writeDebugHtml('debug-pass1-latest.html', htmlPass1);
        console.log(`Saved Pass 1 HTML for debugging: ${debugPath}`);
      } catch (err) {
        console.warn('Could not save debug-pass1.html:', err);
      }

      await page.setContent(htmlPass1, {
        waitUntil: 'load',
      });
      await page.evaluate(async () => {
        const imgs = Array.from(document.querySelectorAll('img'));
        await Promise.all(imgs.map(img => {
          if (img.complete) return;
          return new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        }));
      });
      await page.waitForSelector('body.layout-final');

      const layoutInfo = await page.evaluate(() => {
        const pages = Array.from(document.querySelectorAll('.page'));
        const mapping: Record<string, number> = {};
        pages.forEach((p, index) => {
          const chapter = p.getAttribute('data-chapter');
          if (chapter && mapping[chapter] === undefined) {
            mapping[chapter] = index + 1; // 1-based page number
          }
        });
        return {
          mapping,
          totalPages: pages.length
        };
      });

      console.log('Calculated Chapter Page Mapping:', layoutInfo.mapping);
      console.log(`Total pages calculated: ${layoutInfo.totalPages}`);

      // Pass 2: Re-render layout with correct page numbers and generate PDF
      console.log('Pass 2: Re-rendering layout with correct page numbers...');
      const htmlPass2 = await options.renderHtml(layoutInfo.mapping);

      try {
        const debugPath = writeDebugHtml('debug-pass2-latest.html', htmlPass2);
        console.log(`Saved Pass 2 HTML for debugging: ${debugPath}`);
      } catch (err) {
        console.warn('Could not save debug-pass2.html:', err);
      }

      await page.setContent(htmlPass2, {
        waitUntil: 'load',
      });
      await page.evaluate(async () => {
        const imgs = Array.from(document.querySelectorAll('img'));
        await Promise.all(imgs.map(img => {
          if (img.complete) return;
          return new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        }));
      });
      await page.waitForSelector('body.layout-final');

      console.log('Generating final PDF page-by-page...');
      const mergedDoc = await PDFDocument.create();

      for (let i = 1; i <= layoutInfo.totalPages; i++) {
        const isFront = (i === 1 || i === 2);
        const isEven = (i % 2 === 0);
        const footerAlign = isEven ? 'left' : 'right';
        const footerPadding = isEven ? 'padding-left: 0.625in;' : 'padding-right: 0.625in;';
        
        const pageBuffer = await page.pdf({
          pageRanges: `${i}`,
          displayHeaderFooter: !isFront,
          headerTemplate: '<span></span>',
          footerTemplate: isFront ? '<span></span>' : `
            <div style="font-size: 9pt; font-family: 'Lora', 'Georgia', serif; text-align: ${footerAlign}; width: 100%; ${footerPadding} box-sizing: border-box; margin-bottom: 0.35in; color: #666;">
              ${i}
            </div>
          `,
          width: '6.125in',
          height: '9.25in',
          printBackground: true,
          margin: {
            top: '0in',
            bottom: '0.625in',
            left: '0in',
            right: '0in'
          }
        });

        const pageDoc = await PDFDocument.load(pageBuffer);
        const [copiedPage] = await mergedDoc.copyPages(pageDoc, [0]);
        mergedDoc.addPage(copiedPage);
      }

      const finalPdfBuffer = await mergedDoc.save();
      return Buffer.from(finalPdfBuffer);
    } finally {
      await browser.close();
    }
  }
}
