import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Plus, BookOpen, Trash2 } from 'lucide-react';
import Navbar from '@/components/Navbar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';

interface BookSummary {
  id: string;
  recipient_name: string;
  relationship: string;
  occasion: string;
  created_at: string;
}

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    supabase.from('books').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data, error }: any) => {
        const capBooks = (data || []).map((b: any) => {
          if (b.recipient_name) {
            b.recipient_name = b.recipient_name.trim().split(/\s+/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          }
          return b;
        });
        setBooks(capBooks);
        setLoading(false);
      });
  }, [user]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      // Delete chapters first, then the book
      await supabase.from('chapters').delete().eq('book_id', deleteId);
      await supabase.from('memories').delete().eq('book_id', deleteId);
      const { error } = await supabase.from('books').delete().eq('id', deleteId);
      if (error) throw error;
      setBooks(prev => prev.filter(b => b.id !== deleteId));
      toast({ title: 'Book deleted' });
    } catch (e: any) {
      toast({ title: 'Error deleting book', description: e.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">My Books</h1>
          <div className="flex gap-3 w-full sm:w-auto">
            <Button onClick={() => navigate('/new-book')} className="flex-1 sm:flex-none">
              <Plus className="h-4 w-4 mr-2" /> New Book
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="text-muted-foreground text-center py-20">Loading...</p>
        ) : books.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="font-heading text-xl font-semibold text-foreground mb-2">No books yet</h2>
            <p className="text-muted-foreground mb-6">Create your first book of wisdom and start writing chapters.</p>
            <Button size="lg" onClick={() => navigate('/new-book')}>Start Your Book</Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {books.map(book => (
              <div
                key={book.id}
                className="relative bg-card border border-border rounded-xl p-6 text-left hover:shadow-md hover:border-primary/30 transition-all cursor-pointer"
                onClick={() => navigate(`/book/${book.id}`)}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteId(book.id); }}
                  className="absolute top-3 right-3 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  aria-label="Delete book"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <h2 className="font-heading text-lg font-bold text-foreground pr-8">
                  {book.recipient_name}'s Gift
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {book.relationship} · {book.occasion}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Book</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this book? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting…' : 'Delete Book'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;
