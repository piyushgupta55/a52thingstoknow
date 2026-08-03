import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

// app.52thingstoknow.com is the app, not a storefront — the marketing site
// (52thingstoknow.com) does the selling. Logged-out visitors go straight to
// log in; signed-in users go to their dashboard.
const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 text-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  return <Navigate to={user ? '/dashboard' : '/login'} replace />;
};

export default Index;
