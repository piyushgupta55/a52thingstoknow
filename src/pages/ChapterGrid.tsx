import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Camera } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { computeChapterTotalWords, getPage2Status } from '@/lib/page2Status';

interface Book {
  id: string;
  recipient_name: string;
}

interface Chapter {
  id: string;
  chapter_number: number;
  title: string;
  content: string | null;
  reference_text: string | null;
  chapter_template: string | null;
  review_status: string | null;
  review_note: string | null;
  is_photo_chapter: boolean | null;
  photo_urls: string[] | null;
  photo_declined: boolean | null;
}

const ChapterGrid = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [memoryCounts, setMemoryCounts] = useState<Record<string, number>>({});
  const [ancestryStatus, setAncestryStatus] = useState<string>('not_started');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bookId) return;
    const fetchData = async () => {
      const [{ data: bookData }, { data: chapData }, { data: memData }, { data: ancData }] = await Promise.all([
        supabase.from('books').select('*').eq('id', bookId).single(),
        supabase.from('chapters').select('*').eq('book_id', bookId).order('chapter_number'),
        supabase.from('memories').select('chapter_id').eq('book_id', bookId).or('entry_type.is.null,entry_type.eq.memory'),
        supabase.from('book_ancestry').select('status').eq('book_id', bookId).maybeSingle(),
      ]);
      setBook(bookData);
      setChapters((chapData as any) || []);
      setAncestryStatus((ancData as any)?.status || 'not_started');
      const counts: Record<string, number> = {};
      (memData || []).forEach((m: any) => {
        if (m.chapter_id) counts[m.chapter_id] = (counts[m.chapter_id] || 0) + 1;
      });
      setMemoryCounts(counts);
      setLoading(false);
    };
    fetchData();
  }, [bookId]);

  if (loading) return <div className="min-h-screen bg-background"><Navbar /><div className="container mx-auto px-4 py-20 text-center text-muted-foreground">Loading...</div></div>;
  if (!book) return <div className="min-h-screen bg-background"><Navbar /><div className="container mx-auto px-4 py-20 text-center text-muted-foreground">Book not found.</div></div>;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button variant="ghost" className="mb-4 gap-2" onClick={() => navigate(`/book/${bookId}`)}>
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Button>
        <h1 className="font-heading text-2xl font-bold text-foreground mb-6">
          All Chapters — {book.recipient_name}
        </h1>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {chapters.map(chapter => {
            const isLetter = chapter.chapter_number === 0;
            const totalWords = computeChapterTotalWords(chapter, memoryCounts[chapter.id] || 0);
            const page2 = getPage2Status(totalWords, chapter.chapter_template);
            return (
              <button
                key={chapter.id}
                onClick={() => navigate(`/book/${bookId}/chapter/${chapter.id}`)}
                className="bg-card border border-border rounded-lg p-4 text-left hover:shadow-md hover:border-primary/30 transition-all group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground mb-1">
                      {isLetter ? 'Letter' : `Chapter ${chapter.chapter_number}`}
                    </div>
                    <div className="font-medium text-foreground text-sm truncate group-hover:text-primary transition-colors">
                      {chapter.title}
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-end gap-2">
                  {!isLetter && (
                    <span
                      className="inline-flex items-center gap-1.5 text-[0.65rem] text-muted-foreground"
                      title={`Page 2: ${page2.totalWords}/${page2.budget} words`}
                    >
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: page2.color }}
                      />
                      {page2.label}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {chapter.review_status === 'keep' ? (
                    <Badge className="text-[0.65rem] bg-primary/10 text-primary hover:bg-primary/10 border-transparent">Kept</Badge>
                  ) : chapter.review_status === 'rewrite' ? (
                    <Badge className="text-[0.65rem] bg-accent/15 text-accent-foreground hover:bg-accent/15 border-transparent">Needs editing</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[0.65rem] text-muted-foreground">Undecided</Badge>
                  )}
                  {chapter.is_photo_chapter &&
                    !chapter.photo_declined &&
                    !(chapter.photo_urls && chapter.photo_urls.length > 0) && (
                      <Badge variant="outline" className="text-[0.65rem] text-muted-foreground gap-1">
                        <Camera className="h-3 w-3" /> Photo needed
                      </Badge>
                    )}
                </div>
                {chapter.review_status === 'rewrite' && chapter.review_note && (
                  <p className="mt-1.5 text-[0.7rem] italic text-muted-foreground line-clamp-2">
                    “{chapter.review_note}”
                  </p>
                )}

              </button>
            );
          })}

          {[
            { key: 'ancestry', label: 'Where You Come From', status: ancestryStatus, path: `/book/${bookId}/ancestry` },
            
          ].map(section => {
            const isComplete = section.status === 'complete';
            const isInProgress = section.status === 'in_progress';
            return (
              <button
                key={section.key}
                onClick={() => navigate(section.path)}
                className="bg-muted/30 border border-dashed border-primary/30 rounded-lg p-4 text-left hover:shadow-md hover:border-primary/60 transition-all group"
              >
                <div className="text-xs text-primary/70 mb-1 uppercase tracking-wider">Optional section</div>
                <div className="font-medium text-foreground text-sm truncate group-hover:text-primary transition-colors">
                  {section.label}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {isComplete ? (
                    <Badge className="text-[0.65rem] bg-primary/10 text-primary hover:bg-primary/10 border-transparent">Complete</Badge>
                  ) : isInProgress ? (
                    <Badge className="text-[0.65rem] bg-accent/15 text-accent-foreground hover:bg-accent/15 border-transparent">In progress</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[0.65rem] text-muted-foreground">Not started</Badge>
                  )}
                </div>
                <p className="mt-1.5 text-[0.7rem] italic text-muted-foreground">
                  Two-page section at the back of the book
                </p>
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
};

export default ChapterGrid;
