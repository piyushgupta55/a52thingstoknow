import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Plus, Trash2, Pencil, Check, X, Inbox, CheckCircle2, Clock } from 'lucide-react';
import { InviteFamilyForm } from '@/components/family/InviteFamilyForm';
import { toast } from '@/hooks/use-toast';

interface Memory {
  id: string;
  book_id: string;
  chapter_id: string | null;
  contributor_name: string;
  contributor_type: string;
  memory_text: string;
  size_tag: string;
  status: string;
  created_at: string;
}

interface BookInfo {
  id: string;
  recipient_name: string;
  user_id: string;
}

const sizeFromText = (text: string): 'small' | 'medium' | 'full' => {
  const sentences = text.trim().split(/[.!?]+\s+/).filter(Boolean).length;
  if (sentences <= 1) return 'small';
  if (sentences <= 3) return 'medium';
  return 'full';
};

const MemoryManager = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [book, setBook] = useState<BookInfo | null>(null);
  const [authorName, setAuthorName] = useState('');
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);

  const [newFrom, setNewFrom] = useState('');
  const [newText, setNewText] = useState('');
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFromValue, setEditFromValue] = useState('');

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);

  useEffect(() => {
    if (!bookId) return;
    const load = async () => {
      try {
        const { data: bookData, error: bookErr } = await supabase
          .from('books').select('id, recipient_name, user_id').eq('id', bookId).maybeSingle();
        if (bookErr) console.error('[MemoryManager] book load error', bookErr);
        setBook(bookData);
        if (bookData) {
          const { data: profile } = await supabase
            .from('profiles').select('display_name').eq('user_id', bookData.user_id).maybeSingle();
          const name = profile?.display_name || '';
          setAuthorName(name);
          setNewFrom(name);
        }
        const { data: memData, error: memErr } = await supabase
          .from('memories').select('*').eq('book_id', bookId).order('created_at', { ascending: false });
        if (memErr) console.error('[MemoryManager] memories load error', memErr);
        setMemories(memData || []);

        const { data: inviteData, error: invErr } = await supabase
          .from('memory_invites').select('token').eq('book_id', bookId).is('revoked_at', null)
          .order('created_at', { ascending: false }).limit(1);
        if (invErr) console.error('[MemoryManager] invites load error', invErr);
        if (inviteData && inviteData.length > 0) {
          setInviteUrl(`${window.location.origin}/invite/${inviteData[0].token}`);
        }
      } catch (err) {
        console.error('[MemoryManager] unexpected load error', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [bookId]);

  const refreshMemories = async () => {
    const { data } = await supabase
      .from('memories').select('*').eq('book_id', bookId).order('created_at', { ascending: false });
    setMemories(data || []);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim() || !newFrom.trim() || !bookId) return;
    setSaving(true);
    const size = sizeFromText(newText);
    const { error } = await supabase.from('memories').insert({
      book_id: bookId,
      contributor_name: newFrom.trim(),
      contributor_type: 'author',
      memory_text: newText.trim(),
      size_tag: size,
      status: 'unplaced',
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Could not save memory', description: error.message, variant: 'destructive' });
      return;
    }
    setNewText('');
    setNewFrom(authorName);
    toast({ title: 'Memory added to pool' });
    refreshMemories();
  };

  const handleSaveFromName = async (id: string) => {
    if (!editFromValue.trim()) return;
    const { error } = await supabase.from('memories')
      .update({ contributor_name: editFromValue.trim() }).eq('id', id);
    if (error) {
      toast({ title: 'Could not update', description: error.message, variant: 'destructive' });
      return;
    }
    setEditingId(null);
    refreshMemories();
  };

  const handleApprove = async (id: string) => {
    const { error } = await supabase.from('memories')
      .update({ status: 'unplaced' }).eq('id', id);
    if (error) {
      toast({ title: 'Could not approve', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Memory approved' });
    refreshMemories();
  };

  const handleDecline = async (id: string) => {
    const { error } = await supabase.from('memories').delete().eq('id', id);
    if (error) {
      toast({ title: 'Could not decline', description: error.message, variant: 'destructive' });
      return;
    }
    refreshMemories();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('memories').delete().eq('id', deleteId);
    if (error) {
      toast({ title: 'Could not delete', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Memory deleted' });
      refreshMemories();
    }
    setDeleteId(null);
  };

  const handleGenerateInvite = async () => {
    if (!bookId || !user) return;
    setGeneratingInvite(true);
    const token = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '').slice(0, 32);
    const { error } = await supabase.from('memory_invites').insert({
      book_id: bookId, token, created_by: user.id,
    });
    setGeneratingInvite(false);
    if (error) {
      toast({ title: 'Could not create link', description: error.message, variant: 'destructive' });
      return;
    }
    const url = `${window.location.origin}/invite/${token}`;
    setInviteUrl(url);
    navigator.clipboard?.writeText(url).catch(() => {});
    toast({ title: 'Invite link created', description: 'Copied to clipboard' });
  };

  const handleCopyInvite = () => {
    if (!inviteUrl) return;
    navigator.clipboard?.writeText(inviteUrl);
    toast({ title: 'Link copied' });
  };

  const pending = memories.filter(m => m.status === 'pending_approval');
  const placed = memories.filter(m => m.status === 'placed' || m.chapter_id !== null);
  const unplaced = memories.filter(m => m.status === 'unplaced' && m.chapter_id === null);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (!book) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">Book not found.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/book/${bookId}`)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Book
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">Memory Pool</h1>
            <p className="text-muted-foreground mt-1">
              Memories about {book.recipient_name} — they'll find their way into the book wherever there's space.
            </p>
          </div>
        </div>

        <InviteFamilyForm
          bookId={bookId!}
          recipientName={book.recipient_name}
          inviteUrl={inviteUrl}
          onFallbackNeeded={handleGenerateInvite}
          generatingFallback={generatingInvite}
        />

        <form onSubmit={handleAdd} className="bg-card border border-border rounded-xl p-5 mb-8 shadow-sm">
          <h3 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" /> Add a memory
          </h3>
          <div className="space-y-3">
            <div>
              <Label htmlFor="from" className="text-xs uppercase tracking-wider text-muted-foreground">From</Label>
              <Input
                id="from"
                value={newFrom}
                onChange={(e) => setNewFrom(e.target.value)}
                placeholder="Your name (or who this memory is from)"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="text" className="text-xs uppercase tracking-wider text-muted-foreground">Memory</Label>
              <Textarea
                id="text"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="A moment, a story, a small thing you remember…"
                rows={3}
                className="mt-1"
              />
            </div>
            <Button type="submit" disabled={saving || !newText.trim() || !newFrom.trim()}>
              {saving ? 'Saving…' : 'Add to pool'}
            </Button>
          </div>
        </form>

        {pending.length > 0 && (
          <Section title="Pending Approval" icon={<Clock className="h-4 w-4" />} count={pending.length}>
            {pending.map(m => (
              <MemoryCard
                key={m.id} memory={m} editingId={editingId} editFromValue={editFromValue}
                setEditingId={setEditingId} setEditFromValue={setEditFromValue}
                onSaveFromName={handleSaveFromName} onDelete={(id) => setDeleteId(id)}
                showApprove onApprove={() => handleApprove(m.id)} onDecline={() => handleDecline(m.id)}
              />
            ))}
          </Section>
        )}

        <Section title="Unplaced" icon={<Inbox className="h-4 w-4" />} count={unplaced.length}>
          {unplaced.length === 0 ? (
            <p className="text-sm text-muted-foreground italic px-1">No memories waiting in the pool yet.</p>
          ) : (
            unplaced.map(m => (
              <MemoryCard
                key={m.id} memory={m} editingId={editingId} editFromValue={editFromValue}
                setEditingId={setEditingId} setEditFromValue={setEditFromValue}
                onSaveFromName={handleSaveFromName} onDelete={(id) => setDeleteId(id)}
              />
            ))
          )}
        </Section>

        <Section title="Placed" icon={<CheckCircle2 className="h-4 w-4" />} count={placed.length}>
          {placed.length === 0 ? (
            <p className="text-sm text-muted-foreground italic px-1">None placed yet.</p>
          ) : (
            placed.map(m => (
              <MemoryCard
                key={m.id} memory={m} editingId={editingId} editFromValue={editFromValue}
                setEditingId={setEditingId} setEditFromValue={setEditFromValue}
                onSaveFromName={handleSaveFromName} onDelete={(id) => setDeleteId(id)}
              />
            ))
          )}
        </Section>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this memory?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const Section = ({ title, icon, count, children }: { title: string; icon: React.ReactNode; count: number; children: React.ReactNode }) => (
  <div className="mb-8">
    <h2 className="font-heading text-lg font-bold text-foreground mb-3 flex items-center gap-2">
      <span className="text-primary">{icon}</span>
      {title}
      <Badge variant="secondary" className="ml-1">{count}</Badge>
    </h2>
    <div className="space-y-3">{children}</div>
  </div>
);

interface CardProps {
  memory: Memory;
  editingId: string | null;
  editFromValue: string;
  setEditingId: (id: string | null) => void;
  setEditFromValue: (s: string) => void;
  onSaveFromName: (id: string) => void;
  onDelete: (id: string) => void;
  showApprove?: boolean;
  onApprove?: () => void;
  onDecline?: () => void;
}

const MemoryCard = ({
  memory: m, editingId, editFromValue, setEditingId, setEditFromValue,
  onSaveFromName, onDelete, showApprove, onApprove, onDecline,
}: CardProps) => {
  const isEditing = editingId === m.id;
  return (
    <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {isEditing ? (
            <div className="flex items-center gap-1.5">
              <Input
                value={editFromValue}
                onChange={(e) => setEditFromValue(e.target.value)}
                className="h-7 text-sm w-40"
                autoFocus
              />
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onSaveFromName(m.id)}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <>
              <span className="text-sm font-semibold text-foreground">{m.contributor_name}</span>
              <button
                onClick={() => { setEditingId(m.id); setEditFromValue(m.contributor_name); }}
                className="text-muted-foreground/60 hover:text-foreground transition-colors"
                aria-label="Edit name"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </>
          )}
          <Badge variant="outline" className="text-[0.65rem]">{m.size_tag}</Badge>
          {m.contributor_type === 'family' && (
            <Badge variant="secondary" className="text-[0.65rem]">family</Badge>
          )}
        </div>
        <button
          onClick={() => onDelete(m.id)}
          className="p-1 text-muted-foreground/60 hover:text-destructive transition-colors"
          aria-label="Delete memory"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{m.memory_text}</p>
      {showApprove && (
        <div className="flex gap-2 mt-3">
          <Button size="sm" onClick={onApprove}>
            <Check className="h-3.5 w-3.5 mr-1.5" /> Approve
          </Button>
          <Button size="sm" variant="outline" onClick={onDecline}>
            <X className="h-3.5 w-3.5 mr-1.5" /> Decline
          </Button>
        </div>
      )}
    </div>
  );
};

export default MemoryManager;
