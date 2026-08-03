import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Loader2, MailCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const VerifyEmailGate = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [sending, setSending] = useState(false);

  // The confirmation link may be opened on another device. Poll so this
  // device notices the account is verified and moves forward on its own.
  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const { data } = await supabase.auth.refreshSession();
      if (cancelled) return;
      if (data?.session?.user?.email_confirmed_at) {
        window.location.reload();
      }
    };

    const id = window.setInterval(check, 5000);
    const onFocus = () => check();
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, []);


  const resend = async () => {
    if (!user?.email) return;
    setSending(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: user.email });
      if (error) throw error;
      toast({ title: 'Sent', description: 'Check your inbox for the verification link.' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-card border rounded-xl p-8 shadow-sm text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <MailCheck className="h-6 w-6 text-primary" />
        </div>
        <h1 className="font-serif text-2xl font-bold mb-2">Verify your email</h1>
        <p className="text-muted-foreground text-sm mb-6">
          We sent a confirmation link to <strong className="text-foreground">{user?.email}</strong>.
          Click it to unlock your dashboard and start writing.
        </p>
        <div className="flex flex-col gap-2">
          <Button onClick={resend} disabled={sending} className="w-full">
            {sending ? 'Sending…' : 'Resend verification email'}
          </Button>
          <Button variant="ghost" onClick={() => signOut()} className="w-full">
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailGate;
