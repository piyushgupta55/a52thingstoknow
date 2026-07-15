import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { EmailOtpType } from '@supabase/supabase-js';
import { BookOpen, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

const allowedTypes = new Set(['signup', 'recovery', 'magiclink', 'invite', 'email_change']);

const AuthConfirm = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Confirming your email…');

  const nextPath = useMemo(() => {
    const requested = searchParams.get('next') || '/dashboard';
    return requested.startsWith('/') ? requested : '/dashboard';
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    const confirmEmail = async () => {
      const tokenHash = searchParams.get('token_hash');
      const type = searchParams.get('type');

      if (!tokenHash || !type || !allowedTypes.has(type)) {
        setStatus('error');
        setMessage('This confirmation link is missing required information. Please request a new email and try again.');
        return;
      }

      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as EmailOtpType,
      });

      if (cancelled) return;

      if (error) {
        setStatus('error');
        setMessage(error.message || 'This confirmation link is invalid or has expired.');
        return;
      }

      setStatus('success');
      setMessage(type === 'recovery' ? 'Password reset verified.' : 'Email confirmed. Taking you to your account…');

      window.setTimeout(() => {
        navigate(type === 'recovery' ? '/reset-password' : nextPath, { replace: true });
      }, 900);
    };

    confirmEmail();

    return () => {
      cancelled = true;
    };
  }, [navigate, nextPath, searchParams]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <Link to="/" className="inline-flex items-center gap-2 font-heading text-xl font-bold text-primary mb-8">
          <BookOpen className="h-6 w-6" />
          52 Things to Know
        </Link>

        <div className="bg-card rounded-xl border border-border p-8 shadow-sm">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-5">
            {status === 'loading' && <Loader2 className="h-8 w-8 text-primary animate-spin" />}
            {status === 'success' && <CheckCircle2 className="h-8 w-8 text-primary" />}
            {status === 'error' && <XCircle className="h-8 w-8 text-destructive" />}
          </div>

          <h1 className="font-heading text-2xl font-bold text-foreground mb-2">
            {status === 'loading' && 'Confirming your email'}
            {status === 'success' && 'You’re all set'}
            {status === 'error' && 'Link problem'}
          </h1>
          <p className="text-muted-foreground mb-6">{message}</p>

          {status === 'error' && (
            <div className="space-y-3">
              <Link to="/forgot-password">
                <Button className="w-full">Request a new link</Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" className="w-full">Back to log in</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthConfirm;