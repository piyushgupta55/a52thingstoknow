import { EngineType } from './pdfEngine';
import { PuppeteerEngine } from './puppeteerEngine';
import { PrinceEngine } from './princeEngine';

export function createEngine(type: EngineType) {
  switch (type) {
    case EngineType.Puppeteer:
      return new PuppeteerEngine();
    case EngineType.PrinceXML:
      return new PrinceEngine();
    default:
      throw new Error(`Unsupported PDF engine: ${type}`);
  }
}
