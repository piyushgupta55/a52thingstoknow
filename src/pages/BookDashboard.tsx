import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen, PenLine, CheckCircle, Circle, Mail, MessageSquare, Sparkles,
  Users, LayoutGrid, Send, Inbox, Camera, Play, Library, ShoppingCart, Download
} from 'lucide-react';
import { toast } from 'sonner';
import { saveAs } from 'file-saver';
import TutorialVideos from '@/components/TutorialVideos';
import Navbar from '@/components/Navbar';

interface Book {
  id: string;
  recipient_name: string;
  relationship: string;
  occasion: string;
  from_label: string | null;
  user_id: string;
}

interface Chapter {
  id: string;
  chapter_number: number;
  title: string;
  status: string;
  chapter_template: string;
  photo_urls: string[];
  is_photo_chapter: boolean;
  quote_text: string | null;
  quote_attribution: string | null;
  bible_verse_text: string | null;
  bible_verse_reference: string | null;
}

interface ChapterTemplate {
  chapter_number: number;
  is_photo_chapter: boolean;
}

interface Memory {
  id: string;
  chapter_id: string | null;
  status: string;
  contributor_name: string;
  memory_text: string;
}

const BookDashboard = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [photoTemplates, setPhotoTemplates] = useState<ChapterTemplate[]>([]);
  const [authorName, setAuthorName] = useState('');
  const [ancestryStatus, setAncestryStatus] = useState<string>('not_started');
  const [loading, setLoading] = useState(true);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const handleGenerateTestPDF = async () => {
    setIsGeneratingPDF(true);
    console.log('PDF generation started');
    const startTime = performance.now();
    
    try {
      // Format bookData with real data fetched from Supabase
      const bookData = {
        title: "52 Things to Know",
        recipientName: book?.recipient_name || '',
        author: book?.from_label || authorName || 'The Author',
        chapters: chapters.sort((a, b) => a.chapter_number - b.chapter_number).map((ch: any) => ({
          title: ch.title,
          content: (() => {
            if (ch.chapter_number === 0) return ch.content || `<p>No content available.</p>`;
            const refText = ch.reference_text || '';
            const mainContent = ch.content || '';
            const needsSpace = refText.length > 0 && mainContent.length > 0 && !/\s$/.test(refText) && !/^\s/.test(mainContent);
            return refText + (needsSpace ? ' ' : '') + mainContent || `<p>No content available.</p>`;
          })(),
          chapter_number: ch.chapter_number,
          chapter_template: ch.chapter_template,
          photo_urls: ch.photo_urls || [],
          quote_text: ch.quote_text,
          quote_attribution: ch.quote_attribution,
          bible_verse_text: ch.bible_verse_text,
          bible_verse_reference: ch.bible_verse_reference,
          memories: memories.filter(m => m.chapter_id === ch.id).map(m => ({
            contributor_name: m.contributor_name,
            memory_text: m.memory_text
          }))
        }))
      };

      console.log('BookData Payload:', JSON.stringify(bookData, null, 2));

      const API_URL = import.meta.env.VITE_API_URL;
      const pdfEndpoint = `${API_URL}/generate-pdf`;

      const response = await fetch(pdfEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate PDF');
      }

      const blob = await response.blob();
      saveAs(blob, 'book-test.pdf');
      
      const endTime = performance.now();
      const timeInSeconds = ((endTime - startTime) / 1000).toFixed(2);
      
      console.log('PDF generation completed');
      console.log(`Generation time: ${timeInSeconds} seconds`);
      toast.success('Test PDF generated successfully');
    } catch (err: any) {
      console.error('PDF Generation Backend Error:', err);
      toast.error(err.message || 'Failed to generate PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  useEffect(() => {
    if (!bookId) return;
    const fetchData = async () => {
      const { data: bookData } = await supabase.from('books').select('*').eq('id', bookId).single();
      const tplGender = bookData?.recipient_gender === 'Girl/Young Woman' ? 'female' : 'male';
      const [{ data: chapData }, { data: memData }, { data: tplData }, { data: ancData }] = await Promise.all([
        supabase.from('chapters').select('*').eq('book_id', bookId).order('chapter_number'),
        supabase.from('memories').select('*').eq('book_id', bookId),
        supabase.from('chapter_templates').select('chapter_number, title, is_photo_chapter').eq('gender', tplGender),
        supabase.from('book_ancestry').select('status').eq('book_id', bookId).maybeSingle(),
      ]);
      if (ancData?.status) setAncestryStatus(ancData.status);
      if (bookData && bookData.recipient_name) {
        bookData.recipient_name = bookData.recipient_name.trim().split(/\s+/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
      setBook(bookData);
      // Override stale chapter titles with authoritative gender-specific template titles
      const titleByNumber = new Map<number, string>((tplData || []).map((t: any) => [t.chapter_number as number, t.title as string]));
      const correctedChapters = (chapData || []).map((c: any) =>
        c.chapter_number > 0 ? { ...c, title: titleByNumber.get(c.chapter_number) || c.title } : c
      );
      setChapters(correctedChapters);
      setMemories(memData || []);
      setPhotoTemplates(tplData || []);
      if (bookData) {
        const { data: profile } = await supabase.from('profiles').select('display_name').eq('user_id', bookData.user_id).single();
        setAuthorName(profile?.display_name || '');
      }
      setLoading(false);
    };
    fetchData();
  }, [bookId]);

  if (loading) return <div className="min-h-screen bg-background"><Navbar /><div className="container mx-auto px-4 py-20 text-center text-muted-foreground">Loading...</div></div>;
  if (!book) return <div className="min-h-screen bg-background"><Navbar /><div className="container mx-auto px-4 py-20 text-center text-muted-foreground">Book not found.</div></div>;

  const numberedChapters = chapters.filter(c => c.chapter_number > 0);
  const letterChapter = chapters.find(c => c.chapter_number === 0);
  const completed = numberedChapters.filter(c => c.status === 'complete').length;
  const inProgress = numberedChapters.filter(c => c.status === 'in_progress').length;
  const notStarted = numberedChapters.filter(c => c.status === 'not_started').length;
  const progress = numberedChapters.length > 0 ? (completed / numberedChapters.length) * 100 : 0;
  const nextChapter = chapters.find(c => c.status === 'in_progress') || chapters.find(c => c.status === 'not_started');

  const memoriesPlaced = memories.filter(m => m.chapter_id != null).length;
  const memoriesUnplaced = memories.filter(m => m.chapter_id == null).length;

  // Photo chapter tracking
  const photoChapterNums = new Set(photoTemplates.filter(t => t.is_photo_chapter).map(t => t.chapter_number));
  const photoChaptersDesignated = chapters.filter(c => photoChapterNums.has(c.chapter_number)).length;
  const photosUploaded = chapters.filter(c => photoChapterNums.has(c.chapter_number) && c.photo_urls && c.photo_urls.length > 0).length;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-6xl">

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">
            A Book of Wisdom for {book.recipient_name}
          </h1>
          <p className="text-muted-foreground mt-1">
            {book.relationship} · {book.occasion}
          </p>
        </div>

        {/* Progress Section */}
        <div className="bg-card rounded-xl border border-border p-6 mb-8 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-foreground">
              {completed} of {numberedChapters.length} chapters complete
            </span>
            <span className="text-sm font-semibold text-primary">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-3 mb-4" />
          <div className="flex flex-wrap gap-x-6 gap-y-1 mb-5 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5 text-primary" />
              Photo chapters: <span className="font-semibold text-foreground">{photosUploaded}</span> of <span className="font-semibold text-foreground">{photoChaptersDesignated}</span> have photos
            </span>
          </div>
          {nextChapter && (
            <Button size="lg" onClick={() => navigate(`/book/${bookId}/chapter/${nextChapter.id}`)}>
              <PenLine className="h-4 w-4 mr-2" />
              Continue Writing
            </Button>
          )}
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Chapters */}
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Chapters</h3>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-primary" />
                <span className="text-muted-foreground"><span className="font-semibold text-foreground">{completed}</span> complete</span>
              </div>
              <div className="flex items-center gap-2">
                <PenLine className="h-3.5 w-3.5 text-accent" />
                <span className="text-muted-foreground"><span className="font-semibold text-foreground">{inProgress}</span> in progress</span>
              </div>
              <div className="flex items-center gap-2">
                <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />
                <span className="text-muted-foreground"><span className="font-semibold text-foreground">{notStarted}</span> not started</span>
              </div>
              <div className="flex items-center gap-2">
              <Camera className="h-3.5 w-3.5 text-primary" />
                <span className="text-muted-foreground"><span className="font-semibold text-foreground">{photoChaptersDesignated}</span> photo chapters</span>
              </div>
              <div className="flex items-center gap-2">
                <Camera className="h-3.5 w-3.5 text-primary fill-primary/20" />
                <span className="text-muted-foreground"><span className="font-semibold text-foreground">{photosUploaded}</span> photos uploaded</span>
              </div>
            </div>
          </div>

          {/* Memories */}
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Memories</h3>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <Inbox className="h-3.5 w-3.5 text-primary" />
                <span className="text-muted-foreground">
                  Memories in pool: <span className="font-semibold text-foreground">{memories.length}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-primary" />
                <span className="text-muted-foreground">
                  Memories placed: <span className="font-semibold text-foreground">{memoriesPlaced}</span> of {numberedChapters.length} chapters
                </span>
              </div>
            </div>
          </div>

          {/* Emails */}
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Mail className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Emails</h3>
            </div>
            <div className="space-y-1.5 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Send className="h-3.5 w-3.5 text-muted-foreground/40" />
                <span><span className="font-semibold text-foreground">0</span> sent</span>
              </div>
              <div className="flex items-center gap-2">
                <Inbox className="h-3.5 w-3.5 text-muted-foreground/40" />
                <span><span className="font-semibold text-foreground">0</span> responded</span>
              </div>
            </div>
            <Badge variant="secondary" className="mt-2 text-[0.65rem]">Coming soon</Badge>
          </div>

          {/* AI Questions */}
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm opacity-50">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-muted-foreground">AI Questions</h3>
            </div>
            <p className="text-sm text-muted-foreground">Coming soon</p>
            <Badge variant="secondary" className="mt-2 text-[0.65rem]">Planned</Badge>
          </div>
        </div>

        {/* How It Works */}
        <TutorialVideos />

        {/* Quick Actions + Book Preview */}
        <div className="grid lg:grid-cols-5 gap-8">

          {/* Quick Actions */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="font-heading text-lg font-bold text-foreground">Quick Actions</h2>
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={() => navigate(`/book/${bookId}/memories`)}>
                <Users className="h-4 w-4 text-primary" />
                Invite Family to Share Memories
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={() => navigate(`/book/${bookId}/memories`)}>
                <MessageSquare className="h-4 w-4 text-primary" />
                View Memory Pool
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={() => navigate(`/book/${bookId}/chapters`)}>
                <LayoutGrid className="h-4 w-4 text-primary" />
                View All Chapters
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={() => navigate(`/book/${bookId}/library`)}>
                <Library className="h-4 w-4 text-primary" />
                Chapter Library
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={() => navigate(`/book/${bookId}/review`)}>
                <Sparkles className="h-4 w-4 text-primary" />
                Review My Book
              </Button>
              <Button className="w-full justify-start gap-3 h-12" onClick={() => navigate(`/book/${bookId}/review?mode=order`)}>
                <ShoppingCart className="h-4 w-4" />
                Order Book
              </Button>
              <Button 
                variant="secondary" 
                className="w-full justify-start gap-3 h-12 mt-4 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20" 
                onClick={handleGenerateTestPDF}
                disabled={isGeneratingPDF}
              >
                <Download className="h-4 w-4" />
                {isGeneratingPDF ? 'Generating...' : 'Generate Test PDF'}
              </Button>
            </div>
          </div>

          {/* Book Cover — clickable entry to preview */}
          <div className="lg:col-span-3">
            <h2 className="font-heading text-lg font-bold text-foreground mb-4">Your Book</h2>
            <button
              onClick={() => navigate(`/book/${bookId}/preview`)}
              className="block w-full max-w-[280px] mx-auto cursor-pointer group transition-transform hover:scale-[1.02]"
              aria-label="Preview your book"
            >
              {/* Book cover card — portrait orientation */}
              <div
                className="relative rounded-sm overflow-hidden flex flex-col"
                style={{
                  aspectRatio: '5 / 7',
                  boxShadow: '4px 4px 20px rgba(0,0,0,0.18), 1px 1px 4px rgba(0,0,0,0.08)',
                }}
              >
                {/* Spine edge */}
                <div className="absolute left-0 top-0 bottom-0 w-[6px]" style={{ background: '#A8607A' }} />

                {/* Top pink band */}
                <div className="flex items-center justify-center" style={{ background: '#C4788A', padding: '18px 16px 14px' }}>
                  <p className="text-[15px] font-bold tracking-wide text-white" style={{ fontFamily: 'Georgia, serif' }}>
                    52 Things to Know
                  </p>
                </div>

                {/* Middle white section */}
                <div className="flex flex-col items-center justify-center flex-1 bg-white" style={{ padding: '28px 24px' }}>
                  {/* Ornamental divider */}
                  <div className="flex items-center gap-1.5 mb-4">
                    <span style={{ color: '#BBA96A', fontSize: '6px' }}>◆</span>
                    <span style={{ color: '#BBA96A', fontSize: '8px' }}>◆</span>
                    <span style={{ color: '#BBA96A', fontSize: '6px' }}>◆</span>
                  </div>

                  <p className="text-[10px] uppercase tracking-[0.2em] mb-1" style={{ color: '#9CA3AF', fontFamily: 'Georgia, serif' }}>
                    For
                  </p>
                  <p className="text-[22px] italic font-semibold mb-3" style={{ color: '#2D3748', fontFamily: 'Georgia, serif' }}>
                    {book.recipient_name}
                  </p>

                  {/* Gold line divider */}
                  <div className="w-12 mb-3" style={{ height: '1px', background: '#BBA96A' }} />

                  <p className="text-[9px] uppercase tracking-[0.15em] mb-0.5" style={{ color: '#9CA3AF', fontFamily: 'Georgia, serif' }}>
                    From
                  </p>
                  <p className="text-[13px] italic" style={{ color: '#4A5568', fontFamily: 'Georgia, serif' }}>
                    {book.from_label || authorName || 'The Author'}
                  </p>
                </div>

                {/* Bottom pink band */}
                <div style={{ background: '#C4788A', height: '10px' }} />
              </div>
            </button>
            <p className="text-center text-xs text-muted-foreground mt-3 italic">Click to preview your book</p>

            {/* Table of Contents */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm max-h-80 overflow-y-auto mt-6">
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">Table of Contents</h4>
              <div className="space-y-1">
                {chapters
                  .sort((a, b) => a.chapter_number - b.chapter_number)
                  .map(ch => {
                    const isComplete = ch.status === 'complete';
                    const isInProgress = ch.status === 'in_progress';
                    const isLetter = ch.chapter_number === 0;
                    return (
                      <button
                        key={ch.id}
                        onClick={() => navigate(`/book/${bookId}/chapter/${ch.id}`)}
                        className={`flex items-center gap-2 w-full text-left py-1.5 px-2 rounded-md text-sm transition-colors hover:bg-muted/50 ${
                          isComplete ? 'text-foreground' : isInProgress ? 'text-foreground/70' : 'text-muted-foreground/40'
                        }`}
                      >
                        {isLetter ? (
                          <Mail className="h-3.5 w-3.5 text-primary/60 flex-shrink-0" />
                        ) : (
                          <span className="text-xs w-6 text-right flex-shrink-0 tabular-nums">{ch.chapter_number}.</span>
                        )}
                        <span className={`truncate ${isComplete ? 'font-medium' : ''}`}>{ch.title}</span>
                        {isComplete && <CheckCircle className="h-3.5 w-3.5 text-primary ml-auto flex-shrink-0" />}
                        {isInProgress && <PenLine className="h-3.5 w-3.5 text-accent ml-auto flex-shrink-0" />}
                        {!isComplete && !isInProgress && (
                          <span className="text-[0.65rem] italic text-muted-foreground/30 ml-auto flex-shrink-0">not started</span>
                        )}
                      </button>
                    );
                  })}

                {(() => {
                  const isComplete = ancestryStatus === 'complete';
                  const isInProgress = ancestryStatus === 'in_progress';
                  return (
                    <button
                      onClick={() => navigate(`/book/${bookId}/ancestry`)}
                      className={`flex items-center gap-2 w-full text-left py-1.5 px-2 rounded-md text-sm transition-colors hover:bg-muted/50 mt-1 border-t border-border pt-3 ${
                        isComplete ? 'text-foreground' : isInProgress ? 'text-foreground/70' : 'text-muted-foreground/40'
                      }`}
                    >
                      <BookOpen className="h-3.5 w-3.5 text-primary/60 flex-shrink-0" />
                      <span className={`truncate ${isComplete ? 'font-medium' : ''}`}>Where You Come From</span>
                      {isComplete && <CheckCircle className="h-3.5 w-3.5 text-primary ml-auto flex-shrink-0" />}
                      {isInProgress && <PenLine className="h-3.5 w-3.5 text-accent ml-auto flex-shrink-0" />}
                      {!isComplete && !isInProgress && (
                        <span className="text-[0.65rem] italic text-muted-foreground/30 ml-auto flex-shrink-0">not started</span>
                      )}
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookDashboard;
