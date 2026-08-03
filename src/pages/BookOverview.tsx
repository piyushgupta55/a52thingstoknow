import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { replaceTokens } from '@/lib/tokenReplacer';
import { toBookGender } from '@/lib/genderMap';
import { stripReviewWrappers } from '@/lib/reviewTags';
import { fetchMemoryInviteChapters } from '@/lib/memoryChapters';
import { PREVIEW_PAGE_WIDTH } from '@/features/preview/geometry';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ArrowLeft, Camera, Check, ChevronLeft, ChevronRight, LayoutList, MessageCircleHeart, PenLine, Plus, X } from 'lucide-react';

const SERIF = "'Lora', 'Georgia', 'Times New Roman', serif";
const GOLD = '#BBA96A';
const PINK = '#C4788A';
const CREAM = '#EDEBE5';

interface Book {
  id: string;
  recipient_name: string;
  recipient_gender: string;
  relationship: string;
  occasion: string;
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
  photo_urls: string[] | null;
  is_photo_chapter: boolean;
  review_status: string | null;
  review_note: string | null;
  read_at: string | null;
}


interface Template {
  chapter_number: number;
  title: string;
  is_photo_chapter: boolean;
  reference_content: string | null;
}

interface MemoryRow {
  id: string;
  chapter_id: string | null;
  contributor_name: string;
  memory_text: string;
}

const toPlainText = (raw: string) =>
  stripReviewWrappers(raw || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<\/?p[^>]*>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/\n\n+/g, '\n\n')
    .trim();

const BookOverview = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [memoryChapters, setMemoryChapters] = useState<number[]>([]);
  const [authorName, setAuthorName] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const readingRef = useRef<Set<string>>(new Set());


  useEffect(() => {
    if (!bookId) return;
    const load = async () => {
      const { data: bookData } = await supabase.from('books').select('*').eq('id', bookId).single();
      if (bookData?.recipient_name) {
        bookData.recipient_name = bookData.recipient_name
          .trim()
          .split(/\s+/)
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
      }
      const tplGender = toBookGender(bookData?.recipient_gender);
      const [{ data: chapData }, { data: tplData }, { data: memData }, inviteChapters] = await Promise.all([
        supabase.from('chapters').select('*').eq('book_id', bookId).order('chapter_number'),
        supabase
          .from('chapter_templates')
          .select('chapter_number, title, is_photo_chapter, reference_content')
          .eq('gender', tplGender),
        supabase
          .from('memories')
          .select('id, chapter_id, contributor_name, memory_text')
          .eq('book_id', bookId)
          .or('entry_type.is.null,entry_type.eq.memory'),
        fetchMemoryInviteChapters(),
      ]);
      setBook(bookData);
      setChapters((chapData || []) as Chapter[]);
      setTemplates((tplData || []) as Template[]);
      setMemories((memData || []) as MemoryRow[]);
      setMemoryChapters(inviteChapters);
      if (bookData?.user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', bookData.user_id)
          .maybeSingle();
        setAuthorName(bookData.from_label || profile?.display_name || 'The Author');
      }
      setLoading(false);
    };
    load();
  }, [bookId]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const bodyChapters = useMemo(
    () => chapters.filter(c => c.chapter_number > 0).sort((a, b) => a.chapter_number - b.chapter_number),
    [chapters],
  );

  const tokenCtx = {
    recipientName: book?.recipient_name || 'your child',
    recipientGender: book?.recipient_gender || '',
    authorLabel: book?.author_label || null,
  };

  const bodyFor = (ch: Chapter) => {
    const own = (ch.content || '').trim() || (ch.reference_text || '').trim();
    if (own) return toPlainText(replaceTokens(own, tokenCtx));
    const tpl = templates.find(t => t.chapter_number === ch.chapter_number);
    if (tpl?.reference_content) return toPlainText(replaceTokens(tpl.reference_content, tokenCtx));
    return '';
  };

  const isPhotoChapter = (ch: Chapter) =>
    ch.is_photo_chapter || !!templates.find(t => t.chapter_number === ch.chapter_number)?.is_photo_chapter;

  const editorUrl = (ch: Chapter, extra = '') => {
    const back = encodeURIComponent(`/book/${bookId}/overview`);
    return `/book/${bookId}/chapter/${ch.id}?returnTo=${back}&returnLabel=${encodeURIComponent('Back to the book')}${extra}`;
  };

  const goToPage = (idx: number) => {
    const clamped = Math.max(0, Math.min(bodyChapters.length - 1, idx));
    setActiveIndex(clamped);
    pageRefs.current[clamped]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const letterChapter = useMemo(() => chapters.find(c => c.chapter_number === 0) || null, [chapters]);
  const readCount = bodyChapters.filter(c => !!c.read_at).length;

  // Reading is tracked separately from completion — it never blocks printing.
  const markRead = useCallback(async (chapterId: string) => {
    if (readingRef.current.has(chapterId)) return;
    readingRef.current.add(chapterId);
    const stamp = new Date().toISOString();
    setChapters(prev => prev.map(c => (c.id === chapterId ? { ...c, read_at: c.read_at || stamp } : c)));
    await supabase.from('chapters').update({ read_at: stamp }).eq('id', chapterId).is('read_at', null);
  }, []);

  const setReview = async (ch: Chapter, status: string | null, note: string | null = null) => {
    setSavingId(ch.id);
    const { error } = await supabase
      .from('chapters')
      .update({ review_status: status, review_note: note })
      .eq('id', ch.id);
    setSavingId(null);
    if (error) {
      toast.error('Could not save that just now');
      return false;
    }
    setChapters(prev => prev.map(c => (c.id === ch.id ? { ...c, review_status: status, review_note: note } : c)));
    return true;
  };

  // Track which page is in view for the "Chapter X of 52" indicator, and mark it read.
  useEffect(() => {
    if (loading) return;
    const timers = new Map<string, number>();
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          const idx = Number((visible.target as HTMLElement).dataset.index);
          if (Number.isFinite(idx)) setActiveIndex(idx);
        }
        entries.forEach(e => {
          const el = e.target as HTMLElement;
          const id = el.dataset.chapterId;
          if (!id) return;
          if (e.isIntersecting && e.intersectionRatio >= 0.5) {
            if (!timers.has(id)) {
              timers.set(id, window.setTimeout(() => markRead(id), 1500));
            }
          } else {
            const t = timers.get(id);
            if (t) { window.clearTimeout(t); timers.delete(id); }
          }
        });
      },
      { threshold: [0.25, 0.5] },
    );
    pageRefs.current.forEach(el => el && observer.observe(el));
    return () => {
      timers.forEach(t => window.clearTimeout(t));
      observer.disconnect();
    };
  }, [loading, bodyChapters.length, markRead]);


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: CREAM }}>
        <p style={{ fontFamily: SERIF, color: '#6B7280' }}>Opening your book…</p>
      </div>
    );
  }
  if (!book) return null;

  const name = book.recipient_name || 'your child';

  const Cue = ({
    tone,
    icon,
    label,
    detail,
    onClick,
  }: {
    tone: 'gold' | 'pink' | 'sage';
    icon: React.ReactNode;
    label: string;
    detail?: string;
    onClick: () => void;
  }) => {
    const colors = {
      gold: { border: GOLD, bg: 'rgba(187,169,106,0.10)', text: '#7a6a34' },
      pink: { border: PINK, bg: 'rgba(196,120,138,0.10)', text: '#8f4d5c' },
      sage: { border: '#8AA79B', bg: 'rgba(138,167,155,0.12)', text: '#4d6a5e' },
    }[tone];
    return (
      <button
        onClick={onClick}
        className="w-full text-left rounded-md px-4 py-3 mt-4 transition-shadow hover:shadow-sm"
        style={{ border: `1px dashed ${colors.border}`, background: colors.bg }}
      >
        <span className="flex items-start gap-2.5">
          <span style={{ color: colors.text }} className="mt-0.5">{icon}</span>
          <span>
            <span className="block text-[13px] font-medium" style={{ fontFamily: SERIF, color: colors.text }}>
              {label}
            </span>
            {detail && (
              <span className="block text-[12px] mt-0.5 italic" style={{ fontFamily: SERIF, color: colors.text, opacity: 0.85 }}>
                {detail}
              </span>
            )}
          </span>
        </span>
      </button>
    );
  };

  return (
    <div className="min-h-screen" style={{ background: CREAM }}>
      <Navbar />

      {/* Sticky book bar */}
      <div
        className="sticky top-0 z-30 border-b"
        style={{ background: 'rgba(237,235,229,0.94)', backdropFilter: 'blur(6px)', borderColor: '#DAD5CB' }}
      >
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/book/${bookId}`)} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Button>
          <div className="flex-1 text-center">
            <p className="text-[13px]" style={{ fontFamily: SERIF, color: '#4A5568' }}>
              {name}'s Gift · Chapter {bodyChapters[activeIndex]?.chapter_number ?? 1} of {bodyChapters.length}
            </p>
            <div className="mt-1 flex items-center justify-center gap-2">
              <div className="h-1.5 w-28 rounded-full overflow-hidden" style={{ background: 'rgba(187,169,106,0.25)' }}>
                <div
                  className="h-full transition-all duration-500"
                  style={{ width: `${bodyChapters.length ? (readCount / bodyChapters.length) * 100 : 0}%`, background: GOLD }}
                />
              </div>
              <span className="text-[11px]" style={{ fontFamily: SERIF, color: '#8a8378' }}>
                {readCount} of {bodyChapters.length} read
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => goToPage(activeIndex - 1)}
              disabled={activeIndex === 0}
              className="rounded-full border p-1.5 disabled:opacity-25"
              style={{ borderColor: '#D1CCC4', background: '#fff' }}
              aria-label="Previous chapter"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => goToPage(activeIndex + 1)}
              disabled={activeIndex >= bodyChapters.length - 1}
              className="rounded-full border p-1.5 disabled:opacity-25"
              style={{ borderColor: '#D1CCC4', background: '#fff' }}
              aria-label="Next chapter"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <Button variant="outline" size="sm" className="ml-2 gap-1.5" onClick={() => navigate(`/book/${bookId}?view=lists`)}>
              <LayoutList className="h-4 w-4" /> List view
            </Button>
          </div>
        </div>
      </div>

      <div className="py-8 px-4 flex flex-col items-center gap-8">
        {/* Title page */}
        <div
          className="bg-white shadow-md rounded-sm w-full"
          style={{ maxWidth: `${PREVIEW_PAGE_WIDTH}px`, padding: '3.5rem 2.5rem' }}
        >
          <div className="text-center py-10" style={{ border: `2px solid ${GOLD}`, borderRadius: '2px' }}>
            <p className="uppercase tracking-[0.25em] mb-3" style={{ fontFamily: SERIF, fontSize: '9px', color: '#9CA3AF' }}>
              A Book of Wisdom
            </p>
            <h1 className="font-bold mb-2 uppercase tracking-[0.1em]" style={{ fontFamily: SERIF, fontSize: '26px', color: '#2D3748' }}>
              52 Things to Know
            </h1>
            <p style={{ fontFamily: SERIF, fontSize: '13px', color: '#6B7280' }}>For {name}</p>
            <div className="w-10 h-px mx-auto my-5" style={{ background: GOLD }} />
            <p className="italic" style={{ fontFamily: SERIF, fontSize: '13px', color: '#4A5568' }}>
              By {authorName || 'The Author'}
            </p>
          </div>
          <p className="text-center mt-6 text-[12px] italic" style={{ fontFamily: SERIF, color: '#8a8378' }}>
            Your book is written and ready. Read it through — the gentle notes are simply invitations to make it even more yours.
          </p>
        </div>

        {/* Chapter pages */}
        {bodyChapters.map((ch, idx) => {
          const body = bodyFor(ch);
          const photo = (ch.photo_urls || []).filter(Boolean)[0];
          const photoSpot = isPhotoChapter(ch) && !photo;
          const isRewrite = ch.review_status === 'rewrite';
          const isAdd = ch.review_status === 'add';
          const chapterMemories = memories.filter(m => m.chapter_id === ch.id);
          const memoryInvite = memoryChapters.includes(ch.chapter_number) && chapterMemories.length === 0;

          return (
            <div
              key={ch.id}
              id={`ch-${ch.chapter_number}`}
              data-index={idx}
              ref={el => (pageRefs.current[idx] = el)}
              className="bg-white shadow-md rounded-sm w-full scroll-mt-20"
              style={{ maxWidth: `${PREVIEW_PAGE_WIDTH}px`, padding: '2.75rem 2.25rem 2rem' }}
            >
              <p className="text-center uppercase tracking-[0.25em] mb-1" style={{ fontFamily: SERIF, fontSize: '8px', color: '#A9A296' }}>
                Chapter {ch.chapter_number}
              </p>
              <h2 className="text-center font-bold mb-4" style={{ fontFamily: SERIF, fontSize: '19px', color: '#2D3748' }}>
                {ch.title}
              </h2>
              <div className="flex items-center justify-center gap-3 mb-6">
                <span style={{ height: '1px', width: '60px', background: GOLD }} />
                <span style={{ color: GOLD, fontSize: '8px' }}>✦</span>
                <span style={{ height: '1px', width: '60px', background: GOLD }} />
              </div>

              {ch.bible_verse_text && (
                <div className="mb-5 text-center px-4">
                  <p className="italic" style={{ fontFamily: SERIF, fontSize: '11.5pt', color: '#4A5568', lineHeight: 1.6 }}>
                    “{ch.bible_verse_text}”
                  </p>
                  {ch.bible_verse_reference && (
                    <p className="mt-1" style={{ fontFamily: SERIF, fontSize: '9pt', color: GOLD }}>
                      — {ch.bible_verse_reference}
                    </p>
                  )}
                </div>
              )}

              {ch.quote_text && (
                <div className="mb-6 text-center px-6">
                  <p style={{ fontFamily: SERIF, fontSize: '10.5pt', color: '#5A6472', lineHeight: 1.6 }}>“{ch.quote_text}”</p>
                  {ch.quote_attribution && (
                    <p className="mt-1" style={{ fontFamily: SERIF, fontSize: '9pt', color: '#9CA3AF' }}>
                      {ch.quote_attribution}
                    </p>
                  )}
                </div>
              )}

              {photo && (
                <img
                  src={photo}
                  alt={`A photo for ${ch.title}`}
                  className="w-full rounded-sm mb-6"
                  style={{ objectFit: 'cover', maxHeight: '260px' }}
                  loading="lazy"
                />
              )}

              {/*
                AUTHOR-VIEW ONLY: the strikethrough below is a working cue for chapters the
                author flagged "rewrite". It lives only in this component and is never part
                of the PDF/print payload — if a rewrite never happens, the original prints
                normally.
              */}
              <div style={isRewrite ? { textDecoration: 'line-through', textDecorationColor: PINK, opacity: 0.65 } : undefined}>
                {body
                  ? body.split(/\n\n+/).map((para, i) => (
                      <p
                        key={i}
                        style={{
                          fontFamily: SERIF,
                          fontSize: '11pt',
                          color: '#263445',
                          lineHeight: 1.7,
                          marginBottom: '0.85em',
                          textAlign: 'justify',
                        }}
                      >
                        {para}
                      </p>
                    ))
                  : (
                    <p className="italic" style={{ fontFamily: SERIF, fontSize: '11pt', color: '#9CA3AF' }}>
                      This chapter is waiting for your words.
                    </p>
                  )}
              </div>

              {chapterMemories.map(m => (
                <div key={m.id} className="mt-4 rounded-md px-4 py-3" style={{ background: '#F5F0E8' }}>
                  <p style={{ fontFamily: SERIF, fontSize: '10.5pt', color: '#4A5568', lineHeight: 1.6 }}>{m.memory_text}</p>
                  <p className="mt-1 italic" style={{ fontFamily: SERIF, fontSize: '9pt', color: GOLD }}>— {m.contributor_name}</p>
                </div>
              ))}

              {/* Gentle, optional cues */}
              {photoSpot && (
                <button
                  onClick={() => navigate(editorUrl(ch, '&focus=photo'))}
                  className="w-full mt-5 rounded-md flex flex-col items-center justify-center gap-2 transition-colors hover:bg-[rgba(187,169,106,0.06)]"
                  style={{ border: `1px dashed ${GOLD}`, height: '150px' }}
                >
                  <Camera className="h-5 w-5" style={{ color: GOLD }} />
                  <span className="text-[13px]" style={{ fontFamily: SERIF, color: '#7a6a34' }}>
                    Add a photo of {name} here.
                  </span>
                  <span className="text-[11px] italic" style={{ fontFamily: SERIF, color: '#a49c8c' }}>
                    Optional — the chapter is complete either way.
                  </span>
                </button>
              )}

              {isRewrite && (
                <Cue
                  tone="pink"
                  icon={<PenLine className="h-4 w-4" />}
                  label="You marked this one to rewrite — replace it with your own words."
                  detail="Only you see the strikethrough. If you leave it, the original prints as written."
                  onClick={() => navigate(editorUrl(ch))}
                />
              )}

              {isAdd && (
                <Cue
                  tone="gold"
                  icon={<Plus className="h-4 w-4" />}
                  label={ch.review_note ? `You wanted to add: ${ch.review_note}` : 'You wanted to add something to this one.'}
                  detail="Tap to open the chapter and add it whenever you like."
                  onClick={() => navigate(editorUrl(ch))}
                />
              )}

              {memoryInvite && (
                <Cue
                  tone="sage"
                  icon={<MessageCircleHeart className="h-4 w-4" />}
                  label={`This would be a beautiful place for a memory of ${name}.`}
                  detail="An invitation, never a requirement."
                  onClick={() => navigate(editorUrl(ch, '&memory=1'))}
                />
              )}
            </div>
          );
        })}

        <p className="text-center text-[12px] italic pb-10" style={{ fontFamily: SERIF, color: '#8a8378' }}>
          The end — {name}'s book is ready whenever you are.
        </p>
      </div>
    </div>
  );
};

export default BookOverview;
