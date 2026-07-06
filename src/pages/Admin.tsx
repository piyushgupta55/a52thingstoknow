import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { CheckCircle, Trash2, Filter, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import EditContentDialog from '@/components/admin/EditContentDialog';
import PhotoChapterManager from '@/components/admin/PhotoChapterManager';
import TestersManager from '@/components/admin/TestersManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ContentEntry {
  id: string;
  book_id: string | null;
  type: 'verse' | 'quote' | 'memory';
  text: string;
  source: string | null;
  translation: string | null;
  topic_tags: string[];
  status: 'pending' | 'approved' | 'deleted';
  origin: 'preloaded' | 'ai_generated' | 'author_written' | 'family_submitted';
  placed_in: number[];
  word_count: number;
  created_at: string;
}

type TypeFilter = 'all' | 'verse' | 'quote' | 'memory';
type StatusFilter = 'all' | 'pending' | 'approved' | 'deleted';

const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { toast } = useToast();
  const [entries, setEntries] = useState<ContentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editEntry, setEditEntry] = useState<ContentEntry | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate('/dashboard', { replace: true });
    }
  }, [adminLoading, isAdmin, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchEntries();
  }, [isAdmin, typeFilter, statusFilter]);

  const fetchEntries = async () => {
    setLoading(true);
    let query = supabase.from('content_pool').select('*').order('created_at', { ascending: false });

    if (typeFilter !== 'all') query = query.eq('type', typeFilter);
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);

    const { data, error } = await query;
    if (error) {
      console.error('Failed to fetch content pool:', error);
    } else {
      setEntries(data || []);
    }
    setLoading(false);
  };

  const updateStatus = async (id: string, newStatus: 'approved' | 'deleted') => {
    const { error } = await supabase
      .from('content_pool')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: newStatus === 'approved' ? 'Approved' : 'Deleted' });
      fetchEntries();
    }
  };

  const handleEditSave = async (id: string, updates: { text: string; source: string | null; translation: string | null; topic_tags: string[] }) => {
    const { error } = await supabase
      .from('content_pool')
      .update(updates)
      .eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Updated successfully' });
      fetchEntries();
    }
  };

  // Count summaries
  const counts = entries.reduce(
    (acc, e) => {
      acc[e.type] = acc[e.type] || { pending: 0, approved: 0, deleted: 0 };
      acc[e.type][e.status]++;
      return acc;
    },
    {} as Record<string, Record<string, number>>,
  );

  // Compute unfiltered counts for summary
  const [allEntries, setAllEntries] = useState<ContentEntry[]>([]);
  useEffect(() => {
    if (!isAdmin) return;
    const fetchAll = async () => {
      const { data } = await supabase.from('content_pool').select('type, status');
      setAllEntries((data as ContentEntry[]) || []);
    };
    fetchAll();
  }, [isAdmin, entries]);

  const allCounts = allEntries.reduce(
    (acc, e) => {
      acc[e.type] = acc[e.type] || { pending: 0, approved: 0, deleted: 0 };
      acc[e.type][e.status]++;
      return acc;
    },
    {} as Record<string, Record<string, number>>,
  );

  if (adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!isAdmin) return null;

  const originLabel = (o: string) => {
    const map: Record<string, string> = {
      preloaded: 'Preloaded',
      ai_generated: 'AI Generated',
      author_written: 'Author',
      family_submitted: 'Family',
    };
    return map[o] || o;
  };

  const statusColor = (s: string) => {
    if (s === 'approved') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
    if (s === 'pending') return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold font-serif text-foreground mb-6">Admin Panel</h1>

        <Tabs defaultValue="content" className="mb-8">
          <TabsList>
            <TabsTrigger value="content">Content Manager</TabsTrigger>
            <TabsTrigger value="photos">Photo Chapters</TabsTrigger>
          </TabsList>

          <TabsContent value="photos" className="mt-6">
            <PhotoChapterManager />
          </TabsContent>

          <TabsContent value="content" className="mt-6">

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {(['verse', 'quote', 'memory'] as const).map((type) => {
            const c = allCounts[type] || { pending: 0, approved: 0, deleted: 0 };
            return (
              <div key={type} className="rounded-lg border bg-card p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                  {type === 'memory' ? 'Memories' : `${type.charAt(0).toUpperCase() + type.slice(1)}s`}
                </h3>
                <div className="flex gap-3 text-sm">
                  <span className="text-amber-600 font-medium">{c.pending} pending</span>
                  <span className="text-emerald-600 font-medium">{c.approved} approved</span>
                  <span className="text-red-500 font-medium">{c.deleted} deleted</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6 items-center">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="verse">Verses</SelectItem>
              <SelectItem value="quote">Quotes</SelectItem>
              <SelectItem value="memory">Memories</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="deleted">Deleted</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-lg border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Type</TableHead>
                <TableHead>Text</TableHead>
                <TableHead className="w-[120px]">Source</TableHead>
                <TableHead className="w-[100px]">Origin</TableHead>
                <TableHead className="w-[90px]">Status</TableHead>
                <TableHead className="w-[60px]">Words</TableHead>
                <TableHead className="w-[100px]">Tags</TableHead>
                <TableHead className="w-[120px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No content pool entries yet. Structure is ready — add content when needed.
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => {
                  const isExpanded = expandedId === entry.id;
                  return (
                    <React.Fragment key={entry.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      >
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-xs">{entry.type}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[300px] text-sm">
                          <div className="flex items-center gap-1.5">
                            {isExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            )}
                            <span className={isExpanded ? '' : 'truncate'}>{entry.text}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{entry.source || '—'}</TableCell>
                        <TableCell className="text-xs">{originLabel(entry.origin)}</TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(entry.status)}`}>
                            {entry.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{entry.word_count}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {entry.topic_tags.length > 0 ? entry.topic_tags.join(', ') : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-muted-foreground hover:text-foreground"
                              onClick={() => { setEditEntry(entry); setEditOpen(true); }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {entry.status !== 'approved' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-emerald-600 hover:text-emerald-700"
                                onClick={() => updateStatus(entry.id, 'approved')}
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {entry.status !== 'deleted' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-red-500 hover:text-red-600"
                                onClick={() => updateStatus(entry.id, 'deleted')}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={8} className="bg-muted/30 px-6 py-4">
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{entry.text}</p>
                            {entry.translation && (
                              <p className="text-xs text-muted-foreground mt-2">Translation: {entry.translation}</p>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        <EditContentDialog
          entry={editEntry}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSave={handleEditSave}
        />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
