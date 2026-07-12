import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { CheckCircle, X, ExternalLink, Filter, Bug, HelpCircle, Lightbulb, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FeedbackRow {
  id: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  issue_type: 'bug' | 'question' | 'suggestion';
  message: string;
  page_url: string | null;
  screenshot_url: string | null;
  status: 'open' | 'resolved' | 'dismissed';
  created_at: string;
}

type StatusFilter = 'all' | 'open' | 'resolved' | 'dismissed';

const typeMeta = {
  bug: { label: 'Bug', icon: Bug, color: 'text-red-600' },
  question: { label: 'Question', icon: HelpCircle, color: 'text-blue-600' },
  suggestion: { label: 'Suggestion', icon: Lightbulb, color: 'text-amber-600' },
};

export default function FeedbackManager() {
  const { toast } = useToast();
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [signed, setSigned] = useState<Record<string, string>>({});

  const fetchRows = async () => {
    setLoading(true);
    let q = supabase.from('feedback').select('*').order('created_at', { ascending: false });
    if (statusFilter !== 'all') q = q.eq('status', statusFilter);
    const { data, error } = await q;
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setRows(data || []);
      // Sign screenshot URLs in parallel
      const toSign = (data || []).filter((r) => r.screenshot_url);
      const entries = await Promise.all(
        toSign.map(async (r) => {
          const { data: s } = await supabase.storage
            .from('feedback-screenshots')
            .createSignedUrl(r.screenshot_url!, 60 * 60);
          return [r.id, s?.signedUrl || ''] as const;
        })
      );
      setSigned(Object.fromEntries(entries));
    }
    setLoading(false);
  };

  useEffect(() => { fetchRows(); }, [statusFilter]);

  const setStatus = async (id: string, status: 'resolved' | 'dismissed' | 'open') => {
    const { error } = await supabase.from('feedback').update({ status }).eq('id', id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else fetchRows();
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{rows.length} item{rows.length === 1 ? '' : 's'}</span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-center text-muted-foreground py-16 border rounded-lg bg-card">No feedback in this view.</div>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => {
            const meta = typeMeta[r.issue_type];
            const Icon = meta.icon;
            return (
              <div key={r.id} className="rounded-lg border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${meta.color}`} />
                    <Badge variant="outline">{meta.label}</Badge>
                    <Badge variant={r.status === 'open' ? 'default' : 'secondary'} className="capitalize">{r.status}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                  <div className="flex gap-1">
                    {r.status !== 'resolved' && (
                      <Button size="sm" variant="ghost" className="text-emerald-600" onClick={() => setStatus(r.id, 'resolved')}>
                        <CheckCircle className="h-4 w-4 mr-1" /> Resolve
                      </Button>
                    )}
                    {r.status !== 'dismissed' && (
                      <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setStatus(r.id, 'dismissed')}>
                        <X className="h-4 w-4 mr-1" /> Dismiss
                      </Button>
                    )}
                    {r.status !== 'open' && (
                      <Button size="sm" variant="ghost" onClick={() => setStatus(r.id, 'open')}>Reopen</Button>
                    )}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 mb-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Tester</div>
                    <div className="font-medium">{r.user_name || '—'}</div>
                    {r.user_email && (
                      <a href={`mailto:${r.user_email}`} className="text-primary text-xs underline">{r.user_email}</a>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Page</div>
                    {r.page_url ? (
                      <a href={r.page_url} target="_blank" rel="noreferrer" className="text-primary text-xs break-all inline-flex items-center gap-1">
                        {r.page_url} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : '—'}
                  </div>
                </div>

                <div className="whitespace-pre-wrap text-sm bg-muted/40 p-3 rounded-md mb-3">{r.message}</div>

                {r.screenshot_url && signed[r.id] && (
                  <a href={signed[r.id]} target="_blank" rel="noreferrer" className="block">
                    <img src={signed[r.id]} alt="screenshot" className="max-h-72 rounded-md border object-contain bg-muted" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
