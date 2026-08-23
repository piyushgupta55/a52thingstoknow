import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import Navbar from '@/components/Navbar';
import { ArrowLeft } from 'lucide-react';
import { RELATIONSHIP_OPTIONS, impliedBookGender, toBookGender } from '@/lib/genderMap';

const BookSettings = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [recipientName, setRecipientName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [gender, setGender] = useState('');
  const [occasion, setOccasion] = useState('');
  const [milestoneDate, setMilestoneDate] = useState('');
  const [writingTone, setWritingTone] = useState('Warm and Conversational');
  const [fromLabel, setFromLabel] = useState('');
  const [authorLabel, setAuthorLabel] = useState('');

  useEffect(() => {
    if (!bookId) return;
    (async () => {
      const { data, error } = await supabase.from('books').select('*').eq('id', bookId).single();
      if (error || !data) {
        toast({ title: 'Could not load book', description: error?.message, variant: 'destructive' });
        setLoading(false);
        return;
      }
      setRecipientName(data.recipient_name || '');
      setRelationship(data.relationship || '');
      setGender(data.recipient_gender || '');
      setOccasion(data.occasion || '');
      setMilestoneDate(data.milestone_date || '');
      setWritingTone(data.writing_tone || 'Warm and Conversational');
      setFromLabel(data.from_label || '');
      setAuthorLabel(data.author_label || '');
      setLoading(false);
    })();
  }, [bookId, toast]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookId || saving) return;
    setSaving(true);
    try {
      const capitalizedName = recipientName.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

      const { error: updateErr } = await supabase.from('books').update({
        recipient_name: capitalizedName,
        relationship,
        occasion,
        milestone_date: milestoneDate || null,
        writing_tone: writingTone,
        from_label: fromLabel.trim() || null,
        author_label: authorLabel.trim() || null,
      }).eq('id', bookId);
      if (updateErr) throw updateErr;

      toast({ title: 'Book settings saved' });
      navigate(`/book/${bookId}`);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Gender is locked after creation, so only offer relationships that agree
  // with the book version already built.
  const lockedGender = toBookGender(gender);
  const relationshipChoices = RELATIONSHIP_OPTIONS.filter(r => {
    const implied = impliedBookGender(r);
    return implied === null || implied === lockedGender;
  });
  // Keep whatever the book already stores selectable, even if it predates this list.
  const allChoices = relationship && !relationshipChoices.includes(relationship as never)
    ? [relationship, ...relationshipChoices]
    : relationshipChoices;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-10 max-w-xl">
        <button
          onClick={() => navigate(`/book/${bookId}`)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Back to book
        </button>
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-2">Book Settings</h1>
        <p className="text-muted-foreground mb-8">Update any of the details you set when you started this book.</p>

        <form onSubmit={handleSave} className="bg-card rounded-xl border border-border p-8 shadow-sm space-y-5">
          <div>
            <Label htmlFor="recipientName">Recipient's First Name</Label>
            <Input id="recipientName" value={recipientName} onChange={e => setRecipientName(e.target.value)} required className="mt-1" />
          </div>

          <div>
            <Label>Your Relationship</Label>
            <Select value={relationship} onValueChange={setRelationship} required>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select relationship" /></SelectTrigger>
              <SelectContent>
                {allChoices.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Recipient's Gender</Label>
            <div className="mt-1 flex items-center h-10 px-3 rounded-md border border-input bg-muted/40 text-sm text-muted-foreground">
              {gender || '—'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Gender is locked once a book is created. To change this, start a new book.
            </p>
          </div>

          <div>
            <Label>Occasion</Label>
            <Select value={occasion} onValueChange={setOccasion} required>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select occasion" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="High School Graduation">High School Graduation</SelectItem>
                <SelectItem value="18th Birthday">18th Birthday</SelectItem>
                <SelectItem value="Other Milestone">Other Milestone</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="milestoneDate">Expected Date (optional)</Label>
            <Input id="milestoneDate" type="date" value={milestoneDate} onChange={e => setMilestoneDate(e.target.value)} className="mt-1" />
          </div>

          <div>
            <Label htmlFor="authorLabel">How should {recipientName || 'the recipient'} refer to you?</Label>
            <Input id="authorLabel" value={authorLabel} onChange={e => setAuthorLabel(e.target.value)} placeholder="e.g. Mom, Dad, Grandpa, Uncle Joe" className="mt-1" />
            <p className="text-xs text-muted-foreground mt-1">Used in personalized text throughout the book</p>
          </div>

          <div>
            <Label htmlFor="fromLabel">From (shown on book cover)</Label>
            <Input id="fromLabel" value={fromLabel} onChange={e => setFromLabel(e.target.value)} placeholder="e.g. Mom and Dad, Your Father, Grandma" className="mt-1" />
            <p className="text-xs text-muted-foreground mt-1">Leave blank to use your account name</p>
          </div>

          <div>
            <Label>Writing Tone for AI Assistance</Label>
            <Select value={writingTone} onValueChange={setWritingTone}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['Warm and Conversational', 'Formal and Thoughtful', 'Warm and Humorous', 'Poetic and Reflective'].map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => navigate(`/book/${bookId}`)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" size="lg" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BookSettings;
