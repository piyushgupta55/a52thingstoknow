import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Library } from 'lucide-react';
import Navbar from '@/components/Navbar';

interface AlternativeChapter {
  id: string;
  title: string;
  category: string;
  description: string;
  available: boolean;
}

const alternatives: AlternativeChapter[] = [
  {
    id: 'coming-soon',
    title: 'Coming Soon',
    category: 'Library',
    description: 'Alternative chapters are on their way. Check back soon.',
    available: false,
  },
];

const ChapterLibrary = () => {
  const navigate = useNavigate();
  const { bookId } = useParams<{ bookId: string }>();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <button
          onClick={() => navigate(bookId ? `/book/${bookId}` : '/dashboard')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </button>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Library className="h-7 w-7 text-primary" />
            <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground">Chapter Library</h1>
          </div>
          <p className="text-muted-foreground text-base max-w-2xl">
            Swap any chapter in your book for an alternative that fits your child better. Your book always stays at 52 chapters.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {alternatives.map(ch => (
            <div
              key={ch.id}
              className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col"
            >
              <p className="text-[0.65rem] uppercase tracking-wider text-primary font-semibold mb-2">{ch.category}</p>
              <h3 className="font-heading text-lg font-bold text-foreground mb-2">{ch.title}</h3>
              <p className="text-sm text-muted-foreground flex-1 mb-4">{ch.description}</p>
              <Button disabled={!ch.available} className="w-full">
                Swap Into My Book
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChapterLibrary;
