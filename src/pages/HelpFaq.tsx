import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, HelpCircle, Search } from 'lucide-react';
import TutorialVideos from '@/components/TutorialVideos';

type FaqItem = { q: string; a: React.ReactNode; aText: string };
type FaqSection = { title: string; intro?: React.ReactNode; questions: FaqItem[] };

const supportEmail = 'help@52thingstoknow.com';
const MailLink = () => (
  <a href={`mailto:${supportEmail}`} className="text-primary underline underline-offset-2">
    {supportEmail}
  </a>
);

const faqSections: FaqSection[] = [
  {
    title: 'Getting Started',
    intro: (
      <p>
        Welcome! You don't need to be "techy" — if you can send an email, you can build this book.
        Take it one chapter at a time. Here's the whole journey in five steps:
        <br />
        <br />
        1. <strong>Create your account</strong> and confirm your email.
        <br />
        2. <strong>Start a new book</strong> — choose who it's for and add a few details.
        <br />
        3. <strong>Read through your chapters</strong> — every chapter comes filled with wisdom, ready
        for you to make it your own.
        <br />
        4. <strong>Personalize</strong> — edit the words, add your own memories, and drop in photos.
        <br />
        5. <strong>Invite family</strong> to add their memories and wisdom, then preview your finished book.
      </p>
    ),
    questions: [
      {
        q: 'How do I create my account?',
        aText:
          'Sign up with your email and password. After you sign up, we send a confirmation email — click the link inside before starting your book.',
        a: (
          <p>
            Sign up with your email address and a password. After you sign up, we'll send you a{' '}
            <strong>confirmation email</strong> — you must click the link inside it before you can
            start your book. This just proves the email is really yours.
          </p>
        ),
      },
      {
        q: "I didn't get my confirmation email. What do I do?",
        aText:
          "Give it a couple of minutes, then check your spam or junk folder. If it still hasn't arrived, try signing in again to have it resent, or email help@52thingstoknow.com.",
        a: (
          <p>
            Give it a couple of minutes, then <strong>check your spam or junk folder</strong> —
            confirmation emails sometimes land there. If it still hasn't arrived, try signing in
            again to have it resent, or reach out at <MailLink />.
          </p>
        ),
      },
      {
        q: 'How do I log back in later?',
        aText:
          'Return to the app and sign in with the same email and password. Your book saves automatically.',
        a: (
          <p>
            Just return to the app and sign in with the same email and password. Your book saves
            automatically, so everything will be exactly where you left it.
          </p>
        ),
      },
    ],
  },
  {
    title: 'Creating Your Book',
    questions: [
      {
        q: 'How do I start a book?',
        aText:
          "Once signed in, create a new book. Pick who it's for and add personal details — we'll build all 52 chapters instantly, already written and ready to personalize.",
        a: (
          <p>
            Once you're signed in, choose to <strong>create a new book</strong>. You'll pick who
            the book is for and add a few personal details, and we'll instantly build all 52
            chapters for you — already written and ready to personalize.
          </p>
        ),
      },
      {
        q: 'What are the different book types?',
        aText:
          'Four versions: for a son, daughter, stepson, or stepdaughter. Step versions are written for blended families, honoring the unique bond.',
        a: (
          <>
            <p>There are four versions so the book fits your relationship and reads naturally:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>For a son</strong></li>
              <li><strong>For a daughter</strong></li>
              <li><strong>For a stepson</strong></li>
              <li><strong>For a stepdaughter</strong></li>
            </ul>
            <p className="mt-2">
              The step versions aren't just relabeled — the wording is written for a blended
              family, with language that honors how your child came into your life and the unique
              bond you share.
            </p>
          </>
        ),
      },
      {
        q: 'Important: choose the book type carefully',
        aText:
          "The book type is locked once created because it shapes wording of all 52 chapters. To switch, start a new book. Everything else, like recipient's name, is editable in Book Settings.",
        a: (
          <p>
            The book type (son / daughter / stepson / stepdaughter) is{' '}
            <strong>locked once your book is created</strong>, because it shapes the wording of
            all 52 chapters. If you pick the wrong one, you'll need to start a new book rather
            than switch. Everything else — like the recipient's name — you can change later in
            Book Settings.
          </p>
        ),
      },
      {
        q: 'What details do I add when setting up?',
        aText:
          "Recipient's name, how the book refers to them, and their pronouns. These flow into every chapter automatically.",
        a: (
          <p>
            You'll add things like the <strong>recipient's name</strong>, how the book should{' '}
            <strong>refer to them</strong>, and their <strong>pronouns</strong>. These flow
            automatically into every chapter, so the whole book reads as if it were written just
            for that one person — because it was.
          </p>
        ),
      },
    ],
  },
  {
    title: 'Understanding Your Book',
    questions: [
      {
        q: "What's actually in the book?",
        aText:
          '52 chapters of wisdom, memories, and love — one meaningful topic each. Faith-based with scripture woven in. About 100 pages when finished.',
        a: (
          <p>
            Your book has <strong>52 chapters</strong> of wisdom, memories, and love — one
            meaningful topic each. It's a faith-based keepsake, so you'll find scripture woven in
            alongside the life lessons. When it's finished, it becomes a beautifully formatted
            book (around 100 pages) your child can keep forever.
          </p>
        ),
      },
      {
        q: 'Do I have to write all 52 chapters from scratch?',
        aText:
          "No. Every chapter arrives already written. Your job is to make each chapter yours — adjust wording, add a memory, include a photo.",
        a: (
          <p>
            No — and this is the best part. Every chapter arrives <strong>already written</strong>{' '}
            with heartfelt, ready-to-read wisdom. Your job isn't to start from a blank page; it's
            to make each chapter <em>yours</em> — adjust the words so they sound like you, add a
            memory, include a photo. You can personalize as much or as little as you like.
          </p>
        ),
      },
      {
        q: 'How long is each chapter?',
        aText:
          "Each chapter fits neatly on two pages. If you add so much it overflows, you'll see a gentle note to trim it down.",
        a: (
          <p>
            Each chapter is designed to fit neatly on <strong>two pages</strong>, which keeps the
            finished book clean and readable. That means there's a limit to how much text will
            fit — if you add so much that it overflows, you'll see a gentle note asking you to
            trim it down a little.
          </p>
        ),
      },
    ],
  },
  {
    title: 'Personalizing Your Chapters',
    questions: [
      {
        q: 'How do I edit a chapter?',
        aText:
          "Open any chapter and edit the text right there. Change a word, rewrite a sentence, or leave as-is. Everything saves automatically.",
        a: (
          <p>
            Open any chapter and edit the text right there. Change a word, rewrite a sentence, or
            leave it as-is — it's completely up to you. Whatever you change saves automatically.
          </p>
        ),
      },
      {
        q: 'The chapters say "I" — what if two of us are writing the book together?',
        aText:
          'Chapters are first person ("I") by default. Ask the AI Companion to switch a chapter to "we" whenever you\'d like — chapter by chapter.',
        a: (
          <p>
            The chapters are written in the <strong>first person ("I")</strong> by default. If
            you and a spouse or partner are creating the book together, you can ask the{' '}
            <strong>AI Companion</strong> to change a chapter to <strong>"we"</strong> whenever
            you'd like. It's chapter by chapter, so you decide where it fits.
          </p>
        ),
      },
    ],
  },
  {
    title: 'The AI Companion',
    questions: [
      {
        q: 'What is the AI Companion?',
        aText:
          "A built-in writing helper. Reword, tighten, or adjust tone while you stay in control of the final words.",
        a: (
          <p>
            The AI Companion is a built-in writing helper. If you're not sure how to phrase
            something, it can reword, tighten, or adjust the tone of a chapter for you — while
            you stay in control of the final words. Think of it as a gentle writing partner
            sitting beside you.
          </p>
        ),
      },
      {
        q: 'How do I use it?',
        aText:
          "Open a chapter and use the AI Companion to reword or reshape text. Accept, tweak, or ignore — nothing changes unless you say so.",
        a: (
          <p>
            Open a chapter and use the AI Companion to reword or reshape the text. You can accept
            its suggestion, tweak it, or ignore it — nothing changes unless you say so.
          </p>
        ),
      },
      {
        q: 'Can it change a chapter from "I" to "we"?',
        aText:
          'Yes. Ask the AI Companion to switch a chapter to "we." Chapter by chapter, you decide where it fits.',
        a: (
          <p>
            Yes. Chapters are written in the first person ("I") by default. If you and a spouse
            or partner are creating the book together, ask the AI Companion to switch a chapter
            to "we." It's chapter by chapter, so you decide where it fits.
          </p>
        ),
      },
    ],
  },
  {
    title: 'Memories',
    questions: [
      {
        q: 'How do I add a memory to a chapter?',
        aText:
          "Within a chapter, add a personal memory — a specific moment. Even a sentence or two (\"I'll never forget when you...\") makes a chapter come alive.",
        a: (
          <p>
            Within a chapter, add a personal memory — a specific moment you remember with your
            child. Even a sentence or two ("I'll never forget when you…") makes a chapter come
            alive. These sit alongside the wisdom to make each page personal.
          </p>
        ),
      },
      {
        q: 'How many memories can I add?',
        aText:
          "Add as many as you'd like across your chapters. Each chapter still needs to fit its two pages.",
        a: (
          <p>
            Add as many as you'd like across your chapters — just keep in mind each chapter needs
            to fit its two pages, so very long entries may need trimming.
          </p>
        ),
      },
    ],
  },
  {
    title: 'Photos',
    questions: [
      {
        q: 'How do I add photos?',
        aText:
          'About 15 chapters per book are set up as photo chapters. Upload a photo that fits the theme.',
        a: (
          <p>
            Certain chapters are set up as <strong>photo chapters</strong> — about 15 per book —
            where you can upload a picture that fits the theme. Just upload your photo and it's
            placed into the chapter for you.
          </p>
        ),
      },
      {
        q: 'Do I need to resize my photos?',
        aText: "No. Photos are automatically sized to fit the page beautifully.",
        a: (
          <p>
            No. Photos are <strong>automatically sized</strong> to fit the page beautifully, so
            you don't have to worry about dimensions. Just pick a photo you love.
          </p>
        ),
      },
    ],
  },
  {
    title: 'Inviting Family',
    intro: (
      <p>
        One of the most special things you can do is invite family members — grandparents, aunts,
        uncles, siblings — to add their own memories and words of wisdom for your child.
      </p>
    ),
    questions: [
      {
        q: 'How do I invite a family member?',
        aText:
          "In the Family section of your dashboard, enter their name and email. The app sends a warm invitation email on your behalf.",
        a: (
          <p>
            In the <strong>Family</strong> section of your dashboard, enter the family member's{' '}
            <strong>name and email</strong>. The app sends them a warm invitation email on your
            behalf, with a simple link. You don't have to write the email yourself — we've
            crafted it for you.
          </p>
        ),
      },
      {
        q: 'What do they do?',
        aText:
          "They click the link and share memories, words of wisdom, or both. No sign-up required. They can add several entries in one visit.",
        a: (
          <p>
            They click the link and land on a friendly page where they can share{' '}
            <strong>memories, words of wisdom</strong>, or both — as little or as much as they'd
            like. They can even pass along wisdom they've heard from someone else ("Grandpa
            always says..."). They can add several entries in one visit.
          </p>
        ),
      },
      {
        q: 'Where do their contributions go?',
        aText:
          'Everything arrives in your Family hub, grouped by person. New, unread contributions show bright/bold, then dim once viewed. See sent vs. responded counts.',
        a: (
          <p>
            Everything they send arrives in your <strong>Family</strong> hub, grouped by person.
            New, unread contributions show up <strong>bright/bold</strong> so you can spot them
            at a glance, and dim once you've viewed them. The hub also shows how many invites
            you've <strong>sent</strong> versus <strong>responded</strong>, so you know who
            might need a gentle nudge.
          </p>
        ),
      },
      {
        q: 'How do I use what they sent?',
        aText:
          "Open a contributor's entries and approve the ones to include, then place them into the right chapter. Nothing appears until you approve it.",
        a: (
          <p>
            Open a contributor's entries and <strong>approve</strong> the ones you'd like to
            include, then place them into the right chapter. Nothing a family member sends
            appears in the book until <em>you</em> approve it — you're always the editor.
          </p>
        ),
      },
      {
        q: 'Will I know when someone responds?',
        aText:
          "Yes. You get a notification in the app and by email whenever a family member shares something.",
        a: (
          <p>
            Yes. You'll get a notification — both in the app and by email — whenever a family
            member shares something, so you never miss a contribution.
          </p>
        ),
      },
    ],
  },
  {
    title: 'Book Settings',
    questions: [
      {
        q: "Can I change my book's details after I start?",
        aText:
          "Yes. In Book Settings, update setup details like the recipient's name. The book type is the only thing you can't change — start a new book to switch it.",
        a: (
          <p>
            Yes. In <strong>Book Settings</strong> you can update your setup details — like the
            recipient's name — and the change flows through your chapters. The one thing you{' '}
            <strong>can't</strong> change is the book type (son / daughter / stepson /
            stepdaughter), since that's built into the wording of every chapter. To change that,
            you'd start a new book.
          </p>
        ),
      },
    ],
  },
  {
    title: 'Previewing Your Book',
    questions: [
      {
        q: 'How do I see what my book will look like?',
        aText:
          "Preview your book as a formatted document any time — title page, table of contents, letter from the author, and all your chapters laid out beautifully.",
        a: (
          <p>
            You can <strong>preview your book</strong> as a formatted document at any time. It
            includes a title page, table of contents, a letter from you as the author, and all
            your chapters with their wisdom, verses, memories, and photos laid out beautifully.
          </p>
        ),
      },
      {
        q: 'When is my book "finished"?',
        aText:
          "When each chapter fits within its two pages and you're happy with how it reads. Take your time.",
        a: (
          <p>
            Your book is complete when each chapter fits within its two pages and you're happy
            with how it reads. Take your time — there's no rush, and you can keep refining.
          </p>
        ),
      },
    ],
  },
  {
    title: 'Ordering',
    questions: [
      {
        q: 'Can I order a printed copy?',
        aText:
          "Printing isn't available during this testing phase. Right now the focus is on helping you build and preview your book. Printed and bound copies are coming later.",
        a: (
          <p>
            Printing isn't available during this testing phase — right now the focus is on
            helping you build and preview your book. Printed and bound copies are coming later.
          </p>
        ),
      },
    ],
  },
  {
    title: 'Getting Help',
    questions: [
      {
        q: 'I found a problem or something looks wrong. How do I report it?',
        aText:
          "Use the Report a Problem / Send Feedback button on the Help page and in the footer. Choose the issue type, describe what happened, and attach a screenshot.",
        a: (
          <p>
            Use the <strong>Report a Problem / Send Feedback</strong> button (on the Help page
            and in the footer). You can choose the type of issue, describe what happened, and —
            most helpfully — <strong>attach a screenshot</strong>. A picture of what you're
            seeing helps us fix things much faster. Your message comes straight to us.
          </p>
        ),
      },
      {
        q: 'How else can I reach you?',
        aText: `Email ${supportEmail} any time and we'll get back to you.`,
        a: (
          <p>
            Email <MailLink /> any time and we'll get back to you.
          </p>
        ),
      },
    ],
  },
  {
    title: 'Frequently Asked Questions',
    questions: [
      {
        q: 'Do I have to finish the book all at once?',
        aText:
          "Not at all. Your work saves automatically. Do one chapter or ten, then come back whenever you like.",
        a: (
          <p>
            Not at all. Your work saves automatically. Do one chapter or ten, then come back
            whenever you like.
          </p>
        ),
      },
      {
        q: 'Can I change the book type after I start?',
        aText:
          "No — that's locked. You'd need to start a new book. Everything else, including the recipient's name, can be changed in Book Settings.",
        a: (
          <p>
            No — that's locked. You'd need to start a new book. Everything else, including the
            recipient's name, can be changed in Book Settings.
          </p>
        ),
      },
      {
        q: "What if a chapter's text is too long?",
        aText:
          "Each chapter fits two pages. If you go over, you'll see a note to trim it slightly so it lays out cleanly.",
        a: (
          <p>
            Each chapter fits two pages. If you go over, you'll see a note to trim it slightly so
            it lays out cleanly.
          </p>
        ),
      },
      {
        q: 'Do family members need an account?',
        aText:
          "No. They just click the link in the invitation email and share — no sign-up required.",
        a: (
          <p>
            No. They just click the link in the invitation email and share — no sign-up required.
          </p>
        ),
      },
      {
        q: 'Will family contributions show up in my book automatically?',
        aText:
          "No. Nothing appears until you approve it and place it in a chapter. You're always in control.",
        a: (
          <p>
            No. Nothing appears until you approve it and place it in a chapter. You're always in
            control.
          </p>
        ),
      },
      {
        q: 'Do I need to resize my photos before uploading?',
        aText: "No, photos are sized for you automatically.",
        a: <p>No, photos are sized for you automatically.</p>,
      },
      {
        q: "I didn't get an email (confirmation, invite, or notification). What now?",
        aText: `Check your spam/junk folder first. If it's still missing, email ${supportEmail}.`,
        a: (
          <p>
            Check your spam/junk folder first. If it's still missing, email <MailLink />.
          </p>
        ),
      },
      {
        q: 'Can I print my book?',
        aText:
          "Not yet — printing comes after this testing phase. For now you can build and preview it.",
        a: (
          <p>
            Not yet — printing comes after this testing phase. For now you can build and preview
            it.
          </p>
        ),
      },
    ],
  },
];

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const tokenBoundaryRegex = (token: string) =>
  new RegExp(`\\b(${escapeRegExp(token)})`, 'i');

const tokenMatches = (text: string, token: string) => tokenBoundaryRegex(token).test(text);

const buildTokenRegex = (tokens: string[]) => {
  if (!tokens.length) return null;
  return new RegExp(`\\b(${tokens.map(escapeRegExp).join('|')})`, 'gi');
};

const scoreItem = (item: FaqItem, sectionTitle: string, tokens: string[]) => {
  let score = 0;

  for (const token of tokens) {
    let found = false;
    if (tokenMatches(sectionTitle, token)) {
      score += 100;
      found = true;
    }
    if (tokenMatches(item.q, token)) {
      score += 50;
      found = true;
    }
    if (tokenMatches(item.aText, token)) {
      score += 10;
      found = true;
    }
    if (!found) return 0;
  }

  return score;
};

type QuestionResult = { item: FaqItem; qIdx: number; score: number };
type SectionResult = { section: FaqSection; sIdx: number; questions: QuestionResult[]; sectionScore: number };

const HighlightText = ({ text, regex }: { text: string; regex: RegExp | null }) => {
  if (!regex) return <>{text}</>;
  const parts = text.split(regex);
  if (parts.length <= 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="bg-primary/20 text-foreground rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
};

const HelpFaq = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [openItems, setOpenItems] = useState<string[]>([]);

  const tokens = useMemo(() => query.trim().split(/\s+/).filter(Boolean), [query]);
  const regex = useMemo(() => buildTokenRegex(tokens), [tokens]);

  const results = useMemo<SectionResult[]>(() => {
    if (!tokens.length) {
      return faqSections.map((section, sIdx) => ({
        section,
        sIdx,
        questions: section.questions.map((item, qIdx) => ({ item, qIdx, score: 0 })),
        sectionScore: 0,
      }));
    }

    const sectionResults: SectionResult[] = faqSections.map((section, sIdx) => {
      const sectionMatchesAll = tokens.every((t) => tokenMatches(section.title, t));

      const questions = section.questions
        .map((item, qIdx) => {
          const score = sectionMatchesAll
            ? Math.max(scoreItem(item, section.title, tokens), 1000)
            : scoreItem(item, section.title, tokens);
          return { item, qIdx, score };
        })
        .filter((q) => q.score > 0);

      const sectionScore = sectionMatchesAll
        ? 10000
        : Math.max(0, ...questions.map((q) => q.score));

      return { section, sIdx, questions, sectionScore };
    });

    const withMatches = sectionResults.filter((s) => s.questions.length > 0);
    withMatches.sort((a, b) => b.sectionScore - a.sectionScore);
    withMatches.forEach((s) => s.questions.sort((a, b) => b.score - a.score));

    return withMatches;
  }, [tokens]);

  useEffect(() => {
    if (!tokens.length) {
      setOpenItems([]);
      return;
    }
    const values = results.flatMap((s) => s.questions.map((q) => `${s.sIdx}-${q.qIdx}`));
    setOpenItems(values);
  }, [tokens, results]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <Button variant="ghost" className="mb-6 -ml-2" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="flex items-center gap-3 mb-3">
          <HelpCircle className="h-8 w-8 text-primary" />
          <h1 className="font-heading text-3xl font-bold text-foreground">Help Center</h1>
        </div>
        <p className="text-muted-foreground mb-8">
          Everything you need to create your book. If you get stuck, email <MailLink />.
        </p>

        <TutorialVideos
          heading="Video Tutorials"
          subheading="Watch short walkthroughs of the key parts of the platform."
        />

        <div className="relative mb-8">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search help topics..."
            className="pl-9"
            aria-label="Search help topics"
          />
        </div>

        {results.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-muted-foreground mb-2">
              No results — try different words, or use{' '}
              <a
                href={`mailto:${supportEmail}?subject=Report a problem`}
                className="text-primary underline underline-offset-2"
              >
                Report a Problem
              </a>{' '}
              to reach us.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {results.map(({ section, sIdx, questions }) => (
              <div key={sIdx}>
                <h2 className="font-heading text-xl font-semibold text-foreground mb-3">
                  <HighlightText text={section.title} regex={regex} />
                </h2>
                {section.intro && !tokens.length && (
                  <div className="text-muted-foreground leading-relaxed mb-4">{section.intro}</div>
                )}
                <Accordion
                  type="multiple"
                  value={openItems}
                  onValueChange={setOpenItems}
                  className="w-full"
                >
                  {questions.map(({ item, qIdx }) => (
                    <AccordionItem
                      key={`${sIdx}-${qIdx}`}
                      value={`${sIdx}-${qIdx}`}
                      className="border border-border rounded-lg px-4 mb-3 bg-card"
                    >
                      <AccordionTrigger className="text-left font-medium text-foreground hover:no-underline py-4">
                        <HighlightText text={item.q} regex={regex} />
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground pb-4 leading-relaxed">
                        {tokens.length ? (
                          <HighlightText text={item.aText} regex={regex} />
                        ) : (
                          item.a
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
                <Separator className="mt-6" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HelpFaq;
