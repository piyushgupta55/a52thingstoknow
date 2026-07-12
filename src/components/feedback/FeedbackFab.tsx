import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquareWarning } from 'lucide-react';
import FeedbackDialog from './FeedbackDialog';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Floating feedback button anchored to bottom-right on every logged-in screen.
 */
export default function FeedbackFab() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="sm"
        className="fixed bottom-4 right-4 z-40 shadow-lg gap-1.5"
        variant="secondary"
      >
        <MessageSquareWarning className="h-4 w-4" />
        <span className="hidden sm:inline">Feedback</span>
      </Button>
      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
