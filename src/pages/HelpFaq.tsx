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
import { ArrowLeft, HelpCircle, Search, MessageSquareWarning } from 'lucide-react';
import TutorialVideos from '@/components/TutorialVideos';
import FeedbackDialog from '@/components/feedback/FeedbackDialog';
import { captureScreen } from '@/lib/screenCapture';
import { Loader2 } from 'lucide-react';

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
    title: 'Quick Start',
    intro: (
      <p>
        Welcome! This guide walks you through everything you need to create a beautiful,
        personalized keepsake book. You don't need to be "techy" — if you can send an email, you can
        build this book. Take it one chapter at a time.
        <br />
        <br />
        If you ever get stuck, there's a <strong>Report a Problem</strong> button and you can
        always email <MailLink />.
        <br />
        <br />
        <strong>One thing to remember as you go:</strong> your work does <strong>not</strong> save
        on its own. When you make changes in a chapter, click <strong>Save Draft</strong> to keep
        them. If you see "• Unsaved changes," that's your reminder to save before leaving the page.
      </p>
    ),
    questions: [
      {
        q: 'What are the five steps to create my book?',
        aText:
          "1. Create your account and confirm your email. 2. Start a new book — choose who it's for and add a few details. 3. Read through your chapters — every chapter already comes filled with wisdom, ready for you to make it your own. 4. Personalize — edit the words (and click Save Draft), add your own memories, and drop in photos. 5. Invite family to add their memories and wisdom, then preview your finished book. There's no deadline. You can work a little at a time and come back whenever you like.",
        a: (
          <>
            <ol className="list-decimal pl-6 mt-2 space-y-1">
              <li>
                <strong>Create your account</strong> and confirm your email.
              </li>
              <li>
                <strong>Start a new book</strong> — choose who it's for and add a few details.
              </li>
              <li>
                <strong>Read through your chapters</strong> — every chapter already comes filled
                with wisdom, ready for you to make it your own.
              </li>
              <li>
                <strong>Personalize</strong> — edit the words (and click <strong>Save Draft</strong>
                ), add your own memories, and drop in photos.
              </li>
              <li>
                <strong>Invite family</strong> to add their memories and wisdom, then{' '}
                <strong>preview your finished book</strong>.
              </li>
            </ol>
            <p className="mt-3">
              There's no deadline. You can work a little at a time and come back whenever you like.
            </p>
          </>
        ),
      },
    ],
  },
  {
    title: 'Getting Started',
    questions: [
      {
        q: 'How do I create my account?',
        aText:
          '1. Click Get Started on the homepage. 2. Fill in Full Name, Email, and Password (at least 6 characters). 3. Click Get Started to submit. 4. You will see a message: "Check your email — confirm your email first, then log in." You must click the link in that email before you can begin.',
        a: (
          <ol className="list-decimal pl-6 mt-2 space-y-1">
            <li>
              Click <strong>Get Started</strong> on the homepage.
            </li>
            <li>
              Fill in <strong>Full Name</strong>, <strong>Email</strong>, and{' '}
              <strong>Password</strong> (at least 6 characters).
            </li>
            <li>
              Click <strong>Get Started</strong> to submit.
            </li>
            <li>
              You'll see a message: "Check your email — confirm your email first, then log in."
              You must click the link in that email before you can begin.
            </li>
          </ol>
        ),
      },
      {
        q: "I didn't get my confirmation email. What do I do?",
        aText:
          "Give it a couple of minutes, then check your spam or junk folder — confirmation emails sometimes land there. If you're stuck on the Verify your email screen, click Resend verification email. Still nothing? Email help@52thingstoknow.com.",
        a: (
          <p>
            Give it a couple of minutes, then <strong>check your spam or junk folder</strong> —
            confirmation emails sometimes land there. If you're stuck on the "Verify your email"
            screen, click <strong>Resend verification email</strong>. Still nothing? Email{' '}
            <MailLink />.
          </p>
        ),
      },
      {
        q: 'How do I log in?',
        aText:
          '1. Go to the Log In page. 2. Enter your Email and Password and click Log In. 3. You will land on My Books, your home base. If you try to open any page before confirming your email, you will see a Verify your email screen with a Resend verification email button — just confirm first, then log in.',
        a: (
          <>
            <ol className="list-decimal pl-6 mt-2 space-y-1">
              <li>
                Go to the <strong>Log In</strong> page.
              </li>
              <li>
                Enter your <strong>Email</strong> and <strong>Password</strong> and click{' '}
                <strong>Log In</strong>.
              </li>
              <li>
                You'll land on <strong>My Books</strong>, your home base.
              </li>
            </ol>
            <p className="mt-3">
              If you try to open any page before confirming your email, you'll see a "Verify your
              email" screen with a <strong>Resend verification email</strong> button — just
              confirm first, then log in.
            </p>
          </>
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
          "1. On My Books, click + New Book (top right). If it's your very first book, the button says Start Your Book. 2. Fill in the Set Up Your Book form. 3. Click Create My Book. Your 52 chapters are built instantly, and you land on your book's dashboard.",
        a: (
          <ol className="list-decimal pl-6 mt-2 space-y-1">
            <li>
              On <strong>My Books</strong>, click <strong>+ New Book</strong> (top right). If it's
              your very first book, the button says <strong>Start Your Book</strong>.
            </li>
            <li>
              Fill in the <strong>Set Up Your Book</strong> form (details below).
            </li>
            <li>
              Click <strong>Create My Book</strong>. Your 52 chapters are built instantly, and you
              land on your book's dashboard.
            </li>
          </ol>
        ),
      },
      {
        q: 'What do I fill in when setting up?',
        aText:
          "Recipient's First Name — who the book is for. Your Relationship — Daughter, Son, Stepdaughter, Stepson, Granddaughter, Grandson, Niece, Nephew, or Family Friend. Recipient's Gender / book version — Girl / Young Woman, Boy / Young Man, Stepdaughter, or Stepson. (See the important note below — this one is locked later.) Occasion — High School Graduation, 18th Birthday, or Other Milestone. Expected Date (optional) — the milestone date, if you know it. How should [name] refer to you? (optional) — e.g. Mom, Grandpa. From (shown on the book cover) (optional) — leave blank to use your account name. Writing Tone for AI Assistance — defaults to Warm and Conversational.",
        a: (
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>
              <strong>Recipient's First Name</strong> — who the book is for.
            </li>
            <li>
              <strong>Your Relationship</strong> — Daughter, Son, Stepdaughter, Stepson,
              Granddaughter, Grandson, Niece, Nephew, or Family Friend.
            </li>
            <li>
              <strong>Recipient's Gender / book version</strong> — Girl / Young Woman, Boy / Young
              Man, Stepdaughter, or Stepson. (<em>See the important note below — this one is locked
              later.</em>)
            </li>
            <li>
              <strong>Occasion</strong> — High School Graduation, 18th Birthday, or Other Milestone.
            </li>
            <li>
              <strong>Expected Date</strong> (<em>optional</em>) — the milestone date, if you know
              it.
            </li>
            <li>
              <strong>How should [name] refer to you?</strong> (<em>optional</em>) — e.g. "Mom,"
              "Grandpa."
            </li>
            <li>
              <strong>From (shown on the book cover)</strong> (<em>optional</em>) — leave blank to
              use your account name.
            </li>
            <li>
              <strong>Writing Tone for AI Assistance</strong> — defaults to{' '}
              <em>Warm and Conversational</em>.
            </li>
          </ul>
        ),
      },
      {
        q: 'Important: the "Recipient\'s Gender / book version" field is locked',
        aText:
          "This one field sets the wording for all 52 chapters (including the special blended-family language in the stepson/stepdaughter versions), so it locks once your book is created. If you choose the wrong one, you'll need to start a new book. Everything else — the recipient's name, occasion, date, how they refer to you, and more — you can change anytime in Book Settings.",
        a: (
          <p>
            This one field sets the wording for all 52 chapters (including the special
            blended-family language in the stepson/stepdaughter versions), so it{' '}
            <strong>locks once your book is created</strong>. If you choose the wrong one, you'll
            need to start a new book. <strong>Everything else</strong> — the recipient's name,
            occasion, date, how they refer to you, and more — you can change anytime in{' '}
            <strong>Book Settings</strong>.
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
          'Your book has 52 chapters of wisdom, memories, and love — one meaningful topic each. It is a faith-based keepsake, so you will find scripture woven in alongside the life lessons. When it is finished, it becomes a beautifully formatted book (around 100 pages) your child can keep forever.',
        a: (
          <p>
            Your book has <strong>52 chapters</strong> of wisdom, memories, and love — one
            meaningful topic each. It's a faith-based keepsake, so you'll find scripture woven in
            alongside the life lessons. When it's finished, it becomes a beautifully formatted book
            (around 100 pages) your child can keep forever.
          </p>
        ),
      },
      {
        q: 'Do I have to write all 52 chapters from scratch?',
        aText:
          "No — and this is the best part. Every chapter arrives already written with heartfelt, ready-to-read wisdom. Your job isn't to start from a blank page; it's to make each chapter yours — adjust the words so they sound like you, add a memory, include a photo. Personalize as much or as little as you like.",
        a: (
          <p>
            No — and this is the best part. Every chapter arrives <strong>already written</strong>{' '}
            with heartfelt, ready-to-read wisdom. Your job isn't to start from a blank page; it's to
            make each chapter <em>yours</em> — adjust the words so they sound like you, add a
            memory, include a photo. You can personalize as much or as little as you like.
          </p>
        ),
      },
      {
        q: 'How long is each chapter?',
        aText:
          "Each chapter is designed to fit neatly on two pages. That keeps the book clean and readable, and it means there's a limit to how much text fits. If a chapter runs too long, the editor tells you right away so you can trim it.",
        a: (
          <p>
            Each chapter is designed to fit neatly on <strong>two pages</strong>. That keeps the
            book clean and readable, and it means there's a limit to how much text fits. If a
            chapter runs too long, the editor tells you right away so you can trim it.
          </p>
        ),
      },
    ],
  },
  {
    title: 'Personalizing Your Chapters',
    questions: [
      {
        q: 'How do I open a chapter?',
        aText:
          "From your book dashboard, you have three ways in: Click Continue Writing (top) to jump to your next unfinished chapter. Click any chapter in the Table of Contents on the right. Click View All Chapters, then pick a chapter tile.",
        a: (
          <>
            <p>From your book dashboard, you have three ways in:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>
                Click <strong>Continue Writing</strong> (top) to jump to your next unfinished
                chapter.
              </li>
              <li>
                Click any chapter in the <strong>Table of Contents</strong> on the right.
              </li>
              <li>
                Click <strong>View All Chapters</strong>, then pick a chapter tile.
              </li>
            </ul>
          </>
        ),
      },
      {
        q: 'How do I edit a chapter?',
        aText:
          "1. The chapter opens on the Edit tab (there's an Edit / Preview toggle at the top). 2. To rename it, click the chapter title at the top and type (up to 45 characters). 3. The verse and quote sit above the main text — click either to edit it, or use the swap link to browse other options. 4. Click into the large text area below and write. This is the chapter's main wisdom. 5. Click Save Draft (top right, the floppy-disk icon) to keep your changes.",
        a: (
          <ol className="list-decimal pl-6 mt-2 space-y-1">
            <li>
              The chapter opens on the <strong>Edit</strong> tab (there's an{' '}
              <strong>Edit / Preview</strong> toggle at the top).
            </li>
            <li>
              To rename it, click the <strong>chapter title</strong> at the top and type (up to 45
              characters).
            </li>
            <li>
              The <strong>verse</strong> and <strong>quote</strong> sit above the main text — click
              either to edit it, or use the <strong>swap</strong> link to browse other options.
            </li>
            <li>
              Click into the large <strong>text area</strong> below and write. This is the chapter's
              main wisdom.
            </li>
            <li>
              Click <strong>Save Draft</strong> (top right, the floppy-disk icon) to keep your
              changes.
            </li>
          </ol>
        ),
      },
      {
        q: 'Does my writing save automatically?',
        aText:
          'No — you need to click Save Draft. Until you do, you will see "• Unsaved changes" near the buttons, and if you try to leave the page, the app will ask you to confirm. When in doubt, save.',
        a: (
          <p>
            No — <strong>you need to click Save Draft</strong>. Until you do, you'll see "• Unsaved
            changes" near the buttons, and if you try to leave the page, the app will ask you to
            confirm. When in doubt, save.
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
          'The AI Companion is a built-in writing helper. If you are not sure how to phrase something, it can reword, tighten, or adjust the tone of a chapter for you — while you stay in control of the final words. Think of it as a gentle writing partner sitting beside you.',
        a: (
          <p>
            The AI Companion is a built-in writing helper. If you're not sure how to phrase
            something, it can reword, tighten, or adjust the tone of a chapter for you — while you
            stay in control of the final words. Think of it as a gentle writing partner sitting
            beside you.
          </p>
        ),
      },
      {
        q: 'How do I use it?',
        aText:
          '1. Open a chapter and look for the round white "52" badge (a pink-outlined circle) floating on the page — it gives a little pulse the first time. 2. Click it to open the chat panel (you can drag it around). 3. Type what you would like in the box at the bottom — for example, "make this warmer" or "shorten this a little" — and press Enter. 4. When it suggests an edit, you will see a preview with two buttons: Add to chapter (applies it) or Try again (ask for another version). 5. Changed your mind? Use Revert in the panel header to undo, or × to close. 6. Then click Save Draft in the toolbar — nothing is saved until you do.',
        a: (
          <ol className="list-decimal pl-6 mt-2 space-y-1">
            <li>
              Open a chapter and look for the round white "<strong>52</strong>"{' '}
              <strong>badge</strong> (a pink-outlined circle) floating on the page — it gives a little
              pulse the first time.
            </li>
            <li>
              Click it to open the chat panel (you can drag it around).
            </li>
            <li>
              Type what you'd like in the box at the bottom — for example, "make this warmer" or
              "shorten this a little" — and press <strong>Enter</strong>.
            </li>
            <li>
              When it suggests an edit, you'll see a preview with two buttons:{' '}
              <strong>Add to chapter</strong> (applies it) or <strong>Try again</strong> (ask for
              another version).
            </li>
            <li>
              Changed your mind? Use <strong>Revert</strong> in the panel header to undo, or × to
              close.
            </li>
            <li>
              <strong>Then click Save Draft</strong> in the toolbar — nothing is saved until you
              do.
            </li>
          </ol>
        ),
      },
      {
        q: 'Can it change a chapter from "I" to "we"?',
        aText:
          'Yes. Chapters are written in the first person ("I") by default. If you and a spouse or partner are creating the book together, ask the AI Companion to switch a chapter to "we." It is chapter by chapter, so you decide where it fits.',
        a: (
          <p>
            Yes. Chapters are written in the first person ("I") by default. If you and a spouse or
            partner are creating the book together, ask the AI Companion to switch a chapter to{' '}
            <strong>"we."</strong> It's chapter by chapter, so you decide where it fits.
          </p>
        ),
      },
    ],
  },
  {
    title: 'Adding Your Memories',
    questions: [
      {
        q: 'How do I add a memory to the chapter I am in?',
        aText:
          "1. In the chapter's top toolbar, click Memory (the heart-with-chat icon). 2. In the Memory Capture window, enter who it's from and the memory itself. 3. Save. It's added to the chapter and appears on page 2 in the preview.",
        a: (
          <ol className="list-decimal pl-6 mt-2 space-y-1">
            <li>
              In the chapter's top toolbar, click <strong>Memory</strong> (the heart-with-chat
              icon).
            </li>
            <li>
              In the <strong>Memory Capture</strong> window, enter who it's from and the memory
              itself.
            </li>
            <li>
              <strong>Save</strong>. It's added to the chapter and appears on page 2 in the preview.
            </li>
          </ol>
        ),
      },
      {
        q: 'How do I add memories to use later?',
        aText:
          '1. From your book dashboard, click the Family tile (or View Memory Pool). 2. Under Add a memory, fill in From and the Memory, then click Add to pool. 3. It waits in the Unplaced area. To place it, open the chapter you want, then add it from that chapter\'s Memory panel.',
        a: (
          <ol className="list-decimal pl-6 mt-2 space-y-1">
            <li>
              From your book dashboard, click the <strong>Family</strong> tile (or{' '}
              <strong>View Memory Pool</strong>).
            </li>
            <li>
              Under <strong>Add a memory</strong>, fill in <strong>From</strong> and the{' '}
              <strong>Memory</strong>, then click <strong>Add to pool</strong>.
            </li>
            <li>
              It waits in the <strong>Unplaced</strong> area. To place it, open the chapter you want,
              then add it from that chapter's <strong>Memory</strong> panel.
            </li>
          </ol>
        ),
      },
      {
        q: 'How many memories can I add?',
        aText:
          "As many as you'd like — just remember each chapter needs to fit its two pages, so very long entries may need trimming.",
        a: (
          <p>
            As many as you'd like — just remember each chapter needs to fit its two pages, so very
            long entries may need trimming.
          </p>
        ),
      },
    ],
  },
  {
    title: 'Adding Photos',
    questions: [
      {
        q: 'How do I add a photo?',
        aText:
          "About 15 chapters per book are photo chapters — you'll spot a small camera icon next to them in the Table of Contents. 1. Open a photo chapter. 2. You'll see a dashed box that says something like \"Add a horizontal photo.\" 3. Click it to open your device's file picker (JPEG or PNG only). 4. Choose your photo — it uploads into the frame. To remove it, click the ✕ on the photo. 5. If you'd like a different arrangement, use the layout selector in the toolbar (Classic, Photo Top, or Photo Second Page). 6. Click Save Draft to store it.",
        a: (
          <>
            <p>
              About 15 chapters per book are <strong>photo chapters</strong> — you'll spot a small{' '}
              <strong>camera icon</strong> next to them in the Table of Contents.
            </p>
            <ol className="list-decimal pl-6 mt-2 space-y-1">
              <li>Open a photo chapter.</li>
              <li>
                You'll see a <strong>dashed box</strong> that says something like "Add a horizontal
                photo."
              </li>
              <li>
                Click it to open your device's file picker (<strong>JPEG or PNG</strong> only).
              </li>
              <li>
                Choose your photo — it uploads into the frame. To remove it, click the ✕ on the
                photo.
              </li>
              <li>
                If you'd like a different arrangement, use the <strong>layout selector</strong> in the
                toolbar (Classic, Photo Top, or Photo Second Page).
              </li>
              <li>
                Click <strong>Save Draft</strong> to store it.
              </li>
            </ol>
          </>
        ),
      },
      {
        q: 'Do I need to resize my photos?',
        aText:
          'No — photos are sized to fit the page automatically. Just pick one you love. (Note: a photo-layout chapter stays in Photos & Decisions until you either add a photo or switch it to the Classic layout.)',
        a: (
          <p>
            No — photos are <strong>sized to fit the page automatically</strong>. Just pick one you
            love. (Note: a photo-layout chapter stays in <strong>Photos &amp; Decisions</strong>{' '}
            until you either add a photo or switch it to the <strong>Classic</strong> layout.)
          </p>
        ),
      },
    ],
  },
  {
    title: 'Inviting Family to Contribute',
    intro: (
      <p>
        One of the most special things you can do is invite family — grandparents, aunts, uncles,
        siblings — to add their own memories and wisdom for your child.
      </p>
    ),
    questions: [
      {
        q: 'How do I invite a family member?',
        aText:
          "1. From your book dashboard, click the Family tile (or Invite Family to Share Memories). 2. At the top, the Invite family to share memories card is already open. 3. Enter their Name (e.g. \"Grandpa\") and Email. 4. Click Send invite. They'll get a warm email from memories@52thingstoknow.com with a simple link — you don't have to write anything. 5. Below the form you'll see everyone you've invited, each marked Sent or Responded. Prefer to share a link yourself? Expand Or copy a shareable link and click Generate shareable link.",
        a: (
          <>
            <ol className="list-decimal pl-6 mt-2 space-y-1">
              <li>
                From your book dashboard, click the <strong>Family</strong> tile (or{' '}
                <strong>Invite Family to Share Memories</strong>).
              </li>
              <li>
                At the top, the <strong>Invite family to share memories</strong> card is already
                open.
              </li>
              <li>
                Enter their <strong>Name</strong> (e.g. "Grandpa") and <strong>Email</strong>.
              </li>
              <li>
                Click <strong>Send invite</strong>. They'll get a warm email from{' '}
                <strong>memories@52thingstoknow.com</strong> with a simple link — you don't have to
                write anything.
              </li>
              <li>
                Below the form you'll see everyone you've invited, each marked{' '}
                <strong>Sent</strong> or <strong>Responded</strong>.
              </li>
            </ol>
            <p className="mt-3">
              Prefer to share a link yourself? Expand <strong>Or copy a shareable link</strong> and
              click <strong>Generate shareable link</strong>.
            </p>
          </>
        ),
      },
      {
        q: 'What do they do?',
        aText:
          'They click the link and land on a friendly page where they can share memories, wisdom, or both — as little or as much as they like, and several entries in one visit. No account needed.',
        a: (
          <p>
            They click the link and land on a friendly page where they can share{' '}
            <strong>memories</strong>, <strong>wisdom</strong>, or both — as little or as much as
            they'd like, and several entries in one visit. No account needed.
          </p>
        ),
      },
    ],
  },
  {
    title: 'Reviewing Family Contributions',
    questions: [
      {
        q: 'Someone responded — how do I add it to the book?',
        aText:
          "1. New submissions appear in the Pending Approval area at the top of your Memory Pool (Family section). The Family tile also shows an \"N new\" badge until you visit. 2. Each card shows who it's from and the memory. Click ✓ Approve to keep it, or ✕ Decline to remove it. 3. Approved memories move to Unplaced. To put one in the book, open the chapter you want and add it from that chapter's Memory tools — it then shows as Placed. You're always the editor — nothing a family member sends appears in the book until you approve and place it. You can also edit the \"from\" name (pencil icon) or delete a memory (trash icon) on any card.",
        a: (
          <>
            <ol className="list-decimal pl-6 mt-2 space-y-1">
              <li>
                New submissions appear in the <strong>Pending Approval</strong> area at the top of
                your <strong>Memory Pool</strong> (Family section). The <strong>Family</strong> tile
                also shows an "<strong>N new</strong>" badge until you visit.
              </li>
              <li>
                Each card shows who it's from and the memory. Click ✓ <strong>Approve</strong> to
                keep it, or ✕ <strong>Decline</strong> to remove it.
              </li>
              <li>
                Approved memories move to <strong>Unplaced</strong>. To put one in the book, open
                the chapter you want and add it from that chapter's <strong>Memory tools</strong> —
                it then shows as <strong>Placed</strong>.
              </li>
            </ol>
            <p className="mt-3">
              You're always the editor — nothing a family member sends appears in the book until{' '}
              <em>you</em> approve and place it. You can also edit the "from" name (pencil icon) or
              delete a memory (trash icon) on any card.
            </p>
          </>
        ),
      },
    ],
  },
  {
    title: 'Book Settings',
    questions: [
      {
        q: 'Can I change my book\'s details after I start?',
        aText:
          "Yes — most of them. 1. From your book dashboard, click Book Settings (top-right). 2. Update any of these: Recipient's First Name, Your Relationship, Occasion, Expected Date, how they refer to you, the From name, and Writing Tone. 3. Click Save Changes. The one thing you can't change is Recipient's Gender / book version — it shows as locked, because it's built into the wording of all 52 chapters. To change that, you'd start a new book.",
        a: (
          <>
            <p>Yes — most of them.</p>
            <ol className="list-decimal pl-6 mt-2 space-y-1">
              <li>
                From your book dashboard, click <strong>Book Settings</strong> (top-right).
              </li>
              <li>
                Update any of these: <strong>Recipient's First Name</strong>,{' '}
                <strong>Your Relationship</strong>, <strong>Occasion</strong>,{' '}
                <strong>Expected Date</strong>, how they <strong>refer to you</strong>, the{' '}
                <strong>From</strong> name, and <strong>Writing Tone</strong>.
              </li>
              <li>
                Click <strong>Save Changes</strong>.
              </li>
            </ol>
            <p className="mt-3">
              The one thing you <strong>can't</strong> change is{' '}
              <strong>Recipient's Gender / book version</strong> — it shows as locked, because it's
              built into the wording of all 52 chapters. To change that, you'd start a new book.
            </p>
          </>
        ),
      },
    ],
  },
  {
    title: 'Previewing Your Book',
    questions: [
      {
        q: 'How do I see what my book looks like?',
        aText:
          '1. On your book dashboard, click the book cover (it says "Click to preview your book"). 2. Page through the spreads with the ◀ / ▶ arrows (or your arrow keys). 3. Click ✕ to return. Every chapter is in the book from day one, so the preview always shows the whole thing.',
        a: (
          <>
            <ol className="list-decimal pl-6 mt-2 space-y-1">
              <li>
                On your book dashboard, click the <strong>book cover</strong> (it says "Click to
                preview your book").
              </li>
              <li>
                Page through the spreads with the <strong>◀ / ▶</strong> arrows (or your arrow
                keys).
              </li>
              <li>
                Click <strong>✕</strong> to return.
              </li>
            </ol>
            <p className="mt-3">
              Every chapter is in your book from day one, so the preview always shows the whole
              book — including anything you've flagged as <strong>Needs editing</strong>.
            </p>
          </>
        ),
      },
      {
        q: 'Can I download a copy to look at?',
        aText:
          'Yes. On the dashboard, click Generate Test PDF in Quick Actions. It prepares the file and downloads book-test.pdf. As with the preview, it includes your opening Letter plus all 52 chapters.',
        a: (
          <p>
            Yes. On the dashboard, click <strong>Generate Test PDF</strong> in Quick Actions. It
            prepares the file and downloads <strong>book-test.pdf</strong>. As with the preview, it
            includes your opening Letter plus all 52 chapters.
          </p>
        ),
      },
      {
        q: 'Can I order a printed copy?',
        aText:
          "Printing isn't available during this testing phase — right now the focus is on helping you build and preview your book. Printed, bound copies are coming later.",
        a: (
          <p>
            Printing isn't available during this testing phase — right now the focus is on helping
            you build and preview your book. Printed, bound copies are coming later.
          </p>
        ),
      },
    ],
  },
  {
    title: 'Saving and Reviewing Chapters',
    questions: [
      {
        q: 'How do I save a chapter?',
        aText:
          "You don't have to. Your changes save automatically a moment after you stop typing — text, photos, and layout alike. There's nothing to click and nothing to remember.",
        a: (
          <p>
            You don't have to. Your changes <strong>save automatically</strong> a moment after you
            stop typing — text, photos, and layout alike. There's nothing to click and nothing to
            remember.
          </p>
        ),
      },
      {
        q: 'What do Keep and Needs editing mean?',
        aText:
          "Every chapter is already written and ready to print. As you read through, you tell us how you feel about each one: Keep this one leaves it as it is, and Needs editing flags it so it shows up in your Needs editing list with any note you leave. Editing a chapter and saving resolves the flag automatically.",
        a: (
          <>
            <p>
              Every chapter is already written and ready to print. As you read through, you tell us
              how you feel about each one:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>
                <strong>Keep this one</strong> — leaves the chapter exactly as it is.
              </li>
              <li>
                <strong>Needs editing</strong> — flags it, along with any note you leave, so it
                shows up in your <strong>Needs editing</strong> list on the dashboard.
              </li>
            </ul>
            <p className="mt-3">
              Editing a flagged chapter and letting it save clears the flag automatically.
            </p>
          </>
        ),
      },
      {
        q: 'When is the whole book finished?',
        aText:
          "Your book is print-ready from day one — all 52 chapters are already written. The dashboard only counts what's still open: chapters you flagged as Needs editing, missing photos, and decisions to make. When that list is empty, you're done.",
        a: (
          <p>
            Your book is <strong>print-ready from day one</strong> — all 52 chapters are already
            written. The dashboard only counts what's still open: chapters you flagged as{' '}
            <strong>Needs editing</strong>, missing photos, and decisions to make. When that list is
            empty, you're done.
          </p>
        ),
      },
    ],
  },
  {
    title: 'Getting Help',
    questions: [
      {
        q: "Something's broken or looks wrong — how do I tell you?",
        aText:
          'Use the Report a Problem / Send Feedback button. Choose the type of issue, describe what happened, and — most helpfully — attach a screenshot. A picture of what you are seeing helps us fix it much faster.',
        a: (
          <p>
            Use the <strong>Report a Problem / Send Feedback</strong> button. Choose the type of
            issue, describe what happened, and — most helpfully — <strong>attach a screenshot</strong>
            . A picture of what you're seeing helps us fix it much faster.
          </p>
        ),
      },
      {
        q: 'How else can I reach you?',
        aText: 'Email help@52thingstoknow.com any time.',
        a: (
          <p>
            Email <MailLink /> any time.
          </p>
        ),
      },
    ],
  },
  {
    title: 'Frequently Asked Questions',
    questions: [
      {
        q: 'Does my work save automatically?',
        aText:
          'No. Click Save Draft in a chapter to keep your changes. "• Unsaved changes" means you have not saved yet.',
        a: (
          <p>
            No. Click <strong>Save Draft</strong> in a chapter to keep your changes. "• Unsaved
            changes" means you haven't saved yet.
          </p>
        ),
      },
      {
        q: 'Do I have to finish the book all at once?',
        aText:
          'Not at all. Save your work and come back whenever you like — one chapter or ten at a time.',
        a: (
          <p>
            Not at all. Save your work and come back whenever you like — one chapter or ten at a
            time.
          </p>
        ),
      },
      {
        q: 'Can I change who the book is for after I start?',
        aText:
          "You can change the name and most details in Book Settings. The one locked field is Recipient's Gender / book version, since it shapes all 52 chapters — that requires starting a new book.",
        a: (
          <p>
            You can change the <strong>name</strong> and most details in Book Settings. The one
            locked field is <strong>Recipient's Gender / book version</strong>, since it shapes all
            52 chapters — that requires starting a new book.
          </p>
        ),
      },
      {
        q: "Why is a chapter still showing as open?",
        aText:
          "It's one of three things: you flagged it as Needs editing (open it, make your change, and it clears), it's a photo chapter with no photo yet (add one, or switch to the Classic layout), or there's a decision waiting on you.",
        a: (
          <p>
            It's one of three things: you flagged it as <strong>Needs editing</strong> (open it,
            make your change, and it clears), it's a photo chapter with no photo yet (
            <strong>add one, or switch to the Classic layout</strong>), or there's a decision
            waiting on you.
          </p>
        ),
      },
      {
        q: 'Do family members need an account?',
        aText:
          'No. They just click the link in the invitation email and share.',
        a: <p>No. They just click the link in the invitation email and share.</p>,
      },
      {
        q: 'Will family contributions show up automatically?',
        aText:
          'No. Nothing appears until you approve it and place it in a chapter. You are always in control.',
        a: (
          <p>
            No. Nothing appears until you <strong>approve</strong> it and <strong>place</strong> it
            in a chapter. You're always in control.
          </p>
        ),
      },
      {
        q: 'Do I need to resize my photos?',
        aText:
          'No — they are sized for you automatically (JPEG or PNG).',
        a: <p>No — they're sized for you automatically (JPEG or PNG).</p>,
      },
      {
        q: "I didn't get an email (confirmation, invite, or notification). What now?",
        aText:
          'Check your spam/junk folder first. If it is still missing, email help@52thingstoknow.com.',
        a: (
          <p>
            Check your spam/junk folder first. If it's still missing, email <MailLink />.
          </p>
        ),
      },
      {
        q: 'Can I print my book?',
        aText:
          'Not yet — printing comes after this testing phase. For now you can build, preview, and download a test PDF.',
        a: (
          <p>
            Not yet — printing comes after this testing phase. For now you can build, preview, and
            download a test PDF.
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
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackInitialFile, setFeedbackInitialFile] = useState<File | null>(null);
  const [feedbackCapturing, setFeedbackCapturing] = useState(false);

  const openFeedback = async () => {
    setFeedbackCapturing(true);
    try {
      const file = await captureScreen();
      setFeedbackInitialFile(file);
    } catch {
      setFeedbackInitialFile(null);
    } finally {
      setFeedbackCapturing(false);
      setFeedbackOpen(true);
    }
  };

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
        <p className="text-muted-foreground mb-4">
          Everything you need to create your book. If you get stuck, email <MailLink />.
        </p>
        <Button onClick={openFeedback} disabled={feedbackCapturing} className="mb-8 gap-1.5">
          {feedbackCapturing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MessageSquareWarning className="h-4 w-4" />
          )}
          Report a Problem / Send Feedback
        </Button>
        <FeedbackDialog
          open={feedbackOpen}
          onOpenChange={(v) => {
            setFeedbackOpen(v);
            if (!v) setFeedbackInitialFile(null);
          }}
          initialFile={feedbackInitialFile}
        />

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
