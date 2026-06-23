import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { replaceTokens } from '@/lib/tokenReplacer';
import { X, ChevronLeft, ChevronRight, Camera } from 'lucide-react';
import CompanionBubble from '@/components/chapter/CompanionBubble';
import {
  PREVIEW_PAGE_CONTENT_HEIGHT,
  PREVIEW_PAGE_FOOTER_HEIGHT,
  PREVIEW_PAGE_HEIGHT,
  PREVIEW_PAGE_WIDTH,
  PREVIEW_PAGE_PADDING_INNER,
  PREVIEW_PAGE_PADDING_OUTER,
  PREVIEW_PAGE_PADDING_TOP,
  PREVIEW_PHOTO_HORIZONTAL_HEIGHT,
  PREVIEW_PHOTO_VERTICAL_HEIGHT,
  PREVIEW_PHOTO_VERTICAL_WIDTH,
  PREVIEW_MAX_VIEWPORT_HEIGHT_RATIO,
  PREVIEW_MAX_VIEWPORT_WIDTH_RATIO,
  PREVIEW_SPINE_HALF_WIDTH,
  PREVIEW_SPREAD_COLUMN_GAP,
  PREVIEW_SPREAD_HEIGHT,
  PREVIEW_SPINE_WIDTH,
  PREVIEW_SPREAD_WIDTH,
} from '@/features/preview/geometry';
import type { Book, Chapter, ChapterTemplate, Memory, SpreadDef, SpreadRender } from '@/features/preview/types';
import { getPhotoImageStyle, parsePhotoRenderLayout } from '@/features/photoRendering';

const SERIF = "'Lora', 'Georgia', 'Times New Roman', serif";
const GOLD = '#BBA96A';
const PINK = '#C4788A';

const PreviewBook = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [templates, setTemplates] = useState<ChapterTemplate[]>([]);
  const [authorName, setAuthorName] = useState('');
  const [memories, setMemories] = useState<Memory[]>([]);
  const [ancestry, setAncestry] = useState<{ content: string | null; pdf_url: string | null; pdf_filename: string | null } | null>(null);
  const [familyHistory, setFamilyHistory] = useState<{ content: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentSpread, setCurrentSpread] = useState(0);
  const [showLeftPageFade, setShowLeftPageFade] = useState(false);
  const [viewportScale, setViewportScale] = useState(1);
  const [exactPreviewHtml, setExactPreviewHtml] = useState('');
  const [exactPreviewLoading, setExactPreviewLoading] = useState(false);
  const [exactPreviewError, setExactPreviewError] = useState<string | null>(null);
  const [exactPageCount, setExactPageCount] = useState(0);
  const [isCompactPreview, setIsCompactPreview] = useState(false);
  const [compactPageIndex, setCompactPageIndex] = useState(0);
  const exactHasInsideFrontCover = true;
  const flowContainerRef = useRef<HTMLDivElement | null>(null);
  const exactPreviewIframeRef = useRef<HTMLIFrameElement | null>(null);

  const visibleChapters = chapters
    .filter(c => c.chapter_number > 0 && c.status === 'complete')
    .sort((a, b) => a.chapter_number - b.chapter_number);

  const rawAncestryText = ancestry?.content?.trim() || '';
  const ancestryText = rawAncestryText
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<\/?p[^>]*>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/\n\n+/g, '\n\n')
    .trim();
  const hasAncestry = ancestryText.length > 0 || !!ancestry?.pdf_url;

  const familyHistoryText = (familyHistory?.content || '').trim();
  const hasFamilyHistory = familyHistoryText.length > 0;

  const spreads: SpreadDef[] = [];
  spreads.push({ type: 'title' });
  spreads.push({ type: 'toc_letter' });
  spreads.push({ type: 'epigraph' });
  visibleChapters.forEach(ch => spreads.push({ type: 'chapter', chapter: ch }));
  if (hasAncestry) spreads.push({ type: 'ancestry' });
  if (hasFamilyHistory) spreads.push({ type: 'family_history' });

  const totalSpreads = spreads.length;
  const clampedSpread = Math.min(currentSpread, totalSpreads - 1);
  const totalPages = totalSpreads * 2;
  const leftPageNum = clampedSpread === 0 ? 0 : clampedSpread * 2;
  const rightPageNum = clampedSpread * 2 + 1;

  useEffect(() => {
    if (!bookId) return;
    const load = async () => {
      const { data: bookData } = await supabase.from('books').select('*').eq('id', bookId).single();
      const tplGender = bookData?.recipient_gender === 'Girl/Young Woman' ? 'female' : 'male';
      const [{ data: chapData }, { data: tplData }, { data: memData }, { data: ancData }, { data: fhData }] = await Promise.all([
        supabase.from('chapters').select('*').eq('book_id', bookId).order('chapter_number'),
        supabase.from('chapter_templates').select('chapter_number, title, is_photo_chapter, reference_content_male, reference_content_female').eq('gender', tplGender),
        supabase.from('memories').select('id, chapter_id, contributor_name, memory_text').eq('book_id', bookId),
        supabase.from('book_ancestry').select('content, pdf_url, pdf_filename').eq('book_id', bookId).maybeSingle(),
        supabase.from('book_family_history').select('content').eq('book_id', bookId).maybeSingle(),
      ]);
      if (bookData && bookData.recipient_name) {
        bookData.recipient_name = bookData.recipient_name.trim().split(/\s+/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
      setBook(bookData);
      setChapters(chapData || []);
      setTemplates(tplData || []);
      setMemories(memData || []);
      setAncestry(ancData || null);
      setFamilyHistory(fhData || null);
      if (bookData?.user_id) {
        const { data: userData } = await supabase.auth.getUser();
        const { data: profile } = await supabase.from('profiles').select('display_name').eq('user_id', bookData.user_id).single();
        setAuthorName(bookData.from_label || profile?.display_name || userData.user?.user_metadata?.full_name || 'The Author');
      }
      setLoading(false);
    };
    load();
  }, [bookId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setCurrentSpread(p => Math.max(0, p - 1));
      if (e.key === 'ArrowRight') setCurrentSpread(p => p + 1);
      if (e.key === 'Escape' && bookId) navigate(`/book/${bookId}`);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [bookId, navigate]);

  useLayoutEffect(() => {
    const activeSpread = spreads[clampedSpread];
    if (!activeSpread || activeSpread.type !== 'chapter') {
      setShowLeftPageFade(false);
      return;
    }

    const hasPhoto = activeSpread.chapter.photo_urls && activeSpread.chapter.photo_urls.length > 0;
    const isVerticalPhoto = (activeSpread.chapter.chapter_template === 'photo_second' || activeSpread.chapter.chapter_template === 'vertical_photo') && hasPhoto;
    const container = flowContainerRef.current;

    if (isVerticalPhoto || !container) {
      setShowLeftPageFade(false);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const columnMidpoint = containerRect.left + containerRect.width / 2;
    const bodyParagraphs = Array.from(container.querySelectorAll<HTMLElement>('[data-body-paragraph="true"]'));
    const continuesOnRight = bodyParagraphs.some((paragraph) =>
      Array.from(paragraph.getClientRects()).some((rect) => rect.left >= columnMidpoint + 8)
    );

    setShowLeftPageFade(continuesOnRight);
  }, [book?.recipient_gender, book?.recipient_name, chapters, clampedSpread, templates]);

  useEffect(() => {
    const computeScale = () => {
      const compact = window.innerWidth < 1200;
      setIsCompactPreview(compact);
      const availableWidth = window.innerWidth * PREVIEW_MAX_VIEWPORT_WIDTH_RATIO;
      const availableHeight = window.innerHeight * PREVIEW_MAX_VIEWPORT_HEIGHT_RATIO;
      const targetWidth = compact ? PREVIEW_PAGE_WIDTH : PREVIEW_SPREAD_WIDTH;
      const targetHeight = compact ? PREVIEW_PAGE_HEIGHT : PREVIEW_SPREAD_HEIGHT;
      const widthScale = availableWidth / targetWidth;
      const heightScale = availableHeight / targetHeight;
      const next = Math.min(widthScale, heightScale, 1.25);
      setViewportScale(Math.max(0.35, next));
    };

    computeScale();
    window.addEventListener('resize', computeScale);
    return () => window.removeEventListener('resize', computeScale);
  }, []);

  useEffect(() => {
    if (isCompactPreview) {
      setCurrentSpread(0);
      setCompactPageIndex(0);
    }
  }, [isCompactPreview]);

  useEffect(() => {
    if (loading || !book) return;

    const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || 'https://pdf-render-service-33np.onrender.com';
    const normalizeContent = (referenceText: string | null, content: string | null) => {
      const ref = (referenceText || '').trim();
      const body = (content || '').trim();
      if (!ref) return body;
      if (!body) return ref;
      return /\s$/.test(ref) || /^\s/.test(body) ? `${ref}${body}` : `${ref} ${body}`;
    };

    const letter = chapters.find(c => c.chapter_number === 0);
    const payloadChapters: Array<Record<string, unknown>> = [];

    if (letter && ((letter.content || '').trim() || (letter.reference_text || '').trim())) {
      payloadChapters.push({
        chapter_number: 0,
        title: letter.title || 'Letter from the Author',
        chapter_template: 'letter',
        content: normalizeContent(letter.reference_text, letter.content),
        photo_urls: [],
        photo_layout: letter.photo_layout,
        memories: [],
      });
    }

    visibleChapters.forEach((ch) => {
      const chapterMemories = memories
        .filter(m => m.chapter_id === ch.id)
        .map(m => ({ memory_text: m.memory_text, contributor_name: m.contributor_name }));

      payloadChapters.push({
        chapter_number: ch.chapter_number,
        title: ch.title,
        chapter_template: ch.chapter_template,
        content: normalizeContent(ch.reference_text, ch.content),
        photo_urls: (ch.photo_urls || []).filter(Boolean),
        photo_layout: ch.photo_layout,
        bible_verse_text: ch.bible_verse_text,
        bible_verse_reference: ch.bible_verse_reference,
        quote_text: ch.quote_text,
        quote_attribution: ch.quote_attribution,
        memories: chapterMemories,
      });
    });

    const payload = {
      title: 'A Book of Wisdom',
      author: authorName || 'The Author',
      recipientName: book.recipient_name,
      chapters: payloadChapters,
      ancestryText: ancestryText || undefined,
      ancestryPdfUrl: ancestry?.pdf_url || undefined,
      familyHistoryText: familyHistoryText || undefined,
    };

    const loadExactPreview = async () => {
      setExactPreviewLoading(true);
      setExactPreviewError(null);
      try {
        const response = await fetch(`${apiBase}/generate-preview-html`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          throw new Error(`Preview HTML failed (${response.status})`);
        }
        const html = await response.text();
        setExactPreviewHtml(html);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load exact preview HTML';
        setExactPreviewError(message);
      } finally {
        setExactPreviewLoading(false);
      }
    };

    loadExactPreview();
  }, [loading, book, chapters, memories, authorName, ancestryText, ancestry?.pdf_url]);

  useEffect(() => {
    if (!exactPreviewHtml) return;
    setExactPageCount(0);
    setCurrentSpread(0);
    setCompactPageIndex(0);
    setExactPreviewError(null);
  }, [exactPreviewHtml]);

  useEffect(() => {
    return () => {
    };
  }, []);

  useEffect(() => {
    if (!exactPreviewHtml || exactPageCount === 0) return;

    const iframe = exactPreviewIframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc) return;

    const pages = Array.from(doc.querySelectorAll<HTMLElement>('.page')).filter((page) => {
      const hasText = (page.textContent || '').replace(/\s+/g, '').length > 0;
      const hasMedia = page.querySelector('img, svg, .chapter-photo, .memory-item, .cover-frame') !== null;
      return hasText || hasMedia;
    });
    const contentSpreads = Math.max(1, Math.ceil(Math.max(0, exactPageCount - 1) / 2));
    const totalSpreads = contentSpreads + (exactHasInsideFrontCover ? 1 : 0);
    const clamped = Math.max(0, Math.min(currentSpread, totalSpreads - 1));
    const isInsideFrontCoverSpread = exactHasInsideFrontCover && clamped === 0;
    const contentSpreadIndex = isInsideFrontCoverSpread ? 0 : clamped - (exactHasInsideFrontCover ? 1 : 0);
    const start = isInsideFrontCoverSpread ? 0 : (contentSpreadIndex * 2) + 1;
    const end = start + 1;
    const selectedCompactDocIndex = isCompactPreview
      ? (compactPageIndex === 0 ? null : compactPageIndex - 1)
      : null;

    pages.forEach((page, idx) => {
      const shouldShow = isCompactPreview
        ? idx === selectedCompactDocIndex
        : idx === start || (!isInsideFrontCoverSpread && idx === end);
      page.style.display = shouldShow ? 'block' : 'none';
      page.style.flex = '0 0 auto';
      page.style.margin = '0';
      page.style.boxSizing = 'border-box';
      if (isCompactPreview) {
        page.style.paddingLeft = '0.5in';
        page.style.paddingRight = '0.5in';
        page.style.paddingTop = '0.5in';
        page.style.paddingBottom = '0';
        page.style.maxWidth = '100%';
      }
    });

    doc.body.style.margin = '0';
    doc.body.style.padding = '0';
    doc.body.style.height = '100%';
    doc.body.style.background = '#ffffff';
    doc.body.style.display = 'flex';
    doc.body.style.flexDirection = isCompactPreview ? 'column' : 'row';
    const hasRightPage = !isInsideFrontCoverSpread && end < pages.length;
    doc.body.style.justifyContent = isCompactPreview 
      ? 'center' 
      : (isInsideFrontCoverSpread 
          ? 'flex-end' 
          : (hasRightPage ? 'center' : 'flex-start')
        );
    doc.body.style.alignItems = isCompactPreview ? 'center' : 'flex-start';
    doc.body.style.overflow = 'hidden';

    if (doc.documentElement) {
      doc.documentElement.style.height = '100%';
      doc.documentElement.style.overflow = 'hidden';
    }
  }, [exactPreviewHtml, exactPageCount, currentSpread, exactHasInsideFrontCover, isCompactPreview, compactPageIndex]);

  const waitForLayoutFinal = async (doc: Document) => {
    for (let i = 0; i < 120; i += 1) {
      if (doc.body?.classList.contains('layout-final')) return;
      await new Promise(resolve => window.setTimeout(resolve, 50));
    }
  };

  const handleExactPreviewLoad = async () => {
    const iframe = exactPreviewIframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc) return;

    await waitForLayoutFinal(doc);
    const pages = Array.from(doc.querySelectorAll<HTMLElement>('.page')).filter((page) => {
      const hasText = (page.textContent || '').replace(/\s+/g, '').length > 0;
      const hasMedia = page.querySelector('img, svg, .chapter-photo, .memory-item, .cover-frame') !== null;
      return hasText || hasMedia;
    });

    if (pages.length === 0) return;

    setExactPageCount(prev => (prev === pages.length ? prev : pages.length));
    const totalSpreads = Math.max(1, Math.ceil(Math.max(0, pages.length - 1) / 2)) + (exactHasInsideFrontCover ? 1 : 0);
    setCurrentSpread(prev => Math.min(prev, totalSpreads - 1));
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: '#EDEBE5' }}>
        <p style={{ fontFamily: SERIF, color: '#9CA3AF' }}>Loading preview…</p>
      </div>
    );
  }
  if (!book) return null;

  if (!loading && exactPreviewLoading && !exactPreviewHtml) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: '#EDEBE5' }}>
        <p style={{ fontFamily: SERIF, color: '#6B7280' }}>Loading exact PDF preview…</p>
      </div>
    );
  }

  if (!loading && exactPreviewHtml && !exactPreviewError) {
    const exactContentSpreads = Math.max(1, Math.ceil(Math.max(0, exactPageCount - 1) / 2));
    const exactTotalSpreads = exactContentSpreads + (exactHasInsideFrontCover ? 1 : 0);
    const exactTotalPages = exactPageCount + (exactHasInsideFrontCover ? 1 : 0);
    const exactClampedSpread = Math.min(currentSpread, exactTotalSpreads - 1);
    const exactIsInsideFrontCoverSpread = exactHasInsideFrontCover && exactClampedSpread === 0;
    const exactContentSpreadIndex = exactIsInsideFrontCoverSpread
      ? -1
      : exactClampedSpread - (exactHasInsideFrontCover ? 1 : 0);
    const exactLeftPageNum = exactIsInsideFrontCoverSpread ? 1 : (exactContentSpreadIndex * 2) + 2;
    const exactRightPageNum = Math.min(exactLeftPageNum + 1, exactTotalPages);
    const exactCompactTotalPages = exactPageCount + (exactHasInsideFrontCover ? 1 : 0);
    const compactLabel = compactPageIndex === 0
      ? 'Inside Front Cover'
      : `Page ${compactPageIndex + 1} of ${exactCompactTotalPages}`;
    const compactWidth = isCompactPreview ? Math.min(PREVIEW_PAGE_WIDTH, Math.floor(window.innerWidth * 0.92)) : PREVIEW_SPREAD_WIDTH;

    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'linear-gradient(180deg, #d7d4cc 0%, #d2cfc7 100%)' }}>
        <button
          onClick={() => navigate(`/book/${bookId}`)}
          className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-opacity hover:opacity-70"
          style={{ background: 'rgba(255,255,255,0.5)', color: '#6B7280', fontFamily: SERIF, fontSize: '0.75rem', minWidth: '44px', minHeight: '44px', backdropFilter: 'blur(2px)' }}
        >
          <X className="h-3.5 w-3.5" />
          Close
        </button>

        <div className="flex-1 overflow-hidden flex items-center justify-center py-2 px-2 sm:px-4">
          <div
            className="relative"
            style={{
              width: `${isCompactPreview ? compactWidth : PREVIEW_SPREAD_WIDTH}px`,
              height: `${isCompactPreview ? PREVIEW_PAGE_HEIGHT : PREVIEW_SPREAD_HEIGHT}px`,
              boxShadow: '0 12px 34px rgba(58, 55, 46, 0.22)',
              borderRadius: '4px',
              overflow: 'hidden',
              transform: `scale(${viewportScale})`,
              transformOrigin: 'center center',
              background: '#faf8f5',
              border: '1px solid rgba(255,255,255,0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {!isCompactPreview && (
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: 0,
                  transform: 'translateX(-50%)',
                  width: '18px',
                  height: '100%',
                  background: '#ece6dc',
                  borderLeft: '1px solid #c27488',
                  borderRight: '1px solid #c27488',
                  zIndex: 2,
                  pointerEvents: 'none',
                }}
              />
            )}

            {isCompactPreview ? (
              compactPageIndex === 0 ? (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: '#ffffff',
                    zIndex: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  <p style={{ fontFamily: SERIF, fontSize: '14px', color: '#7c8797', fontStyle: 'italic' }}>
                    Inside Front Cover
                  </p>
                </div>
              ) : null
            ) : exactIsInsideFrontCoverSpread && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: `calc(50% - 9px)`,
                  height: '100%',
                  background: '#ffffff',
                  zIndex: 3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                <p style={{ fontFamily: SERIF, fontSize: '14px', color: '#7c8797', fontStyle: 'italic' }}>
                  Inside Front Cover
                </p>
              </div>
            )}

            <iframe
              ref={exactPreviewIframeRef}
              onLoad={handleExactPreviewLoad}
              title="Exact PDF Preview"
              srcDoc={exactPreviewHtml}
              className="w-full h-full border-0"
              sandbox="allow-same-origin allow-scripts"
              style={{
                position: 'relative',
                zIndex: 1,
                opacity: 1,
                pointerEvents: 'auto',
                width: '100%',
                height: '100%',
              }}
            />
          </div>
        </div>

        <div
          className="absolute left-0 right-0 bottom-3 sm:bottom-4 z-20 flex items-center justify-center gap-3 sm:gap-8"
          style={{ pointerEvents: 'none' }}
        >
          <button
            onClick={() => {
              if (isCompactPreview) {
                setCompactPageIndex(p => Math.max(0, p - 1));
              } else {
                setCurrentSpread(p => Math.max(0, p - 1));
              }
            }}
            disabled={isCompactPreview ? compactPageIndex === 0 : exactClampedSpread === 0}
            className="flex items-center justify-center rounded-full border transition-opacity disabled:opacity-20"
            style={{ color: '#6B7280', width: '40px', height: '40px', background: '#fff', borderColor: '#D1CCC4', pointerEvents: 'auto' }}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <span className="tabular-nums min-w-[120px] sm:min-w-[160px] text-center" style={{ fontFamily: SERIF, fontSize: '11px', color: '#9CA3AF', background: 'rgba(255,255,255,0.72)', borderRadius: '999px', padding: '6px 10px', pointerEvents: 'auto' }}>
            {exactPageCount > 0 ? (isCompactPreview ? compactLabel : (exactIsInsideFrontCoverSpread ? 'Inside Front Cover' : `Page ${exactLeftPageNum}${exactRightPageNum > exactLeftPageNum ? `-${exactRightPageNum}` : ''} of ${exactTotalPages}`)) : 'Preparing pages...'}
          </span>

          <button
            onClick={() => {
              if (isCompactPreview) {
                setCompactPageIndex(p => Math.min(exactCompactTotalPages - 1, p + 1));
              } else {
                setCurrentSpread(p => Math.min(exactTotalSpreads - 1, p + 1));
              }
            }}
            disabled={isCompactPreview ? compactPageIndex >= exactCompactTotalPages - 1 : exactClampedSpread >= exactTotalSpreads - 1}
            className="flex items-center justify-center rounded-full border transition-opacity disabled:opacity-20"
            style={{ color: '#6B7280', width: '40px', height: '40px', background: '#fff', borderColor: '#D1CCC4', pointerEvents: 'auto' }}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

  const letterChapter = chapters.find(c => c.chapter_number === 0);
  const rawLetterText = letterChapter?.content?.trim() || letterChapter?.reference_text?.trim() || '';
  const unescapedLetterText = rawLetterText.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const letterRawText = unescapedLetterText
    .replace(/<\/?p[^>]*>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/\n\n+/g, '\n\n')
    .trim();
  const hasLetterWritten = letterRawText.length > 0;
  const isFemale = book.recipient_gender === 'Girl/Young Woman';

  const photoNums = new Set(templates.filter(t => t.is_photo_chapter).map(t => t.chapter_number));

  const tokenCtx = {
    recipientName: book.recipient_name || 'your child',
    recipientGender: book.recipient_gender || '',
    authorLabel: book.author_label || null,
  };

  const getTemplateRef = (chapterNumber: number) => {
    const tpl = templates.find(t => t.chapter_number === chapterNumber);
    if (!tpl) return null;
    const raw = isFemale ? tpl.reference_content_female : tpl.reference_content_male;
    const tokensReplaced = raw ? replaceTokens(raw, tokenCtx) : null;
    if (!tokensReplaced) return null;
    const unescapedTokensReplaced = tokensReplaced.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    return unescapedTokensReplaced
      .replace(/<\/?p[^>]*>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?[^>]+(>|$)/g, '')
      .replace(/\n\n+/g, '\n\n')
      .trim();
  };

  const getChapterTitle = (ch: { chapter_number: number; title: string }) => {
    return ch.title;
  };

  const PageNum = ({ num }: { num: number }) => {
    if (num <= 1) return <div style={{ height: '24px' }} className="mt-auto" />;
    return (
      <p className="text-center mt-auto pt-4" style={{ fontFamily: SERIF, fontSize: '8px', color: GOLD }}>{num}</p>
    );
  };

  const renderInline = (line: string): React.ReactNode => {
    if (!line) return null;
    const re =
      /<mark[^>]*>([\s\S]*?)<\/mark>|\*\*([^*\n]+?)\*\*|~~([^~\n]+?)~~|`([^`\n]+?)`|\*([^*\n]+?)\*|_([^_\n]+?)_/g;
    const parts: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    let k = 0;
    const emStyle: React.CSSProperties = { fontStyle: 'italic' };
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) parts.push(line.slice(last, m.index));
      if (m[1] !== undefined) {
        parts.push(
          <mark
            key={`mk${k++}`}
            style={{
              backgroundColor: '#FEF3C7',
              color: 'inherit',
              padding: '0 2px',
              borderRadius: '2px',
            }}
          >
            {m[1]}
          </mark>,
        );
      } else if (m[2] !== undefined) {
        parts.push(<strong key={`b${k++}`} style={{ fontWeight: 'bold' }}>{m[2]}</strong>);
      } else if (m[3] !== undefined) {
        parts.push(<s key={`s${k++}`}>{m[3]}</s>);
      } else if (m[4] !== undefined) {
        parts.push(
          <code
            key={`c${k++}`}
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: '0.92em',
              background: 'rgba(0,0,0,0.05)',
              padding: '0 4px',
              borderRadius: '2px',
            }}
          >
            {m[4]}
          </code>,
        );
      } else if (m[5] !== undefined) {
        parts.push(<em key={`i${k++}`} style={emStyle}>{m[5]}</em>);
      } else if (m[6] !== undefined) {
        parts.push(<em key={`u${k++}`} style={emStyle}>{m[6]}</em>);
      }
      last = m.index + m[0].length;
    }
    if (last < line.length) parts.push(line.slice(last));
    if (parts.length === 0) return line;
    return parts.length === 1 ? parts[0] : parts;
  };

  const renderWithLineBreaks = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => (
      <span key={idx} style={{ display: 'block' }}>
        {renderInline(line) || '\u00A0'}
      </span>
    ));
  };

  const DropCapText = ({ text, color }: { text: string; color: string }) => (
    <>
      {text.split(/\n\n+/).filter(Boolean).map((para, i) => {
        const isPlaceholder = para.trim() === 'No content available.';
        const shouldApplyDropCap = i === 0 && !isPlaceholder;
        const body = shouldApplyDropCap ? para.slice(1) : para;
        return (
          <p key={i} data-body-paragraph="true" style={{ fontFamily: SERIF, fontSize: '11pt', color: '#263445', lineHeight: 1.65, marginBottom: '0.8em', textAlign: 'justify', textJustify: 'inter-word', hyphens: 'auto', WebkitHyphens: 'auto' }}>
            {shouldApplyDropCap && (
              <span className="float-left" style={{ fontFamily: SERIF, fontSize: '3.6em', lineHeight: 1, fontWeight: 700, color, margin: '-0.12em 0.08em 0 0', paddingTop: '0.14em' }}>
                {para.charAt(0)}
              </span>
            )}
            {shouldApplyDropCap ? (
              // First paragraph: render first line inline to flow next to floated drop cap
              (() => {
                const lines = body.split('\n');
                return lines.map((line, idx) => (
                  <span key={idx} style={{ display: idx === 0 ? 'inline' : 'block' }}>
                    {renderInline(line) || '\u00A0'}
                  </span>
                ));
              })()
            ) : (
              renderWithLineBreaks(body)
            )}
          </p>
        );
      })}
    </>
  );

  const renderTitleSpread = (): [React.ReactNode, React.ReactNode, string | undefined] => {
    const left = (
      <div className="flex flex-col h-full items-center justify-center p-8 text-center">
        <p style={{ fontFamily: SERIF, fontSize: '10px', color: '#9CA3AF', fontStyle: 'italic' }}>
          Inside Front Cover
        </p>
      </div>
    );

    const right = (
      <div className="flex flex-col h-full items-center justify-center">
        <div 
          className="w-full h-full flex flex-col items-center justify-center p-1.5"
          style={{ 
            border: `2px solid ${GOLD}`, 
            borderRadius: '2px'
          }}
        >
          <div 
            className="w-full h-full flex flex-col items-center justify-center p-6 text-center"
            style={{ 
              border: `1px solid ${GOLD}`,
              borderRadius: '1px'
            }}
          >
            <p className="uppercase tracking-[0.25em] mb-2" style={{ fontFamily: SERIF, fontSize: '8px', color: '#9CA3AF' }}>
              A Book of Wisdom
            </p>
            <h1 className="font-bold mb-2 uppercase tracking-[0.1em]" style={{ fontFamily: SERIF, fontSize: '24px', color: '#2D3748', lineHeight: 1.2 }}>
              52 Things to Know
            </h1>
            <p className="mb-4" style={{ fontFamily: SERIF, fontSize: '12px', color: '#6B7280' }}>
              For {book.recipient_name || 'your loved one'}
            </p>
            <div className="w-10 my-4" style={{ height: '1px', background: GOLD }} />
            <h3 className="italic" style={{ fontFamily: SERIF, fontSize: '12px', color: '#4A5568' }}>
              By {authorName || 'The Author'}
            </h3>
          </div>
        </div>
      </div>
    );

    return [left, right, undefined];
  };

  const renderTocLetterSpread = (): [React.ReactNode, React.ReactNode, string | undefined] => {
    const chapterPageMap = new Map<string, number>();
    visibleChapters.forEach((ch, i) => {
      chapterPageMap.set(ch.id, (3 + i) * 2);
    });

    const left = (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto">
          <p className="text-center uppercase tracking-[0.25em] mb-1" style={{ fontFamily: SERIF, fontSize: '9px', color: '#9CA3AF' }}>
            A Book of Wisdom
          </p>
          <h2 className="text-center font-bold mb-1" style={{ fontFamily: SERIF, fontSize: '18px', color: '#2D3748' }}>
            52 Things to Know
          </h2>
          <p className="text-center mb-5" style={{ fontFamily: SERIF, fontSize: '11px', color: '#6B7280' }}>
            For {book.recipient_name}
          </p>
          <div className="w-8 mx-auto mb-4" style={{ height: '1px', background: GOLD }} />

          {hasLetterWritten && (
            <div className="flex items-baseline justify-between py-2" style={{ borderBottom: '1px solid #E5E1D8' }}>
              <span style={{ fontFamily: SERIF, fontSize: '11px', color: '#2D3748' }}>Letter from the Author</span>
              <span style={{ fontFamily: SERIF, fontSize: '10px', color: GOLD }}>3</span>
            </div>
          )}

          {visibleChapters.length === 0 && !hasLetterWritten ? (
            <p className="text-center mt-8 italic" style={{ fontFamily: SERIF, fontSize: '11px', color: '#9CA3AF' }}>
              Your book will take shape as you write.
            </p>
          ) : (
            visibleChapters.map(ch => {
              const isComplete = ch.status === 'complete';
              const isPhoto = photoNums.has(ch.chapter_number);
              const pageNum = chapterPageMap.get(ch.id);
              return (
                <div key={ch.id} className="flex items-baseline justify-between py-1.5" style={{ borderBottom: '1px solid #F0EDE6' }}>
                  <span className="truncate pr-2" style={{ fontFamily: SERIF, fontSize: '11px', color: isComplete ? '#2D3748' : '#6B7280' }}>
                    <span className="inline-block w-4 text-right mr-1.5 tabular-nums" style={{ fontSize: '10px', color: '#9CA3AF' }}>{ch.chapter_number}.</span>
                    {getChapterTitle(ch)}
                  </span>
                  <span className="flex items-center gap-1 flex-shrink-0" style={{ fontFamily: SERIF, fontSize: '10px' }}>
                    {isComplete ? (
                      <span style={{ color: GOLD }}>{pageNum}</span>
                    ) : (
                      <span className="italic" style={{ color: '#9CA3AF' }}>(in progress)</span>
                    )}
                    {isPhoto && <Camera className="h-2.5 w-2.5" style={{ color: GOLD }} />}
                  </span>
                </div>
              );
            })
          )}

          {hasAncestry && (
            <div className="flex items-baseline justify-between py-2 mt-2 pt-3" style={{ borderTop: '1px solid #E5E1D8' }}>
              <span style={{ fontFamily: SERIF, fontSize: '11px', color: '#2D3748' }}>Where You Come From</span>
              <span style={{ fontFamily: SERIF, fontSize: '10px', color: GOLD }}>{(3 + visibleChapters.length) * 2}</span>
            </div>
          )}

          {hasFamilyHistory && (
            <div className="flex items-baseline justify-between py-2" style={{ borderBottom: '1px solid #F0EDE6' }}>
              <span style={{ fontFamily: SERIF, fontSize: '11px', color: '#2D3748' }}>Family History</span>
              <span style={{ fontFamily: SERIF, fontSize: '10px', color: GOLD }}>{(3 + visibleChapters.length + (hasAncestry ? 1 : 0)) * 2}</span>
            </div>
          )}
        </div>
        <PageNum num={leftPageNum} />
      </div>
    );

    let right: React.ReactNode;
    if (!hasLetterWritten) {
      right = (
        <div className="flex flex-col h-full">
          <div className="flex-1" />
          <PageNum num={rightPageNum} />
        </div>
      );
    } else {
      let letterText = replaceTokens(
        letterRawText.replace(/\[AUTHOR_NAME\]/g, authorName || 'The Author'),
        tokenCtx
      );

      if (authorName) {
        const escapedAuthor = authorName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        // Match "I love you, <authorName>" or "I love you, the author" at the very end
        const loveYouRegex = new RegExp(`I love you,\\s*(?:${escapedAuthor}|the author)\\.?\\s*$`, 'i');
        letterText = letterText.replace(loveYouRegex, 'I love you.');

        // Match "I am very proud to be your <authorName>" or "I am very proud to be your the author"
        const proudRegex = new RegExp(`I am very proud to be your\\s*(?:${escapedAuthor}|the author)\\.?`, 'i');
        letterText = letterText.replace(proudRegex, 'I am very proud of you.');
      }

      let hasGreeting = false;
      let strippedLetterText = letterText.replace(/^(\s*(?:<p[^>]*>)?\s*Dear\s+[^,\n<]+,?\s*(?:<\/p>)?)/i, () => {
        hasGreeting = true;
        return '';
      });

      right = (
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto">
            <p className="mb-4 italic" style={{ fontFamily: SERIF, fontSize: '14px', color: '#2D3748', lineHeight: 1.8 }}>
              Dear {book.recipient_name},
            </p>
            {strippedLetterText.split(/\n\n+/).filter(Boolean).map((para, i) => (
              <p key={i} style={{ fontFamily: SERIF, fontSize: '12px', color: '#2D3748', lineHeight: 1.8, marginBottom: '1em', textAlign: 'justify', textJustify: 'inter-word', hyphens: 'auto', WebkitHyphens: 'auto' }}>
                {renderWithLineBreaks(para)}
              </p>
            ))}
            <p className="mt-5" style={{ fontFamily: SERIF, fontSize: '12px', color: '#2D3748' }}>I love you,</p>
            <p className="mt-1 font-semibold" style={{ fontFamily: SERIF, fontSize: '14px', color: '#2D3748' }}>
              {authorName || 'The Author'}
            </p>
          </div>
          <PageNum num={rightPageNum} />
        </div>
      );
    }

    return [left, right, undefined];
  };

  const renderChapterSpread = (ch: Chapter, spreadIndex: number): SpreadRender => {
    const rawFullText = (() => {
      if (ch.chapter_number === 0) return ch.content?.trim() || '';
      const refText = ch.reference_text?.trim() || '';
      const mainContent = ch.content?.trim() || '';
      const needsSpace = refText.length > 0 && mainContent.length > 0 && !/\s$/.test(refText) && !/^\s/.test(mainContent);
      return refText + (needsSpace ? ' ' : '') + mainContent || getTemplateRef(ch.chapter_number) || '';
    })();
    const unescapedRawText = rawFullText.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    const fullText = replaceTokens(unescapedRawText, tokenCtx)
      .replace(/<\/?p[^>]*>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?[^>]+(>|$)/g, '')
      .replace(/\n\n+/g, '\n\n')
      .trim();
    const hasPhoto = ch.photo_urls && ch.photo_urls.length > 0 && ch.photo_urls[0] && ch.photo_urls[0].trim() !== '';
    const photoLayout = parsePhotoRenderLayout(ch.photo_layout);
    const hasAuthorWisdom = fullText.length > 0;
    const chapterLeftPageNum = spreadIndex * 2;
    const chapterRightPageNum = chapterLeftPageNum + 1;
    const isVerticalPhoto = (ch.chapter_template === 'photo_second' || ch.chapter_template === 'vertical_photo') && hasPhoto;
    const rightBg = '#FFFFFF';
    const chapterMemories = memories.filter(m => m.chapter_id === ch.id);
    const continuationFade = 'linear-gradient(to bottom, rgba(255,255,255,0) 98%, rgba(255,255,255,1) 100%)';

    if (isVerticalPhoto) {
      const left = (
        <div className="flex flex-col h-full">
          <div className="flex-1 relative overflow-y-auto pr-1" style={{ marginBottom: '0' }}>
            <p className="uppercase tracking-[0.2em]" style={{ fontFamily: SERIF, fontSize: '10pt', color: '#888', marginBottom: '0.5em' }}>
              Chapter {ch.chapter_number}
            </p>
            <h2 className="font-bold" style={{ fontFamily: SERIF, fontSize: '15pt', color: '#2D3748', lineHeight: 1.2, marginTop: '0.4em', marginBottom: '1.4em' }}>
              {getChapterTitle(ch)}
            </h2>
            {ch.bible_verse_text && (
              <div style={{ borderLeft: `2.5px solid ${GOLD}`, margin: '1.3em 0', paddingLeft: '1.5em' }}>
                <p className="italic" style={{ fontFamily: SERIF, fontSize: '11pt', color: 'rgba(29, 38, 48, 0.7)', lineHeight: 1.7, margin: 0 }}>"{ch.bible_verse_text}"</p>
                {ch.bible_verse_reference && <p className="uppercase tracking-[0.12em]" style={{ fontFamily: 'Source Sans 3, system-ui, sans-serif', fontSize: '8pt', color: 'rgba(106, 117, 129, 0.5)', marginTop: '0.8em', marginBottom: 0 }}>— {ch.bible_verse_reference}</p>}
              </div>
            )}
            {ch.quote_text && (
            <div style={{ borderLeft: `2.5px solid ${PINK}`, margin: '1.3em 0', paddingLeft: '1.5em' }}>
                <p className="italic" style={{ fontFamily: SERIF, fontSize: '11pt', color: 'rgba(29, 38, 48, 0.7)', lineHeight: 1.7, margin: 0 }}>"{ch.quote_text}"</p>
                {ch.quote_attribution && <p className="uppercase tracking-[0.12em]" style={{ fontFamily: 'Source Sans 3, system-ui, sans-serif', fontSize: '8pt', color: 'rgba(106, 117, 129, 0.5)', marginTop: '0.8em', marginBottom: 0 }}>— {ch.quote_attribution}</p>}
              </div>
            )}
            {fullText && <DropCapText text={fullText} color={GOLD} />}
          </div>
          <PageNum num={chapterLeftPageNum} />
        </div>
      );
      const right = (
        <div className="flex flex-col h-full">
          <div className="flex justify-center items-center mb-4 flex-shrink-0" style={{ height: 'auto' }}>
            <div className="rounded overflow-hidden shadow-md" style={{ width: `${PREVIEW_PHOTO_VERTICAL_WIDTH}px`, height: 'auto' }}>
              <img src={ch.photo_urls[0]} alt="" className="chapter-photo vertical-photo" style={getPhotoImageStyle(photoLayout)} />
            </div>
          </div>
          <div className="flex-1 mt-3" style={{ overflow: 'hidden' }}>
            {chapterMemories.length > 0 ? (
              chapterMemories.slice(0, 2).map(m => (
                <div key={m.id} className="mb-3 px-4 py-4 rounded-lg relative" style={{ background: '#F5F0E8' }}>
                  <p style={{ fontFamily: '"Caveat", cursive', fontSize: '15px', color: '#2D3748', lineHeight: 1.6 }}>
                    <span className="text-[#C9A84C] mr-1">✦</span>
                    {m.memory_text}
                  </p>
                  {m.contributor_name && (
                    <p className="mt-2 text-[8px] uppercase tracking-[0.12em] text-muted-foreground/60" style={{ fontFamily: SERIF }}>
                      — {m.contributor_name}
                    </p>
                  )}
                </div>
              ))
            ) : null}
          </div>
          <PageNum num={chapterRightPageNum} />
        </div>
      );
      return [left, right, rightBg, false, null];
    }

    const fullSpread = (
      <div style={{ position: 'relative', width: '100%', height: `${PREVIEW_SPREAD_HEIGHT}px` }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `calc(50% - ${PREVIEW_SPINE_HALF_WIDTH}px)`, background: '#FFFFFF' }} />
        <div style={{ position: 'absolute', left: `calc(50% - ${PREVIEW_SPINE_HALF_WIDTH}px)`, top: 0, bottom: 0, width: `${PREVIEW_SPINE_WIDTH}px`, background: '#EDE5D4', borderLeft: `1px solid ${PINK}`, borderRight: `1px solid ${PINK}`, zIndex: 2 }} />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `calc(50% - ${PREVIEW_SPINE_HALF_WIDTH}px)`, background: rightBg }} />

        <div
          ref={flowContainerRef}
          style={{
            position: 'relative',
            zIndex: 1,
            height: `${PREVIEW_PAGE_CONTENT_HEIGHT}px`,
            padding: `${PREVIEW_PAGE_PADDING_TOP}px ${PREVIEW_PAGE_PADDING_OUTER}px 0`,
            columnCount: 2,
            columnGap: `${PREVIEW_SPREAD_COLUMN_GAP}px`,
            columnFill: 'auto',
            overflow: 'hidden',
          }}
        >
          <div style={{ breakInside: 'avoid' }}>
            <p className="uppercase tracking-[0.2em]" style={{ fontFamily: SERIF, fontSize: '10pt', color: '#888', marginBottom: '0.5em' }}>
              Chapter {ch.chapter_number}
            </p>
            <h2 className="font-bold" style={{ fontFamily: SERIF, fontSize: '15pt', color: '#2D3748', lineHeight: 1.2, marginTop: '0.4em', marginBottom: '1.4em' }}>
              {getChapterTitle(ch)}
            </h2>
          </div>

          {hasPhoto && (ch.chapter_template === 'photo_top' || ch.chapter_template === 'horizontal_photo') ? (
            <div className="rounded overflow-hidden" style={{ breakInside: 'avoid', margin: '1.2em 0 0.8em', height: 'auto' }}>
              <img src={ch.photo_urls[0]} alt="" className="chapter-photo w-full h-auto block" style={getPhotoImageStyle(photoLayout)} />
            </div>
          ) : null}

          {ch.bible_verse_text && (
            <div style={{ borderLeft: `2.5px solid ${GOLD}`, breakInside: 'avoid', margin: '1.3em 0', paddingLeft: '1.5em' }}>
              <p className="italic" style={{ fontFamily: SERIF, fontSize: '11pt', color: 'rgba(29, 38, 48, 0.7)', lineHeight: 1.7, margin: 0 }}>"{ch.bible_verse_text}"</p>
              {ch.bible_verse_reference && <p className="uppercase tracking-[0.12em]" style={{ fontFamily: 'Source Sans 3, system-ui, sans-serif', fontSize: '8pt', color: 'rgba(106, 117, 129, 0.5)', marginTop: '0.8em', marginBottom: 0 }}>— {ch.bible_verse_reference}</p>}
            </div>
          )}

          {ch.quote_text && (
            <div style={{ borderLeft: `2.5px solid ${PINK}`, breakInside: 'avoid', margin: '1.3em 0', paddingLeft: '1.5em' }}>
              <p className="italic" style={{ fontFamily: SERIF, fontSize: '11pt', color: 'rgba(29, 38, 48, 0.7)', lineHeight: 1.7, margin: 0 }}>"{ch.quote_text}"</p>
              {ch.quote_attribution && <p className="uppercase tracking-[0.12em]" style={{ fontFamily: 'Source Sans 3, system-ui, sans-serif', fontSize: '8pt', color: 'rgba(106, 117, 129, 0.5)', marginTop: '0.8em', marginBottom: 0 }}>— {ch.quote_attribution}</p>}
            </div>
          )}

          {hasAuthorWisdom ? (
            <DropCapText text={fullText} color={GOLD} />
          ) : (
            <p className="italic text-center mt-8" style={{ fontFamily: SERIF, fontSize: '12px', color: '#9CA3AF' }}>
              Your wisdom for this chapter will appear here...
            </p>
          )}

          {chapterMemories.map(m => (
            <div key={m.id} className="mt-4 px-4 py-4 rounded-lg relative" style={{ background: '#F5F0E8', breakInside: 'avoid' }}>
              <p style={{ fontFamily: '"Caveat", cursive', fontSize: '15px', color: '#2D3748', lineHeight: 1.6 }}>
                <span className="text-[#C9A84C] mr-1">✦</span>
                {m.memory_text}
              </p>
              {m.contributor_name && (
                <p className="mt-2 text-[8px] uppercase tracking-[0.12em] text-muted-foreground/60" style={{ fontFamily: SERIF }}>
                  — {m.contributor_name}
                </p>
              )}
            </div>
          ))}

        </div>

        {showLeftPageFade && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: `calc(50% - ${PREVIEW_SPINE_HALF_WIDTH}px)`,
              height: `${PREVIEW_PAGE_CONTENT_HEIGHT}px`,
              pointerEvents: 'none',
              background: continuationFade,
              zIndex: 2,
            }}
          />
        )}

        <p className="absolute text-center" style={{ bottom: `${Math.max(4, Math.round((PREVIEW_PAGE_FOOTER_HEIGHT - 24) / 2))}px`, left: `${PREVIEW_PAGE_PADDING_OUTER}px`, height: '24px', lineHeight: '24px', fontFamily: SERIF, fontSize: '8px', color: GOLD, zIndex: 3 }}>{chapterLeftPageNum}</p>
        <p className="absolute text-center" style={{ bottom: `${Math.max(4, Math.round((PREVIEW_PAGE_FOOTER_HEIGHT - 24) / 2))}px`, right: `${PREVIEW_PAGE_PADDING_OUTER}px`, height: '24px', lineHeight: '24px', fontFamily: SERIF, fontSize: '8px', color: GOLD, zIndex: 3 }}>{chapterRightPageNum}</p>
      </div>
    );

    return [null, null, rightBg, false, fullSpread];
  };

  const renderAncestrySpread = (): [React.ReactNode, React.ReactNode, string | undefined] => {
    const useText = ancestryText.length > 0;
    const paragraphs = useText ? ancestryText.split(/\n\n+/).filter(Boolean) : [];

    const left = (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-hidden flex flex-col items-center justify-center text-center px-4">
          <p className="uppercase tracking-[0.25em] mb-2" style={{ fontFamily: SERIF, fontSize: '9px', color: '#9CA3AF' }}>
            A Final Page
          </p>
          <div className="w-8 mb-4" style={{ height: '1px', background: GOLD }} />
          <h2 className="font-bold" style={{ fontFamily: SERIF, fontSize: '22px', color: '#2D3748', lineHeight: 1.2 }}>
            Where You Come From
          </h2>
          <div className="w-8 mt-4" style={{ height: '1px', background: GOLD }} />
          <p className="italic mt-6 px-4" style={{ fontFamily: SERIF, fontSize: '11px', color: '#6B7280', lineHeight: 1.7 }}>
            The story of your family — where you come from, who came before you, and the thread that connects it all to you.
          </p>
        </div>
        <PageNum num={leftPageNum} />
      </div>
    );

    const right = (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto pr-1">
          {useText ? (
            paragraphs.map((para, i) => (
              <p key={i} style={{ fontFamily: SERIF, fontSize: '12px', color: '#2D3748', lineHeight: 1.8, marginBottom: '1em', textAlign: 'justify', textJustify: 'inter-word', hyphens: 'auto', WebkitHyphens: 'auto' }}>
                {renderWithLineBreaks(para)}
              </p>
            ))
          ) : ancestry?.pdf_url ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="italic mb-3" style={{ fontFamily: SERIF, fontSize: '12px', color: '#6B7280' }}>
                Family history attached as PDF
              </p>
              <p style={{ fontFamily: SERIF, fontSize: '11px', color: '#9CA3AF' }}>
                {ancestry.pdf_filename || 'Ancestry document'}
              </p>
              <p className="mt-4 text-xs italic" style={{ fontFamily: SERIF, color: '#B8B3A8' }}>
                (The attached PDF will be printed in the final book.)
              </p>
            </div>
          ) : null}
        </div>
        <PageNum num={rightPageNum} />
      </div>
    );

    return [left, right, undefined];
  };

  const renderEpigraphSpread = (): [React.ReactNode, React.ReactNode, string | undefined] => {
    const left = (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-10 mb-8" style={{ height: '1px', background: GOLD }} />
          <p
            className="italic"
            style={{
              fontFamily: SERIF,
              fontSize: '14px',
              color: '#2D3748',
              lineHeight: 1.9,
              maxWidth: '78%',
            }}
          >
            “Getting wisdom is the wisest thing you can do! And whatever else you do, develop good judgment.”
          </p>
          <p
            className="uppercase tracking-[0.2em] mt-8"
            style={{
              fontFamily: 'Source Sans 3, system-ui, sans-serif',
              fontSize: '9px',
              color: PINK,
            }}
          >
            — Proverbs 4:7 &nbsp;·&nbsp; New Living Translation
          </p>
          <div className="w-10 mt-8" style={{ height: '1px', background: GOLD }} />
        </div>
        <div style={{ height: '24px' }} className="mt-auto" />
      </div>
    );
    const right = (
      <div className="flex flex-col h-full">
        <div className="flex-1" />
      </div>
    );
    return [left, right, undefined];
  };

  const renderFamilyHistorySpread = (): [React.ReactNode, React.ReactNode, string | undefined] => {
    // Split paragraphs roughly in half across the two-page spread.
    const paragraphs = familyHistoryText.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
    const totalWords = paragraphs.reduce((sum, p) => sum + p.split(/\s+/).filter(Boolean).length, 0);
    const half = totalWords / 2;
    let running = 0;
    let splitIdx = paragraphs.length;
    for (let i = 0; i < paragraphs.length; i++) {
      running += paragraphs[i].split(/\s+/).filter(Boolean).length;
      if (running >= half) { splitIdx = i + 1; break; }
    }
    const leftParas = paragraphs.slice(0, splitIdx);
    const rightParas = paragraphs.slice(splitIdx);

    const paraStyle: React.CSSProperties = {
      fontFamily: SERIF,
      fontSize: '12px',
      color: '#2D3748',
      lineHeight: 1.8,
      marginBottom: '1em',
      textAlign: 'justify',
      textJustify: 'inter-word',
      hyphens: 'auto',
      WebkitHyphens: 'auto',
    };

    const left = (
      <div className="flex flex-col h-full">
        <p className="text-center uppercase tracking-[0.25em] mb-1" style={{ fontFamily: SERIF, fontSize: '9px', color: '#9CA3AF' }}>
          Our Family Story
        </p>
        <h2 className="text-center font-bold mb-2" style={{ fontFamily: SERIF, fontSize: '20px', color: '#2D3748' }}>
          Family History
        </h2>
        <div className="w-8 mx-auto mb-4" style={{ height: '1px', background: GOLD }} />
        <div className="flex-1 overflow-hidden pr-1">
          {leftParas.map((para, i) => (
            <p key={i} style={paraStyle}>{renderWithLineBreaks(para)}</p>
          ))}
        </div>
        <PageNum num={leftPageNum} />
      </div>
    );

    const right = (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-hidden pr-1">
          {rightParas.map((para, i) => (
            <p key={i} style={paraStyle}>{renderWithLineBreaks(para)}</p>
          ))}
        </div>
        <PageNum num={rightPageNum} />
      </div>
    );

    return [left, right, undefined];
  };

  const getCurrentSpreadContent = (): SpreadRender => {
    const spread = spreads[clampedSpread];
    if (!spread) return [null, null, undefined, false, null];
    if (spread.type === 'title') return [...renderTitleSpread(), false, null];
    if (spread.type === 'toc_letter') return [...renderTocLetterSpread(), false, null];
    if (spread.type === 'epigraph') return [...renderEpigraphSpread(), false, null];
    if (spread.type === 'ancestry') return [...renderAncestrySpread(), false, null];
    if (spread.type === 'family_history') return [...renderFamilyHistorySpread(), false, null];
    return renderChapterSpread(spread.chapter, clampedSpread);
  };

  const [leftContent, rightContent, rightPageBg, isFullBleedRight, fullSpread] = getCurrentSpreadContent();

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#EDEBE5' }}>
      {/* Book label — subtle persistent identifier (not part of printed book) */}
      {book.recipient_name && (
        <div
          className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-full max-w-[220px] truncate"
          title={`${book.recipient_name}'s Book`}
          style={{ background: 'rgba(0,0,0,0.05)', color: '#6B7280', fontFamily: SERIF, fontSize: '0.75rem', letterSpacing: '0.05em' }}
        >
          {book.recipient_name}'s Book
        </div>
      )}

      {/* Close button */}
      <button
        onClick={() => navigate(`/book/${bookId}`)}
        className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-opacity hover:opacity-70"
        style={{ background: 'rgba(0,0,0,0.05)', color: '#6B7280', fontFamily: SERIF, fontSize: '0.75rem', minWidth: '44px', minHeight: '44px' }}
      >
        <X className="h-3.5 w-3.5" />
        Close
      </button>

      {/* Two-page spread */}
      <div className="flex-1 overflow-hidden flex items-center justify-center py-2 px-4">
        <div
          className="flex relative"
          style={{
            width: `${PREVIEW_SPREAD_WIDTH}px`,
            minHeight: `${PREVIEW_SPREAD_HEIGHT}px`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
            borderRadius: '3px',
            overflow: 'visible',
            transform: `scale(${viewportScale})`,
            transformOrigin: 'center center',
          }}
        >
          {/* 52 Companion badge on chapter spreads */}
          {bookId && spreads[clampedSpread]?.type === 'chapter' && (() => {
            const ch = (spreads[clampedSpread] as { type: 'chapter'; chapter: Chapter }).chapter;
            return (
              <div className="absolute -top-5 -left-5 z-20">
                <CompanionBubble
                  bookId={bookId}
                  chapterId={ch.id}
                  chapterTitle={getChapterTitle(ch)}
                  currentContent={ch.content ?? ''}
                  currentReferenceText={ch.reference_text ?? ''}
                  onRequestEdit={() => navigate(`/book/${bookId}/chapter/${ch.id}`)}
                  variant="badge"
                />
              </div>
            );
          })()}

          <div className="flex w-full" style={{ borderRadius: '3px', overflow: 'hidden' }}>
            {fullSpread ? (
              fullSpread
            ) : (
              <>
                {/* Left page */}
                <div
                  style={{
                    flex: 1,
                    background: '#FFFFFF',
                    padding: `${PREVIEW_PAGE_PADDING_TOP}px ${PREVIEW_PAGE_PADDING_INNER}px ${PREVIEW_PAGE_FOOTER_HEIGHT}px ${PREVIEW_PAGE_PADDING_OUTER}px`,
                    height: `${PREVIEW_SPREAD_HEIGHT}px`,
                    overflow: 'hidden',
                  }}
                >
                  {leftContent}
                </div>

                {/* Spine */}
                <div style={{ width: `${PREVIEW_SPINE_WIDTH}px`, background: '#EDE5D4', borderLeft: `1px solid ${PINK}`, borderRight: `1px solid ${PINK}` }} />

                {/* Right page */}
                <div
                  style={{
                    flex: 1,
                    background: rightPageBg || '#FFFFFF',
                    padding: isFullBleedRight
                      ? '0'
                      : `${PREVIEW_PAGE_PADDING_TOP}px ${PREVIEW_PAGE_PADDING_OUTER}px ${PREVIEW_PAGE_FOOTER_HEIGHT}px ${PREVIEW_PAGE_PADDING_INNER}px`,
                    height: `${PREVIEW_SPREAD_HEIGHT}px`,
                    overflow: 'hidden',
                  }}
                >
                  {rightContent}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-8 py-4" style={{ background: '#EDEBE5' }}>
        <button
          onClick={() => setCurrentSpread(p => Math.max(0, p - 1))}
          disabled={clampedSpread === 0}
          className="flex items-center justify-center rounded-full border transition-opacity disabled:opacity-20"
          style={{ color: '#6B7280', width: '44px', height: '44px', background: '#fff', borderColor: '#D1CCC4' }}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="tabular-nums min-w-[140px] text-center" style={{ fontFamily: SERIF, fontSize: '11px', color: '#9CA3AF' }}>
          {clampedSpread === 0 ? `Cover – Page 1 of ${totalPages}` : `Page ${leftPageNum}–${rightPageNum} of ${totalPages}`}
        </span>
        <button
          onClick={() => setCurrentSpread(p => Math.min(totalSpreads - 1, p + 1))}
          disabled={clampedSpread === totalSpreads - 1}
          className="flex items-center justify-center rounded-full border transition-opacity disabled:opacity-20"
          style={{ color: '#6B7280', width: '44px', height: '44px', background: '#fff', borderColor: '#D1CCC4' }}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default PreviewBook;
