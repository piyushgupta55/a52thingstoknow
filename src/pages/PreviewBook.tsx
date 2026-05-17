import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { replaceTokens } from '@/lib/tokenReplacer';
import { X, ChevronLeft, ChevronRight, Camera } from 'lucide-react';
import CompanionBubble from '@/components/chapter/CompanionBubble';

interface Memory {
  id: string;
  chapter_id: string;
  contributor_name: string;
  memory_text: string;
}

interface Book {
  id: string;
  recipient_name: string;
  recipient_gender: string;
  relationship: string;
  occasion: string;
  user_id: string;
  from_label: string | null;
  author_label: string | null;
}

interface Chapter {
  id: string;
  chapter_number: number;
  title: string;
  status: string;
  content: string | null;
  reference_text: string | null;
  bible_verse_text: string | null;
  bible_verse_reference: string | null;
  quote_text: string | null;
  quote_attribution: string | null;
  photo_urls: string[];
  chapter_template: string;
  is_photo_chapter: boolean;
}

interface ChapterTemplate {
  chapter_number: number;
  title: string;
  is_photo_chapter: boolean;
  reference_content_male: string | null;
  reference_content_female: string | null;
}

const SERIF = 'Georgia, "Times New Roman", serif';
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
  const [loading, setLoading] = useState(true);
  const [currentSpread, setCurrentSpread] = useState(0);
  const [showLeftPageFade, setShowLeftPageFade] = useState(false);
  const flowContainerRef = useRef<HTMLDivElement | null>(null);

  type SpreadDef = { type: 'letter' } | { type: 'toc' } | { type: 'chapter'; chapter: Chapter } | { type: 'ancestry' };

  const visibleChapters = chapters
    .filter(c => c.chapter_number > 0 && (c.status === 'complete' || c.status === 'in_progress'))
    .sort((a, b) => a.chapter_number - b.chapter_number);

  const ancestryText = ancestry?.content?.trim() || '';
  const hasAncestry = ancestryText.length > 0 || !!ancestry?.pdf_url;

  const spreads: SpreadDef[] = [];
  spreads.push({ type: 'letter' });
  spreads.push({ type: 'toc' });
  visibleChapters.forEach(ch => spreads.push({ type: 'chapter', chapter: ch }));
  if (hasAncestry) spreads.push({ type: 'ancestry' });

  const totalSpreads = spreads.length;
  const clampedSpread = Math.min(currentSpread, totalSpreads - 1);
  const totalPages = totalSpreads * 2;
  const leftPageNum = clampedSpread * 2 + 1;
  const rightPageNum = leftPageNum + 1;

  useEffect(() => {
    if (!bookId) return;
    const load = async () => {
      const { data: bookData } = await supabase.from('books').select('*').eq('id', bookId).single();
      const tplGender = bookData?.recipient_gender === 'Girl/Young Woman' ? 'female' : 'male';
      const [{ data: chapData }, { data: tplData }, { data: memData }] = await Promise.all([
        supabase.from('chapters').select('*').eq('book_id', bookId).order('chapter_number'),
        supabase.from('chapter_templates').select('chapter_number, title, is_photo_chapter, reference_content_male, reference_content_female').eq('gender', tplGender),
        supabase.from('memories').select('id, chapter_id, contributor_name, memory_text').eq('book_id', bookId).eq('status', 'approved'),
      ]);
      setBook(bookData);
      setChapters(chapData || []);
      setTemplates(tplData || []);
      setMemories(memData || []);
      if (bookData) {
        const { data: profile } = await supabase.from('profiles').select('display_name').eq('user_id', bookData.user_id).single();
        setAuthorName(profile?.display_name || '');
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
    const isVerticalPhoto = activeSpread.chapter.chapter_template === 'photo_second' && hasPhoto;
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

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: '#EDEBE5' }}>
        <p style={{ fontFamily: SERIF, color: '#9CA3AF' }}>Loading preview…</p>
      </div>
    );
  }
  if (!book) return null;

  const letterChapter = chapters.find(c => c.chapter_number === 0);
  const letterRawText = letterChapter?.content?.trim() || letterChapter?.reference_text?.trim() || '';
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
    return raw ? replaceTokens(raw, tokenCtx) : null;
  };

  // Authoritative gender-specific chapter title from templates (falls back to stored chapter title)
  const getChapterTitle = (ch: { chapter_number: number; title: string }) => {
    if (ch.chapter_number === 0) return ch.title;
    const tpl = templates.find(t => t.chapter_number === ch.chapter_number);
    return tpl?.title || ch.title;
  };

  const PageNum = ({ num }: { num: number }) => (
    <p className="text-center mt-auto pt-4" style={{ fontFamily: SERIF, fontSize: '8px', color: GOLD }}>{num}</p>
  );

  const renderWithLineBreaks = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => (
      <span key={idx} style={{ display: 'block' }}>
        {line || '\u00A0'}
      </span>
    ));
  };

  const DropCapText = ({ text, color }: { text: string; color: string }) => (
    <>
      {text.split(/\n\n+/).filter(Boolean).map((para, i) => {
        const body = i === 0 ? para.slice(1) : para;
        return (
          <p key={i} data-body-paragraph="true" style={{ fontFamily: SERIF, fontSize: '12px', color: '#2D3748', lineHeight: 1.8, marginBottom: '0.9em' }}>
            {i === 0 && (
              <span className="float-left mr-2" style={{ fontFamily: SERIF, fontSize: '2.6em', lineHeight: 0.8, fontWeight: 700, color, marginTop: '3px' }}>
                {para.charAt(0)}
              </span>
            )}
            {renderWithLineBreaks(body)}
          </p>
        );
      })}
    </>
  );

  const renderLetterSpread = (): [React.ReactNode, React.ReactNode, string | undefined] => {
    const left = (
      <div className="flex flex-col h-full">
        <div className="flex-1" />
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
      const letterText = replaceTokens(
        letterRawText.replace(/\[AUTHOR_NAME\]/g, authorName || 'The Author'),
        tokenCtx
      );

      right = (
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto">
            <p className="mb-4 italic" style={{ fontFamily: SERIF, fontSize: '14px', color: '#2D3748', lineHeight: 1.8 }}>
              Dear {book.recipient_name},
            </p>
            {letterText.split(/\n\n+/).filter(Boolean).map((para, i) => (
              <p key={i} style={{ fontFamily: SERIF, fontSize: '12px', color: '#2D3748', lineHeight: 1.8, marginBottom: '1em' }}>
                {para}
              </p>
            ))}
            <p className="mt-5" style={{ fontFamily: SERIF, fontSize: '12px', color: '#2D3748' }}>With love,</p>
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

  const renderTocSpread = (): [React.ReactNode, React.ReactNode, string | undefined] => {
    const chapterPageMap = new Map<string, number>();
    visibleChapters.forEach((ch, i) => {
      chapterPageMap.set(ch.id, (2 + i) * 2 + 1);
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
              <span style={{ fontFamily: SERIF, fontSize: '10px', color: GOLD }}>2</span>
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
        </div>
        <PageNum num={leftPageNum} />
      </div>
    );

    const right = (
      <div className="flex flex-col h-full">
        <div className="flex-1" />
        <PageNum num={rightPageNum} />
      </div>
    );

    return [left, right, undefined];
  };

  const renderChapterSpread = (ch: Chapter, spreadIndex: number): [React.ReactNode, React.ReactNode, string | undefined, boolean, React.ReactNode | null] => {
    const rawText = ch.content?.trim() || ch.reference_text?.trim() || getTemplateRef(ch.chapter_number) || '';
    const fullText = replaceTokens(rawText, tokenCtx);
    const hasPhoto = ch.photo_urls && ch.photo_urls.length > 0;
    const hasAuthorWisdom = fullText.length > 0;
    const isComplete = ch.status === 'complete';
    const chapterLeftPageNum = spreadIndex * 2 + 1;
    const chapterRightPageNum = chapterLeftPageNum + 1;
    const isVerticalPhoto = ch.chapter_template === 'photo_second' && hasPhoto;
    const rightBg = isComplete ? '#FFFFFF' : '#FDF8F8';
    const chapterMemories = memories.filter(m => m.chapter_id === ch.id);
    const continuationFade = 'linear-gradient(to bottom, rgba(255,255,255,0) 98%, rgba(255,255,255,1) 100%)';

    if (isVerticalPhoto) {
      const left = (
        <div className="flex flex-col" style={{ height: '580px', padding: '48px 36px 0' }}>
          <div className="flex-1 relative" style={{ overflow: 'hidden', marginBottom: '0' }}>
            <p className="uppercase tracking-[0.2em] mb-2" style={{ fontFamily: SERIF, fontSize: '8px', color: '#9CA3AF' }}>
              Chapter {ch.chapter_number}
            </p>
            <h2 className="font-bold mb-4" style={{ fontFamily: SERIF, fontSize: '20px', color: '#2D3748', lineHeight: 1.2 }}>
              {getChapterTitle(ch)}
            </h2>
            {ch.bible_verse_text && (
              <div className="mb-3 pl-3 py-1" style={{ borderLeft: `2px solid ${GOLD}` }}>
                <p className="italic" style={{ fontFamily: SERIF, fontSize: '11px', color: 'rgba(45,55,72,0.7)', lineHeight: 1.7 }}>"{ch.bible_verse_text}"</p>
                {ch.bible_verse_reference && <p className="uppercase tracking-[0.12em] mt-1" style={{ fontFamily: SERIF, fontSize: '7px', color: '#9CA3AF' }}>— {ch.bible_verse_reference}</p>}
              </div>
            )}
            {ch.quote_text && (
              <div className="mb-3 pl-3 py-1" style={{ borderLeft: `2px solid ${PINK}` }}>
                <p className="italic" style={{ fontFamily: SERIF, fontSize: '11px', color: 'rgba(45,55,72,0.7)', lineHeight: 1.7 }}>"{ch.quote_text}"</p>
                {ch.quote_attribution && <p className="uppercase tracking-[0.12em] mt-1" style={{ fontFamily: SERIF, fontSize: '7px', color: '#9CA3AF' }}>— {ch.quote_attribution}</p>}
              </div>
            )}
            {fullText && <DropCapText text={fullText} color={GOLD} />}
          </div>
          <p className="text-center" style={{ height: '24px', fontFamily: SERIF, fontSize: '8px', color: GOLD, lineHeight: '24px' }}>{chapterLeftPageNum}</p>
        </div>
      );
      const right = (
        <div className="flex flex-col" style={{ height: '580px', padding: '48px 36px 0', background: rightBg }}>
          <div className="rounded overflow-hidden" style={{ height: '55%', flexShrink: 0 }}>
            <img src={ch.photo_urls[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
          </div>
          <div className="flex-1 mt-3" style={{ overflow: 'hidden' }}>
            {chapterMemories.length > 0 ? (
              chapterMemories.slice(0, 2).map(m => (
                <div key={m.id} className="mb-2 pl-3 py-1" style={{ borderLeft: `2px solid ${GOLD}`, background: '#F5F0E8', borderRadius: '2px', padding: '8px 10px 8px 12px' }}>
                  <p style={{ fontFamily: '"Caveat", cursive', fontSize: '13px', color: '#2D3748', lineHeight: 1.6 }}>"{m.memory_text}"</p>
                  <p className="mt-1" style={{ fontFamily: SERIF, fontSize: '8px', color: '#9CA3AF' }}>— {m.contributor_name}</p>
                </div>
              ))
            ) : !isComplete ? (
              <div className="flex items-center justify-center" style={{ border: '1px dashed #D1CCC4', borderRadius: '4px', height: '80px', marginTop: '8px' }}>
                <p className="italic text-center" style={{ fontFamily: SERIF, fontSize: '11px', color: '#B8B3A8' }}>A memory will appear here…</p>
              </div>
            ) : null}
          </div>
          <p className="text-center" style={{ height: '24px', fontFamily: SERIF, fontSize: '8px', color: GOLD, lineHeight: '24px' }}>{chapterRightPageNum}</p>
        </div>
      );
      return [left, right, rightBg, false, null];
    }

    const fullSpread = (
      <div style={{ position: 'relative', width: '100%', height: '580px' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 'calc(50% - 7px)', background: '#FFFFFF' }} />
        <div style={{ position: 'absolute', left: 'calc(50% - 7px)', top: 0, bottom: 0, width: '14px', background: '#EDE5D4', borderLeft: `1px solid ${PINK}`, borderRight: `1px solid ${PINK}`, zIndex: 2 }} />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 'calc(50% - 7px)', background: rightBg }} />

        <div
          ref={flowContainerRef}
          style={{
            position: 'relative',
            zIndex: 1,
            height: 'calc(100% - 24px)',
            padding: '48px 36px 0',
            columnCount: 2,
            columnGap: '86px',
            columnFill: 'auto',
            overflow: 'hidden',
          }}
        >
          {hasPhoto && (
            <div className="mb-3 rounded overflow-hidden" style={{ breakInside: 'avoid' }}>
              <img src={ch.photo_urls[0]} alt="" className="w-full" style={{ height: '180px', objectFit: 'cover', objectPosition: 'center top' }} />
            </div>
          )}

          <div style={{ breakInside: 'avoid' }}>
            <p className="uppercase tracking-[0.2em] mb-2" style={{ fontFamily: SERIF, fontSize: '8px', color: '#9CA3AF' }}>
              Chapter {ch.chapter_number}
            </p>
            <h2 className="font-bold mb-4" style={{ fontFamily: SERIF, fontSize: '20px', color: '#2D3748', lineHeight: 1.2 }}>
              {getChapterTitle(ch)}
            </h2>
          </div>

          {ch.bible_verse_text && (
            <div className="mb-3 pl-3 py-1" style={{ borderLeft: `2px solid ${GOLD}`, breakInside: 'avoid' }}>
              <p className="italic" style={{ fontFamily: SERIF, fontSize: '11px', color: 'rgba(45,55,72,0.7)', lineHeight: 1.7 }}>"{ch.bible_verse_text}"</p>
              {ch.bible_verse_reference && <p className="uppercase tracking-[0.12em] mt-1" style={{ fontFamily: SERIF, fontSize: '7px', color: '#9CA3AF' }}>— {ch.bible_verse_reference}</p>}
            </div>
          )}

          {ch.quote_text && (
            <div className="mb-3 pl-3 py-1" style={{ borderLeft: `2px solid ${PINK}`, breakInside: 'avoid' }}>
              <p className="italic" style={{ fontFamily: SERIF, fontSize: '11px', color: 'rgba(45,55,72,0.7)', lineHeight: 1.7 }}>"{ch.quote_text}"</p>
              {ch.quote_attribution && <p className="uppercase tracking-[0.12em] mt-1" style={{ fontFamily: SERIF, fontSize: '7px', color: '#9CA3AF' }}>— {ch.quote_attribution}</p>}
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
            <div key={m.id} className="mt-3 pl-3 py-1" style={{ borderLeft: `2px solid ${GOLD}`, background: '#F5F0E8', borderRadius: '2px', padding: '8px 10px 8px 12px', breakInside: 'avoid' }}>
              <p style={{ fontFamily: '"Caveat", cursive', fontSize: '13px', color: '#2D3748', lineHeight: 1.6 }}>"{m.memory_text}"</p>
              <p className="mt-1" style={{ fontFamily: SERIF, fontSize: '8px', color: '#9CA3AF' }}>— {m.contributor_name}</p>
            </div>
          ))}

          {!isComplete && chapterMemories.length === 0 && (
            <div className="mt-3" style={{ breakInside: 'avoid', border: '1px dashed #D1CCC4', borderRadius: '4px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p className="italic text-center" style={{ fontFamily: SERIF, fontSize: '11px', color: '#B8B3A8' }}>A memory will appear here…</p>
            </div>
          )}
        </div>

        {showLeftPageFade && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: 'calc(50% - 7px)',
              height: 'calc(100% - 24px)',
              pointerEvents: 'none',
              background: continuationFade,
              zIndex: 2,
            }}
          />
        )}

        <p className="absolute text-center" style={{ bottom: '4px', left: '36px', height: '24px', lineHeight: '24px', fontFamily: SERIF, fontSize: '8px', color: GOLD, zIndex: 3 }}>{chapterLeftPageNum}</p>
        <p className="absolute text-center" style={{ bottom: '4px', right: '36px', height: '24px', lineHeight: '24px', fontFamily: SERIF, fontSize: '8px', color: GOLD, zIndex: 3 }}>{chapterRightPageNum}</p>
      </div>
    );

    return [null, null, rightBg, false, fullSpread];
  };

  const getCurrentSpreadContent = (): [React.ReactNode, React.ReactNode, string | undefined, boolean, React.ReactNode | null] => {
    const spread = spreads[clampedSpread];
    if (!spread) return [null, null, undefined, false, null];
    if (spread.type === 'letter') return [...renderLetterSpread(), false, null] as [React.ReactNode, React.ReactNode, string | undefined, boolean, React.ReactNode | null];
    if (spread.type === 'toc') return [...renderTocSpread(), false, null] as [React.ReactNode, React.ReactNode, string | undefined, boolean, React.ReactNode | null];
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
      <div className="flex-1 overflow-y-auto flex items-center justify-center py-6 px-4">
        <div
          className="flex relative"
          style={{
            width: '920px',
            maxWidth: '100%',
            minHeight: '580px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
            borderRadius: '3px',
            overflow: 'visible',
          }}
        >
          {/* 52 Companion badge on chapter spreads */}
          {bookId && spreads[clampedSpread]?.type === 'chapter' && (() => {
            const ch = (spreads[clampedSpread] as { type: 'chapter'; chapter: Chapter }).chapter;
            return (
              <CompanionBubble
                bookId={bookId}
                chapterId={ch.id}
                chapterTitle={getChapterTitle(ch)}
                currentContent={ch.content ?? ''}
                currentReferenceText={ch.reference_text ?? ''}
                onRequestEdit={() => navigate(`/book/${bookId}/chapter/${ch.id}`)}
                variant="badge"
              />
            );
          })()}

          <div className="flex w-full" style={{ borderRadius: '3px', overflow: 'hidden' }}>
            {fullSpread ? (
              fullSpread
            ) : (
              <>
                {/* Left page */}
                <div style={{ flex: 1, background: '#FFFFFF', padding: '48px 36px 28px', height: '580px', overflow: 'hidden' }}>
                  {leftContent}
                </div>

                {/* Spine */}
                <div style={{ width: '14px', background: '#EDE5D4', borderLeft: `1px solid ${PINK}`, borderRight: `1px solid ${PINK}` }} />

                {/* Right page */}
                <div style={{ flex: 1, background: rightPageBg || '#FFFFFF', padding: isFullBleedRight ? '0' : '48px 36px 28px', height: '580px', overflow: 'hidden' }}>
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
          Page {leftPageNum}–{rightPageNum} of {totalPages}
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
