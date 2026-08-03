import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Supabase parses the recovery token from the URL hash and fires
    // PASSWORD_RECOVERY. We just need to wait for a session before letting
    // the user submit.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: 'Password too short', description: 'Use at least 6 characters.', variant: 'destructive' });
      return;
    }
    if (password !== confirm) {
      toast({ title: 'Passwords do not match', description: 'Please retype your new password.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: 'Password updated', description: 'You are now logged in.' });
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      toast({ title: 'Could not update password', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 font-heading text-xl font-bold text-primary mb-2">
            <BookOpen className="h-6 w-6" />
            52 Things to Know
          </Link>
          <h1 className="font-heading text-2xl font-bold text-foreground">Set a new password</h1>
          <p className="text-muted-foreground mt-1">Choose something you'll remember.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border p-8 shadow-sm space-y-5">
          <div>
            <Label htmlFor="password">New password</Label>
            <PasswordInput id="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" required minLength={6} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="confirm">Confirm new password</Label>
            <PasswordInput id="confirm" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Retype your password" required minLength={6} className="mt-1" />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={loading || !ready}>
            {loading ? 'Updating…' : ready ? 'Update password' : 'Verifying link…'}
          </Button>
          {!ready && (
            <p className="text-xs text-muted-foreground text-center">
              If this page doesn't load, open the reset link from your email again.
            </p>
          )}
        </form>

        <p className="text-center text-sm mt-6">
          <Link to="/login" className="text-primary font-medium hover:underline">← Back to log in</Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;
