import { PDFEngine, EngineType } from './pdfEngine';
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

/**
 * PrinceXML PDF engine implementation.
 *
 * It follows the same `PDFEngine` contract as the Puppeteer engine.
 * The two‑pass layout workflow is preserved: the caller supplies a
 * `renderHtml` callback that receives an optional `chapterPages`
 * mapping (page numbers for each chapter). For simplicity we invoke the
 * callback once without a mapping – a full implementation could reuse the
 * existing PuppeteerEngine to compute the mapping first.
 */
export class PrinceEngine implements PDFEngine {
  constructor(private binaryPath: string = 'prince') {}

  async generate(options: { renderHtml: (chapterPages?: Record<string, number>) => Promise<string> }): Promise<Buffer> {
    // Generate the final HTML (without a mapping for now)
    const html = await options.renderHtml();

    // Write HTML to a temporary file
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prince-'));
    const htmlPath = path.join(tmpDir, 'book.html');
    await fs.writeFile(htmlPath, html, 'utf8');

    // Output PDF path
    const pdfPath = path.join(tmpDir, 'book.pdf');

    // Build Prince command arguments
    const args = [htmlPath, `--output=${pdfPath}`, '--media=print'];

    // Execute PrinceXML CLI
    await new Promise<void>((resolve, reject) => {
      execFile(this.binaryPath, args, (error, _stdout, stderr) => {
        if (error) {
          console.error('PrinceXML execution error:', stderr);
          return reject(error);
        }
        resolve();
      });
    });

    // Read the generated PDF
    const pdfBuffer = await fs.readFile(pdfPath);

    // Cleanup temporary directory
    await fs.rm(tmpDir, { recursive: true, force: true });

    return pdfBuffer;
  }
}
