import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Circle, PenLine, ArrowLeft } from 'lucide-react';
import Navbar from '@/components/Navbar';

interface Book {
  id: string;
  recipient_name: string;
}

interface Chapter {
  id: string;
  chapter_number: number;
  title: string;
  status: 'not_started' | 'in_progress' | 'complete';
}

const statusConfig = {
  not_started: { label: 'Not Started', variant: 'secondary' as const, icon: Circle },
  in_progress: { label: 'In Progress', variant: 'default' as const, icon: PenLine },
  complete: { label: 'Complete', variant: 'outline' as const, icon: CheckCircle },
};

const ChapterGrid = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bookId) return;
    const fetchData = async () => {
      const [{ data: bookData }, { data: chapData }] = await Promise.all([
        supabase.from('books').select('*').eq('id', bookId).single(),
        supabase.from('chapters').select('*').eq('book_id', bookId).order('chapter_number'),
      ]);
      setBook(bookData);
      setChapters(chapData || []);
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
            const config = statusConfig[chapter.status];
            const StatusIcon = config.icon;
            return (
              <button
                key={chapter.id}
                onClick={() => navigate(`/book/${bookId}/chapter/${chapter.id}`)}
                className="bg-card border border-border rounded-lg p-4 text-left hover:shadow-md hover:border-primary/30 transition-all group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground mb-1">Chapter {chapter.chapter_number}</div>
                    <div className="font-medium text-foreground text-sm truncate group-hover:text-primary transition-colors">
                      {chapter.title}
                    </div>
                  </div>
                  <StatusIcon className={`h-4 w-4 flex-shrink-0 mt-1 ${chapter.status === 'complete' ? 'text-primary' : chapter.status === 'in_progress' ? 'text-accent' : 'text-muted-foreground/40'}`} />
                </div>
                <Badge variant={config.variant} className="mt-2 text-xs">
                  {config.label}
                </Badge>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ChapterGrid;
