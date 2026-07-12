import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquareWarning, Loader2 } from 'lucide-react';
import FeedbackDialog from './FeedbackDialog';
import { useAuth } from '@/contexts/AuthContext';
import { captureScreen } from '@/lib/screenCapture';

/**
 * Floating feedback button anchored to bottom-right on every logged-in screen.
 * Auto-captures the current page BEFORE opening the dialog so the screenshot
 * shows the page, not the feedback form.
 */
export default function FeedbackFab() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [initialFile, setInitialFile] = useState<File | null>(null);
  const [capturing, setCapturing] = useState(false);

  if (!user) return null;

  const handleClick = async () => {
    setCapturing(true);
    try {
      const file = await captureScreen();
      setInitialFile(file);
    } catch (e) {
      console.warn('auto-capture failed', e);
      setInitialFile(null);
    } finally {
      setCapturing(false);
      setOpen(true);
    }
  };

  return (
    <>
      <Button
        data-feedback-ui
        onClick={handleClick}
        disabled={capturing}
        size="sm"
        className="fixed bottom-4 right-4 z-40 shadow-lg gap-1.5"
        variant="secondary"
      >
        {capturing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MessageSquareWarning className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">Feedback</span>
      </Button>
      <FeedbackDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setInitialFile(null);
        }}
        initialFile={initialFile}
      />
    </>
  );
}
