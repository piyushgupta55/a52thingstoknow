import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronDown, ChevronUp, Trash2, Download, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

interface Profile {
  user_id: string;
  display_name: string | null;
  email: string | null;
  email_verified: boolean;
  created_at: string;
}

interface Book {
  id: string;
  user_id: string;
  recipient_name: string;
  relationship: string;
  gender: string;
  occasion: string;
  milestone_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ChapterSummary {
  id: string;
  chapter_number: number;
  title: string | null;
  review_status: string | null;
  word_count: number | null;
}

const TestersManager: React.FC = () => {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [expandedBook, setExpandedBook] = useState<string | null>(null);
  const [bookChapters, setBookChapters] = useState<Record<string, ChapterSummary[]>>({});
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: p }, { data: b }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('books').select('*').order('created_at', { ascending: false }),
    ]);
    setProfiles(p || []);
    setBooks(b || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const loadChapters = async (bookId: string) => {
    if (bookChapters[bookId]) return;
    const { data } = await supabase
      .from('chapters')
      .select('id, chapter_number, title, review_status, word_count')
      .eq('book_id', bookId)
      .order('chapter_number');
    setBookChapters((prev) => ({ ...prev, [bookId]: (data as ChapterSummary[]) || [] }));
  };

  const booksByUser = (userId: string) => books.filter((b) => b.user_id === userId);

  const chapterPercent = (chapters: ChapterSummary[]) => {
    if (!chapters.length) return 0;
    const done = chapters.filter((c) => !!c.review_status).length;
    return Math.round((done / chapters.length) * 100);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('admin-delete-user', {
        body: { target_user_id: deleteTarget.user_id },
      });
      if (error) throw error;
      toast({ title: 'Account deleted', description: `${deleteTarget.email} and all their data are gone.` });
      setDeleteTarget(null);
      setConfirmText('');
      await load();
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const exportCsv = () => {
    const rows: string[] = ['user_email,user_name,verified,signup_date,book_id,recipient,relationship,gender,occasion,milestone_date,status,book_created,book_updated'];
    for (const p of profiles) {
      const userBooks = booksByUser(p.user_id);
      if (userBooks.length === 0) {
        rows.push([p.email, p.display_name, p.email_verified, p.created_at, '', '', '', '', '', '', '', '', ''].map(csv).join(','));
      }
      for (const b of userBooks) {
        rows.push([
          p.email, p.display_name, p.email_verified, p.created_at,
          b.id, b.recipient_name, b.relationship, b.gender, b.occasion, b.milestone_date, b.status, b.created_at, b.updated_at,
        ].map(csv).join(','));
      }
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `testers-books-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="text-muted-foreground py-8">Loading testers…</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {profiles.length} accounts · {books.length} books
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv}>
          <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
        </Button>
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]" />
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-[100px]">Verified</TableHead>
              <TableHead className="w-[120px]">Signed up</TableHead>
              <TableHead className="w-[80px]">Books</TableHead>
              <TableHead className="w-[100px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((p) => {
              const userBooks = booksByUser(p.user_id);
              const isOpen = expandedUser === p.user_id;
              return (
                <React.Fragment key={p.user_id}>
                  <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => setExpandedUser(isOpen ? null : p.user_id)}>
                    <TableCell>{isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</TableCell>
                    <TableCell className="font-medium">{p.display_name || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.email || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={p.email_verified ? 'default' : 'outline'} className="text-xs">
                        {p.email_verified ? 'Yes' : 'No'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{userBooks.length}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 px-2 text-red-500 hover:text-red-600"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-muted/20 px-6 py-4">
                        {userBooks.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No books yet.</p>
                        ) : (
                          <div className="space-y-3">
                            {userBooks.map((b) => {
                              const bookOpen = expandedBook === b.id;
                              const chapters = bookChapters[b.id] || [];
                              return (
                                <div key={b.id} className="rounded border bg-background">
                                  <div
                                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-muted/30"
                                    onClick={() => {
                                      const next = bookOpen ? null : b.id;
                                      setExpandedBook(next);
                                      if (next) loadChapters(b.id);
                                    }}
                                  >
                                    <div className="flex-1">
                                      <div className="font-medium text-sm">
                                        For {b.recipient_name} <span className="text-muted-foreground font-normal">({b.relationship}, {b.gender}) · {b.occasion}</span>
                                      </div>
                                      <div className="text-xs text-muted-foreground mt-0.5">
                                        Status: <Badge variant="outline" className="text-xs ml-1">{b.status}</Badge>
                                        {b.milestone_date && <span className="ml-3">Milestone: {b.milestone_date}</span>}
                                        <span className="ml-3">Updated {new Date(b.updated_at).toLocaleDateString()}</span>
                                      </div>
                                    </div>
                                    <Link to={`/book/${b.id}/preview`} onClick={(e) => e.stopPropagation()}>
                                      <Button size="sm" variant="ghost" className="h-7">
                                        <ExternalLink className="h-3.5 w-3.5 mr-1" /> Preview
                                      </Button>
                                    </Link>
                                  </div>
                                  {bookOpen && (
                                    <div className="border-t p-3 text-xs">
                                      {chapters.length === 0 ? (
                                        <span className="text-muted-foreground">Loading chapters…</span>
                                      ) : (
                                        <>
                                          <div className="mb-2 text-muted-foreground">
                                            {chapterPercent(chapters)}% reviewed · {chapters.filter((c) => !!c.review_status).length}/{chapters.length} chapters reviewed
                                          </div>
                                          <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
                                            {chapters.map((c) => (
                                              <div key={c.id} className="flex justify-between px-2 py-1 rounded bg-muted/40">
                                                <span className="truncate">{c.chapter_number}. {c.title || '(untitled)'}</span>
                                                <span className={c.review_status === 'keep' ? 'text-emerald-600' : c.review_status === 'rewrite' ? 'text-amber-600' : 'text-muted-foreground'}>
                                                  {c.word_count || 0}w
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setConfirmText(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this account permanently?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This will <strong>hard delete</strong> {deleteTarget?.email} — including every book, chapter, memory,
                  and uploaded photo. The email address will be freed and can be re-registered.
                </p>
                <p className="text-red-600 font-medium">This cannot be undone.</p>
                <div className="pt-2">
                  <Label htmlFor="confirm" className="text-sm">
                    Type <code className="px-1 bg-muted rounded">DELETE</code> to confirm:
                  </Label>
                  <Input id="confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="mt-1" />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={confirmText !== 'DELETE' || deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting…' : 'Delete account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

function csv(v: any): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default TestersManager;
