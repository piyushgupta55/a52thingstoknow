import https from 'https';
import http from 'http';
import sizeOf from 'image-size';
import type { BookData } from '../types/pdf';
import type { ValidationWarning } from './pagination';

function fetchImageBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (url.startsWith('data:')) {
      // Handle data URIs (e.g., base64)
      const parts = url.split(',');
      if (parts.length === 2) {
        resolve(Buffer.from(parts[1], 'base64'));
      } else {
        reject(new Error('Invalid data URI'));
      }
      return;
    }

    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Handle redirects
        return fetchImageBuffer(res.headers.location).then(resolve).catch(reject);
      }

      const data: Buffer[] = [];
      res.on('data', (chunk) => data.push(chunk));
      res.on('end', () => resolve(Buffer.concat(data)));
    }).on('error', reject);
  });
}

export async function validateImages(bookData: BookData): Promise<ValidationWarning[]> {
  const warnings: ValidationWarning[] = [];

  for (const chapter of bookData.chapters) {
    if (!chapter.photo_urls || chapter.photo_urls.length === 0) continue;

    const rawTemplate = chapter.chapter_template || 'classic';
    const template = (rawTemplate === 'all_words') ? 'classic' :
                     (rawTemplate === 'photo_top') ? 'horizontal_photo' :
                     (rawTemplate === 'photo_second') ? 'vertical_photo' :
                     rawTemplate;

    for (let i = 0; i < chapter.photo_urls.length; i++) {
      const url = chapter.photo_urls[i];
      try {
        const buffer = await fetchImageBuffer(url);
        const dimensions = sizeOf(buffer);

        if (!dimensions.width || !dimensions.height) {
          continue;
        }

        const width = dimensions.width;
        const height = dimensions.height;
        const isLandscape = width > height;

        // 1. Resolution / DPI Validation
        if (template === 'vertical_photo' || template === 'photo_second') {
          // Vertical photos are constrained to ~3.0 inches. 300 DPI = 900px minimum.
          if (width < 900) {
            warnings.push({
              chapterNumber: chapter.chapter_number || 0,
              type: 'image_low_res',
              message: `Chapter ${chapter.chapter_number} photo #${i + 1} has low resolution (${width}x${height}px). Recommended minimum width is 900px for this layout. It may appear blurry in print.`
            });
          }

          // 2. Aspect Ratio Validation
          if (isLandscape) {
            warnings.push({
              chapterNumber: chapter.chapter_number || 0,
              type: 'image_aspect_ratio',
              message: `Chapter ${chapter.chapter_number} uses a vertical portrait layout, but photo #${i + 1} is landscape (${width}x${height}px). Important subjects on the left or right may be cropped out.`
            });
          }
        } else {
          // Full-width photos (classic, horizontal_photo) are ~6.0 inches wide. 300 DPI = 1800px minimum.
          if (width < 1800) {
            warnings.push({
              chapterNumber: chapter.chapter_number || 0,
              type: 'image_low_res',
              message: `Chapter ${chapter.chapter_number} photo #${i + 1} has low resolution (${width}x${height}px). Recommended minimum width is 1800px for full-width layouts. It may appear blurry in print.`
            });
          }
        }
      } catch (err) {
        console.warn(`Could not validate image at ${url}:`, err);
        // We do not fail the whole process if an image can't be fetched, just skip validation
      }
    }
  }

  return warnings;
}
