import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ShieldAlert } from 'lucide-react';

const AdminSetup = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'idle' | 'checking' | 'granting' | 'done' | 'blocked'>('idle');
  const [message, setMessage] = useState('');

  const handleSetup = async () => {
    if (!user) return;
    setStatus('checking');

    // Check if any admin already exists
    const { count, error: countError } = await supabase
      .from('user_roles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'admin');

    if (countError) {
      setMessage('Error checking admin status.');
      setStatus('blocked');
      return;
    }

    if ((count ?? 0) > 0) {
      setMessage('An admin already exists. This setup route is disabled.');
      setStatus('blocked');
      return;
    }

    setStatus('granting');
    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: user.id, role: 'admin' });

    if (error) {
      setMessage('Failed to grant admin role: ' + error.message);
      setStatus('blocked');
      return;
    }

    setMessage('Admin role granted! Redirecting...');
    setStatus('done');
    setTimeout(() => navigate('/admin'), 1500);
  };

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Please log in first.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {status === 'done' ? (
          <ShieldCheck className="mx-auto h-12 w-12 text-green-500" />
        ) : status === 'blocked' ? (
          <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
        ) : (
          <ShieldCheck className="mx-auto h-12 w-12 text-muted-foreground" />
        )}
        <h1 className="text-2xl font-bold text-foreground">Admin Bootstrap</h1>
        <p className="text-muted-foreground text-sm">
          This page grants admin access to the first user. It disables itself once an admin exists.
        </p>
        {message && (
          <p className={`text-sm font-medium ${status === 'blocked' ? 'text-destructive' : 'text-green-600'}`}>
            {message}
          </p>
        )}
        {(status === 'idle' || status === 'checking') && (
          <Button onClick={handleSetup} disabled={status === 'checking'} size="lg">
            {status === 'checking' ? 'Checking...' : 'Grant Me Admin'}
          </Button>
        )}
      </div>
    </div>
  );
};

export default AdminSetup;
