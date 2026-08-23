import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toBookGender, impliedBookGender, GENDER_LABELS, RELATIONSHIP_OPTIONS, type BookGender } from '@/lib/genderMap';
import { replaceTokens } from '@/lib/tokenReplacer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import Navbar from '@/components/Navbar';

const NewBook = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [recipientName, setRecipientName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [gender, setGender] = useState('');
  const [occasion, setOccasion] = useState('');
  const [milestoneDate, setMilestoneDate] = useState('');
  const [writingTone, setWritingTone] = useState('Warm and Conversational');
  const [fromLabel, setFromLabel] = useState('');
  const [authorLabel, setAuthorLabel] = useState('');

  const impliedGender = impliedBookGender(relationship);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || loading) return;
    setLoading(true);

    try {
      // The relationship decides the book version whenever it implies one, so
      // the two fields can never disagree. Otherwise the author picked it.
      const bookGender: BookGender = impliedBookGender(relationship) ?? toBookGender(gender);
      const genderLabel = GENDER_LABELS[bookGender];
      const capitalizedRecipientName = recipientName.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');


      // Fetch chapter templates (single reference_content column, keyed by gender)
      const { data: templates, error: tplError } = await supabase
        .from('chapter_templates')
        .select('chapter_number, title, template_key, is_photo_chapter, reference_content, bible_verse_text, bible_verse_reference, quote_text, quote_attribution')
        .eq('gender', bookGender)
        .order('chapter_number');


      if (tplError) throw tplError;

      const { data: book, error: bookError } = await supabase
        .from('books')
        .insert({
          user_id: user.id,
          recipient_name: capitalizedRecipientName,
          relationship,
          recipient_gender: genderLabel,
          gender: bookGender,
          occasion,
          milestone_date: milestoneDate || null,
          writing_tone: writingTone,
          from_label: fromLabel.trim() || null,
          author_label: authorLabel.trim() || null,
        })
        .select()
        .single();

      if (bookError) throw bookError;

      // Create the Letter from the Author chapter (chapter_number = 0)
      const authorName = user.user_metadata?.full_name || 'the author';
      const letterBodyText = `There's so much I want to tell you, and somehow life never quite gives us the time to slow down and say it. So here it is — 52 things I want you to carry with you as you grow into the person you're becoming.\n\nSome of this wisdom comes from getting it right. A lot of it comes from getting it wrong — mine and other people's. One of the humbling things about being a parent is realizing how many lessons I learned the hard way, and how much I'd love to spare you that. So I'll use myself as the example, good and bad.\n\nNot all of it is serious. Some of it may not even interest you at first. Be patient with me, and read each one carefully — 52 is a big number. This might end up being more fun for me than it is for you, but I hope you'll enjoy it too.\n\nYou are special, and I am your biggest fan.`;
      const letterContentText = `Dear ${capitalizedRecipientName},\n\n${letterBodyText}`;

      const letterChapter = {
        book_id: book.id,
        chapter_number: 0,
        title: 'Letter from the Author',
        template_key: 'opening-letter',
        reference_text: null,
        chapter_template: 'letter',
        is_photo_chapter: false,
        photo_urls: [],
        photo_layout: 'top',
        content: letterContentText,
        seed_content: letterContentText,
        bible_verse_text: null,
        bible_verse_reference: null,
        quote_text: null,
        quote_attribution: null,
        verse_id: null,
        quote_id: null,
      };

      // Personalization context for seeding chapter content
      const tokenCtx = {
        recipientName: capitalizedRecipientName,
        recipientGender: genderLabel,
        authorLabel: authorLabel.trim() || null,
      };

      const chapters = (templates || []).map((t: any) => {
        // Personalize the seed once at creation time — both `content` (editable)
        // and `seed_content` (frozen baseline for future change-measurement) get the same value.
        const rawSeed = t.reference_content || null;
        const seededContent = rawSeed ? replaceTokens(rawSeed, tokenCtx) : null;
        return {
          book_id: book.id,
          chapter_number: t.chapter_number,
          title: t.title,
          bible_verse_text: t.bible_verse_text || null,
          bible_verse_reference: t.bible_verse_reference || null,
          quote_text: t.quote_text || null,
          quote_attribution: t.quote_attribution || null,
          verse_id: null,
          quote_id: null,
          chapter_template: t.is_photo_chapter ? 'horizontal_photo' : 'all_words',
          is_photo_chapter: t.is_photo_chapter || false,
          photo_urls: [],
          photo_layout: 'top',
            content: seededContent,
          seed_content: seededContent,
          reference_text: null,
        };
      });

      const { error: chapError } = await supabase.from('chapters').insert([letterChapter, ...chapters]);
      if (chapError) throw chapError;

      // Safety net for comped testers: the database trigger should unlock the
      // book immediately, but this explicit claim keeps newly-created books
      // from ever falling through to the payment flow if the user clicks fast.
      try {
        await supabase.rpc('claim_pending_comp', { _book_id: book.id });
        window.dispatchEvent(new CustomEvent('book-unlocked', { detail: { bookId: book.id } }));
      } catch {
        // Non-comped users continue normally in preview mode.
      }

      toast({ title: 'Book created!', description: `Your book for ${recipientName} is ready to write.` });
      navigate(`/book/${book.id}`);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-10 max-w-xl">
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-2">Set Up Your Book</h1>
        <p className="text-muted-foreground mb-8">Tell us about the person you're writing for.</p>

        <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border p-8 shadow-sm space-y-5">
          <div>
            <Label htmlFor="recipientName">Recipient's First Name</Label>
            <Input id="recipientName" value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="e.g. Sarah" required className="mt-1" />
          </div>

          <div>
            <Label>Your Relationship</Label>
            <Select value={relationship} onValueChange={setRelationship} required>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select relationship" /></SelectTrigger>
              <SelectContent>
                {RELATIONSHIP_OPTIONS.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {impliedGender ? (
            <div>
              <Label>Book Version</Label>
              <div className="mt-1 flex items-center h-10 px-3 rounded-md border border-input bg-muted/40 text-sm text-muted-foreground">
                {GENDER_LABELS[impliedGender]}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Set by your relationship, so the two can never disagree. Change the relationship above to change it.
              </p>
            </div>
          ) : (
            <div>
              <Label>Book Version</Label>
              <Select value={gender} onValueChange={setGender} required>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select the version to write" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Girl/Young Woman">Girl / Young Woman</SelectItem>
                  <SelectItem value="Boy/Young Man">Boy / Young Man</SelectItem>
                  <SelectItem value="Stepdaughter">Stepdaughter (blended family)</SelectItem>
                  <SelectItem value="Stepson">Stepson (blended family)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Which set of chapters to write. Locked once the book is created.
              </p>
            </div>
          )}

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
            <Label htmlFor="milestoneDate">Target Date</Label>
            <Input id="milestoneDate" type="date" value={milestoneDate} onChange={e => setMilestoneDate(e.target.value)} className="mt-1" required />
            <p className="text-xs text-muted-foreground mt-1">The day you want to give the book. Sets your money-back guarantee window (full refund until 90 days before, or 30 days from purchase — whichever is later).</p>
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

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? 'Creating...' : 'Create My Book'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default NewBook;
