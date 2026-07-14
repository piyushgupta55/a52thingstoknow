import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { BookOpen, HelpCircle, Menu, X, MessageSquareWarning, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { openFeedback } from '@/components/feedback/FeedbackFab';
import { useIsAdmin } from '@/hooks/useIsAdmin';

const Navbar = () => {
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        <Link to="/" className="flex items-center gap-2 font-heading text-lg font-bold text-primary">
          <BookOpen className="h-6 w-6" />
          52 Things to Know
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <Button variant="ghost" onClick={() => navigate('/dashboard')}>My Books</Button>
              <Button variant="ghost" onClick={openFeedback}><MessageSquareWarning className="h-4 w-4 mr-1.5" />Feedback</Button>
              <Button variant="ghost" onClick={() => navigate('/help')}><HelpCircle className="h-4 w-4 mr-1.5" />Help</Button>
              {isAdmin && (
                <Button variant="ghost" onClick={() => navigate('/admin')}><ShieldCheck className="h-4 w-4 mr-1.5" />Admin</Button>
              )}
              <Button variant="outline" onClick={() => { signOut(); navigate('/'); }}>Log Out</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => navigate('/login')}>Login</Button>
              <Button onClick={() => navigate('/register')}>Get Started</Button>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-card px-4 py-4 flex flex-col gap-2">
          {user ? (
            <>
              <Button variant="ghost" className="justify-start" onClick={() => { navigate('/dashboard'); setMobileOpen(false); }}>My Books</Button>
              <Button variant="ghost" className="justify-start" onClick={() => { setMobileOpen(false); openFeedback(); }}><MessageSquareWarning className="h-4 w-4 mr-1.5" />Feedback</Button>
              <Button variant="ghost" className="justify-start" onClick={() => { navigate('/help'); setMobileOpen(false); }}><HelpCircle className="h-4 w-4 mr-1.5" />Help</Button>
              {isAdmin && (
                <Button variant="ghost" className="justify-start" onClick={() => { navigate('/admin'); setMobileOpen(false); }}><ShieldCheck className="h-4 w-4 mr-1.5" />Admin</Button>
              )}
              <Button variant="outline" className="justify-start" onClick={() => { signOut(); navigate('/'); setMobileOpen(false); }}>Log Out</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" className="justify-start" onClick={() => { navigate('/login'); setMobileOpen(false); }}>Login</Button>
              <Button className="justify-start" onClick={() => { navigate('/register'); setMobileOpen(false); }}>Get Started</Button>
            </>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
