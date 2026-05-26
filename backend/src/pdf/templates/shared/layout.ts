import * as fs from 'fs';
import * as path from 'path';
import type { BookData } from '../../types/pdf';
// supabase import removed - not needed for screenshots

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
      return `${prefix}<span class="dropcap">${firstLetter}</span><span class="dropcap-rest">${p1Body}</span>${p1Rest}`;
    } else {
      return `${prefix}<span class="dropcap">${firstLetter}</span><span class="dropcap-rest">${remainder}</span>`;
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
          <div class="wisdom-text chapter-opening intro-wisdom">${formatContent(chapter.content)}</div>
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
            <h1>${bookData.title}</h1>
            <hr class="gold-separator" />
            ${bookData.author ? `<h3>By ${bookData.author}</h3>` : ''}
          </div>
        </div>
      </div>
      ${tocHtml}
      ${chaptersHtml}

      <script>
        // Client-side text splitting to flow overflowing content from page-p1 to page-p2 and dynamically create overflow pages as needed
        window.addEventListener('load', () => {
          document.fonts.ready.then(() => {
            splitAllChaptersOverflow();
            cleanEmptyPages();
            markSparsePages();
            document.body.classList.add('layout-final');
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
          const hadDropCap = p.querySelector('span.dropcap') !== null;
          const initialBottom = p.getBoundingClientRect().bottom;
          if (initialBottom <= maxBottom) {
            return null;
          }

          const text = p.innerText;
          const words = text.split(' ');
          
          // Wrap words in spans to measure them without triggering DOM reflows repeatedly.
          // For drop caps, we must NOT nest the floated dropcap span inside a word span
          // because it breaks line formatting in Puppeteer.
          if (hadDropCap) {
            const firstWord = words[0];
            const firstLetter = firstWord.charAt(0);
            const restOfFirstWord = firstWord.slice(1);
            p.innerHTML = '<span class="dropcap">' + firstLetter + '</span><span class="dropcap-rest"><span>' + restOfFirstWord + '</span> ' +
              words.slice(1).map(w => '<span>' + w + '</span>').join(' ') + '</span>';
          } else {
            p.innerHTML = words.map(w => '<span>' + w + '</span>').join(' ');
          }

          const spans = [];
          if (hadDropCap) {
            const dropcap = p.querySelector('span.dropcap');
            if (dropcap) spans.push(dropcap);
            const restSpans = p.querySelectorAll('span.dropcap-rest > span');
            restSpans.forEach(s => spans.push(s));
          } else {
            p.querySelectorAll('span').forEach(s => spans.push(s));
          }

          if (spans.length === 0) return null;

          // Group spans by line (based on top coordinate)
          // If we had a dropcap, spans[0] is the floated dropcap element.
          // We start grouping lines from spans[1] which contains the inline text flow.
          const lines = [];
          let currentLine = [];
          let lastTop = -1;
          const startIdx = hadDropCap ? 1 : 0;
          
          for (let i = startIdx; i < spans.length; i++) {
            const rect = spans[i].getBoundingClientRect();
            if (lastTop === -1 || Math.abs(rect.top - lastTop) > 5) {
              if (currentLine.length > 0) {
                lines.push(currentLine);
              }
              currentLine = [];
              lastTop = rect.top;
            }
            currentLine.push(i); // store word index
          }
          if (currentLine.length > 0) {
            lines.push(currentLine);
          }

          // Find the last line that fits entirely below maxBottom
          let fitLineCount = 0;
          for (let i = 0; i < lines.length; i++) {
            const lastWordIdx = lines[i][lines[i].length - 1];
            const lastWordBottom = spans[lastWordIdx].getBoundingClientRect().bottom;
            if (lastWordBottom <= maxBottom) {
              fitLineCount = i + 1;
            } else {
              break;
            }
          }

          // Apply Widows/Orphans constraints (minimum 2 lines in each part)
          const totalLines = lines.length;
          const remainingLines = totalLines - fitLineCount;

          if (fitLineCount < 2) {
            // Orphan warning: less than 2 lines would fit on current page.
            // So we push the entire paragraph to the next page!
            fitLineCount = 0;
          } else if (remainingLines < 2) {
            // Widow warning: less than 2 lines would be left on the next page.
            // So we pull one more line to the next page (reduce fitLineCount by 1).
            fitLineCount = totalLines - 2;
            if (fitLineCount < 2) {
              // If pulling a line leaves less than 2 lines on the current page, push the whole paragraph!
              fitLineCount = 0;
            }
          }

          if (fitLineCount === 0) {
            // Push entire paragraph to next page: restore original text and return it
            p.innerText = text;
            return { element: p, remainingText: text, originalText: text, pushEntire: true };
          }

          // Split at the determined fitLineCount
          const lastSpanIdx = lines[fitLineCount - 1][lines[fitLineCount - 1].length - 1];
          const splitWordIndex = hadDropCap ? lastSpanIdx : lastSpanIdx + 1;
          const fitText = words.slice(0, splitWordIndex).join(' ');
          if (hadDropCap) {
            const match = fitText.match(/^([A-Za-z0-9])/);
            if (match) {
              const firstLetter = match[1];
              const remainder = fitText.slice(1);
              p.innerHTML = '<span class="dropcap">' + firstLetter + '</span><span class="dropcap-rest">' + remainder + '</span>';
            } else {
              p.innerText = fitText;
            }
          } else {
            p.innerText = fitText;
          }

          const remainingText = words.slice(splitWordIndex).join(' ');
          if (!remainingText) return null;

          const newP = document.createElement('p');
          newP.innerText = remainingText;
          return { element: newP, remainingText: remainingText, originalText: text };
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
