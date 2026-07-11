import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Users, Send, Copy, Loader2, Mail, CheckCircle2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Props {
  bookId: string;
  recipientName: string;
  inviteUrl: string | null;
  onFallbackNeeded: () => void;
  generatingFallback: boolean;
}

interface Invitee {
  id: string;
  name: string;
  email: string;
  sent_at: string;
  last_sent_at: string;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const InviteFamilyForm = ({ bookId, recipientName, inviteUrl, onFallbackNeeded, generatingFallback }: Props) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [invitees, setInvitees] = useState<Invitee[]>([]);
  const [responderEmails, setResponderEmails] = useState<Set<string>>(new Set());

  const load = async () => {
    const [{ data: inv }, { data: mem }] = await Promise.all([
      supabase.from('memory_invitees').select('*').eq('book_id', bookId).order('last_sent_at', { ascending: false }),
      supabase.from('memories').select('contributor_email').eq('book_id', bookId).eq('contributor_type', 'family'),
    ]);
    setInvitees(inv || []);
    const emails = new Set<string>();
    (mem || []).forEach((m: any) => { if (m.contributor_email) emails.add(m.contributor_email.toLowerCase()); });
    setResponderEmails(emails);
  };

  useEffect(() => { load(); }, [bookId]);

  const canSend = name.trim().length > 0 && emailRegex.test(email.trim()) && !sending;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke('send-family-invite', {
      body: {
        book_id: bookId,
        name: name.trim(),
        email: email.trim(),
        app_origin: window.location.origin,
      },
    });
    setSending(false);
    if (error || (data as any)?.error) {
      const msg = (data as any)?.details || (data as any)?.error || error?.message || 'Send failed';
      toast({ title: 'Could not send invite', description: String(msg).slice(0, 200), variant: 'destructive' });
      return;
    }
    toast({ title: 'Invite sent', description: `${name.trim()} will get an email shortly.` });
    setName(''); setEmail('');
    load();
  };

  const responded = invitees.filter(i => responderEmails.has(i.email.toLowerCase())).length;

  return (
    <div className="bg-card border border-border rounded-xl p-5 mb-8 shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <Users className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="font-heading font-semibold text-foreground">Invite family to share memories</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Send anyone who knows {recipientName} a warm, personalized invitation. Their submissions will arrive here for your approval.
          </p>
        </div>
      </div>

      <form onSubmit={handleSend} className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="inv-name" className="text-xs uppercase tracking-wider text-muted-foreground">Name</Label>
          <Input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Grandpa" className="mt-1" maxLength={80} />
        </div>
        <div>
          <Label htmlFor="inv-email" className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
          <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="grandpa@example.com" className="mt-1" maxLength={200} />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={!canSend} size="sm">
            {sending ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Sending…</> : <><Send className="h-3.5 w-3.5 mr-1.5" /> Send invite</>}
          </Button>
        </div>
      </form>

      {invitees.length > 0 && (
        <div className="mt-5 pt-5 border-t border-border/60">
          <div className="flex items-center gap-3 mb-3 text-xs text-muted-foreground">
            <span><span className="font-semibold text-foreground">Sent:</span> {invitees.length}</span>
            <span>·</span>
            <span><span className="font-semibold text-foreground">Responded:</span> {responded}</span>
          </div>
          <div className="space-y-1.5">
            {invitees.map(i => {
              const has = responderEmails.has(i.email.toLowerCase());
              return (
                <div key={i.id} className="flex items-center justify-between text-sm py-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" />
                    <span className="font-medium text-foreground truncate">{i.name}</span>
                    <span className="text-muted-foreground/70 truncate">{i.email}</span>
                  </div>
                  {has ? (
                    <Badge variant="secondary" className="text-[0.65rem] flex-shrink-0"><CheckCircle2 className="h-3 w-3 mr-1" />Responded</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[0.65rem] flex-shrink-0">Sent</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <details className="mt-5 pt-4 border-t border-border/60">
        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Or copy a shareable link</summary>
        <div className="mt-3">
          {inviteUrl ? (
            <div className="flex flex-wrap items-center gap-2">
              <code className="flex-1 min-w-0 text-xs bg-muted px-3 py-2 rounded-md truncate">{inviteUrl}</code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { navigator.clipboard?.writeText(inviteUrl); toast({ title: 'Link copied' }); }}
              >
                <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={onFallbackNeeded} disabled={generatingFallback}>
              {generatingFallback ? 'Creating…' : 'Generate shareable link'}
            </Button>
          )}
        </div>
      </details>
    </div>
  );
};
