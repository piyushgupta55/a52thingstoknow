import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { EMAIL_VERIFICATION_REQUIRED } from '@/lib/authGate';
import VerifyEmailGate from '@/components/VerifyEmailGate';

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 text-center text-muted-foreground">
        Loading your writing dashboard...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // Email verification gate — dormant unless EMAIL_VERIFICATION_REQUIRED is true.
  if (EMAIL_VERIFICATION_REQUIRED && !user.email_confirmed_at) {
    return <VerifyEmailGate />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
