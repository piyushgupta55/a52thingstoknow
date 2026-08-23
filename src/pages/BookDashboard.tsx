import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toBookGender } from '@/lib/genderMap';

import { Button } from '@/components/ui/button';
import { applyReviewFlags, type ReviewAction } from '@/lib/reviewTags';

import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen, PenLine, CheckCircle, Circle, Mail, MessageSquare, Sparkles,
  Users, LayoutGrid, Send, Inbox, Camera, Play, Library, ShoppingCart, Download,
  Heart, Plus, Zap, GripVertical, ArrowUpDown, ChevronDown, ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';
import { saveAs } from 'file-saver';
import TutorialVideos from '@/components/TutorialVideos';
import { BookLockBanner } from '@/components/BookLockBanner';
import Navbar from '@/components/Navbar';
import { normalizeWhitespace } from '@/features/chapter-editor/textSplit';
import { replaceTokens } from '@/lib/tokenReplacer';
import { fetchMemoryInviteChapters } from '@/lib/memoryChapters';
import { useBookUnlocked } from '@/hooks/useBookUnlocked';
import { useIsAdmin } from '@/hooks/useIsAdmin';


interface Book {
  id: string;
  recipient_name: string;
  recipient_gender: string;
  relationship: string;
  occasion: string;
  from_label: string | null;
  author_label: string | null;
  user_id: string;
  gender: string;
}


interface Chapter {
  id: string;
  chapter_number: number;
  title: string;
  chapter_template: string;
  photo_urls: string[];
  is_photo_chapter: boolean;
  quote_text: string | null;
  quote_attribution: string | null;
  bible_verse_text: string | null;
  bible_verse_reference: string | null;
  content: string | null;
  reference_text: string | null;
  review_status: string | null;
  seed_content?: string | null;
  photo_declined?: boolean;
  reading_reward_decision?: string | null;
}


interface ChapterTemplate {
  chapter_number: number;
  title?: string;
  is_photo_chapter: boolean;
  reference_content?: string | null;
}


interface Memory {
  id: string;
  chapter_id: string | null;
  status: string;
  contributor_name: string;
  memory_text: string;
}

const BookDashboard = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const bookUnlocked = useBookUnlocked(bookId);
  const { isAdmin } = useIsAdmin();
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [photoTemplates, setPhotoTemplates] = useState<ChapterTemplate[]>([]);
  const [authorName, setAuthorName] = useState('');
  const [ancestryStatus, setAncestryStatus] = useState<string>('not_started');
  const [ancestry, setAncestry] = useState<{ content: string | null; pdf_url: string | null; upload_mime_type?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [familyStats, setFamilyStats] = useState<{ sent: number; responded: number; unseen: number }>({ sent: 0, responded: 0, unseen: 0 });
  const [memoryInviteChapters, setMemoryInviteChapters] = useState<number[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);
  const [tocExpanded, setTocExpanded] = useState(false);


  const handleGenerateTestPDF = async () => {
    setIsGeneratingPDF(true);
    console.log('PDF generation started');
    const startTime = performance.now();

    // Load review flags for all chapters so <review> keep/soften/remove is honored in the PDF.
    // The wrapper itself never leaves the client — inner text is applied per action before send.
    const chapterIds = chapters.map((c: any) => c.id).filter(Boolean);
    const { data: flagRows } = await supabase
      .from('chapter_review_flags')
      .select('chapter_id, tag_index, action')
      .in('chapter_id', chapterIds.length ? chapterIds : ['00000000-0000-0000-0000-000000000000']);
    const flagsByChapter: Record<string, Record<number, ReviewAction>> = {};
    (flagRows || []).forEach((r: any) => {
      (flagsByChapter[r.chapter_id] ??= {})[r.tag_index] = r.action as ReviewAction;
    });

    try {

      // Format bookData with real data fetched from Supabase
      const bookData = {
        title: "52 Things to Know",
        recipientName: book?.recipient_name || '',
        author: book?.from_label || authorName || 'The Author',
        ancestryText: ancestry?.content || undefined,
        ancestryPdfUrl: ancestry?.upload_mime_type?.startsWith('image/') ? undefined : ancestry?.pdf_url || undefined,
        ancestryImageUrl: ancestry?.upload_mime_type?.startsWith('image/') ? ancestry?.pdf_url || undefined : undefined,
        
        chapters: chapters
          .sort((a, b) => a.chapter_number - b.chapter_number)
          .map((ch: any) => ({
            title: ch.title,
            content: (() => {
              if (ch.chapter_number === 0) return normalizeWhitespace(ch.content || '');
              let refText = ch.reference_text || '';
              let mainContent = ch.content || '';
              if (!refText && !mainContent) {
                const tpl = photoTemplates.find(t => t.chapter_number === ch.chapter_number);
                if (tpl) {
                  const rawRef = tpl.reference_content;
                  if (rawRef) {
                    refText = replaceTokens(rawRef, {
                      recipientName: book?.recipient_name || 'your loved one',
                      recipientGender: book?.recipient_gender || '',
                      authorLabel: book?.author_label || null,
                    });
                  }
                }

              }
              const needsSpace = refText.length > 0 && mainContent.length > 0 && !/\s$/.test(refText) && !/^\s/.test(mainContent);
              const merged = normalizeWhitespace(refText + (needsSpace ? ' ' : '') + mainContent);
              return applyReviewFlags(merged, flagsByChapter[ch.id] || {});
            })(),

          chapter_number: ch.chapter_number,
          chapter_template: ch.chapter_template,
          photo_urls: ch.photo_urls || [],
          quote_text: ch.quote_text,
          quote_attribution: ch.quote_attribution,
          bible_verse_text: ch.bible_verse_text,
          bible_verse_reference: ch.bible_verse_reference,
          memories: memories.filter(m => m.chapter_id === ch.id).map(m => ({
            contributor_name: m.contributor_name,
            memory_text: m.memory_text
          }))
        }))
      };

      console.log('BookData Payload:', JSON.stringify(bookData, null, 2));

      const API_URL = import.meta.env.VITE_API_URL || 'https://a52thingstoknow-staging-pdf.onrender.com';
      const pdfEndpoint = `${API_URL}/generate-pdf`;

      const response = await fetch(pdfEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate PDF');
      }

      const blob = await response.blob();
      saveAs(blob, 'book-test.pdf');
      
      const endTime = performance.now();
      const timeInSeconds = ((endTime - startTime) / 1000).toFixed(2);
      
      console.log('PDF generation completed');
      console.log(`Generation time: ${timeInSeconds} seconds`);
      toast.success('Test PDF generated successfully');
    } catch (err: any) {
      console.error('PDF Generation Backend Error:', err);
      toast.error(err.message || 'Failed to generate PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const persistReorder = async (newOrder: Chapter[]) => {
    // newOrder is numbered chapters (excluding Letter ch 0) in new sequence; position i => chapter_number i+1
    if (!bookId) return;
    setSavingOrder(true);
    try {
      const titleByNumber = new Map<number, string>(
        (photoTemplates || []).map((t: any) => [t.chapter_number as number, t.title as string])
      );

      // Backfill any missing titles BEFORE renumbering, so content (incl. title) travels with the chapter.
      const withTitles = newOrder.map(c => ({
        ...c,
        title: c.title && c.title.trim().length > 0
          ? c.title
          : (titleByNumber.get(c.chapter_number) || c.title || ''),
      }));

      // Two-pass update to avoid the (book_id, chapter_number) unique-constraint collision.
      // Pass 1: move all to a temporary high range (offset 1000).
      for (const c of withTitles) {
        const { error } = await supabase
          .from('chapters')
          .update({ chapter_number: 1000 + c.chapter_number, title: c.title })
          .eq('id', c.id);
        if (error) throw error;
      }
      // Pass 2: assign final positions (1..N).
      for (let i = 0; i < withTitles.length; i++) {
        const c = withTitles[i];
        const finalNum = i + 1;
        const { error } = await supabase
          .from('chapters')
          .update({ chapter_number: finalNum })
          .eq('id', c.id);
        if (error) throw error;
      }

      // Reflect locally
      setChapters(prev => {
        const idToNew = new Map(withTitles.map((c, i) => [c.id, { num: i + 1, title: c.title }]));
        return prev.map(c => {
          const upd = idToNew.get(c.id);
          return upd ? { ...c, chapter_number: upd.num, title: upd.title } : c;
        });
      });
      toast.success('Chapter order saved');
    } catch (e: any) {
      console.error('Reorder failed', e);
      toast.error(e.message || 'Could not save the new order');
    } finally {
      setSavingOrder(false);
    }
  };

  useEffect(() => {
    if (!bookId) return;
    const fetchData = async () => {
      const { data: bookData } = await supabase.from('books').select('*').eq('id', bookId).single();
      const tplGender = toBookGender(bookData?.recipient_gender);
      const [{ data: chapData }, { data: memData }, { data: tplData }, { data: ancData }] = await Promise.all([
        supabase.from('chapters').select('*').eq('book_id', bookId).order('chapter_number'),
        supabase.from('memories').select('*').eq('book_id', bookId).or('entry_type.is.null,entry_type.eq.memory'),
        supabase.from('chapter_templates').select('chapter_number, title, is_photo_chapter, reference_content').eq('gender', tplGender),
        supabase.from('book_ancestry').select('status, content, pdf_url, upload_mime_type').eq('book_id', bookId).maybeSingle(),
      ]);
      if (ancData) {
        setAncestryStatus(ancData.status || 'not_started');
        setAncestry(ancData);
      }
      if (bookData && bookData.recipient_name) {
        bookData.recipient_name = bookData.recipient_name.trim().split(/\s+/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
      setBook(bookData);
      // Override stale chapter titles with authoritative gender-specific template titles
      const titleByNumber = new Map<number, string>((tplData || []).map((t: any) => [t.chapter_number as number, t.title as string]));
      const correctedChapters = (chapData || []).map((c: any) =>
        c.chapter_number > 0 ? { ...c, title: titleByNumber.get(c.chapter_number) || c.title } : c
      );
      setChapters(correctedChapters);
      setMemories(memData || []);
      setPhotoTemplates(tplData || []);
      setMemoryInviteChapters(await fetchMemoryInviteChapters());



      // Load family stats
      const [{ count: sentCount }, { data: familyMems }] = await Promise.all([
        supabase.from('memory_invitees').select('*', { count: 'exact', head: true }).eq('book_id', bookId),
        supabase.from('memories').select('id, seen_by_author_at').eq('book_id', bookId).eq('contributor_type', 'family'),
      ]);
      setFamilyStats({
        sent: sentCount || 0,
        responded: (familyMems || []).length,
        unseen: (familyMems || []).filter((m: any) => !m.seen_by_author_at).length,
      });

      if (bookData) {
        const { data: profile } = await supabase.from('profiles').select('display_name').eq('user_id', bookData.user_id).single();
        setAuthorName(profile?.display_name || '');
      }
      setLoading(false);
    };
    fetchData();
  }, [bookId]);

  // Always open the book dashboard at the top so the read-through section is seen first.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [bookId]);


  if (loading) return <div className="min-h-screen bg-background"><Navbar /><div className="container mx-auto px-4 py-20 text-center text-muted-foreground">Loading...</div></div>;
  if (!book) return <div className="min-h-screen bg-background"><Navbar /><div className="container mx-auto px-4 py-20 text-center text-muted-foreground">Book not found.</div></div>;

  const numberedChapters = chapters.filter(c => c.chapter_number > 0);
  const letterChapter = chapters.find(c => c.chapter_number === 0);
  // Progress is driven by review decisions, not by chapters.status.
  // Reviewed = keep or rewrite. Undecided = no review_status yet.
  const isReviewed = (c: Chapter) => c.review_status === 'keep' || c.review_status === 'rewrite';
  const completed = numberedChapters.filter(isReviewed).length;
  const undecided = numberedChapters.length - completed;
  const progress = numberedChapters.length > 0 ? (completed / numberedChapters.length) * 100 : 0;
  const nextChapter = chapters.find(c => !isReviewed(c));


  const memoriesPlaced = memories.filter(m => m.chapter_id != null).length;
  const memoriesUnplaced = memories.filter(m => m.chapter_id == null).length;

  // Photo chapter tracking
  const photoChapterNums = new Set(photoTemplates.filter(t => t.is_photo_chapter).map(t => t.chapter_number));
  const photoChaptersDesignated = chapters.filter(c => photoChapterNums.has(c.chapter_number)).length;
  const photosUploaded = chapters.filter(c => photoChapterNums.has(c.chapter_number) && c.photo_urls && c.photo_urls.length > 0).length;

  // Read-through tallies. Everything is kept by default; Add/Replace are optional marks.
  
  // Needs editing includes the Letter from the Author (chapter 0).
  const reviewRewrite = chapters.filter(c => c.review_status === 'rewrite').length;
  const readCount = numberedChapters.filter(c => !!(c as any).read_at).length;
  const notReviewed = numberedChapters.length - readCount;
  const reviewedCount = readCount;
  const reviewPath = bookUnlocked === false ? `/book/${bookId}/quick-read` : `/book/${bookId}/preview?review=1`;
  const hasRewardMark = (c: Chapter) => /<mark\b/i.test(`${c.seed_content || ''}\n${c.content || ''}`);
  // Photos & Decisions is pre-populated: every photo chapter plus the reading-reward chapter.
  const photosDecisionsOpen = numberedChapters.filter(c => {
    const isPhoto = c.is_photo_chapter || photoChapterNums.has(c.chapter_number);
    const needsPhoto = isPhoto && !(c.photo_urls && c.photo_urls.length > 0) && !c.photo_declined;
    const needsReward = hasRewardMark(c) && !c.reading_reward_decision;
    return needsPhoto || needsReward;
  }).length;
  // Memories is its own basket, pre-populated with the curated memory-invitation chapters.
  const memoriesOpen = numberedChapters.filter(
    c => memoryInviteChapters.includes(c.chapter_number) && !memories.some(m => m.chapter_id === c.id)
  ).length;


  // ── Readiness model: every chapter is complete by default. Only unresolved
  // photo spots and the missing reward decision keep the book from being ready.
  const openPhotoSpots = numberedChapters.filter(c =>
    (c.is_photo_chapter || photoChapterNums.has(c.chapter_number)) &&
    !(c.photo_urls && c.photo_urls.length > 0) &&
    !c.photo_declined
  ).length;
  const openRewardDecisions = numberedChapters.filter(c =>
    /<mark\b/i.test(`${c.seed_content || ''}\n${c.content || ''}`) && !c.reading_reward_decision
  ).length;
  const flaggedChapters = chapters.filter(
    c => c.review_status === 'rewrite'
  ).length;

  const blockingItems = openPhotoSpots + openRewardDecisions;
  const isReadyToPrint = blockingItems === 0;
  const readParts: string[] = [];
  if (openPhotoSpots > 0) readParts.push(`${openPhotoSpots} photo spot${openPhotoSpots === 1 ? '' : 's'}`);
  if (openRewardDecisions > 0) readParts.push(`${openRewardDecisions} reward decision${openRewardDecisions === 1 ? '' : 's'}`);
  if (flaggedChapters > 0) readParts.push(`${flaggedChapters} chapter${flaggedChapters === 1 ? '' : 's'} needing editing`);
  const openSummary = readParts.length
    ? `Your book is ready — ${readParts.join(' and ')} still to go.`
    : 'Your book is ready to print.';
  const totalOpen = blockingItems + flaggedChapters;
  const readinessPct = numberedChapters.length > 0
    ? Math.max(0, Math.round(100 - (totalOpen / numberedChapters.length) * 100))
    : 100;


  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <BookLockBanner bookId={book.id} />
      <div className="container mx-auto px-4 py-8 max-w-6xl">


        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">
              {book.recipient_name}'s Gift
            </h1>
            <p className="text-muted-foreground mt-1">
              {book.relationship} · {book.occasion}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate(`/book/${bookId}/settings`)}>
            Book Settings
          </Button>
        </div>

        {/* ONE primary hero — opening the book IS the read-through */}
        {(() => {
          const firstName = (book.recipient_name || '').trim().split(/\s+/)[0] || '';
          const bookTitle = firstName ? `${firstName}'s Book` : 'Your Book';
          const possessive = firstName ? `${firstName}'s` : 'Your';
          const started = reviewedCount > 0;
          const longName = firstName.length > 8;
          const buttonLabel = started
            ? `Continue reading${firstName && !longName ? ` ${firstName}'s book` : ''}`
            : firstName
              ? `Read ${firstName}'s book`
              : 'Read your book';
          return (
            <div className="bg-card rounded-xl border-2 border-primary p-7 md:p-8 mb-8 shadow-lg ring-4 ring-primary/10">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen className="h-5 w-5 text-primary" />
                      <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground">
                        {bookTitle}
                      </h2>
                    </div>
                    <p className="text-sm md:text-base text-muted-foreground max-w-2xl leading-relaxed">
                      All {numberedChapters.length || 52} chapters are written and ready to print — you could give this to {firstName || 'your loved one'} today. Read through it and note anything you'd want different, or open a chapter and change it yourself.
                    </p>
                  </div>
                  <div className="md:flex-shrink-0 flex flex-col gap-2 max-w-full">
                    <Button
                      size="lg"
                      className="text-base px-8 py-6 h-auto shadow-md max-w-full"
                      onClick={() => navigate(reviewPath)}
                    >
                      <BookOpen className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span className="truncate">{buttonLabel}</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      className="text-sm px-8 h-11 max-w-full"
                      onClick={() => navigate(`/book/${bookId}/chapters`)}
                    >
                      <LayoutGrid className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span className="truncate">Edit any chapter</span>
                    </Button>
                    <button
                      onClick={() => setTocExpanded(v => !v)}
                      className="inline-flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline mt-1"
                    >
                      All chapters — reorder or jump to one
                      {tocExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {tocExpanded && (
                  <div className="w-full border-t border-primary/10 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Table of Contents</h4>
                      <button
                        onClick={() => { setReorderMode(m => !m); setDragIndex(null); setOverIndex(null); }}
                        disabled={savingOrder}
                        className="inline-flex items-center gap-1 text-[0.65rem] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                        title="Drag chapters to reorder"
                      >
                        <ArrowUpDown className="h-3 w-3" />
                        {reorderMode ? 'Done' : 'Reorder'}
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto space-y-1">
                      {(() => {
                        const sorted = [...chapters].sort((a, b) => a.chapter_number - b.chapter_number);
                        const letter = sorted.find(c => c.chapter_number === 0);
                        const numbered = sorted.filter(c => c.chapter_number > 0);

                        const renderRow = (ch: Chapter, displayNum: number | null, draggable: boolean, idx: number) => {
                          const isKept = ch.review_status === 'keep';
                          const isFlagged = ch.review_status === 'rewrite';
                          const isLetter = displayNum === null;
                          const isDragging = dragIndex === idx;
                          const isOver = overIndex === idx && dragIndex !== null && dragIndex !== idx;

                          const inner = (
                            <>
                              {reorderMode && !isLetter && (
                                <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0 cursor-grab active:cursor-grabbing" />
                              )}
                              {isLetter ? (
                                <Mail className="h-3.5 w-3.5 text-primary/60 flex-shrink-0" />
                              ) : (
                                <span className="text-xs w-6 text-right flex-shrink-0 tabular-nums">{displayNum}.</span>
                              )}
                              <span className="truncate">{ch.title}</span>
                              {!reorderMode && isKept && <CheckCircle className="h-3.5 w-3.5 text-primary ml-auto flex-shrink-0" />}
                              {!reorderMode && isFlagged && <PenLine className="h-3.5 w-3.5 text-accent ml-auto flex-shrink-0" />}
                              {!reorderMode && !isKept && !isFlagged && (
                                <span className="text-[0.65rem] italic text-muted-foreground/40 ml-auto flex-shrink-0">undecided</span>
                              )}
                            </>
                          );

                          const cls = `flex items-center gap-2 w-full text-left py-1.5 px-2 rounded-md text-sm transition-colors text-foreground ${reorderMode ? 'bg-muted/20' : 'hover:bg-muted/50'} ${isDragging ? 'opacity-40' : ''} ${isOver ? 'ring-1 ring-primary/40 bg-primary/5' : ''}`;

                          if (reorderMode && draggable) {
                            return (
                              <div
                                key={ch.id}
                                draggable
                                onDragStart={() => setDragIndex(idx)}
                                onDragOver={(e) => { e.preventDefault(); if (overIndex !== idx) setOverIndex(idx); }}
                                onDragLeave={() => { if (overIndex === idx) setOverIndex(null); }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  if (dragIndex === null || dragIndex === idx) { setDragIndex(null); setOverIndex(null); return; }
                                  const next = [...numbered];
                                  const [moved] = next.splice(dragIndex, 1);
                                  next.splice(idx, 0, moved);
                                  setDragIndex(null);
                                  setOverIndex(null);
                                  const idToNew = new Map(next.map((c, i) => [c.id, i + 1]));
                                  setChapters(prev => prev.map(c => idToNew.has(c.id) ? { ...c, chapter_number: idToNew.get(c.id)! } : c));
                                  persistReorder(next);
                                }}
                                onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
                                className={cls}
                              >
                                {inner}
                              </div>
                            );
                          }

                          return (
                            <button
                              key={ch.id}
                              onClick={() => !reorderMode && navigate(`/book/${bookId}/chapter/${ch.id}`)}
                              disabled={reorderMode}
                              className={cls}
                            >
                              {inner}
                            </button>
                          );
                        };

                        return (
                          <>
                            {letter && renderRow(letter, null, false, -1)}
                            {numbered.map((ch, i) => renderRow(ch, i + 1, true, i))}
                          </>
                        );
                      })()}

                      {(() => {
                        const isComplete = ancestryStatus === 'complete';
                        const isInProgress = ancestryStatus === 'in_progress';
                        return (
                          <button
                            onClick={() => navigate(`/book/${bookId}/ancestry`)}
                            disabled={reorderMode}
                            className={`flex items-center gap-2 w-full text-left py-1.5 px-2 rounded-md text-sm transition-colors hover:bg-muted/50 mt-1 border-t border-border pt-3 text-foreground ${reorderMode ? 'opacity-50' : ''}`}
                          >
                            <BookOpen className="h-3.5 w-3.5 text-primary/60 flex-shrink-0" />
                            <span className="truncate">Where You Come From</span>
                            {isComplete && <CheckCircle className="h-3.5 w-3.5 text-primary ml-auto flex-shrink-0" />}
                            {!isComplete && (
                              <span className="text-[0.65rem] italic text-muted-foreground/40 ml-auto flex-shrink-0">
                                {isInProgress ? 'in progress' : 'not started'}
                              </span>
                            )}
                          </button>
                        );
                      })()}
                    </div>
                    {reorderMode && (
                      <p className="text-[0.65rem] italic text-muted-foreground/60 mt-3">
                        Drag chapters to reorder. Numbers follow position. The Letter stays first.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* What's still open — secondary status + baskets */}
        <div className="bg-card rounded-xl border border-border p-6 mb-8 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className={`h-5 w-5 ${isReadyToPrint ? 'text-primary' : 'text-muted-foreground'}`} />
            <h2 className="font-heading text-lg md:text-xl font-bold text-foreground">What's still open</h2>
          </div>

          <div className="flex items-start justify-between gap-4 mb-3">
            <span className="text-sm font-medium text-foreground">
              {(() => {
                const firstName = (book.recipient_name || '').trim().split(/\s+/)[0];
                const who = firstName ? `${firstName}'s book` : 'Your book';
                return readParts.length
                  ? `${who} is ready — ${readParts.join(' and ')} still to go.`
                  : `${who} is ready to print.`;
              })()}
            </span>
            {totalOpen > 0 && (
              <span className="text-sm font-semibold text-primary whitespace-nowrap">
                {totalOpen} open
              </span>
            )}
          </div>
          <Progress value={readinessPct} className="h-3 mb-2" />
          <p className="text-xs text-muted-foreground mb-4">
            {reviewedCount} of {numberedChapters.length} looked at · {photosUploaded} of {photoChaptersDesignated} photos added · {openRewardDecisions} reward decision{openRewardDecisions === 1 ? '' : 's'}
          </p>

          <div className="flex flex-wrap gap-x-6 gap-y-1 mb-5 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5 text-primary" />
              Photo chapters: <span className="font-semibold text-foreground">{photosUploaded}</span> of <span className="font-semibold text-foreground">{photoChaptersDesignated}</span> have photos
            </span>
          </div>

          <p className="text-xs text-muted-foreground/60 mb-3">Baskets — jump straight to a set of things to look at:</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => navigate(`/book/${bookId}/pile/rewrite`)}
              className="text-left rounded-lg border border-border p-3 bg-muted/20 hover:bg-muted/50 hover:border-primary/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <PenLine className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Needs editing</span>
              </div>
              <div className="font-heading text-xl font-bold text-foreground">{reviewRewrite}</div>
            </button>
            <button
              type="button"
              onClick={() => navigate(`/book/${bookId}/pile/photos`)}
              className="text-left rounded-lg border border-border p-3 bg-muted/20 hover:bg-muted/50 hover:border-primary/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Photos &amp; Decisions</span>
              </div>
              <div className="font-heading text-xl font-bold text-foreground">{photosDecisionsOpen}</div>
            </button>
            <button
              type="button"
              onClick={() => navigate(`/book/${bookId}/pile/memories`)}
              className="text-left rounded-lg border border-border p-3 bg-muted/20 hover:bg-muted/50 hover:border-primary/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Memories</span>
              </div>
              <div className="font-heading text-xl font-bold text-foreground">{memoriesOpen}</div>
            </button>
          </div>

        </div>


        {/* Status Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Chapters */}
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Chapters</h3>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-primary" />
                <span className="text-muted-foreground"><span className="font-semibold text-foreground">{numberedChapters.length}</span> chapters written &amp; ready</span>
              </div>
              <div className="flex items-center gap-2">
                <Camera className="h-3.5 w-3.5 text-accent" />
                <span className="text-muted-foreground"><span className="font-semibold text-foreground">{openPhotoSpots}</span> photo spots open</span>
              </div>
              <div className="flex items-center gap-2">
                <PenLine className="h-3.5 w-3.5 text-muted-foreground/60" />
                <span className="text-muted-foreground"><span className="font-semibold text-foreground">{flaggedChapters}</span> flagged (optional)</span>
              </div>

              <div className="flex items-center gap-2">
              <Camera className="h-3.5 w-3.5 text-primary" />
                <span className="text-muted-foreground"><span className="font-semibold text-foreground">{photoChaptersDesignated}</span> photo chapters</span>
              </div>
              <div className="flex items-center gap-2">
                <Camera className="h-3.5 w-3.5 text-primary fill-primary/20" />
                <span className="text-muted-foreground"><span className="font-semibold text-foreground">{photosUploaded}</span> photos uploaded</span>
              </div>
            </div>
          </div>

          {/* Memories */}
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Memories</h3>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <Inbox className="h-3.5 w-3.5 text-primary" />
                <span className="text-muted-foreground">
                  Memories in pool: <span className="font-semibold text-foreground">{memories.length}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-primary" />
                <span className="text-muted-foreground">
                  Memories placed: <span className="font-semibold text-foreground">{memoriesPlaced}</span> of {numberedChapters.length} chapters
                </span>
              </div>
            </div>
          </div>

          {/* Family */}
          <div className="text-left bg-card rounded-xl border border-border p-5 shadow-sm hover:border-primary/40 hover:shadow-md transition-all">
            <button onClick={() => navigate(`/book/${bookId}/memories`)} className="w-full text-left">
              <div className="flex items-center gap-2 mb-3">
                <Heart className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Family</h3>
                {familyStats.unseen > 0 && (
                  <Badge className="ml-auto text-[0.65rem] bg-primary text-primary-foreground">{familyStats.unseen} new</Badge>
                )}
              </div>
              <div className="space-y-1.5 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Send className="h-3.5 w-3.5 text-muted-foreground/60" />
                  <span><span className="font-semibold text-foreground">{familyStats.sent}</span> invites sent</span>
                </div>
                <div className="flex items-center gap-2">
                  <Inbox className="h-3.5 w-3.5 text-muted-foreground/60" />
                  <span><span className="font-semibold text-foreground">{familyStats.responded}</span> contributions received</span>
                </div>
              </div>
            </button>

            <div className="mt-4 pt-3 border-t border-border">
              <p className="text-[0.7rem] italic text-muted-foreground/80 mb-2">
                An optional two-page section at the back of the book, where you can write about the family and add a family tree.
              </p>
              <button
                onClick={() => navigate(`/book/${bookId}/ancestry`)}
                className="flex items-center gap-2 w-full text-left py-1.5 px-2 -mx-2 rounded-md text-sm text-foreground hover:bg-muted/50 transition-colors"
              >
                <BookOpen className="h-3.5 w-3.5 text-primary/60 flex-shrink-0" />
                <span className="truncate underline-offset-2 hover:underline">Where You Come From</span>
                <span className="ml-auto text-[0.65rem] text-muted-foreground flex-shrink-0">
                  {ancestryStatus === 'complete' ? 'Complete' : ancestryStatus === 'in_progress' ? 'In progress' : 'Not started'}
                </span>
              </button>
            </div>
          </div>



        </div>

        {/* How It Works */}
        <TutorialVideos />

        {/* Quick Actions + Book Preview */}
        <div className="grid lg:grid-cols-5 gap-8">

          {/* Quick Actions */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="font-heading text-lg font-bold text-foreground">Quick Actions</h2>
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={() => navigate(`/book/${bookId}/memories`)}>
                <Users className="h-4 w-4 text-primary" />
                Invite Family to Share Memories
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={() => navigate(`/book/${bookId}/memories`)}>
                <MessageSquare className="h-4 w-4 text-primary" />
                View Memory Pool
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={() => navigate(`/book/${bookId}/chapters`)}>
                <LayoutGrid className="h-4 w-4 text-primary" />
                View All Chapters
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={() => navigate(`/book/${bookId}/library`)}>
                <Library className="h-4 w-4 text-primary" />
                Chapter Library
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={() => navigate(`/book/${bookId}/review`)}>
                <Sparkles className="h-4 w-4 text-primary" />
                Review My Book
              </Button>
              <Button className="w-full justify-start gap-3 h-12" onClick={() => navigate(`/book/${bookId}/review?mode=order`)}>
                <ShoppingCart className="h-4 w-4" />
                Order Book
              </Button>
              {isAdmin && (
                <Button 
                  variant="secondary" 
                  className="w-full justify-start gap-3 h-12 mt-4 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20" 
                  onClick={handleGenerateTestPDF}
                  disabled={isGeneratingPDF}
                >
                  <Download className="h-4 w-4" />
                  {isGeneratingPDF ? 'Generating...' : 'Generate Test PDF'}
                </Button>
              )}
            </div>
          </div>

          {/* Book Cover — clickable entry to preview */}
          <div className="lg:col-span-3">
            <h2 className="font-heading text-lg font-bold text-foreground mb-4">Your Book</h2>
            <button
              onClick={() => navigate(`/book/${bookId}/preview`)}
              className="block w-full max-w-[280px] mx-auto cursor-pointer group transition-transform hover:scale-[1.02]"
              aria-label="See your finished book"
            >
              {/* Book cover card — portrait orientation */}
              <div
                className="relative rounded-sm overflow-hidden flex flex-col"
                style={{
                  aspectRatio: '5 / 7',
                  boxShadow: '4px 4px 20px rgba(0,0,0,0.18), 1px 1px 4px rgba(0,0,0,0.08)',
                }}
              >
                {/* Spine edge */}
                <div className="absolute left-0 top-0 bottom-0 w-[6px]" style={{ background: '#A8607A' }} />

                {/* Top pink band */}
                <div className="flex items-center justify-center" style={{ background: '#C4788A', padding: '18px 16px 14px' }}>
                  <p className="text-[15px] font-bold tracking-wide text-white" style={{ fontFamily: 'Georgia, serif' }}>
                    52 Things to Know
                  </p>
                </div>

                {/* Middle white section */}
                <div className="flex flex-col items-center justify-center flex-1 bg-white" style={{ padding: '28px 24px' }}>
                  {/* Ornamental divider */}
                  <div className="flex items-center gap-1.5 mb-4">
                    <span style={{ color: '#BBA96A', fontSize: '6px' }}>◆</span>
                    <span style={{ color: '#BBA96A', fontSize: '8px' }}>◆</span>
                    <span style={{ color: '#BBA96A', fontSize: '6px' }}>◆</span>
                  </div>

                  <p className="text-[10px] uppercase tracking-[0.2em] mb-1" style={{ color: '#9CA3AF', fontFamily: 'Georgia, serif' }}>
                    For
                  </p>
                  <p className="text-[22px] italic font-semibold mb-3" style={{ color: '#2D3748', fontFamily: 'Georgia, serif' }}>
                    {book.recipient_name}
                  </p>

                  {/* Gold line divider */}
                  <div className="w-12 mb-3" style={{ height: '1px', background: '#BBA96A' }} />

                  <p className="text-[9px] uppercase tracking-[0.15em] mb-0.5" style={{ color: '#9CA3AF', fontFamily: 'Georgia, serif' }}>
                    From
                  </p>
                  <p className="text-[13px] italic" style={{ color: '#4A5568', fontFamily: 'Georgia, serif' }}>
                    {book.from_label || authorName || 'The Author'}
                  </p>
                </div>

                {/* Bottom pink band */}
                <div style={{ background: '#C4788A', height: '10px' }} />
              </div>
            </button>
            <p className="text-center text-xs text-muted-foreground mt-3 italic">Click to preview your book</p>

          </div>
        </div>
      </div>
    </div>
  );
};

export default BookDashboard;
