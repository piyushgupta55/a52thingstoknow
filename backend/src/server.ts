import express, { Request, Response } from 'express';
import cors from 'cors';
import * as fs from 'fs';
import * as path from 'path';
import { generatePDF } from './pdf/generatePDF';
import { renderBook } from './pdf/templates/shared/layout';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
const allowedOrigins = [
  'https://lovable.dev',
  'https://a52thingstoknow.lovable.app',
  'https://a52thingstoknow.vercel.app'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or same-origin)
    if (!origin) return callback(null, true);
    
    const isAllowed = allowedOrigins.includes(origin) || 
                      origin.endsWith('.lovable.app') || 
                      origin.endsWith('.vercel.app') ||
                      /^http:\/\/localhost:\d+$/.test(origin);
                      
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '50mb' })); // Allow large payloads (e.g. base64 images if any)

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', service: 'pdf-backend', message: 'PDF Backend Service is running' });
});

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
