import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import Navbar from '@/components/Navbar';
import { ArrowLeft, FileUp, X, Save, FileText } from 'lucide-react';
import { countWords } from '@/lib/page2Status';

const MAX_WORDS = 300;
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

const AncestrySection = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [recipientName, setRecipientName] = useState('');
  const [content, setContent] = useState('');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFilename, setPdfFilename] = useState<string | null>(null);
  const [uploadMimeType, setUploadMimeType] = useState<string | null>(null);
  const [ancestryId, setAncestryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!bookId) return;
    (async () => {
      const [{ data: bookData }, { data: ancestryData }] = await Promise.all([
        supabase.from('books').select('recipient_name').eq('id', bookId).single(),
        supabase.from('book_ancestry').select('*').eq('book_id', bookId).maybeSingle(),
      ]);
      if (bookData) setRecipientName(bookData.recipient_name || '');
      if (ancestryData) {
        setAncestryId(ancestryData.id);
        setContent(ancestryData.content || '');
        setPdfUrl(ancestryData.pdf_url || null);
        setPdfFilename(ancestryData.pdf_filename || null);
        setUploadMimeType((ancestryData as any).upload_mime_type || null);
      }
      setLoading(false);
    })();
  }, [bookId]);

  const words = countWords(content);
  const remaining = Math.max(0, MAX_WORDS - words);
  const overLimit = words > MAX_WORDS;

  const computeStatus = (txt: string, url: string | null) => {
    const hasText = txt.trim().length > 0;
    const hasPdf = !!url;
    if (!hasText && !hasPdf) return 'not_started';
    if (hasText && countWords(txt) >= 50) return 'complete';
    if (hasPdf && !hasText) return 'complete';
    return 'in_progress';
  };

  const handleSave = async () => {
    if (!bookId || !user) return;
    if (overLimit) {
      toast({ title: 'Too long', description: `Please trim to ${MAX_WORDS} words or fewer.`, variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const status = computeStatus(content, pdfUrl);
      const payload: any = {
        book_id: bookId,
        content: content.trim() ? content : null,
        pdf_url: pdfUrl,
        pdf_filename: pdfFilename,
        upload_mime_type: pdfUrl ? uploadMimeType : null,
        status,
      };
      if (ancestryId) {
        const { error } = await supabase.from('book_ancestry').update(payload).eq('id', ancestryId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('book_ancestry').insert(payload).select().single();
        if (error) throw error;
        setAncestryId(data.id);
      }
      toast({ title: 'Saved', description: 'Your family story has been saved.' });
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !bookId) return;
    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      toast({
        title: 'Unsupported file',
        description: 'Please upload a JPEG or PNG image, or a PDF.',
        variant: 'destructive',
      });
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      toast({ title: 'File too large', description: 'Maximum file size is 10MB.', variant: 'destructive' });
      return;
    }
    const isImage = file.type.startsWith('image/');
    setUploading(true);
    try {
      const path = `${user.id}/${bookId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from('ancestry-pdfs').upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('ancestry-pdfs').getPublicUrl(path);
      setPdfUrl(pub.publicUrl);
      setPdfFilename(file.name);
      setUploadMimeType(file.type);
      toast({
        title: isImage ? 'Image uploaded' : 'PDF uploaded',
        description: isImage
          ? 'It will appear on the page. Remember to save your changes.'
          : 'It will be printed at the back of the book. Remember to save your changes.',
      });
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePdf = () => {
    setPdfUrl(null);
    setPdfFilename(null);
    setUploadMimeType(null);
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">Loading…</div>
      </div>
    );
  }

  const textPriorityNotice = content.trim().length > 0 && pdfUrl;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <button
          onClick={() => navigate(`/book/${bookId}`)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Book
        </button>

        <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-3" style={{ fontFamily: 'Georgia, serif' }}>
          Where You Come From
        </h1>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          This is your family's story — where you come from, who came before you, and the thread that connects it
          all to {recipientName || 'you'}. Write as much or as little as you want. This page belongs to your family.
          You have space for approximately 300 words, and you can add an image — a family tree, a scanned photo or
          document — that appears right on the page beside your words.
        </p>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-heading text-lg font-semibold text-foreground">Option 1 — Write it</h2>
            <span className={`text-xs tabular-nums ${overLimit ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
              {words} / {MAX_WORDS} words · {remaining} remaining
            </span>
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Tell the story of your family — names, places, traditions, the people who shaped who you are…"
            className="min-h-[280px] text-base leading-relaxed"
            style={{ fontFamily: 'Georgia, serif' }}
          />
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm mb-6">
          <h2 className="font-heading text-lg font-semibold text-foreground mb-1">Option 2 — Upload a page</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Upload a JPEG or PNG — a family tree, a scanned photo or document — and it appears on the page itself,
            with your writing alongside it. A PDF is accepted too, but it is printed at the back of the book rather
            than on this page.
          </p>

          {pdfUrl ? (
            <div className="flex items-center justify-between gap-3 p-3 border border-border rounded-md bg-muted/30">
              <div className="flex items-center gap-2 min-w-0">
                {isImageUpload ? (
                  <ImageIcon className="h-4 w-4 text-primary flex-shrink-0" />
                ) : (
                  <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                )}
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-foreground hover:underline truncate"
                >
                  {pdfFilename || (isImageUpload ? 'Uploaded image' : 'Uploaded PDF')}
                </a>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  Replace
                </Button>
                <button
                  onClick={handleRemovePdf}
                  aria-label="Remove upload"
                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-2">
              <FileUp className="h-4 w-4" />
              {uploading ? 'Uploading…' : 'Upload an image or PDF'}
            </Button>
          )}
          {pdfUrl && (
            <p className="text-xs text-muted-foreground mt-2 italic">
              {isImageUpload
                ? 'This image appears on the "Where You Come From" page.'
                : 'This PDF is printed at the back of the book, not on this page.'}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-2">JPEG, PNG or PDF · Max 10MB</p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            className="hidden"
            onChange={handleUpload}
          />
        </div>

        {textPriorityNotice && (
          <p className="text-xs text-muted-foreground italic mb-4">
            Note: your written text appears on the page. The attached PDF is printed at the back of the book.
          </p>
        )}

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving || overLimit} size="lg" className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AncestrySection;
