import express, { Request, Response } from 'express';
import cors from 'cors';
import * as fs from 'fs';
import * as path from 'path';
import { generatePDF } from './pdf/generatePDF';
import { renderBook } from './pdf/templates/shared/layout';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Allow frontend to call the backend
app.use(express.json({ limit: '50mb' })); // Allow large payloads (e.g. base64 images if any)

const debugHtmlDir = path.join(process.cwd(), 'debug', 'html');

const sendDebugHtml = (filename: string, res: Response) => {
  const filePath = path.join(debugHtmlDir, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Debug HTML not found');
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.sendFile(filePath);
};

app.get('/debug-pass1-latest.html', (_req: Request, res: Response) => {
  sendDebugHtml('debug-pass1-latest.html', res);
});

app.get('/debug-pass2-latest.html', (_req: Request, res: Response) => {
  sendDebugHtml('debug-pass2-latest.html', res);
});

app.get('/debug/html/:filename', (req: Request, res: Response) => {
  const { filename } = req.params;
  if (!/^debug-pass[12]-latest\.html$/.test(filename)) {
    return res.status(404).send('Debug HTML not found');
  }
  return sendDebugHtml(filename, res);
});

// Healthcheck endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', service: 'pdf-backend' });
});

// PDF Generation endpoint
app.post('/generate-pdf', async (req: Request, res: Response) => {
  try {
    const bookData = req.body;
    
    if (!bookData || !bookData.title) {
      return res.status(400).json({ error: 'Invalid or missing bookData payload' });
    }

    console.log(`Received request to generate PDF for: ${bookData.title}`);
    
    // Call the extracted PDF generation logic
    const pdfBuffer = await generatePDF(bookData);

    console.log(`PDF generated successfully. Size: ${pdfBuffer.length} bytes`);

    // Send the generated PDF as a binary response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="book.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(Buffer.from(pdfBuffer));

  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF', details: error instanceof Error ? error.message : String(error) });
  }
});

// HTML Preview endpoint (same renderer as PDF template)
app.post('/generate-preview-html', async (req: Request, res: Response) => {
  try {
    const bookData = req.body;

    if (!bookData || !bookData.title) {
      return res.status(400).json({ error: 'Invalid or missing bookData payload' });
    }

    const html = await renderBook(bookData);
    res.status(200).send(html);
  } catch (error) {
    console.error('Error generating preview HTML:', error);
    res.status(500).json({ error: 'Failed to generate preview HTML', details: error instanceof Error ? error.message : String(error) });
  }
});

app.listen(port, () => {
  console.log(`PDF Backend Service listening at http://localhost:${port}`);
});
