import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import Navbar from '@/components/Navbar';
import { ArrowLeft, Save } from 'lucide-react';
import { countWords } from '@/lib/page2Status';

// Two free pages of writing (roughly matches chapter all_words 450-word budget).
const MAX_WORDS = 450;

const FamilyHistorySection = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [recipientName, setRecipientName] = useState('');
  const [content, setContent] = useState('');
  const [rowId, setRowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!bookId) return;
    (async () => {
      const [{ data: bookData }, { data: fhData }] = await Promise.all([
        supabase.from('books').select('recipient_name').eq('id', bookId).single(),
        supabase.from('book_family_history').select('*').eq('book_id', bookId).maybeSingle(),
      ]);
      if (bookData) setRecipientName(bookData.recipient_name || '');
      if (fhData) {
        setRowId(fhData.id);
        setContent(fhData.content || '');
      }
      setLoading(false);
    })();
  }, [bookId]);

  const words = countWords(content);
  const remaining = Math.max(0, MAX_WORDS - words);
  const overLimit = words > MAX_WORDS;
  const fillPct = Math.min(100, Math.round((words / MAX_WORDS) * 100));

  const computeStatus = (txt: string) => {
    const trimmed = txt.trim();
    if (!trimmed) return 'not_started';
    if (countWords(trimmed) >= 50) return 'complete';
    return 'in_progress';
  };

  const handleSave = async () => {
    if (!bookId || !user) return;
    if (overLimit) {
      toast({ title: 'Too long', description: `Please trim to ${MAX_WORDS} words or fewer.`, variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const status = computeStatus(content);
      const payload: any = {
        book_id: bookId,
        content: content.trim() ? content : null,
        status,
      };
      if (rowId) {
        const { error } = await supabase.from('book_family_history').update(payload).eq('id', rowId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('book_family_history').insert(payload).select().single();
        if (error) throw error;
        setRowId(data.id);
      }
      toast({ title: 'Saved', description: 'Your family history has been saved.' });
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <button
          onClick={() => navigate(`/book/${bookId}`)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Book
        </button>

        <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground/60 mb-2" style={{ fontFamily: 'Georgia, serif' }}>
          Our Family Story
        </p>
        <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-3" style={{ fontFamily: 'Georgia, serif' }}>
          Family History
        </h1>
        <p className="text-muted-foreground mb-6 leading-relaxed">
          A free-form, two-page section at the back of {recipientName ? `${recipientName}'s` : 'the'} book. Write
          your family's story — names, places, traditions, the people who came before. If you leave this blank, the
          section won't appear in the book at all.
        </p>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground/60" style={{ fontFamily: 'Georgia, serif' }}>
              Two-page section
            </span>
            <span className={`text-xs tabular-nums ${overLimit ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
              {words} / {MAX_WORDS} words · {remaining} remaining
            </span>
          </div>

          {/* Page-fill indicator (mirrors letter / chapter feel) */}
          <div className="h-1 w-full rounded-full bg-muted overflow-hidden mb-4">
            <div
              className="h-full transition-all"
              style={{
                width: `${fillPct}%`,
                background: overLimit ? '#DC2626' : fillPct >= 90 ? '#D97706' : '#C9A84C',
              }}
            />
          </div>

          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Tell the story of your family — where you come from, who came before, the threads that connect it all…"
            className="min-h-[420px] text-base leading-relaxed"
            style={{ fontFamily: 'Georgia, serif' }}
          />
          <p className="text-xs text-muted-foreground mt-3 italic">
            Roughly fills two facing pages. The section is hidden from the printed book until you save some words here.
          </p>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving || overLimit} size="lg" className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FamilyHistorySection;
