import * as fs from 'fs';
import * as path from 'path';
import type { BookData } from '../../types/pdf';
// supabase import removed - not needed for screenshots

interface DropcapConfig {
  xOffset: number;    // Shift horizontally
  yOffset: number;    // Shift vertically to lock baseline
  scale: number;      // Optical scaling
  aspectRatio: number;// Locked aspect ratio (prevents box collapsing)
}

const GLYPH_METRICS: Record<string, DropcapConfig> = {
  'A': { xOffset: -0.05, yOffset: 0.08, scale: 0.95, aspectRatio: 0.85 },
  'B': { xOffset: 0.00, yOffset: 0.07, scale: 1.00, aspectRatio: 0.78 },
  'C': { xOffset: -0.06, yOffset: 0.09, scale: 1.00, aspectRatio: 0.82 },
  'D': { xOffset: 0.00, yOffset: 0.07, scale: 1.00, aspectRatio: 0.80 },
  'E': { xOffset: 0.00, yOffset: 0.07, scale: 1.00, aspectRatio: 0.75 },
  'F': { xOffset: 0.00, yOffset: 0.07, scale: 1.00, aspectRatio: 0.70 },
  'G': { xOffset: -0.05, yOffset: 0.09, scale: 1.00, aspectRatio: 0.85 },
  'H': { xOffset: 0.00, yOffset: 0.07, scale: 1.00, aspectRatio: 0.82 },
  'I': { xOffset: 0.05, yOffset: 0.07, scale: 1.00, aspectRatio: 0.35 },
  'J': { xOffset: 0.05, yOffset: 0.12, scale: 1.00, aspectRatio: 0.45 },
  'K': { xOffset: 0.00, yOffset: 0.07, scale: 1.00, aspectRatio: 0.82 },
  'L': { xOffset: 0.00, yOffset: 0.07, scale: 1.00, aspectRatio: 0.72 },
  'M': { xOffset: -0.02, yOffset: 0.08, scale: 0.90, aspectRatio: 1.10 },
  'N': { xOffset: 0.00, yOffset: 0.07, scale: 1.00, aspectRatio: 0.82 },
  'O': { xOffset: -0.06, yOffset: 0.09, scale: 1.00, aspectRatio: 0.86 },
  'P': { xOffset: 0.00, yOffset: 0.07, scale: 1.00, aspectRatio: 0.75 },
  'Q': { xOffset: -0.06, yOffset: 0.15, scale: 1.00, aspectRatio: 0.86 },
  'R': { xOffset: 0.00, yOffset: 0.07, scale: 1.00, aspectRatio: 0.80 },
  'S': { xOffset: -0.02, yOffset: 0.08, scale: 1.00, aspectRatio: 0.75 },
  'T': { xOffset: -0.04, yOffset: 0.07, scale: 1.00, aspectRatio: 0.85 },
  'U': { xOffset: 0.00, yOffset: 0.07, scale: 1.00, aspectRatio: 0.82 },
  'V': { xOffset: -0.03, yOffset: 0.08, scale: 0.98, aspectRatio: 0.82 },
  'W': { xOffset: -0.02, yOffset: 0.08, scale: 0.90, aspectRatio: 1.15 },
  'X': { xOffset: 0.00, yOffset: 0.07, scale: 1.00, aspectRatio: 0.82 },
  'Y': { xOffset: -0.03, yOffset: 0.08, scale: 0.98, aspectRatio: 0.80 },
  'Z': { xOffset: 0.00, yOffset: 0.07, scale: 1.00, aspectRatio: 0.78 },
  'default': { xOffset: 0.0, yOffset: 0.08, scale: 1.0, aspectRatio: 0.80 }
};

const LORA_GLYPH_PATHS: Record<string, { d: string, aspect: number }> = {
  'A': { d: 'M0,85 L25,15 L55,15 L80,85 L65,85 L58,65 L22,65 L15,85 Z M40,25 L26,55 L54,55 Z', aspect: 0.85 },
  'T': { d: 'M0,20 L30,20 L30,85 L50,85 L50,20 L80,20 L80,10 L0,10 Z', aspect: 0.85 },
  'I': { d: 'M0,10 L30,10 L30,85 L0,85 Z', aspect: 0.35 }
};

function injectSvgDropcap(letter: string, fontClass: string = 'book-font-serif'): string {
  const upper = letter.toUpperCase();
  const metrics = GLYPH_METRICS[upper] || GLYPH_METRICS['default'];
  const glyph = LORA_GLYPH_PATHS[upper];
  
  const width = Math.round(100 * metrics.aspectRatio);
  const height = 100;
  
  const x = (width / 2) + (metrics.xOffset * 100);
  const y = 80 + (metrics.yOffset * 100);
  
  const innerContent = glyph 
    ? `<path d="${glyph.d}" fill="var(--gold, #c9a14a)" />`
    : `<text x="${x}" y="${y}" font-size="${metrics.scale * 100}" text-anchor="middle" class="dropcap-svg-text ${fontClass}" style="dominant-baseline: alphabetic; font-family: 'Lora', 'Georgia', serif; fill: var(--gold, #c9a14a); font-weight: normal;">${letter}</text>`;
  
  return `<span class="dropcap-svg-container" style="aspect-ratio: ${metrics.aspectRatio}; float: left; display: block; height: calc(1.8em * 3 - 0.4em); margin-right: 0.6em; margin-top: 0.15em; line-height: 0;" data-dropcap-letter="${letter}"><svg viewBox="0 0 ${width} ${height}" style="height: 100%; width: auto; overflow: visible;" preserveAspectRatio="xMidYMid meet">${innerContent}</svg></span>`;
}

function formatContent(content: string | null | undefined): string {
  if (!content) return '';
  const trimmed = content.trim();
  let html = '';
  if (/^<p|^<div|^<ol|^<ul|^<blockquote|^<table/i.test(trimmed)) {
    html = trimmed;
  } else {
    html = trimmed
      .split(/\n\n+/)
      .map(para => `<p>${para.replace(/\n/g, '<br />')}</p>`)
      .join('');
  }

  // Suppress drop cap for placeholder content
  const plainText = trimmed.replace(/<[^>]+>/g, '').trim();
  if (plainText === 'No content available.') {
    return html;
  }

  // Inject drop cap to the first actual letter of the first paragraph
  const match = html.match(/^(\s*(?:<p[^>]*>|<div[^>]*>)*)\s*([A-Za-z0-9])(.*)$/is);
  if (match) {
    const prefix = match[1];
    const firstLetter = match[2];
    const remainder = match[3];
    const pCloseIdx = remainder.indexOf('</p>');
    if (pCloseIdx !== -1) {
      const p1Body = remainder.slice(0, pCloseIdx);
      const p1Rest = remainder.slice(pCloseIdx);
      return `${prefix}${injectSvgDropcap(firstLetter)}<span class="text-flow">${p1Body}</span>${p1Rest}`;
    } else {
      return `${prefix}${injectSvgDropcap(firstLetter)}<span class="text-flow">${remainder}</span>`;
    }
  }
  return html;
}


export async function renderBook(bookData: BookData, actualChapterPages?: Record<string, number>): Promise<string> {
  // Load core print styles directly to avoid @import path issues in Puppeteer
  const stylesDir = path.join(process.cwd(), 'src/pdf/styles');
  let printStyles = '';
  try {
    const baseCss = fs.readFileSync(path.join(stylesDir, 'base.css'), 'utf8');
    const pagesCss = fs.readFileSync(path.join(stylesDir, 'pages.css'), 'utf8');
    const layoutCss = fs.readFileSync(path.join(stylesDir, 'layout.css'), 'utf8');
    const typographyCss = fs.readFileSync(path.join(stylesDir, 'typography.css'), 'utf8');
    printStyles = baseCss + '\n' + typographyCss + '\n' + pagesCss + '\n' + layoutCss;
  } catch (err) {
    console.warn('Could not load print styles:', err);
  }

  let pageNum = 1; // Cover Page
  
  // Create TOC and determine page numbers
  let tocItemsHtml = '';
  const chapterPages: { [key: number]: number } = {};
  
  let currentContentPageNum = 3; // TOC is page 2, first content starts on page 3
  
  // Placeholder loadMemories - no external data needed for screenshots
  const loadMemories = async () => { /* no-op */ };
  
  for (let i = 0; i < bookData.chapters.length; i++) {
    const chapter = bookData.chapters[i];
    chapterPages[i] = currentContentPageNum;
    
    if (chapter.chapter_number !== 0) {
      const chNumStr = chapter.chapter_number?.toString() || String(i);
      const displayPageNum = actualChapterPages ? (actualChapterPages[chNumStr] ?? currentContentPageNum) : currentContentPageNum;
      tocItemsHtml += `
        <div class="toc-item">
          <span class="toc-chapter-title">${chapter.title}</span>
          <span class="toc-leader"></span>
          <span class="toc-page-number" data-toc-chapter="${chapter.chapter_number}">${displayPageNum}</span>
        </div>
      `;
    }
    
    // Increment page numbers based on assumed chapter lengths
    if (chapter.chapter_number === 0) {
      currentContentPageNum += 1; // Letter is usually 1 page
    } else {
      currentContentPageNum += 2; // Regular chapters are a 2-page spread
    }
  }

  let ancestryStartPage = currentContentPageNum;
  if (bookData.ancestryText || bookData.ancestryPdfUrl) {
    const displayAncestryPageNum = actualChapterPages ? (actualChapterPages['ancestry'] ?? ancestryStartPage) : ancestryStartPage;
    tocItemsHtml += `
      <div class="toc-item">
        <span class="toc-chapter-title">Where You Come From</span>
        <span class="toc-leader"></span>
        <span class="toc-page-number" data-toc-chapter="ancestry">${displayAncestryPageNum}</span>
      </div>
    `;
    currentContentPageNum += 2;
  }

  const tocHtml = `
    <div class="page toc-page">
      <h2 class="toc-title">Table of Contents</h2>
      ${tocItemsHtml}
    </div>
  `;

  let chaptersHtml = '';
  for (let i = 0; i < bookData.chapters.length; i++) {
    const chapter = bookData.chapters[i];
    const startPage = chapterPages[i];
    
    // The Letter (Chapter 0)
    if (chapter.chapter_number === 0) {
      let rawContent = chapter.content || '';
      const authorName = bookData.author || 'The Author';
      if (authorName) {
        const escapedAuthor = authorName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        // Match "I love you, <authorName>" or "I love you, the author" or "I love you, [AUTHOR_NAME]" at the very end
        const loveYouRegex = new RegExp(`I love you,\\s*(?:${escapedAuthor}|the author|\\[AUTHOR_NAME\\])\\.?\\s*$`, 'i');
        rawContent = rawContent.replace(loveYouRegex, 'I love you.');

        // Match "I am very proud to be your <authorName>" or "I am very proud to be your the author" or "I am very proud to be your [AUTHOR_NAME]"
        const proudRegex = new RegExp(`I am very proud to be your\\s*(?:${escapedAuthor}|the author|\\[AUTHOR_NAME\\])\\.?`, 'i');
        rawContent = rawContent.replace(proudRegex, 'I am very proud of you.');
      }

      // Match and title-case the recipient's name in the "Dear <recipient>," greeting block at the start
      rawContent = rawContent.replace(/^(\s*(?:<p[^>]*>)?\s*Dear\s+)([^,\n<]+)(,)/i, (match, prefix, name, suffix) => {
        const capitalizedName = name.trim().split(/\s+/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        return `${prefix}${capitalizedName}${suffix}`;
      });

      chaptersHtml += `
        <!-- Page 1: Introduction Letter (no static overflow placeholder) -->
        <div class="page chapter-content-page page-p1" data-chapter="${chapter.chapter_number}">
          <div class="intro-header">
            <div class="intro-label">Introduction</div>
            <h2 class="intro-title">Letter from the Author</h2>
            <div class="intro-separator">
              <span class="line"></span>
              <span class="diamond">✦</span>
              <span class="line"></span>
            </div>
          </div>
          <div class="wisdom-text chapter-opening intro-wisdom">${formatContent(rawContent)}</div>
          <div class="intro-separator intro-footer-separator">
            <span class="line"></span>
            <span class="diamond">✦</span>
            <span class="line"></span>
          </div>
          <div class="letter-signature">
            <span class="warm-regards">With love and blessings,</span>
            <span class="signature-name">${bookData.author}</span>
          </div>
        </div>
      `;
      continue;
    }

    const rawTemplate = chapter.chapter_template || 'classic';
    const template = (rawTemplate === 'all_words') ? 'classic' :
                     (rawTemplate === 'photo_top') ? 'horizontal_photo' :
                     (rawTemplate === 'photo_second') ? 'vertical_photo' :
                     rawTemplate;

    let quoteHtml = '';
    if (chapter.quote_text || chapter.bible_verse_text) {
      // Wrap each quote in a consistent wrapper for styling
      if (chapter.quote_text) {
        quoteHtml += `
          <div class="quote-wrapper">
            <blockquote class="chapter-quote">
              "${chapter.quote_text}"
              ${chapter.quote_attribution ? `<span class="attribution">— ${chapter.quote_attribution}</span>` : ''}
            </blockquote>
          </div>`;
      }
      if (chapter.bible_verse_text) {
        quoteHtml += `
          <div class="quote-wrapper">
            <blockquote class="chapter-quote bible-verse">
              "${chapter.bible_verse_text}"
              ${chapter.bible_verse_reference ? `<span class="attribution">— ${chapter.bible_verse_reference}</span>` : ''}
            </blockquote>
          </div>`;
      }
    }

    let memoriesHtml = '';
    console.log(`Memories for Chapter ${chapter.chapter_number}:`, JSON.stringify(chapter.memories));
    if (chapter.memories && chapter.memories.length > 0) {
      memoriesHtml += `<div class="memories-section">`;
      for (const m of chapter.memories) {
        memoriesHtml += `
          <div class="memory-item">
            <span class="memory-star">★</span>
            <div class="memory-text">"${m.memory_text}"</div>
            <span class="memory-contributor">— ${m.contributor_name}</span>
          </div>
        `;
      }
      memoriesHtml += `</div>`;
    }

    const hasPhoto = chapter.photo_urls && chapter.photo_urls.length > 0;
    const photoClass = (template === 'vertical_photo' || template === 'photo_second') ? 'chapter-photo vertical-photo' : 'chapter-photo';
    const photoHtml = hasPhoto ? `<img src="${chapter.photo_urls![0]}" class="${photoClass}" />` : '';

    if (template === 'classic') {
      chaptersHtml += `
        <!-- Page 1: Title, Quote, Wisdom -->
        <div class="page chapter-content-page page-p1" data-chapter="${chapter.chapter_number}" data-template="${template}" data-has-memories="${chapter.memories && chapter.memories.length > 0}">
          <div class="chapter-header">
            <div class="chapter-label">Chapter ${chapter.chapter_number}</div>
            <h2 class="chapter-title ${chapter.title.length > 50 ? 'long-title' : ''}">${chapter.title}</h2>
            <div class="chapter-separator">
              <span class="line"></span>
              <span class="diamond">✦</span>
              <span class="line"></span>
            </div>
          </div>
          <div class="wisdom-text chapter-opening">
            ${quoteHtml}
            ${formatContent(chapter.content)}
          </div>
          ${memoriesHtml}
        </div>
      `;
    } else if (template === 'horizontal_photo') {
      chaptersHtml += `
        <!-- Page 1: Photo Top, Wisdom -->
        <div class="page chapter-content-page page-p1" data-chapter="${chapter.chapter_number}" data-template="${template}" data-has-memories="${chapter.memories && chapter.memories.length > 0}">
          <div class="chapter-header">
            <div class="chapter-label">Chapter ${chapter.chapter_number}</div>
            <h2 class="chapter-title ${chapter.title.length > 50 ? 'long-title' : ''}">${chapter.title}</h2>
            <div class="chapter-separator">
              <span class="line"></span>
              <span class="diamond">✦</span>
              <span class="line"></span>
            </div>
          </div>
          ${photoHtml}
          <div class="wisdom-text chapter-opening">
            ${quoteHtml}
            ${formatContent(chapter.content)}
          </div>
          ${memoriesHtml}
        </div>
      `;
    } else if (template === 'vertical_photo' || template === 'photo_second') {
      chaptersHtml += `
          <!-- Page 1: Title, Quotes, Wisdom, and Photo (split to Page 2) -->
          <div class="page chapter-content-page page-p1" data-chapter="${chapter.chapter_number}" data-template="${template}" data-has-memories="${chapter.memories && chapter.memories.length > 0}">
            <div class="chapter-header">
              <div class="chapter-label">Chapter ${chapter.chapter_number}</div>
              <h2 class="chapter-title ${chapter.title.length > 50 ? 'long-title' : ''}">${chapter.title}</h2>
              <div class="chapter-separator">
                <span class="line"></span>
                <span class="diamond">✦</span>
                <span class="line"></span>
              </div>
            </div>
            <div class="wisdom-text chapter-opening">
              ${quoteHtml}
              ${formatContent(chapter.content)}
            </div>
            ${photoHtml}
            ${memoriesHtml}
          </div>
      `;
    }
  }

  if (bookData.ancestryText || bookData.ancestryPdfUrl) {
    chaptersHtml += `
      <!-- Page 1: Where You Come From -->
      <div class="page chapter-content-page page-p1" data-chapter="ancestry">
        <div class="chapter-header">
          <h2 class="chapter-title">Where You Come From</h2>
          <div class="chapter-separator">
            <span class="line"></span>
            <span class="diamond">✦</span>
            <span class="line"></span>
          </div>
        </div>
        ${bookData.ancestryText ? `
        <div class="wisdom-text chapter-opening">
          ${bookData.ancestryText}
        </div>
        ` : ''}
      </div>
      <!-- Page 2: Overflow target -->
      <div class="page chapter-content-page page-p2" data-chapter="ancestry">
        <div class="wisdom-text"></div>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${bookData.title}</title>
      <style>
        ${printStyles}
      </style>
    </head>
    <body>
      <div class="page title-page">
        <div class="cover-frame">
          <div class="cover-inner">
            <p class="uppercase-sub" style="text-transform: uppercase; letter-spacing: 0.25em; font-size: 8pt; color: #9CA3AF; margin-bottom: 0.5em; font-family: 'Lora', serif;">A Book of Wisdom</p>
            <h1 style="font-weight: bold; margin-bottom: 0.5em; text-transform: uppercase; letter-spacing: 0.1em; font-size: 24pt; color: #2D3748; line-height: 1.2;">52 Things to Know</h1>
            <p class="recipient-label" style="margin-bottom: 1em; font-size: 12pt; color: #6B7280; font-family: 'Lora', serif;">For ${bookData.recipientName || 'your loved one'}</p>
            <hr class="gold-separator" style="width: 40px; height: 1px; background-color: var(--gold); border: none; margin: 1.5em auto;" />
            ${bookData.author ? `<h3 style="font-style: italic; font-size: 12pt; color: #4A5568; font-family: 'Lora', serif;">By ${bookData.author}</h3>` : ''}
          </div>
        </div>
      </div>
      ${tocHtml}
      ${chaptersHtml}

      <script>
        console.log("PUPPETEER BOOTSTRAP ACTIVE");
        window.onerror = function(msg, url, line, col, error) {
          console.error("BROWSER EXCEPTION:", msg, "at", url, "line", line, "col", col);
          return false;
        };
        window.GLYPH_METRICS = {

          'A': { xOffset: -0.05, yOffset: 0.08, scale: 0.95, aspectRatio: 0.85 },
          'B': { xOffset: 0.00, yOffset: 0.07, scale: 1.00, aspectRatio: 0.78 },
          'C': { xOffset: -0.06, yOffset: 0.09, scale: 1.00, aspectRatio: 0.82 },
          'D': { xOffset: 0.00, yOffset: 0.07, scale: 1.00, aspectRatio: 0.80 },
          'E': { xOffset: 0.00, yOffset: 0.07, scale: 1.00, aspectRatio: 0.75 },
          'F': { xOffset: 0.00, yOffset: 0.07, scale: 1.00, aspectRatio: 0.70 },
          'G': { xOffset: -0.05, yOffset: 0.09, scale: 1.00, aspectRatio: 0.85 },
          'H': { xOffset: 0.00, yOffset: 0.07, scale: 1.00, aspectRatio: 0.82 },
          'I': { xOffset: 0.05, yOffset: 0.07, scale: 1.00, aspectRatio: 0.35 },
          'J': { xOffset: 0.05, yOffset: 0.12, scale: 1.00, aspectRatio: 0.45 },
          'K': { xOffset: 0.00, yOffset: 0.07, scale: 1.00, aspectRatio: 0.82 },
          'L': { xOffset: 0.00, yOffset: 0.07, scale: 1.00, aspectRatio: 0.72 },
          'M': { xOffset: -0.02, yOffset: 0.08, scale: 0.90, aspectRatio: 1.10 },
          'N': { xOffset: 0.00, yOffset: 0.07, scale: 1.00, aspectRatio: 0.82 },
          'O': { xOffset: -0.06, yOffset: 0.09, scale: 1.00, aspectRatio: 0.86 },
          'P': { xOffset: 0.00, yOffset: 0.07, scale: 1.00, aspectRatio: 0.75 },
          'Q': { xOffset: -0.06, yOffset: 0.15, scale: 1.00, aspectRatio: 0.86 },
          'R': { xOffset: 0.00, yOffset: 0.07, scale: 1.00, aspectRatio: 0.80 },
          'S': { xOffset: -0.02, yOffset: 0.08, scale: 1.00, aspectRatio: 0.75 },
          'T': { xOffset: -0.04, yOffset: 0.07, scale: 1.00, aspectRatio: 0.85 },
          'U': { xOffset: 0.00, yOffset: 0.07, scale: 1.00, aspectRatio: 0.82 },
          'V': { xOffset: -0.03, yOffset: 0.08, scale: 0.98, aspectRatio: 0.82 },
          'W': { xOffset: -0.02, yOffset: 0.08, scale: 0.90, aspectRatio: 1.15 },
          'X': { xOffset: 0.00, yOffset: 0.07, scale: 1.00, aspectRatio: 0.82 },
          'Y': { xOffset: -0.03, yOffset: 0.08, scale: 0.98, aspectRatio: 0.80 },
          'Z': { xOffset: 0.00, yOffset: 0.07, scale: 1.00, aspectRatio: 0.78 },
          'default': { xOffset: 0.0, yOffset: 0.08, scale: 1.0, aspectRatio: 0.80 }
        };

        window.LORA_GLYPH_PATHS = {
          'A': { d: 'M0,85 L25,15 L55,15 L80,85 L65,85 L58,65 L22,65 L15,85 Z M40,25 L26,55 L54,55 Z', aspect: 0.85 },
          'T': { d: 'M0,20 L30,20 L30,85 L50,85 L50,20 L80,20 L80,10 L0,10 Z', aspect: 0.85 },
          'I': { d: 'M0,10 L30,10 L30,85 L0,85 Z', aspect: 0.35 }
        };

        function injectSvgDropcap(letter, fontClass = 'book-font-serif') {
          const upper = letter.toUpperCase();
          const metrics = GLYPH_METRICS[upper] || GLYPH_METRICS['default'];
          const glyph = LORA_GLYPH_PATHS[upper];
          
          const width = Math.round(100 * metrics.aspectRatio);
          const height = 100;
          
          const x = (width / 2) + (metrics.xOffset * 100);
          const y = 80 + (metrics.yOffset * 100);
          
          const innerContent = glyph 
            ? '<path d="' + glyph.d + '" fill="var(--gold, #c9a14a)" />'
            : '<text x="' + x + '" y="' + y + '" font-size="' + (metrics.scale * 100) + '" text-anchor="middle" class="dropcap-svg-text ' + fontClass + '" style="dominant-baseline: alphabetic; font-family: Lora, Georgia, serif; fill: var(--gold, #c9a14a); font-weight: normal;">' + letter + '</text>';
          
          return '<span class="dropcap-svg-container" style="aspect-ratio: ' + metrics.aspectRatio + '; float: left; display: block; height: calc(1.8em * 3 - 0.4em); margin-right: 0.6em; margin-top: 0.15em; line-height: 0;" data-dropcap-letter="' + letter + '"><svg viewBox="0 0 ' + width + ' ' + height + '" style="height: 100%; width: auto; overflow: visible;" preserveAspectRatio="xMidYMid meet">' + innerContent + '</svg></span>';
        }


        function findLineBreakOffsetsBinary(container, graphemeOffsets) {
          const lines = [];
          const totalGraphemes = graphemeOffsets.length - 1;
          
          let lineStartGraphemeIdx = 0;
          const range = document.createRange();
          
          while (lineStartGraphemeIdx < totalGraphemes) {
            let low = lineStartGraphemeIdx + 1;
            let high = totalGraphemes;
            let boundaryIdx = totalGraphemes;
            
            const startCharOffset = graphemeOffsets[lineStartGraphemeIdx];
            
            while (low <= high) {
              const mid = Math.floor((low + high) / 2);
              const midCharOffset = graphemeOffsets[mid];
              
              const startOk = setRangeStartAtOffset(range, container, startCharOffset);
              const endOk = setRangeEndAtOffset(range, container, midCharOffset);
              if (!startOk || !endOk) {
                low = mid + 1;
                continue;
              }
              
              const rects = range.getClientRects();
              
              if (rects.length > 0 && isMultiLineRange(rects, 8)) {
                boundaryIdx = mid;
                high = mid - 1;
              } else {
                low = mid + 1;
              }
            }
            
            const endCharOffset = graphemeOffsets[boundaryIdx - 1] !== undefined ? graphemeOffsets[boundaryIdx - 1] : graphemeOffsets[boundaryIdx];
            lines.push({ 
              startOffset: startCharOffset, 
              endOffset: boundaryIdx === totalGraphemes ? graphemeOffsets[totalGraphemes] : endCharOffset 
            });
            
            // MATHEMATICALLY GUARANTEED PROGRESSION:
            // nextStart must be strictly greater than lineStartGraphemeIdx to prevent infinite loop traps
            const nextStart = Math.max(boundaryIdx - 1, lineStartGraphemeIdx + 1);
            lineStartGraphemeIdx = nextStart;
            
            if (boundaryIdx === totalGraphemes) break;
          }
          
          return lines;
        }

        function isMultiLineRange(rects, threshold = 8) {
          if (rects.length <= 1) return false;
          const firstTop = rects[0].top;
          for (let i = 1; i < rects.length; i++) {
            if (Math.abs(rects[i].top - firstTop) > threshold) {
              return true;
            }
          }
          return false;
        }


        function setRangeStartAtOffset(range, node, targetOffset) {
          if (node.nodeType === Node.TEXT_NODE) {
            const len = node.textContent.length;
            if (targetOffset <= len) {
              range.setStart(node, targetOffset);
              return true;
            }
            return targetOffset - len;
          }
          
          let remaining = targetOffset;
          for (let i = 0; i < node.childNodes.length; i++) {
            const res = setRangeStartAtOffset(range, node.childNodes[i], remaining);
            if (res === true) return true;
            remaining = res;
          }
          return remaining;
        }

        function setRangeEndAtOffset(range, node, targetOffset) {
          if (node.nodeType === Node.TEXT_NODE) {
            const len = node.textContent.length;
            if (targetOffset <= len) {
              range.setEnd(node, targetOffset);
              return true;
            }
            return targetOffset - len;
          }
          
          let remaining = targetOffset;
          for (let i = 0; i < node.childNodes.length; i++) {
            const res = setRangeEndAtOffset(range, node.childNodes[i], remaining);
            if (res === true) return true;
            remaining = res;
          }
          return remaining;
        }

        function getOffsetVerticalBottom(container, offset) {
          const range = document.createRange();
          const startOk = setRangeStartAtOffset(range, container, offset > 0 ? offset - 1 : 0);
          const endOk = setRangeEndAtOffset(range, container, offset);
          if (!startOk || !endOk) return container.getBoundingClientRect().bottom;
          const rects = range.getClientRects();
          return rects.length > 0 ? rects[0].bottom : container.getBoundingClientRect().bottom;
        }

        // Client-side text splitting to flow overflowing content from page-p1 to page-p2 and dynamically create overflow pages as needed
        window.addEventListener('load', () => {
          document.fonts.ready.then(() => {
            try {
              splitAllChaptersOverflow();
              cleanEmptyPages();
              markSparsePages();
            } catch (err) {
              console.error('CLIENT-SIDE PAGINATION ERROR:', err);
            } finally {
              document.body.classList.add('layout-final');
            }
          });
        });


        function splitAllChaptersOverflow() {
          const p1Pages = document.querySelectorAll('.page-p1');
          p1Pages.forEach(p1 => {
            splitPageIfNeeded(p1);
          });
        }

        function splitPageIfNeeded(page, depth = 0) {
          const chapterNum = page.getAttribute('data-chapter');
          const pageRect = page.getBoundingClientRect();
          // maxBottom threshold is 770px relative to page top (within 888px high page)
          const maxBottom = pageRect.top + 770;
          console.log("splitPageIfNeeded [ch=" + chapterNum + ", depth=" + depth + "]: pageRect.top=" + pageRect.top + ", maxBottom=" + maxBottom);

          if (depth > 20) {
            console.error("Infinite recursion safety trigger on chapter " + chapterNum + ". Stopping split.");
            return;
          }

          // 1. Collect all flowable units in their visual DOM order
          const units = [];
          Array.from(page.children).forEach(child => {
            if (child.classList.contains('wisdom-text')) {
              Array.from(child.children).forEach(grandchild => {
                units.push({ type: 'wisdom', element: grandchild });
              });
            } else if (child.classList.contains('chapter-photo')) {
              units.push({ type: 'photo', element: child });
            } else if (child.classList.contains('memories-section')) {
              Array.from(child.children).forEach(grandchild => {
                if (grandchild.classList.contains('memory-item')) {
                  units.push({ type: 'memory', element: grandchild });
                }
              });
            } else if (child.classList.contains('letter-signature') || child.classList.contains('intro-footer-separator')) {
              units.push({ type: 'signature', element: child });
            }
          });

          // 2. Find the first unit that overflows
          let overflowIndex = -1;
          let forceMoveEntireUnit = false;
          
          for (let i = 0; i < units.length; i++) {
            const rect = units[i].element.getBoundingClientRect();
            console.log("  unit " + i + " [type=" + units[i].type + "]: rect.bottom=" + rect.bottom + ", maxBottom=" + maxBottom);
            if (rect.bottom > maxBottom) {
              overflowIndex = i;
              break;
            }
          }

          const template = page.getAttribute('data-template');
          const hasMemories = page.getAttribute('data-has-memories') === 'true';

          if (depth === 0) {
            let forcedOverflowIndex = -1;
            
            if (template === 'vertical_photo') {
              for (let i = 0; i < units.length; i++) {
                if (units[i].type === 'photo') {
                  forcedOverflowIndex = i;
                  break;
                }
              }
            } else if (hasMemories) {
              for (let i = 0; i < units.length; i++) {
                if (units[i].type === 'memory') {
                  forcedOverflowIndex = i;
                  break;
                }
              }
            }

            // If we found a forced split point, and it's earlier than natural overflow (or there is no natural overflow)
            if (forcedOverflowIndex !== -1 && (overflowIndex === -1 || forcedOverflowIndex <= overflowIndex)) {
              overflowIndex = forcedOverflowIndex;
              forceMoveEntireUnit = true;
            }
          }

          // 3. If there is overflow, split and move
          if (overflowIndex !== -1) {
            // Find or create the next page
            let nextPage = page.nextElementSibling;
            if (!nextPage || nextPage.getAttribute('data-chapter') !== chapterNum || !nextPage.classList.contains('page')) {
              nextPage = createOverflowPage(chapterNum);
              page.after(nextPage);
            }

            const overflowUnit = units[overflowIndex];
            const nextPageWisdom = nextPage.querySelector('.wisdom-text');

            let unitsToMove = [];
            if (!forceMoveEntireUnit && overflowUnit.type === 'wisdom' && overflowUnit.element.tagName.toLowerCase() === 'p') {
              // Split paragraph
              const splitResult = splitParagraph(overflowUnit.element, maxBottom);
              if (splitResult) {
                if (splitResult.pushEntire) {
                  unitsToMove = units.slice(overflowIndex);
                } else {
                  // Widow/Orphan Control
                  const overflowWordCount = splitResult.remainingText.split(' ').length;
                  if (overflowWordCount < 40 && !page.hasAttribute('data-rebalanced')) {
                    console.log("  Widow/Orphan detected (" + overflowWordCount + " words). Attempting rebalance on chapter " + chapterNum);
                    page.setAttribute('data-rebalanced', 'true');
                    
                    // Restore original text
                    overflowUnit.element.innerText = splitResult.originalText;
                    
                    // Apply tightening
                    const wisdomContainer = page.querySelector('.wisdom-text');
                    if (wisdomContainer) wisdomContainer.classList.add('rebalance-tight');
                    
                    // Allow slight margin bleed for tiny orphans
                    const bleedAllowance = (overflowWordCount < 15) ? 35 : 10;
                    
                    // Re-evaluate with new constraints to find the new overflow point
                    let newOverflowIndex = -1;
                    for (let j = 0; j < units.length; j++) {
                      if (units[j].element.getBoundingClientRect().bottom > maxBottom + bleedAllowance) {
                        newOverflowIndex = j; break;
                      }
                    }
                    
                    if (newOverflowIndex === -1) {
                      console.log("  Rebalance successful. Absorbed orphan completely.");
                      return; // Successfully absorbed and nothing else overflows!
                    } else if (newOverflowIndex > overflowIndex) {
                      console.log("  Rebalance absorbed the orphan, but subsequent units (e.g. memories) overflow.");
                      // We successfully absorbed the text, but the memories (or next elements) overflow.
                      // We change the overflow unit to the new one and skip paragraph splitting.
                      unitsToMove = units.slice(newOverflowIndex);
                    } else {
                      console.log("  Rebalance failed to absorb orphan. Proceeding with split.");
                      // Re-run splitParagraph since we restored the text
                      const retrySplit = splitParagraph(overflowUnit.element, maxBottom);
                      if (retrySplit) {
                        if (retrySplit.pushEntire) {
                          unitsToMove = units.slice(overflowIndex);
                        } else {
                          unitsToMove.push({ type: 'wisdom', element: retrySplit.element });
                          unitsToMove = unitsToMove.concat(units.slice(overflowIndex + 1));
                        }
                      } else {
                        unitsToMove = unitsToMove.concat(units.slice(overflowIndex + 1));
                      }
                    }
                  } else {
                    unitsToMove.push({ type: 'wisdom', element: splitResult.element });
                    unitsToMove = unitsToMove.concat(units.slice(overflowIndex + 1));
                  }
                }
              } else {
                 unitsToMove = unitsToMove.concat(units.slice(overflowIndex + 1));
              }
            } else {
              // Move remaining units starting from overflowIndex
              unitsToMove = units.slice(overflowIndex);
            }

            // 4. Move the units to the next page
            let nextMemories = null;
            
            unitsToMove.forEach(unit => {
              if (unit.type === 'wisdom') {
                nextPageWisdom.appendChild(unit.element);
              } else if (unit.type === 'photo') {
                const nextMems = nextPage.querySelector('.memories-section');
                if (nextMems) {
                  nextPage.insertBefore(unit.element, nextMems);
                } else {
                  nextPage.appendChild(unit.element);
                }
              } else if (unit.type === 'memory') {
                if (!nextMemories) {
                  nextMemories = nextPage.querySelector('.memories-section');
                  if (!nextMemories) {
                    nextMemories = document.createElement('div');
                    nextMemories.className = 'memories-section';
                    const nextPhoto = nextPage.querySelector('.chapter-photo');
                    if (nextPhoto) {
                      nextPhoto.after(nextMemories);
                    } else {
                      nextPageWisdom.after(nextMemories);
                    }
                  }
                }
                nextMemories.appendChild(unit.element);
              } else if (unit.type === 'signature') {
                nextPage.appendChild(unit.element);
              }
            });

            // Clean up empty memories section on current page
            const memoriesSection = page.querySelector('.memories-section');
            if (memoriesSection && memoriesSection.querySelectorAll('.memory-item').length === 0) {
              memoriesSection.remove();
            }

            // Recursively split the next page if we moved actual content
            if (unitsToMove.length > 0) {
              splitPageIfNeeded(nextPage, depth + 1);
            }
          }
        }

        function createOverflowPage(chapterNum) {
          const newPage = document.createElement('div');
          newPage.className = 'page chapter-content-page page-overflow';
          newPage.setAttribute('data-chapter', chapterNum);
          
          const wisdomText = document.createElement('div');
          if (chapterNum === '0') {
            wisdomText.className = 'wisdom-text intro-wisdom';
          } else {
            wisdomText.className = 'wisdom-text';
          }
          newPage.appendChild(wisdomText);
          
          const pageNumDiv = document.createElement('div');
          pageNumDiv.className = 'page-number';
          newPage.appendChild(pageNumDiv);
          
          return newPage;
        }

        function splitParagraph(p, maxBottom) {
          const originalHtml = p.innerHTML;
          
          // 1. Detect if paragraph has a dropcap container
          const dropcapContainer = p.querySelector('.dropcap-svg-container');
          const hadDropCap = dropcapContainer !== null;
          
          let dropcapLetter = '';
          let fontClass = 'book-font-serif';
          
          if (hadDropCap) {
            dropcapLetter = dropcapContainer.getAttribute('data-dropcap-letter') || 'T';
            const textNode = p.querySelector('.dropcap-svg-text');
            if (textNode) {
              fontClass = Array.from(textNode.classList)
                .filter(c => c !== 'dropcap-svg-text')
                .join(' ');
            }
          }

          const initialBottom = p.getBoundingClientRect().bottom;
          if (initialBottom <= maxBottom) {
            return null;
          }

          // 2. PARSE UNICODE-SAFE GRAPHEME & WORD BOUNDARIES
          const textFlow = p.querySelector('.text-flow') || p;
          const rawText = textFlow.textContent || '';
          
          const graphemeSegmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
          const wordSegmenter = new Intl.Segmenter('en', { granularity: 'word' });
          
          const graphemes = Array.from(graphemeSegmenter.segment(rawText));
          const words = Array.from(wordSegmenter.segment(rawText));
          
          // Create a set of character index offsets that represent valid word boundaries
          const wordBoundarySet = new Set();
          words.forEach(w => {
            wordBoundarySet.add(w.index);
            wordBoundarySet.add(w.index + w.segment.length);
          });

          // Filter grapheme indices to only allow splitting on valid word boundaries
          const safeSplitOffsets = [0];
          graphemes.forEach(g => {
            const nextOffset = g.index + g.segment.length;
            if (wordBoundarySet.has(nextOffset)) {
              safeSplitOffsets.push(nextOffset);
            }
          });

          // Ensure terminal index is included
          if (safeSplitOffsets[safeSplitOffsets.length - 1] !== rawText.length) {
            safeSplitOffsets.push(rawText.length);
          }

          // 3. O(L log N) BINARY SEARCH LINE BREAK OFFSET DETECTION
          const lines = findLineBreakOffsetsBinary(textFlow, safeSplitOffsets);
          
          if (lines.length <= 1) {
            const bounds = p.getBoundingClientRect();
            if (bounds.bottom <= maxBottom) return null;
            // Entire paragraph overflow
            return { element: p, remainingText: rawText, originalText: rawText, pushEntire: true };
          }

          // 4. CALIBRATE HOW MANY LINES FIT
          let fitLineCount = 0;
          for (let i = 0; i < lines.length; i++) {
            const lineEndOffset = lines[i].endOffset;
            const lineBottom = getOffsetVerticalBottom(textFlow, lineEndOffset);
            if (lineBottom <= maxBottom) {
              fitLineCount = i + 1;
            } else {
              break;
            }
          }

          // Apply Widows/Orphans checks
          const totalLines = lines.length;
          const remainingLines = totalLines - fitLineCount;

          if (fitLineCount < 2) {
            fitLineCount = 0; // Push entire block
          } else if (remainingLines < 2) {
            fitLineCount = totalLines - 2; // Pull lines forward
            if (fitLineCount < 2) fitLineCount = 0;
          }

          if (fitLineCount === 0) {
            return { element: p, remainingText: rawText, originalText: rawText, pushEntire: true };
          }

          // 5. PERFORM RICH DOM SPLITTING VIA RANGE CLONING
          const splitOffset = lines[fitLineCount - 1].endOffset;
          
          // Part 1: Range from start to split point
          const range1 = document.createRange();
          range1.setStart(textFlow, 0);
          setRangeEndAtOffset(range1, textFlow, splitOffset);
          const part1Fragment = range1.cloneContents();

          // Part 2: Range from split point to end
          const range2 = document.createRange();
          setRangeStartAtOffset(range2, textFlow, splitOffset);
          range2.setEnd(textFlow, textFlow.childNodes.length);
          const part2Fragment = range2.cloneContents();

          // Re-serialize text metadata safely (No layout-dependent innerText)
          const remainingText = rawText.slice(splitOffset);

          // 6. ASSEMBLE OUTPUT CONTAINERS
          // Current Page Paragraph
          p.innerHTML = '';
          if (hadDropCap) {
            p.innerHTML = injectSvgDropcap(dropcapLetter, fontClass);
            p.classList.add('has-dropcap');
          } else {
            p.classList.remove('has-dropcap');
          }
          
          const part1Flow = document.createElement('span');
          part1Flow.className = 'text-flow';
          part1Flow.appendChild(part1Fragment);
          p.appendChild(part1Flow);

          // Overflow Paragraph (Plain flow, no drop cap)
          const newP = document.createElement('p');
          const part2Flow = document.createElement('span');
          part2Flow.className = 'text-flow';
          part2Flow.appendChild(part2Fragment);
          newP.appendChild(part2Flow);

          return { element: newP, remainingText: remainingText, originalText: rawText, pushEntire: false };
        }





        function cleanEmptyPages() {
          const allPages = document.querySelectorAll('.page');
          allPages.forEach(page => {
            if (page.classList.contains('title-page') || page.classList.contains('toc-page') || page.classList.contains('page-p1')) {
              return;
            }
            
            const wisdomText = page.querySelector('.wisdom-text');
            const hasText = wisdomText && wisdomText.textContent.trim().replace(/\s+/g, '').length > 0;
            const hasPhoto = page.querySelector('.chapter-photo') !== null;
            const hasMemories = page.querySelector('.memory-item') !== null;
            const hasSignature = page.querySelector('.letter-signature') !== null;
            
            if (!hasText && !hasPhoto && !hasMemories && !hasSignature) {
              console.log("Removing empty page: chapter=" + page.getAttribute('data-chapter'));
              page.remove();
            }
          });
        }

        function markSparsePages() {
          const allPages = document.querySelectorAll('.page');
          allPages.forEach(page => {
            if (page.classList.contains('title-page') || page.classList.contains('toc-page')) {
              return;
            }
            
            const wisdomText = page.querySelector('.wisdom-text');
            const hasText = wisdomText && wisdomText.innerText.trim().length > 20;
            const hasPhoto = page.querySelector('.chapter-photo') !== null;
            const hasMemories = page.querySelector('.memory-item') !== null;
            
            // Mark completely sparse pages (mostly photos/memories)
            if (!hasText && (hasPhoto || hasMemories)) {
              console.log("Marking page as sparse: chapter=" + page.getAttribute('data-chapter'));
              page.classList.add('sparse-page');
            }

            // Mark short-text chapter openers for dynamic whitespace reclaiming
            if (page.classList.contains('page-p1') && hasText && !page.hasAttribute('data-rebalanced')) {
              // If text exists but is very short (< 400 chars) and there are no memories
              const textLength = wisdomText.innerText.trim().length;
              if (textLength < 400 && !hasMemories) {
                 console.log("Marking chapter opener as short-text-page to reclaim whitespace: chapter=" + page.getAttribute('data-chapter'));
                 page.classList.add('short-text-page');
              }
            }
          });
        }

      </script>
    </body>
    </html>
  `;
}
