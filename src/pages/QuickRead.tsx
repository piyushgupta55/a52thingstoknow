import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { replaceTokens } from '@/lib/tokenReplacer';
import { Button } from '@/components/ui/button';
import { Heart, Plus, PenLine, X, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';

const SERIF = "'Lora', 'Georgia', 'Times New Roman', serif";
const CREAM = '#F5F0E8';
const GOLD = '#BBA96A';
const PINK = '#C4788A';

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
  is_photo_chapter: boolean;
  chapter_template: string;
  review_status: string | null;
}

interface Memory {
  id: string;
  chapter_id: string | null;
  contributor_name: string;
  memory_text: string;
}

interface Book {
  id: string;
  recipient_name: string;
  recipient_gender: string;
  from_label: string | null;
  user_id: string;
}

const SHORT_CHAPTER_WORD_THRESHOLD = 180;

const QuickRead = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [authorLabel, setAuthorLabel] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bookId) return;
    (async () => {
      const { data: bookData } = await supabase.from('books').select('*').eq('id', bookId).single();
      const [{ data: chapData }, { data: memData }] = await Promise.all([
        supabase.from('chapters').select('*').eq('book_id', bookId).gt('chapter_number', 0).order('chapter_number'),
        supabase.from('memories').select('id, chapter_id, contributor_name, memory_text').eq('book_id', bookId),
      ]);
      if (bookData?.recipient_name) {
        bookData.recipient_name = bookData.recipient_name.trim().split(/\s+/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
      setBook(bookData);
      setAuthorLabel(bookData?.from_label || null);
      setChapters((chapData as Chapter[]) || []);
      setMemories((memData as Memory[]) || []);
      setLoading(false);
    })();
  }, [bookId]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [index]);

  const ctx = useMemo(() => ({
    recipientName: book?.recipient_name || '',
    recipientGender: book?.recipient_gender || '',
    authorLabel,
  }), [book, authorLabel]);

  const total = chapters.length;
  const chapter = chapters[index];

  const tk = (t: string | null | undefined) => replaceTokens(t || '', ctx);

  const chapterMemories = chapter ? memories.filter(m => m.chapter_id === chapter.id) : [];

  const wordCount = useMemo(() => {
    if (!chapter) return 0;
    const text = `${chapter.reference_text || ''} ${chapter.content || ''}`.trim();
    return text ? text.split(/\s+/).length : 0;
  }, [chapter]);

  const isShort = chapter
    ? wordCount < SHORT_CHAPTER_WORD_THRESHOLD
      && (!chapter.photo_urls || chapter.photo_urls.length === 0)
      && chapterMemories.length === 0
    : false;

  const advance = () => {
    if (index + 1 >= total) {
      toast.success("All done — beautiful work.");
      navigate(`/book/${bookId}`);
    } else {
      setIndex(i => i + 1);
    }
  };

  const handleChoice = async (choice: 'keep' | 'add' | 'rewrite') => {
    if (!chapter || saving) return;
    setSaving(true);
    const { error } = await supabase
      .from('chapters')
      .update({ review_status: choice })
      .eq('id', chapter.id);
    setSaving(false);
    if (error) {
      toast.error("Couldn't save — try again.");
      return;
    }
    // Optimistically update local state
    setChapters(prev => prev.map(c => c.id === chapter.id ? { ...c, review_status: choice } : c));
    advance();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: CREAM, fontFamily: SERIF }}>
        <p className="text-muted-foreground">Loading your book…</p>
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: CREAM, fontFamily: SERIF }}>
        <p>No chapters to read yet.</p>
        <Button onClick={() => navigate(`/book/${bookId}`)}>Back to dashboard</Button>
      </div>
    );
  }

  const bodyText = `${chapter.reference_text || ''}${chapter.reference_text && chapter.content ? ' ' : ''}${chapter.content || ''}`.trim();
  const paragraphs = bodyText.split(/\n\n+/).filter(Boolean);

  const progressPct = Math.round(((index) / total) * 100);

  return (
    <div className="min-h-screen" style={{ background: CREAM, fontFamily: SERIF }}>
      {/* Header bar */}
      <div className="sticky top-0 z-10 backdrop-blur-sm border-b" style={{ background: 'rgba(245,240,232,0.92)', borderColor: 'rgba(187,169,106,0.3)' }}>
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <button
            onClick={() => navigate(`/book/${bookId}`)}
            className="flex items-center gap-1 text-sm hover:opacity-70 transition-opacity"
            style={{ color: '#5a4632' }}
          >
            <ChevronLeft className="h-4 w-4" /> Exit Quick Read
          </button>
          <div className="text-sm" style={{ color: '#5a4632' }}>
            Chapter <span className="font-semibold">{index + 1}</span> of {total} — going great
          </div>
          <button
            onClick={() => navigate(`/book/${bookId}`)}
            aria-label="Close"
            className="hover:opacity-70 transition-opacity"
            style={{ color: '#5a4632' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="h-1 w-full" style={{ background: 'rgba(187,169,106,0.15)' }}>
          <div className="h-full transition-all duration-500" style={{ width: `${progressPct}%`, background: GOLD }} />
        </div>
      </div>

      {/* Chapter content */}
      <div className="max-w-3xl mx-auto px-6 md:px-10 py-12 md:py-16">
        <div className="text-center mb-10">
          <p className="uppercase tracking-[0.3em] text-xs mb-3" style={{ color: GOLD }}>
            Chapter {chapter.chapter_number}
          </p>
          <h1 className="font-bold text-3xl md:text-4xl leading-tight" style={{ color: '#2a1f1a' }}>
            {tk(chapter.title)}
          </h1>
          <div className="mx-auto mt-6 h-px w-16" style={{ background: GOLD }} />
        </div>

        {chapter.bible_verse_text && (
          <blockquote className="text-center italic text-lg md:text-xl mb-8 px-4" style={{ color: '#5a4632' }}>
            <p className="leading-relaxed">"{tk(chapter.bible_verse_text)}"</p>
            {chapter.bible_verse_reference && (
              <footer className="not-italic text-sm mt-2" style={{ color: GOLD }}>
                — {tk(chapter.bible_verse_reference)}
              </footer>
            )}
          </blockquote>
        )}

        {chapter.quote_text && (
          <blockquote className="text-center italic text-lg md:text-xl mb-8 px-4" style={{ color: '#5a4632' }}>
            <p className="leading-relaxed">"{tk(chapter.quote_text)}"</p>
            {chapter.quote_attribution && (
              <footer className="not-italic text-sm mt-2" style={{ color: GOLD }}>
                — {tk(chapter.quote_attribution)}
              </footer>
            )}
          </blockquote>
        )}

        {chapter.photo_urls && chapter.photo_urls.length > 0 && (
          <div className="my-8 flex justify-center">
            <img
              src={chapter.photo_urls[0]}
              alt={chapter.title}
              className="max-h-[420px] rounded shadow-md"
            />
          </div>
        )}

        <div className="prose prose-lg max-w-none" style={{ color: '#2a1f1a' }}>
          {paragraphs.length === 0 ? (
            <p className="italic text-center" style={{ color: '#8a7560' }}>
              This chapter is waiting for your words.
            </p>
          ) : (
            paragraphs.map((p, i) => (
              <p key={i} className="text-lg leading-[1.85] mb-5 indent-8" style={{ fontFamily: SERIF }}>
                {tk(p)}
              </p>
            ))
          )}
        </div>

        {chapterMemories.length > 0 && (
          <div className="mt-12 space-y-6">
            {chapterMemories.map(m => (
              <div key={m.id} className="border-l-4 pl-5 py-2" style={{ borderColor: PINK }}>
                <p className="text-base leading-relaxed italic" style={{ color: '#5a4632' }}>
                  "{m.memory_text}"
                </p>
                <p className="text-sm mt-2" style={{ color: PINK, fontFamily: "'Caveat', cursive" }}>
                  — {m.contributor_name}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Decorative end mark */}
        <div className="text-center my-12">
          <span className="text-2xl" style={{ color: GOLD }}>❦</span>
        </div>

        {/* Review buttons */}
        <div className="space-y-3 pb-12">
          <p className="text-center text-sm mb-4" style={{ color: '#8a7560' }}>
            How do you feel about this chapter?
          </p>
          <Button
            onClick={() => handleChoice('keep')}
            disabled={saving}
            className="w-full h-16 text-base md:text-lg justify-start gap-4 shadow-sm hover:shadow-md transition-all"
            style={{ background: GOLD, color: '#fff' }}
          >
            <Heart className="h-5 w-5" />
            <div className="text-left">
              <div className="font-semibold">Keep this one</div>
              <div className="text-xs opacity-90 font-normal">It reads beautifully as-is</div>
            </div>
          </Button>
          <Button
            onClick={() => handleChoice('add')}
            disabled={saving}
            variant="outline"
            className="w-full h-16 text-base md:text-lg justify-start gap-4 border-2 hover:bg-white"
            style={{ borderColor: GOLD, color: '#2a1f1a', background: 'transparent' }}
          >
            <Plus className="h-5 w-5" style={{ color: GOLD }} />
            <div className="text-left">
              <div className="font-semibold">Add to it</div>
              <div className="text-xs opacity-70 font-normal">Love it — I'll add my own words later</div>
            </div>
          </Button>
          <Button
            onClick={() => handleChoice('rewrite')}
            disabled={saving}
            variant="outline"
            className="w-full h-16 text-base md:text-lg justify-start gap-4 border-2 hover:bg-white"
            style={{ borderColor: PINK, color: '#2a1f1a', background: 'transparent' }}
          >
            <PenLine className="h-5 w-5" style={{ color: PINK }} />
            <div className="text-left">
              <div className="font-semibold">Rewrite this</div>
              <div className="text-xs opacity-70 font-normal">I'd like to write my own version later</div>
            </div>
          </Button>

          {isShort && (
            <p className="text-center text-xs italic pt-3" style={{ color: '#8a7560' }}>
              Tip: this chapter is short — a photo or memory would help finish the page.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuickRead;
