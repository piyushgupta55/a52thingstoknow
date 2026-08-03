import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { BookOpen, Loader2, MailCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Register = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const { signUp, signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const pollingRef = useRef(false);

  // Cross-device confirmation: the user may click the email link on another
  // device. Keep checking here so this device isn't stranded.
  useEffect(() => {
    if (!confirmationSent) return;
    let cancelled = false;

    const check = async () => {
      if (pollingRef.current) return;
      pollingRef.current = true;
      try {
        await signIn(email, password);
        if (!cancelled) {
          toast({ title: 'Email confirmed!', description: 'Taking you to your dashboard.' });
          navigate('/dashboard', { replace: true });
        }
      } catch {
        // still unconfirmed — keep waiting
      } finally {
        pollingRef.current = false;
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
  }, [confirmationSent, email, password, signIn, navigate, toast]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { needsEmailConfirmation } = await signUp(email, password, fullName);

      if (needsEmailConfirmation) {
        setConfirmationSent(true);
      } else {
        toast({ title: 'Account created!', description: 'Your dashboard is ready.' });
        navigate('/dashboard', { replace: true });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (confirmationSent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg">
          <div className="bg-card rounded-2xl border border-border p-10 shadow-md text-center">
            <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <MailCheck className="h-10 w-10 text-primary" />
            </div>
            <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
              Check your email
            </h1>
            <p className="text-lg text-foreground mb-3">
              We just sent a confirmation link to<br />
              <strong className="text-primary">{email}</strong>
            </p>
            <p className="text-base text-muted-foreground mb-2">
              Click the link in that email to confirm your account. You'll be signed in automatically — no need to log in again.
            </p>
            <p className="text-base text-muted-foreground mb-8">
              <strong>Don't see it?</strong> Please check your <strong>spam</strong> or <strong>junk</strong> folder. It can take a minute to arrive.
            </p>
            <div className="flex flex-col gap-2">
              <Link to="/login">
                <Button variant="outline" className="w-full" size="lg">
                  Back to log in
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }



  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 font-heading text-xl font-bold text-primary mb-2">
            <BookOpen className="h-6 w-6" />
            52 Things to Know
          </Link>
          <h1 className="font-heading text-2xl font-bold text-foreground">Create Your Account</h1>
          <p className="text-muted-foreground mt-1">Start writing wisdom for your graduate</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border p-8 shadow-sm space-y-5">
          <div>
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name" required className="mt-1" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" required className="mt-1" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" required minLength={6} className="mt-1" />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? 'Creating Account...' : 'Get Started'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account? <Link to="/login" className="text-primary font-medium hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
