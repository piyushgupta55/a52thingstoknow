import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Camera, Upload, X, Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type IssueType = 'bug' | 'question' | 'suggestion';

export default function FeedbackDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [issueType, setIssueType] = useState<IssueType>('bug');
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setIssueType('bug');
      setMessage('');
      setFile(null);
      setPreview(null);
    }
  }, [open]);

  const handleFile = (f: File | null) => {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const captureScreen = async () => {
    setCapturing(true);
    try {
      // Temporarily hide the dialog for a clean capture
      const dialogEls = Array.from(document.querySelectorAll('[role="dialog"]')) as HTMLElement[];
      const overlays = Array.from(document.querySelectorAll('[data-radix-popper-content-wrapper], [data-state="open"].fixed')) as HTMLElement[];
      const toHide = [...dialogEls, ...overlays];
      const prev = toHide.map((el) => el.style.visibility);
      toHide.forEach((el) => (el.style.visibility = 'hidden'));
      await new Promise((r) => setTimeout(r, 100));

      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        logging: false,
        scale: Math.min(window.devicePixelRatio || 1, 2),
        windowWidth: document.documentElement.clientWidth,
        windowHeight: document.documentElement.clientHeight,
      });

      toHide.forEach((el, i) => (el.style.visibility = prev[i] ?? ''));

      const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/png', 0.92));
      if (blob) {
        const captured = new File([blob], `screen-${Date.now()}.png`, { type: 'image/png' });
        handleFile(captured);
        toast({ title: 'Screen captured', description: 'Attached to your feedback.' });
      }
    } catch (err: any) {
      console.error('capture failed', err);
      toast({ title: 'Capture failed', description: 'Try uploading a screenshot instead.', variant: 'destructive' });
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
      let screenshot_path: string | null = null;
      if (file) {
        const ext = file.name.split('.').pop() || 'png';
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('feedback-screenshots')
          .upload(path, file, { contentType: file.type });
        if (upErr) throw upErr;
        screenshot_path = path;
      }

      // Get profile for name
      const { data: profile } = await supabase
        .from('profiles').select('display_name, email').eq('user_id', user.id).maybeSingle();

      const { data: inserted, error: insErr } = await supabase
        .from('feedback')
        .insert({
          user_id: user.id,
          user_name: profile?.display_name || user.email,
          user_email: profile?.email || user.email,
          issue_type: issueType,
          message: message.trim(),
          page_url: window.location.href,
          screenshot_url: screenshot_path,
        })
        .select('id')
        .single();
      if (insErr) throw insErr;

      // Send email notification (best-effort)
      supabase.functions
        .invoke('send-feedback-notification', { body: { feedback_id: inserted.id } })
        .catch((e) => console.warn('notification failed', e));

      toast({ title: 'Thanks!', description: 'Your feedback was sent.' });
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Could not submit', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Report a problem or send feedback</DialogTitle>
          <DialogDescription>
            We read every message. A screenshot helps a lot.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={issueType} onValueChange={(v) => setIssueType(v as IssueType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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

          <div className="space-y-1.5">
            <Label>Screenshot</Label>
            {preview ? (
              <div className="relative rounded-md border overflow-hidden">
                <img src={preview} alt="attachment preview" className="max-h-56 w-full object-contain bg-muted" />
                <Button
                  type="button" size="icon" variant="secondary"
                  className="absolute top-2 right-2 h-7 w-7"
                  onClick={() => handleFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={captureScreen} disabled={capturing}>
                  {capturing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Camera className="h-4 w-4 mr-1.5" />}
                  Capture this screen
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                  <Upload className="h-4 w-4 mr-1.5" /> Upload image
                </Button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0] || null)}
                />
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            We'll include your name, email, the page URL, and time so we can follow up.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || !message.trim()}>
            {submitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Send feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
