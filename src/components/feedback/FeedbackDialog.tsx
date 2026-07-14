import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Camera, Upload, X, Loader2, Minus, MessageSquareWarning } from 'lucide-react';
import { captureScreen } from '@/lib/screenCapture';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional file to prefill (e.g. auto-captured before opening). */
  initialFile?: File | null;
}

type IssueType = 'bug' | 'question' | 'suggestion';

const MAX_ATTACHMENTS = 5;

interface Attachment {
  id: string;
  file: File;
  preview: string;
}

function makeAttachment(file: File): Attachment {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    preview: URL.createObjectURL(file),
  };
}

export default function FeedbackDialog({ open, onOpenChange, initialFile }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [issueType, setIssueType] = useState<IssueType>('bug');
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const consumedInitialRef = useRef<File | null>(null);

  // Reset state only when the dialog fully closes (not on minimize).
  useEffect(() => {
    if (!open) {
      setIssueType('bug');
      setMessage('');
      setAttachments((prev) => {
        prev.forEach((a) => URL.revokeObjectURL(a.preview));
        return [];
      });
      setMinimized(false);
      consumedInitialRef.current = null;
    }
  }, [open]);

  // Absorb an auto-captured file when the dialog opens.
  useEffect(() => {
    if (open && initialFile && consumedInitialRef.current !== initialFile) {
      consumedInitialRef.current = initialFile;
      addFiles([initialFile]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialFile]);

  const addFiles = (files: File[]) => {
    if (!files.length) return;
    setAttachments((prev) => {
      const room = MAX_ATTACHMENTS - prev.length;
      if (room <= 0) {
        toast({
          title: `Up to ${MAX_ATTACHMENTS} screenshots`,
          description: 'Remove one to add another.',
        });
        return prev;
      }
      const accepted = files.slice(0, room).map(makeAttachment);
      if (files.length > room) {
        toast({
          title: 'Some files skipped',
          description: `Only ${MAX_ATTACHMENTS} screenshots can be attached.`,
        });
      }
      return [...prev, ...accepted];
    });
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((a) => a.id !== id);
    });
  };

  const doCapture = async () => {
    setCapturing(true);
    try {
      const file = await captureScreen();
      if (file) {
        addFiles([file]);
        toast({ title: 'Screen captured', description: 'Added to your feedback.' });
        // If we were minimized, bring the box back so the user sees the result.
        setMinimized(false);
      }
    } catch (err) {
      console.error('capture failed', err);
      toast({
        title: 'Capture failed',
        description: 'Try uploading a screenshot instead.',
        variant: 'destructive',
      });
    } finally {
      setCapturing(false);
    }
  };

  const submit = async () => {
    if (!user) return;
    if (!message.trim()) {
      toast({ title: 'Please describe the issue', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const uploadedPaths: string[] = [];
      for (const att of attachments) {
        const ext = att.file.name.split('.').pop() || 'png';
        const path = `${user.id}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('feedback-screenshots')
          .upload(path, att.file, { contentType: att.file.type });
        if (upErr) throw upErr;
        uploadedPaths.push(path);
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, email')
        .eq('user_id', user.id)
        .maybeSingle();

      const { data: inserted, error: insErr } = await supabase
        .from('feedback')
        .insert({
          user_id: user.id,
          user_name: profile?.display_name || user.email,
          user_email: profile?.email || user.email,
          issue_type: issueType,
          message: message.trim(),
          page_url: window.location.href,
          screenshot_url: uploadedPaths[0] || null,
          screenshot_urls: uploadedPaths,
        })
        .select('id')
        .single();
      if (insErr) throw insErr;

      supabase.functions
        .invoke('send-feedback-notification', { body: { feedback_id: inserted.id } })
        .catch((e) => console.warn('notification failed', e));

      toast({ title: 'Thanks!', description: 'Your feedback was sent.' });
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Could not submit',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Minimized floating bar — kept mounted so state (type/message/attachments) survives.
  const minimizedBar = open && minimized && (
    <div
      data-feedback-ui
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-card border shadow-lg pl-3 pr-1 py-1"
    >
      <MessageSquareWarning className="h-4 w-4 text-primary" />
      <span className="text-sm text-muted-foreground hidden sm:inline">
        Feedback paused — scroll to the spot, then
      </span>
      <Button size="sm" onClick={doCapture} disabled={capturing} className="gap-1.5">
        {capturing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Camera className="h-4 w-4" />
        )}
        Capture screen
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setMinimized(false)}
        className="rounded-full"
      >
        Reopen
      </Button>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => onOpenChange(false)}
        className="rounded-full h-8 w-8"
        aria-label="Close feedback"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <>
      {minimizedBar}
      <Dialog
        open={open && !minimized}
        onOpenChange={(v) => {
          if (!v) onOpenChange(false);
        }}
      >
        <DialogContent data-feedback-ui className="max-w-lg" overlayClassName="bg-transparent">
          <DialogHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <DialogTitle>Report a problem or send feedback</DialogTitle>
                <DialogDescription>
                  We read every message. Screenshots help a lot.
                </DialogDescription>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 -mt-1"
                onClick={() => setMinimized(true)}
                title="Minimize to capture a specific spot"
                aria-label="Minimize"
              >
                <Minus className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={issueType} onValueChange={(v) => setIssueType(v as IssueType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">Bug — something's broken</SelectItem>
                  <SelectItem value="question">Question — I need help</SelectItem>
                  <SelectItem value="suggestion">Suggestion — an idea</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what happened, what you expected, or what you'd like."
                rows={5}
                maxLength={4000}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  Screenshots{' '}
                  <span className="text-xs text-muted-foreground font-normal">
                    ({attachments.length}/{MAX_ATTACHMENTS})
                  </span>
                </Label>
                <button
                  type="button"
                  onClick={() => setMinimized(true)}
                  className="text-xs text-primary hover:underline"
                >
                  Capture a different spot →
                </button>
              </div>

              {attachments.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {attachments.map((a) => (
                    <div
                      key={a.id}
                      className="relative rounded-md border overflow-hidden bg-muted aspect-video"
                    >
                      <img
                        src={a.preview}
                        alt="attachment"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeAttachment(a.id)}
                        className="absolute top-1 right-1 h-6 w-6 rounded-full bg-background/90 border shadow-sm flex items-center justify-center hover:bg-background"
                        aria-label="Remove screenshot"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {attachments.length < MAX_ATTACHMENTS && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={doCapture}
                    disabled={capturing}
                  >
                    {capturing ? (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4 mr-1.5" />
                    )}
                    Attach screenshot of this page
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInput.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-1.5" /> Upload image
                  </Button>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      addFiles(files);
                      // reset so selecting the same file again re-fires
                      e.target.value = '';
                    }}
                  />
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              We'll include your name, email, the page URL, and time so we can follow up.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting || !message.trim()}>
              {submitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Send feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
