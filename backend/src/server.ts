import express, { Request, Response } from 'express';
import cors from 'cors';
import { generatePDF } from './pdf/generatePDF';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Allow frontend to call the backend
app.use(express.json({ limit: '50mb' })); // Allow large payloads (e.g. base64 images if any)

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

app.listen(port, () => {
  console.log(`PDF Backend Service listening at http://localhost:${port}`);
});
