import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface PurchaseRow {
  id: string;
  book_id: string;
  user_id: string;
  amount_paid_cents: number;
  status: string;
  is_comp: boolean;
  comp_reason: string | null;
  created_at: string;
  environment: string;
  books?: { recipient_name: string | null; id: string } | null;
}

interface PendingRow {
  id: string;
  email: string;
  reason: string | null;
  created_at: string;
  redeemed_at: string | null;
}

const CompsManager = () => {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [granting, setGranting] = useState(false);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: pur }, { data: pen }] = await Promise.all([
      supabase
        .from('book_purchases')
        .select('id, book_id, user_id, amount_paid_cents, status, is_comp, comp_reason, created_at, environment, books(id, recipient_name)')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('pending_comps')
        .select('*')
        .order('created_at', { ascending: false }),
    ]);
    setPurchases((pur as any) || []);
    setPending((pen as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const grantByEmail = async () => {
    if (!email.trim()) return;
    setGranting(true);
    const { data, error } = await supabase.rpc('admin_grant_comp_by_email', {
      _email: email.trim(),
      _reason: reason.trim() || null,
    });
    setGranting(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    const res = data as any;
    if (res?.kind === 'pending') {
      toast({ title: 'Held for signup', description: `Comp will apply when ${res.email} creates their first book.` });
    } else if (res?.kind === 'pending_existing_user') {
      toast({ title: 'Queued', description: `${res.email} has an account but no book yet — comp will apply to their first book.` });
    } else {
      toast({ title: 'Access granted', description: `${res?.books ?? 0} book(s) comped.` });
    }
    setEmail(''); setReason('');
    load();
  };

  const revokeBook = async (bookId: string) => {
    const { error } = await supabase.rpc('admin_revoke_book_comp', { _book_id: bookId });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Comp revoked' });
      load();
    }
  };

  const regrantBook = async (bookId: string) => {
    const { error } = await supabase.rpc('admin_grant_book_comp', { _book_id: bookId, _reason: null });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Comp reactivated' });
      load();
    }
  };

  const deletePending = async (id: string) => {
    const { error } = await supabase.from('pending_comps').delete().eq('id', id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else load();
  };

  return (
    <div className="space-y-8">
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="font-serif text-lg font-semibold mb-1">Grant free access</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Enter an email. If they already have an account, every book they own is comped. If not, the comp applies as soon as they create their first book.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-[1fr,1fr,auto] gap-3 items-end">
          <div>
            <Label htmlFor="comp-email">Email</Label>
            <Input id="comp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jenna@example.com" />
          </div>
          <div>
            <Label htmlFor="comp-reason">Reason (optional)</Label>
            <Input id="comp-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Tester · Gift · Demo · Payment failed" />
          </div>
          <Button onClick={grantByEmail} disabled={granting || !email.trim()}>
            {granting ? 'Granting…' : 'Grant access'}
          </Button>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="p-4 border-b">
            <h3 className="font-serif text-base font-semibold">Pending (no account yet)</h3>
            <p className="text-xs text-muted-foreground">Will auto-apply on first book creation.</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Granted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.filter(p => !p.redeemed_at).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm">{p.email}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.reason || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => deletePending(p.id)}>Cancel</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="font-serif text-base font-semibold">Purchases &amp; comps</h3>
            <p className="text-xs text-muted-foreground">Comped books do not count as revenue.</p>
          </div>
          <Button size="sm" variant="ghost" onClick={load}>Refresh</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Book</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>
            ) : purchases.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No purchases yet.</TableCell></TableRow>
            ) : purchases.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  {p.is_comp ? (
                    <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">Comped</Badge>
                  ) : (
                    <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">Paid</Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm">{p.books?.recipient_name || p.book_id.slice(0, 8)}</TableCell>
                <TableCell className="text-sm">{p.is_comp ? '$0.00' : `$${(p.amount_paid_cents / 100).toFixed(2)}`}</TableCell>
                <TableCell className="text-xs">{p.status}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{p.comp_reason || '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  {p.is_comp && p.status === 'active' ? (
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => revokeBook(p.book_id)}>Revoke</Button>
                  ) : p.is_comp && p.status !== 'active' ? (
                    <Button size="sm" variant="ghost" onClick={() => regrantBook(p.book_id)}>Reactivate</Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default CompsManager;
