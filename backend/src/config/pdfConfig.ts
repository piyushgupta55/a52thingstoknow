// PDF generation configuration
import { EngineType } from '../pdf/engines/pdfEngine';

export const pdfConfig = {
  // Select the PDF engine to use. Options: EngineType.Puppeteer or EngineType.PrinceXML
  engine: EngineType.Puppeteer,
  // Path to the PrinceXML binary if using PrinceXML engine. Leave empty to use system PATH.
  princeBinaryPath: ''
};
