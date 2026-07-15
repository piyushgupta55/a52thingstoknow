import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const destination = (location.state as { from?: string } | null)?.from || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      navigate(destination, { replace: true });
    } catch (err: any) {
      const message = (err?.message || '').toLowerCase();
      const isUnconfirmed = message.includes('email not confirmed');
      const isInvalidCreds = message.includes('invalid login credentials') || message.includes('invalid_credentials');
      const isNetwork = message.includes('failed to fetch') || message.includes('networkerror');

      let title = 'Login failed';
      let description = err?.message || 'Something went wrong. Please try again.';

      if (isUnconfirmed) {
        title = 'Confirm your email first';
        description = 'Open the confirmation email, then log in again to access your dashboard.';
      } else if (isInvalidCreds) {
        title = 'Wrong email or password';
        description = 'Double-check your email and password, then try again.';
      } else if (isNetwork) {
        title = 'Connection problem';
        description = 'We could not reach the server. Check your internet connection and try again.';
      }

      toast({ title, description, variant: 'destructive' });
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
          <h1 className="font-heading text-2xl font-bold text-foreground">Welcome Back</h1>
          <p className="text-muted-foreground mt-1">Continue writing wisdom</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border p-8 shadow-sm space-y-5">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" required className="mt-1" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" required className="mt-1" />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? 'Logging in...' : 'Log In'}
          </Button>
          <p className="text-center text-sm">
            <Link to="/forgot-password" className="text-primary font-medium hover:underline">
              Forgot password?
            </Link>
          </p>
        </form>



        <p className="text-center text-sm text-muted-foreground mt-6">
          Don't have an account? <Link to="/register" className="text-primary font-medium hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
