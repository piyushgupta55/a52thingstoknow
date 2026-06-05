import { useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { replaceTokens } from '@/lib/tokenReplacer';
import { Button } from '@/components/ui/button';
import { Save, CheckCircle, AlertTriangle, Settings2, Check, Sparkles, MessageCircleHeart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Navbar from '@/components/Navbar';
import DevotionalVerse from '@/components/chapter/DevotionalVerse';
import DevotionalQuote from '@/components/chapter/DevotionalQuote';
import PhotoUploadZone from '@/components/chapter/PhotoUploadZone';
import TemplateSelector, { type ChapterTemplate } from '@/components/chapter/TemplateSelector';
import MemoryPlaceholder from '@/components/chapter/MemoryPlaceholder';
import PlacedMemory from '@/components/chapter/PlacedMemory';
import MemorySuggestion from '@/components/chapter/MemorySuggestion';
import { countWords } from '@/lib/page2Status';
import ChapterNav from '@/components/chapter/ChapterNav';
import ContentSearchPanel from '@/components/chapter/ContentSearchPanel';
import PageCanvas from '@/components/chapter/PageCanvas';
import CompanionBubble from '@/components/chapter/CompanionBubble';
import MemoryCaptureOverlay from '@/components/chapter/MemoryCaptureOverlay';
import { type CompanionEdit } from '@/hooks/useCompanionChat';
import {
  ISSUE_LABEL,
  MAX_CONTENT_LENGTH,
  MIN_PAGE_1_WORD_LIMIT,
  PAGE_1_WORD_LIMITS,
  WORD_BUDGETS,
} from '@/features/chapter-editor/constants';
import { validatePhoto } from '@/features/chapter-editor/photoValidation';
import { mergeRefAndContent } from '@/features/chapter-editor/textSplit';
import {
  PREVIEW_PHOTO_HORIZONTAL_HEIGHT,
  PREVIEW_PHOTO_VERTICAL_HEIGHT,
  PREVIEW_PHOTO_VERTICAL_WIDTH,
  PREVIEW_PAGE_HEIGHT,
  PREVIEW_PAGE_WIDTH,
} from '@/features/preview/geometry';
import { measureLayout, type LayoutMeasurementResult } from '@/features/preview/layoutMeasurement';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

const SERIF = "'Lora', 'Georgia', 'Times New Roman', serif";



interface ChapterData {
  id: string;
  book_id: string;
  chapter_number: number;
  title: string;
  bible_verse_text: string | null;
  bible_verse_reference: string | null;
  quote_text: string | null;
  quote_attribution: string | null;
  content: string | null;
  photo_urls: string[];
  status: string;
  verse_id: string | null;
  quote_id: string | null;
  chapter_template: string;
}

interface LibraryItem {
  id: string;
  text: string;
  attribution: string;
}

interface ChapterTemplateRow {
  chapter_number: number;
  is_photo_chapter: boolean;
  gender: string;
  title: string;
}

interface MemoryRow {
  id: string;
  chapter_id: string | null;
  memory_text: string;
  contributor_name: string;
  placed_at: string | null;
  created_at: string;
}

// Photo chapter designation is now loaded from database (chapter_templates.is_photo_chapter)
// instead of being hardcoded

const getChapterIndicatorStatus = (ch: { status: string }) => {
  if (ch.status === 'complete') return 'complete';
  if (ch.status === 'in_progress') return 'in_progress';
  return 'not_started';
};

interface ReviewIssue { id: string; type: string; snippet: string; message: string }

const ChapterEditor = () => {

  const { bookId, chapterId } = useParams<{ bookId: string; chapterId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const [reviewIssues, setReviewIssues] = useState<ReviewIssue[]>([]);
  const [checkedIssueIds, setCheckedIssueIds] = useState<Record<string, boolean>>({});
  const [reviewBannerDismissed, setReviewBannerDismissed] = useState(false);
  const { toast } = useToast();

  const [chapter, setChapter] = useState<ChapterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [bibleVerseText, setBibleVerseText] = useState('');
  const [bibleVerseRef, setBibleVerseRef] = useState('');
  const [quoteText, setQuoteText] = useState('');
  const [quoteAttribution, setQuoteAttribution] = useState('');
  const [content, setContent] = useState('');
  // Single source of truth for the merged chapter editor + ALL word-count
  // display. referenceText/content are derived from this only on save.
  const [mergedText, setMergedText] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [template, setTemplate] = useState<ChapterTemplate>('all_words');
  const [uploading, setUploading] = useState(false);
  const [verseId, setVerseId] = useState<string | null>(null);
  const [quoteId, setQuoteId] = useState<string | null>(null);

  const [editingVerse, setEditingVerse] = useState(false);
  const [editingQuote, setEditingQuote] = useState(false);
  const [previewMode, setPreviewMode] = useState(true);
  const [companionOpen, setCompanionOpen] = useState(false);
  const [printNotice, setPrintNotice] = useState(false);
  const printNoticeTimer = useRef<ReturnType<typeof setTimeout>>();
  const exactPreviewIframeRef = useRef<HTMLIFrameElement | null>(null);
  const exactPreviewRequestId = useRef(0);
  const [exactPreviewHtml, setExactPreviewHtml] = useState('');
  const [exactPreviewLoading, setExactPreviewLoading] = useState(false);
  const [exactPreviewError, setExactPreviewError] = useState<string | null>(null);
  const [chapterPreviewPageCount, setChapterPreviewPageCount] = useState(0);
  const [layoutMeasurement, setLayoutMeasurement] = useState<LayoutMeasurementResult | null>(null);

  const [referenceContent, setReferenceContent] = useState<string | null>(null);
  const [referenceText, setReferenceText] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [ancestryStatus, setAncestryStatus] = useState<string>('not_started');
  const [recipientGender, setRecipientGender] = useState('');
  const [authorLabel, setAuthorLabel] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [photoChapterCount, setPhotoChapterCount] = useState(0);
  const [maxPhotoChapters, setMaxPhotoChapters] = useState(15);
  const [isDesignatedPhotoChapter, setIsDesignatedPhotoChapter] = useState(false);
  const [layoutDrawerOpen, setLayoutDrawerOpen] = useState(false);

  const [duplicateWarning, setDuplicateWarning] = useState<{ type: 'verse' | 'quote'; chapterTitle: string; chapterNumber: number } | null>(null);

  const [searchPanelOpen, setSearchPanelOpen] = useState(false);
  const [searchPanelType, setSearchPanelType] = useState<'verse' | 'quote'>('verse');

  const [allChapters, setAllChapters] = useState<{ id: string; chapter_number: number; title: string; status: string; created_at: string; updated_at: string; content: string | null; verse_id: string | null; quote_id: string | null; bible_verse_text: string | null; quote_text: string | null; chapter_template: string; photo_urls?: string[] }[]>([]);
  const [photoChapterNums, setPhotoChapterNums] = useState<Set<number>>(new Set());
  const [memoryCountsByChapter, setMemoryCountsByChapter] = useState<Record<string, number>>({});
  const [placedMemories, setPlacedMemories] = useState<{ id: string; memory_text: string; contributor_name: string }[]>([]);
  const [unplacedMemories, setUnplacedMemories] = useState<{ id: string; memory_text: string; contributor_name: string }[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [overflowConfirm, setOverflowConfirm] = useState<{ memoryId: string } | null>(null);

  // Unsaved changes tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  // Memory capture
  const [memoryOverlayOpen, setMemoryOverlayOpen] = useState(false);
  const [memoryOverlayMode, setMemoryOverlayMode] = useState<'manual' | 'guided'>('manual');

  // Per-chapter flag: has the author edited the wisdom text?
  const [hasEditedWisdom, setHasEditedWisdom] = useState(false);

  // Track initial values for change detection and last saved for revert
  const initialRef = useRef({ referenceText: '', content: '' });
  const lastSavedRef = useRef({ referenceText: '', content: '' });
  const refTextareaRef = useRef<HTMLTextAreaElement>(null);
  const wisdomTextareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollPositionRef = useRef(0);

  const isPhotoTemplate = template === 'photo_top' || template === 'photo_second';
  const primaryPhotoUrl = (photoUrls[0] || '').trim();
  const hasUploadedPhoto = /^(https?:|data:image\/|blob:)/i.test(primaryPhotoUrl);
  const usesPhotoCapacity = isPhotoTemplate;
  const requiresPhotoForTemplate = isPhotoTemplate;
  const photoTemplateNeedsUpload = requiresPhotoForTemplate && !hasUploadedPhoto;
  const photoTemplateHelpMessage = photoTemplateNeedsUpload
    ? 'You need to add a photo or select a classic template.'
    : null;
  const effectiveTemplate = isPhotoTemplate ? template : 'all_words';
  const isLetterChapter = chapter?.chapter_number === 0;
  const budget = WORD_BUDGETS[effectiveTemplate] || WORD_BUDGETS.all_words;
  // Page-1 word boundary baseline.
  const basePage1Limit =
    effectiveTemplate === 'photo_top'
      ? PAGE_1_WORD_LIMITS.photo_top
      : PAGE_1_WORD_LIMITS.all_words;
  // In photo layouts, quotes/verses consume real vertical space before body
  // text. Apply a conservative penalty so editor split better matches PDF flow.
  const quoteBlocksCount = Number(Boolean((bibleVerseText || '').trim())) + Number(Boolean((quoteText || '').trim()));
  const quoteWords =
    countWords(bibleVerseText || '') +
    countWords(bibleVerseRef || '') +
    countWords(quoteText || '') +
    countWords(quoteAttribution || '');
  const quotePenalty = usesPhotoCapacity && quoteBlocksCount > 0
    ? Math.min(30, Math.max(8, Math.round(quoteWords * 0.5) + quoteBlocksCount * 4))
    : 0;
  const PAGE_1_WORD_LIMIT = Math.max(MIN_PAGE_1_WORD_LIMIT, basePage1Limit - quotePenalty);
  // Letter chapters use their own `content`-bound textarea; every other
  // chapter edits the single unified `mergedText` buffer.
  const editorText = isLetterChapter ? content : mergedText;
  const editorWordCount = countWords(editorText);
  // Author text that lands on page 2 = everything past the page-1 limit.
  const page2AuthorWords = isLetterChapter
    ? editorWordCount
    : Math.max(0, editorWordCount - PAGE_1_WORD_LIMIT);
  // The "want to add a memory?" hint should stay visible as long as there
  // is actually room for a memory on page 2 (≥40 words remaining) and
  // none has been placed yet. Earlier this was gated on page-2 author
  // words < 150, which made the hint vanish the instant the author
  // crossed page-2's halfway point even though plenty of room remained.
  const _page2BudgetTop = Math.max(0, budget - PAGE_1_WORD_LIMIT);
  const _placedMemoryCount = placedMemories?.length ?? 0;
  const _page2WordsTop = page2AuthorWords + _placedMemoryCount * 40;
  const page2RemainingTop = _page2BudgetTop - _page2WordsTop;
  const showMemoryPlaceholder =
    !isLetterChapter && _placedMemoryCount === 0 && page2RemainingTop >= 40;
  const isComplete = chapter?.status === 'complete';

  // Unified word count — all derived from the single editor buffer so the
  // numbers never shuffle as the author types across the page boundary.
  // The status counter is labelled "words available", so 1 typed word must
  // equal 1 budget point. We do NOT charge layout heuristics (paragraph
  // breaks, the empty memory placeholder) against this count; only real
  // placed memories still cost their conservative 40-word buffer below.
  const contentWords = countWords(content);
  const placedMemoryWords = (placedMemories ?? []).reduce((sum, m) => {
    return sum + countWords(m.memory_text);
  }, 0);
  const totalWords = editorWordCount + placedMemoryWords;

  const enterPreview = () => {
    setPreviewMode(true);
    setEditingVerse(false);
    setEditingQuote(false);
    setPrintNotice(true);
    if (printNoticeTimer.current) clearTimeout(printNoticeTimer.current);
    printNoticeTimer.current = setTimeout(() => setPrintNotice(false), 3000);
  };

  const exitPreview = () => {
    setPreviewMode(false);
    setPrintNotice(false);
    // The layout effect below resizes the textareas as soon as edit mode
    // is mounted — no timeout guesswork.
  };

  // Grow a textarea to fit its content without ever scrolling the window.
  // Resetting height to 'auto' then reading scrollHeight can nudge the page;
  // we snapshot scrollY and restore it so the caret never jumps out of view.
  const autoResize = useCallback((el?: HTMLTextAreaElement | null) => {
    if (!el) return;
    const scrollY = window.scrollY;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
    if (window.scrollY !== scrollY) window.scrollTo({ top: scrollY });
  }, []);

  // Reliable auto-resize on mount / when the editor becomes visible / when
  // the buffer changes. useLayoutEffect runs after the textarea is in the
  // DOM but before paint, so the chapter opens already sized — no empty gap.
  useLayoutEffect(() => {
    if (loading || previewMode) return;
    autoResize(wisdomTextareaRef.current);
    autoResize(refTextareaRef.current);
  }, [loading, previewMode, mergedText, content, autoResize]);

  useEffect(() => {
    const handleScroll = () => {
      scrollPositionRef.current = window.scrollY;
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // When arriving from Book Review's "Fix It", load all flagged issues for
  // this chapter and show them in a dismissible checklist banner at the top.
  useEffect(() => {
    if (!chapterId) return;
    setCheckedIssueIds({});
    setReviewBannerDismissed(false);
    try {
      const raw = sessionStorage.getItem(`bookReview:chapterIssues:${chapterId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setReviewIssues(parsed);
          setPreviewMode(false);
          return;
        }
      }
    } catch (error) {
      console.error('Failed to load review issues', error);
    }
    setReviewIssues([]);
  }, [chapterId]);


  useEffect(() => {
    if (!chapterId || !bookId) return;
    setLoading(true);
    setHasUnsavedChanges(false);
    setHasEditedWisdom(false);
    const load = async () => {
      const [{ data: chapterData }, { data: allCh }, { data: bookData }, { data: memoriesData }, { data: capData }, { data: allTpls }] = await Promise.all([
        supabase.from('chapters').select('*').eq('id', chapterId).single(),
        supabase.from('chapters').select('id, chapter_number, title, status, created_at, updated_at, content, verse_id, quote_id, bible_verse_text, quote_text, chapter_template, photo_urls').eq('book_id', bookId).order('chapter_number'),
        supabase.from('books').select('recipient_name, recipient_gender, user_id, author_label').eq('id', bookId).single(),
        supabase.from('memories').select('id, chapter_id, memory_text, contributor_name, placed_at, created_at').eq('book_id', bookId).order('placed_at', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true }),
        supabase.from('app_settings').select('value').eq('key', 'photo_chapter_cap').single(),
        supabase.from('chapter_templates').select('chapter_number, is_photo_chapter, gender, title'),
      ]);
      if (capData) setMaxPhotoChapters(Number(capData.value) || 15);
      const bookGender = bookData?.recipient_gender === 'Girl/Young Woman' ? 'female' : 'male';
      const genderTpls = ((allTpls || []) as ChapterTemplateRow[]).filter((t) => t.gender === bookGender);
      const photoNums = new Set<number>(genderTpls.filter((t) => t.is_photo_chapter).map((t) => t.chapter_number));
      setPhotoChapterNums(photoNums);
      // Map chapter_number -> authoritative title from templates (gender-specific)
      const titleByNumber = new Map<number, string>(genderTpls.map((t) => [t.chapter_number, t.title]));
      if (chapterData) {
        // Override stale chapter title with authoritative gender-specific template title
        const authoritativeTitle = chapterData.chapter_number > 0
          ? (titleByNumber.get(chapterData.chapter_number) || chapterData.title)
          : chapterData.title;
        setChapter({ ...chapterData, title: authoritativeTitle } as ChapterData);
        setBibleVerseText(chapterData.bible_verse_text || '');
        setBibleVerseRef(chapterData.bible_verse_reference || '');
        setQuoteText(chapterData.quote_text || '');
        setQuoteAttribution(chapterData.quote_attribution || '');
        setContent(chapterData.content || '');
        setPhotoUrls(chapterData.photo_urls || []);
        setTemplate((chapterData.chapter_template as ChapterTemplate) || 'all_words');
        setVerseId(chapterData.verse_id || null);
        setQuoteId(chapterData.quote_id || null);

        // Letter chapters (chapter_number=0) don't use chapter_templates
        if (chapterData.chapter_number === 0) {
          setIsDesignatedPhotoChapter(false);
          setReferenceContent(null);
          setReferenceText(chapterData.reference_text || '');
          // Letter editor binds to `content`; keep mergedText coherent.
          setMergedText(chapterData.content || '');
          setTemplate('letter' as ChapterTemplate);
          initialRef.current = { referenceText: chapterData.reference_text || '', content: chapterData.content || '' };
          lastSavedRef.current = { referenceText: chapterData.reference_text || '', content: chapterData.content || '' };
        } else {
          const isFemale = bookData?.recipient_gender === 'Girl/Young Woman';
          const tplGender = isFemale ? 'female' : 'male';
          const { data: tpl } = await supabase
            .from('chapter_templates')
            .select('reference_content_female, reference_content_male, is_photo_chapter')
            .eq('chapter_number', chapterData.chapter_number)
            .eq('gender', tplGender)
            .maybeSingle();
          setIsDesignatedPhotoChapter(tpl?.is_photo_chapter || false);
          const rawRef = isFemale ? tpl?.reference_content_female : tpl?.reference_content_male;
          setReferenceContent(rawRef || null);

          // Prefer saved reference_text; fall back to template
          const refVal = chapterData.reference_text
            ? chapterData.reference_text
            : (rawRef
                ? replaceTokens(rawRef, {
                    recipientName: bookData?.recipient_name || 'your child',
                    recipientGender: bookData?.recipient_gender || '',
                    authorLabel: bookData?.author_label,
                  })
                : '');
          const contentVal = chapterData.content || '';
          setReferenceText(refVal);
          // Seed the unified editor buffer from the saved split.
          setMergedText(mergeRefAndContent(refVal, contentVal));

          initialRef.current = { referenceText: chapterData.reference_text || rawRef || '', content: chapterData.content || '' };
          lastSavedRef.current = { referenceText: chapterData.reference_text || rawRef || '', content: chapterData.content || '' };
        }
      }
      if (bookData) {
        const capRecipient = bookData.recipient_name ? bookData.recipient_name.trim().split(/\s+/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '';
        setRecipientName(capRecipient);
        setRecipientGender(bookData.recipient_gender || '');
        setAuthorLabel(bookData.author_label || '');
        // Load author name from profile
        const { data: profileData } = await supabase.from('profiles').select('display_name').eq('user_id', bookData.user_id).single();
        setAuthorName(profileData?.display_name || '');
      }
      // Load ancestry status for the chapter dropdown
      const { data: ancData } = await supabase.from('book_ancestry').select('status').eq('book_id', bookId).maybeSingle();
      setAncestryStatus(ancData?.status || 'not_started');
      if (memoriesData) {
        const rows = memoriesData as MemoryRow[];
        const counts: Record<string, number> = {};
        rows.forEach((m) => { if (m.chapter_id) counts[m.chapter_id] = (counts[m.chapter_id] || 0) + 1; });
        setMemoryCountsByChapter(counts);
        setPlacedMemories(
          rows
            .filter((m) => m.chapter_id === chapterId)
            .map((m) => ({ id: m.id, memory_text: m.memory_text, contributor_name: m.contributor_name }))
        );
        setUnplacedMemories(
          rows
            .filter((m) => !m.chapter_id)
            .map((m) => ({ id: m.id, memory_text: m.memory_text, contributor_name: m.contributor_name }))
        );
        setSuggestionIndex(0);
      }
      if (allCh) {
        const withCorrectTitles = allCh.map((c) =>
          c.chapter_number > 0
            ? { ...c, title: titleByNumber.get(c.chapter_number) || c.title }
            : c
        );
        setAllChapters(withCorrectTitles);
        const siblings = withCorrectTitles.filter((c) => c.id !== chapterId);
        setPhotoChapterCount(siblings.filter((s) => s.chapter_template === 'photo_top' || s.chapter_template === 'photo_second').length);
      }
      setLoading(false);
      const thisHasContent = ((chapterData?.content || '') as string).trim().length > 0;
      setPreviewMode(!thisHasContent);
      // The merged textarea is sized by the useLayoutEffect below, which
      // fires reliably once the editor is mounted and visible — no fragile
      // setTimeout needed.
    };
    load();
  }, [chapterId, bookId]);

  // Auto-save removed — author saves explicitly via the Save Draft button.

  const siblingChapters = allChapters.filter(c => c.id !== chapterId);
  const chaptersForNav = allChapters.map(ch => ({
    ...ch,
    status: getChapterIndicatorStatus(ch),
    is_photo_chapter:
      photoChapterNums.has(ch.chapter_number) ||
      ch.chapter_template === 'photo_top' ||
      ch.chapter_template === 'photo_second',
    has_photo: (ch.photo_urls && ch.photo_urls.length > 0) || false,
  }));

  const checkDuplicate = useCallback((type: 'verse' | 'quote', id: string | null, text: string) => {
    if (!id && !text) return;
    const match = siblingChapters.find(ch => {
      if (id && type === 'verse') return ch.verse_id === id;
      if (id && type === 'quote') return ch.quote_id === id;
      if (text && type === 'verse') return ch.bible_verse_text === text;
      if (text && type === 'quote') return ch.quote_text === text;
      return false;
    });
    setDuplicateWarning(match ? { type, chapterTitle: match.title, chapterNumber: match.chapter_number } : null);
  }, [siblingChapters]);

  const canMarkComplete = () => {
    if (isLetterChapter) return true;
    
    // Enforce that Page 1 budget must be fully met before completing the chapter
    if (editorWordCount < PAGE_1_WORD_LIMIT) return false;

    const page2HasContent =
      page2AuthorWords > 0 ||
      placedMemories.length > 0 ||
      hasUploadedPhoto;
    return page2HasContent;
  };

  const handleMarkComplete = () => {
    if (!canMarkComplete()) {
      toast({
        title: 'Page 2 is empty',
        description: 'Continue writing, add a memory, or add a photo before completing this chapter.',
        variant: 'destructive',
      });
      return;
    }
    save(true);
  };

  const save = async (markComplete = false, statusOverride?: string) => {
    if (!chapterId) return;
    if (photoTemplateNeedsUpload) {
      toast({
        title: 'Photo required',
        description: 'You need to add a photo or select a classic template.',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    const savedAt = new Date().toISOString();
    const newStatus = statusOverride || (markComplete ? 'complete' : chapter?.status === 'complete' ? 'complete' : 'in_progress');

    // The split into page-1 (reference_text) / page-2 (content) is kept in
    // the live editor state and synced to the exact rendered preview DOM.
    let refToSave = referenceText;
    let contentToSave = content;

    const { error } = await supabase.from('chapters').update({
      bible_verse_text: bibleVerseText || null,
      bible_verse_reference: bibleVerseRef || null,
      quote_text: quoteText || null,
      quote_attribution: quoteAttribution || null,
      content: contentToSave || null,
      reference_text: refToSave || null,
      photo_urls: hasUploadedPhoto ? [primaryPhotoUrl] : [],
      chapter_template: template,
      verse_id: verseId,
      quote_id: quoteId,
      status: newStatus,
      updated_at: savedAt,
    }).eq('id', chapterId);

    if (error) {
      toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
    } else {
      // Sync the derived split into state so preview/revert reflect what
      // was persisted.
      setReferenceText(refToSave);
      setContent(contentToSave);
      setChapter(prev => prev ? { ...prev, status: newStatus } : prev);
      setAllChapters(prev => prev.map(c => c.id === chapterId ? { ...c, status: newStatus, updated_at: savedAt, content: contentToSave || null } : c));
      setHasUnsavedChanges(false);
      hasUnsavedRef.current = false;
      // Update last saved snapshot for revert
      lastSavedRef.current = { referenceText: refToSave || '', content: contentToSave || '' };
      toast({ title: markComplete ? 'Chapter marked complete!' : 'Draft saved!' });
      // If we came from another page (e.g. Book Review), return there after save.
      if (returnTo) {
        navigate(returnTo);
      } else if (markComplete) {
        // After Mark Complete, advance to the next chapter that isn't complete yet
        const nextIncomplete = allChapters
          .filter(c => c.id !== chapterId && c.chapter_number > (chapter?.chapter_number ?? 0))
          .sort((a, b) => a.chapter_number - b.chapter_number)
          .find(c => c.status !== 'complete')
          || allChapters
            .filter(c => c.id !== chapterId)
            .sort((a, b) => a.chapter_number - b.chapter_number)
            .find(c => c.status !== 'complete');
        if (nextIncomplete) {
          navigate(`/book/${bookId}/chapter/${nextIncomplete.id}`);
        }
      }
    }
    setSaving(false);
  };

  const handleCompanionApplyEdit = useCallback((nextContent: string, edit: CompanionEdit) => {
    if (edit.field === 'reference_text') {
      setReferenceText(nextContent);
      // Keep the unified editor buffer coherent with the new split half.
      if (!isLetterChapter) setMergedText(mergeRefAndContent(nextContent, content));
    } else {
      setContent(nextContent);
      setChapter(prev => prev ? { ...prev, content: nextContent } : prev);
      setAllChapters(prev => prev.map(c => c.id === chapterId ? { ...c, content: nextContent } : c));
      setMergedText(isLetterChapter ? nextContent : mergeRefAndContent(referenceText, nextContent));
    }
    setHasUnsavedChanges(true);
    // The layout effect resizes the textareas when mergedText/content change.
    toast({ title: 'Change applied', description: edit.summary });
  }, [chapterId, toast, isLetterChapter, content, referenceText]);

  const handleRevertToSaved = useCallback(() => {
    const saved = lastSavedRef.current;
    setReferenceText(saved.referenceText);
    setContent(saved.content);
    setMergedText(
      isLetterChapter ? saved.content : mergeRefAndContent(saved.referenceText, saved.content),
    );
    setChapter(prev => prev ? { ...prev, content: saved.content || null, reference_text: saved.referenceText || null } : prev);
    setAllChapters(prev => prev.map(c => c.id === chapterId ? { ...c, content: saved.content || null, reference_text: saved.referenceText || null } : c));
    setHasUnsavedChanges(false);
    hasUnsavedRef.current = false;
    // The layout effect resizes the textareas when mergedText/content change.
    toast({ title: 'Reverted to last saved' });
  }, [chapterId, toast, isLetterChapter]);

  // Warn on tab close / hard refresh
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  // Global in-app navigation interceptor while we have unsaved changes.
  // We monkey-patch history.pushState/replaceState and watch popstate so that
  // ANY navigation (Navbar links, logo, back button, chapter arrows) prompts first.
  const hasUnsavedRef = useRef(false);
  useEffect(() => { hasUnsavedRef.current = hasUnsavedChanges; }, [hasUnsavedChanges]);

  useEffect(() => {
    const currentPath = window.location.pathname + window.location.search;
    const origPush = window.history.pushState;
    const origReplace = window.history.replaceState;

    // Push a sentinel state so the first Back press fires popstate (which we intercept).
    window.history.pushState({ __chapterEditorSentinel: true }, '', currentPath);

    const intercept = (target: string): boolean => {
      // Allow same-URL navigations (no real change)
      if (target === currentPath) return false;
      if (!hasUnsavedRef.current) return false;
      setPendingNavigation(target);
      setShowUnsavedDialog(true);
      return true;
    };

    window.history.pushState = function (data: unknown, unused: string, url?: string | URL | null) {
      const target = url ? (typeof url === 'string' ? url : url.toString()) : currentPath;
      if (intercept(target)) return;
      return origPush.apply(this, [data, unused, url] as Parameters<History['pushState']>);
    };
    window.history.replaceState = function (data: unknown, unused: string, url?: string | URL | null) {
      const target = url ? (typeof url === 'string' ? url : url.toString()) : currentPath;
      if (intercept(target)) return;
      return origReplace.apply(this, [data, unused, url] as Parameters<History['replaceState']>);
    };

    const onPop = () => {
      if (hasUnsavedRef.current) {
        // Re-push sentinel so we stay on the page until user decides
        origPush.call(window.history, { __chapterEditorSentinel: true }, '', currentPath);
        setPendingNavigation('__BACK__');
        setShowUnsavedDialog(true);
      }
    };
    window.addEventListener('popstate', onPop);

    return () => {
      window.history.pushState = origPush;
      window.history.replaceState = origReplace;
      window.removeEventListener('popstate', onPop);
    };
  }, [chapterId]);

  // Used by ChapterNav arrows
  const tryNavigate = (targetChapterId: string) => {
    const target = `/book/${bookId}/chapter/${targetChapterId}`;
    if (hasUnsavedChanges) {
      setPendingNavigation(target);
      setShowUnsavedDialog(true);
      return;
    }
    navigate(target);
  };

  const proceedPendingNav = () => {
    const target = pendingNavigation;
    setPendingNavigation(null);
    if (!target) return;
    if (target === '__BACK__') {
      // Use raw history to bypass our patched pushState
      window.history.back();
    } else {
      navigate(target);
    }
  };

  const handleDialogSaveAndContinue = async () => {
    await save(false);
    // Force the ref false synchronously so the navigation interceptor
    // (which reads from hasUnsavedRef, updated only via useEffect after render)
    // does not re-trigger the prompt before React flushes the state update.
    hasUnsavedRef.current = false;
    setShowUnsavedDialog(false);
    proceedPendingNav();
  };

  const handleDialogDiscard = () => {
    setHasUnsavedChanges(false);
    hasUnsavedRef.current = false;
    setShowUnsavedDialog(false);
    proceedPendingNav();
  };

  const handleDialogCancel = () => {
    setShowUnsavedDialog(false);
    setPendingNavigation(null);
  };

  // —— Memory placement from in-editor suggestion ——
  const placeSuggestionMemory = async (memoryId: string) => {
    if (!chapterId) return;
    const { error } = await supabase
      .from('memories')
      .update({
        chapter_id: chapterId,
        status: 'placed',
        placed_at: new Date().toISOString(),
      })
      .eq('id', memoryId);
    if (error) {
      toast({ title: 'Could not place memory', description: error.message, variant: 'destructive' });
      return;
    }
    // Optimistic local update
    const placed = unplacedMemories.find(m => m.id === memoryId);
    if (placed) {
      setPlacedMemories(prev => [...prev, placed]);
      setUnplacedMemories(prev => prev.filter(m => m.id !== memoryId));
    }
    setSuggestionIndex(0);
    setHasUnsavedChanges(true);
    toast({ title: 'Memory placed — remember to Save Draft.' });
  };

  const handlePlaceSuggestion = (memoryId: string) => {
    // Overflow check: would adding this memory push the chapter past budget?
    // Mirrors the page-2 status formula below — per client spec: paragraph
    // break = 3 words, memory slot = 40 words.
    const projectedMemoryCount = placedMemories.length + 1;
    const totalParagraphBreaks = (mergedText.match(/\n\n+/g) || []).length;
    const projected =
      editorWordCount + totalParagraphBreaks * 3 + projectedMemoryCount * 40;
    if (projected > budget) {
      setOverflowConfirm({ memoryId });
      return;
    }
    placeSuggestionMemory(memoryId);
  };

  const handleUnplaceMemory = async (memoryId: string) => {
    const target = placedMemories.find(m => m.id === memoryId);
    const { error } = await supabase
      .from('memories')
      .update({ chapter_id: null, status: 'unplaced', placed_at: null })
      .eq('id', memoryId);
    if (error) {
      toast({ title: 'Could not remove memory', description: error.message, variant: 'destructive' });
      return;
    }
    setPlacedMemories(prev => prev.filter(m => m.id !== memoryId));
    if (target) setUnplacedMemories(prev => [...prev, target]);
    setHasUnsavedChanges(true);
    toast({ title: 'Memory returned to pool — remember to Save Draft.' });
  };

  const [photoWarning, setPhotoWarning] = useState<string | null>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length) return;
    if (photoUrls.length >= 1) {
      toast({ title: 'Maximum 1 photo per chapter', variant: 'destructive' });
      return;
    }
    const file = files[0];
    const variant = template === 'photo_second' ? 'vertical' : 'horizontal';
    const result = await validatePhoto(file, variant);
    if (!result.valid) {
      toast({ title: 'Photo not accepted', description: result.error, variant: 'destructive' });
      return;
    }
    if (result.warning) {
      setPhotoWarning(result.warning);
    } else {
      setPhotoWarning(null);
    }
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${bookId}/${chapterId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('chapter-photos').upload(path, file);
    if (error) {
      toast({ title: 'Upload error', description: error.message, variant: 'destructive' });
    } else {
      const { data: { publicUrl } } = supabase.storage.from('chapter-photos').getPublicUrl(path);
      setPhotoUrls([publicUrl]);
      setHasUnsavedChanges(true);
      // Auto-switch to photo template if currently classic
      if (template === 'all_words') {
        setTemplate('photo_top');
      }
    }
    setUploading(false);
  };

  const removePhoto = () => {
    setPhotoUrls([]);
    setPhotoWarning(null);
    setHasUnsavedChanges(true);
  };

  const handleAddPhotoPrompt = () => {
    setTemplate('photo_top');
    setLayoutDrawerOpen(false);
    setHasUnsavedChanges(true);
  };

  const handleFindAlternatives = (type: 'verse' | 'quote') => {
    setSearchPanelType(type);
    setSearchPanelOpen(true);
  };

  const handleSelectFromPanel = async (item: LibraryItem) => {
    if (searchPanelType === 'verse') {
      setBibleVerseText(item.text);
      setBibleVerseRef(item.attribution);
      setVerseId(null);
      checkDuplicate('verse', item.id, item.text);
    } else {
      setQuoteText(item.text);
      setQuoteAttribution(item.attribution);
      setQuoteId(null);
      checkDuplicate('quote', item.id, item.text);
    }
    setHasUnsavedChanges(true);
    setSearchPanelOpen(false);
    toast({ title: `${searchPanelType === 'verse' ? 'Bible verse' : 'Quote'} swapped — remember to Save Draft.` });
  };

  const handleChapterNavigate = (targetChapterId: string) => {
    tryNavigate(targetChapterId);
  };

  // Paste handler — strips HTML, keeps plain text only
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    // Insert at cursor for textarea
    const target = e.target as HTMLTextAreaElement;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const current = target.value;
    const newValue = current.slice(0, start) + text + current.slice(end);
    // Determine which setter to use based on the textarea
    return { text, newValue, cursorPos: start + text.length };
  };

  // Render one line of chapter text. Supports a small inline markdown
  // subset PLUS the <mark> HTML tag:
  //   <mark>text</mark>  → yellow-highlight span
  //   **text**           → bold
  //   ~~text~~           → strikethrough
  //   `text`             → inline code
  //   *text* / _text_    → italic
  // Order in the alternation matters: the longest markers first so a
  // shorter one (e.g. single `*`) does not eat half of `**bold**`. The
  // inner runs forbid the marker char itself so a stray "*" in normal
  // prose ("rate this 4 * star") never accidentally starts a span.
  const renderInline = (line: string, variant: 'body' | 'reference' = 'body'): React.ReactNode => {
    if (!line) return null;
    const inItalicBody = variant === 'reference';
    const re =
      /<mark[^>]*>([\s\S]*?)<\/mark>|\*\*([^*\n]+?)\*\*|~~([^~\n]+?)~~|`([^`\n]+?)`|\*([^*\n]+?)\*|_([^_\n]+?)_/g;
    const parts: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    let k = 0;
    // The chapter body is now upright, so *italic* / _italic_ markdown
    // renders as plain italic text — visibly different from the
    // surrounding upright body.
    const emStyle: React.CSSProperties = { fontStyle: 'italic' };
    void inItalicBody; // variant kept on the signature for future use
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) parts.push(line.slice(last, m.index));
      if (m[1] !== undefined) {
        // <mark>
        parts.push(
          <mark
            key={`mk${k++}`}
            style={{
              backgroundColor: '#FEF3C7',
              color: 'inherit',
              padding: '0 2px',
              borderRadius: '2px',
            }}
          >
            {m[1]}
          </mark>,
        );
      } else if (m[2] !== undefined) {
        parts.push(<strong key={`b${k++}`}>{m[2]}</strong>);
      } else if (m[3] !== undefined) {
        parts.push(<s key={`s${k++}`}>{m[3]}</s>);
      } else if (m[4] !== undefined) {
        parts.push(
          <code
            key={`c${k++}`}
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: '0.92em',
              background: 'rgba(0,0,0,0.05)',
              padding: '0 4px',
              borderRadius: '2px',
            }}
          >
            {m[4]}
          </code>,
        );
      } else if (m[5] !== undefined) {
        parts.push(<em key={`i${k++}`} style={emStyle}>{m[5]}</em>);
      } else if (m[6] !== undefined) {
        parts.push(<em key={`u${k++}`} style={emStyle}>{m[6]}</em>);
      }
      last = m.index + m[0].length;
    }
    if (last < line.length) parts.push(line.slice(last));
    if (parts.length === 0) return line;
    return parts.length === 1 ? parts[0] : parts;
  };

  const renderParagraphs = (text: string, withDropCap: boolean, suppressDropCap: boolean, variant: 'body' | 'reference' = 'body') => {
    const paragraphs = text.split(/\n\n+/).filter(Boolean);
    return paragraphs.map((p, i) => {
      const lines = p.split('\n');
      return (
        <p
          key={i}
          className={`text-[11pt] leading-[1.7] text-foreground/80 ${i === 0 && withDropCap && !suppressDropCap ? 'drop-cap' : ''}`}
          style={{
            fontFamily: 'var(--font-devotional)',
            marginBottom: i < paragraphs.length - 1 ? '0.9em' : 0,
            textAlign: 'justify',
            textJustify: 'inter-word',
            hyphens: 'auto',
            WebkitHyphens: 'auto',
          }}
        >
          {lines.map((line, idx) => (
            <span key={idx}>
              {renderInline(line, variant) ?? '\u00A0'}
              {idx < lines.length - 1 && <br />}
            </span>
          ))}
        </p>
      );
    });
  };

  const renderPhotoZone = (variant: 'horizontal' | 'vertical' = 'horizontal') => {
    if (previewMode) {
      if (!hasUploadedPhoto) return null;
      const isVert = variant === 'vertical';
      return (
        <div
          className={`rounded-sm overflow-hidden mb-6 ${isVert ? 'flex justify-center' : ''}`}
          style={{
            width: isVert ? `${PREVIEW_PHOTO_VERTICAL_WIDTH}px` : '100%',
            height: isVert ? `${PREVIEW_PHOTO_VERTICAL_HEIGHT}px` : `${PREVIEW_PHOTO_HORIZONTAL_HEIGHT}px`,
            marginLeft: 'auto',
            marginRight: 'auto',
            marginBottom: isVert ? '1.5em' : '1em',
            borderRadius: '2px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          }}
        >
          <img
            src={primaryPhotoUrl}
            alt="Chapter photo"
            className="object-cover"
            style={{
              width: '100%',
              height: '100%',
            }}
          />
        </div>
      );
    }
    return (
      <PhotoUploadZone
        photoUrls={hasUploadedPhoto ? [primaryPhotoUrl] : []}
        uploading={uploading}
        onUpload={handlePhotoUpload}
        onRemove={() => removePhoto()}
        variant={variant}
      />
    );
  };

  // Word count color helper
  const wordCountColor = (count: number, limit: number) => {
    if (limit && count > limit) return '#EF4444';
    if (limit && count >= limit * 0.9) return '#D97706';
    return '#16A34A';
  };

  useEffect(() => {
    if (!chapter) return;

    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const chapterPayload = {
      chapter_number: chapter.chapter_number,
      title: chapter.title,
      chapter_template: template,
      content: isLetterChapter ? mergeRefAndContent(referenceText, content) : mergedText,
      photo_urls: hasUploadedPhoto ? [primaryPhotoUrl] : [],
      bible_verse_text: bibleVerseText || null,
      bible_verse_reference: bibleVerseRef || null,
      quote_text: quoteText || null,
      quote_attribution: quoteAttribution || null,
      memories: placedMemories.map(m => ({
        memory_text: m.memory_text,
        contributor_name: m.contributor_name,
      })),
    };

    const loadExactPreview = async () => {
      const requestId = ++exactPreviewRequestId.current;
      setExactPreviewLoading(true);
      setExactPreviewError(null);
      try {
        const response = await fetch(`${apiBase}/generate-preview-html`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'A Book of Wisdom',
            author: authorName || 'The Author',
            recipientName,
            chapters: [chapterPayload],
          }),
        });
        if (requestId !== exactPreviewRequestId.current) return;
        if (!response.ok) throw new Error(`Preview HTML failed (${response.status})`);
        setExactPreviewHtml(await response.text());
      } catch (err) {
        if (requestId !== exactPreviewRequestId.current) return;
        setExactPreviewError(err instanceof Error ? err.message : 'Failed to load exact preview HTML');
      } finally {
        if (requestId !== exactPreviewRequestId.current) return;
        setExactPreviewLoading(false);
      }
    };

    loadExactPreview();
  }, [chapter, template, mergedText, referenceText, content, hasUploadedPhoto, primaryPhotoUrl, bibleVerseText, bibleVerseRef, quoteText, quoteAttribution, placedMemories, authorName, recipientName, isLetterChapter]);

  const syncExactPreview = () => {
    const iframe = exactPreviewIframeRef.current;
    if (!iframe?.contentDocument || !chapter) return;

    const doc = iframe.contentDocument;
    const chapterKey = String(chapter.chapter_number);
    const waitForLayoutFinal = async () => {
      for (let i = 0; i < 120; i += 1) {
        if (doc.body?.classList.contains('layout-final')) break;
        await new Promise(resolve => window.setTimeout(resolve, 50));
      }

      const pageNodes = Array.from(doc.querySelectorAll(`.page[data-chapter="${chapterKey}"]`));
      if (pageNodes.length === 0) return;

      const wrapper = doc.createElement('div');
      wrapper.style.display = 'flex';
      wrapper.style.flexDirection = 'column';
      wrapper.style.alignItems = 'center';
      wrapper.style.gap = '32px';
      wrapper.style.padding = '24px 0';
      wrapper.style.width = '100%';

      pageNodes.forEach((node) => {
        wrapper.appendChild(node.cloneNode(true));
      });

      doc.body.innerHTML = '';
      doc.body.style.margin = '0';
      doc.body.style.background = '#faf8f5';
      doc.body.style.display = 'flex';
      doc.body.style.justifyContent = 'center';
      doc.body.style.overflowY = 'auto';
      doc.documentElement.style.overflowY = 'auto';

      let hideScrollbars = doc.getElementById('preview-scrollbar-hide');
      if (!hideScrollbars) {
        hideScrollbars = doc.createElement('style');
        hideScrollbars.id = 'preview-scrollbar-hide';
        hideScrollbars.textContent = `
          html, body { scrollbar-width: none; -ms-overflow-style: none; }
          html::-webkit-scrollbar, body::-webkit-scrollbar { display: none; }
        `;
        doc.head.appendChild(hideScrollbars);
      }
      doc.body.appendChild(wrapper);
      setChapterPreviewPageCount(pageNodes.length);
      setLayoutMeasurement(measureLayout(doc));
    };

    void waitForLayoutFinal();
  };

  const handleCompanionRequestEdit = () => {
    if (previewMode) {
      exitPreview();
      setCompanionOpen(true);
    }
  };

  const companionSlotEl = bookId && chapterId ? (
    <CompanionBubble
      bookId={bookId}
      chapterId={chapterId}
      chapterTitle={chapter?.title}
      onRequestEdit={previewMode ? handleCompanionRequestEdit : undefined}
      forceOpen={companionOpen}
      onClose={() => setCompanionOpen(false)}
      currentContent={content}
      currentReferenceText={referenceText}
      onApplyEdit={handleCompanionApplyEdit}
      onRevert={handleRevertToSaved}
      variant="badge"
    />
  ) : null;

  const exactPreviewHeight = Math.max(1, chapterPreviewPageCount || 1) * PREVIEW_PAGE_HEIGHT + Math.max(0, chapterPreviewPageCount - 1) * 32 + 48;

  if (loading) return (
    <div className="min-h-screen bg-[hsl(var(--devotional-bg))]">
      <Navbar />
      <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">Loading…</div>
    </div>
  );

  if (!chapter) return (
    <div className="min-h-screen bg-[hsl(var(--devotional-bg))]">
      <Navbar />
      <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">Chapter not found.</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[hsl(var(--devotional-bg))]">
      <Navbar />

      {/* Toolbar */}
      <div className="sticky top-0 z-20 border-b border-[hsl(var(--devotional-border))]" style={{ background: 'hsla(40, 33%, 97%, 0.95)', backdropFilter: 'blur(8px)' }}>
        <div className="container mx-auto max-w-[720px] px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {recipientName && (
              <div
                className="text-[0.65rem] uppercase tracking-wider text-muted-foreground/70 truncate max-w-[120px] sm:max-w-[180px] flex-shrink-0"
                style={{ fontFamily: 'var(--font-body)' }}
                title={`${recipientName}'s Book`}
              >
                {recipientName}'s Book
              </div>
            )}

            <ChapterNav
              currentChapter={chapter.chapter_number}
              totalChapters={allChapters.filter(c => c.chapter_number > 0).length || 52}
              chapters={chaptersForNav}
              onNavigate={handleChapterNavigate}
              memoryCountsByChapter={memoryCountsByChapter}
              ancestryStatus={ancestryStatus}
              onNavigateAncestry={() => {
                const target = `/book/${bookId}/ancestry`;
                if (hasUnsavedChanges) {
                  setPendingNavigation(target);
                  setShowUnsavedDialog(true);
                } else {
                  navigate(target);
                }
              }}
            />
          </div>

          <div className="flex items-center rounded-sm overflow-hidden border border-[hsl(var(--devotional-border))] flex-shrink-0" style={{ fontFamily: 'var(--font-body)' }}>
            <button
              onClick={exitPreview}
              className={`px-3 py-1 text-[0.65rem] uppercase tracking-wider transition-colors ${
                !previewMode ? 'text-white font-semibold' : 'text-muted-foreground/50 hover:text-muted-foreground'
              }`}
              style={!previewMode ? { background: '#C9A84C' } : undefined}
            >
              Edit
            </button>
            <button
              onClick={enterPreview}
              className={`px-3 py-1 text-[0.65rem] uppercase tracking-wider transition-colors ${
                previewMode ? 'bg-foreground/10 text-foreground font-semibold' : 'text-muted-foreground/50 hover:text-muted-foreground'
              }`}
            >
              Preview
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Unsaved-changes indicator — visible in edit mode */}
            {!previewMode && hasUnsavedChanges && (
              <span
                className="text-[0.6rem] uppercase tracking-wider text-muted-foreground/70"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                • Unsaved changes
              </span>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setMemoryOverlayMode('manual'); setMemoryOverlayOpen(true); }}
              className="gap-1.5 text-xs h-8"
              title="Add a memory to the pool"
            >
              <MessageCircleHeart className="h-3.5 w-3.5" /> Memory
            </Button>

            {!previewMode && (
              <Button variant="ghost" size="sm" onClick={() => save(false)} disabled={saving || photoTemplateNeedsUpload} className="gap-1.5 text-xs h-8">
                <Save className="h-3 w-3" /> {saving ? 'Saving…' : 'Save Draft'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Print notice */}
      {printNotice && previewMode && (
        <div className="text-center py-2 animate-fade-in">
          <p className="text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground/40 animate-fade-out" style={{ fontFamily: 'var(--font-body)', animationDelay: '2s', animationFillMode: 'forwards' }}>
            This is how your chapter will print
          </p>
        </div>
      )}

      {/* Content area */}
      <div className="py-8 px-4">

        {/* Book Review Fix-It checklist — author ticks off issues as they
            edit. Dismissible. Re-scan happens automatically on save+return. */}
        {!reviewBannerDismissed && reviewIssues.length > 0 && (
          <div className="mx-auto max-w-[600px] mb-4">
            <div className="bg-accent/10 border border-accent/30 rounded-sm p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-foreground" style={{ fontFamily: 'var(--font-body)' }}>
                      Book Review found {reviewIssues.length} issue{reviewIssues.length === 1 ? '' : 's'} in this chapter
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
                      Tick each one as you fix it. We'll re-check when you save and return.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReviewBannerDismissed(true)}
                  className="text-xs text-muted-foreground hover:text-foreground flex-shrink-0"
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </div>
              <ul className="space-y-2">
                {reviewIssues.map(iss => {
                  const checked = !!checkedIssueIds[iss.id];
                  const label = ISSUE_LABEL[iss.type] || 'Issue';
                  const detail = (iss.snippet || iss.message || '').trim();
                  return (
                    <li key={iss.id} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e =>
                          setCheckedIssueIds(prev => ({ ...prev, [iss.id]: e.target.checked }))
                        }
                        className="mt-1 h-4 w-4 rounded border-accent/40 accent-[hsl(var(--accent))] cursor-pointer flex-shrink-0"
                      />
                      <span
                        className={`text-sm ${checked ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                        style={{ fontFamily: 'var(--font-body)' }}
                      >
                        <span className="font-medium">{label}:</span>{' '}
                        <span className="italic">{detail}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}





        {/* Duplicate warning */}
        {!previewMode && duplicateWarning && (
          <div className="mx-auto max-w-[600px] mb-4">
            <div className="flex items-start gap-3 bg-accent/10 border border-accent/20 rounded-sm p-4">
              <AlertTriangle className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
              <p className="text-xs text-foreground/70" style={{ fontFamily: 'var(--font-body)' }}>
                This {duplicateWarning.type === 'verse' ? 'verse' : 'quote'} is already used in Chapter {duplicateWarning.chapterNumber}: {duplicateWarning.chapterTitle}. Use "swap" to find a different one.
              </p>
            </div>
          </div>
        )}

        {previewMode ? (
          <div className="flex justify-center py-4 px-2 sm:px-4">
            {exactPreviewLoading && !exactPreviewHtml ? (
              <div className="text-muted-foreground">Loading exact preview…</div>
            ) : exactPreviewError ? (
              <div className="text-sm text-red-500">{exactPreviewError}</div>
            ) : (
              <iframe
                ref={exactPreviewIframeRef}
                title="Exact chapter preview"
                srcDoc={exactPreviewHtml}
                onLoad={syncExactPreview}
                className="border-0 bg-transparent"
                style={{
                  width: '100%',
                  maxWidth: '100%',
                  height: 'calc(100vh - 170px)',
                  display: 'block',
                  margin: '0 auto',
                  pointerEvents: 'auto',
                }}
                />
              )}
          </div>
        ) : isLetterChapter ? (
          /* ═══ LETTER EDIT MODE ═══ */
          <PageCanvas previewMode={false} companionSlot={companionSlotEl}>
            <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground/40 mb-2" style={{ fontFamily: 'var(--font-body)' }}>
              Letter from the Author
            </p>
            <h1 className="text-[32px] font-bold leading-tight text-foreground mb-1" style={{ fontFamily: 'var(--font-heading)' }}>
              {chapter.title}
            </h1>
            <div className="mb-6" />

            <div className="my-8 relative">
              <div className="transition-all duration-200 rounded-sm inline-block w-full relative" style={{ borderLeft: '3px solid #C9A84C', background: '#FDFAF4', margin: '0 -8px', padding: '12px 8px 12px 19px' }}>
                <textarea
                  ref={wisdomTextareaRef}
                  placeholder=""
                  value={content}
                  onChange={e => {
                    const ta = e.target;
                    if (ta.value.length <= MAX_CONTENT_LENGTH) {
                      setContent(ta.value);
                      setHasUnsavedChanges(true);
                    }
                    autoResize(ta);
                  }}
                  onPaste={e => {
                    e.preventDefault();
                    // Normalize Windows CRLF to LF so text.length matches what
                    // the textarea actually stores — otherwise the caret
                    // overshoots by one position per line break.
                    const text = e.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n');
                    const ta = e.target as HTMLTextAreaElement;
                    const start = ta.selectionStart;
                    const end = ta.selectionEnd;
                    const newVal = content.slice(0, start) + text + content.slice(end);
                    if (newVal.length > MAX_CONTENT_LENGTH) return;
                    setContent(newVal);
                    setHasUnsavedChanges(true);
                    const caret = start + text.length;
                    requestAnimationFrame(() => {
                      ta.selectionStart = ta.selectionEnd = caret;
                      autoResize(ta);
                    });
                  }}
                  rows={6}
                  className="relative w-full border-0 bg-transparent resize-none outline-none px-0 text-[15px] leading-[1.8] text-foreground/80"
                  style={{ fontFamily: 'var(--font-devotional)', overflow: 'hidden' }}
                />
              </div>
            </div>

            <div className="text-center mt-8 pt-4 border-t border-[hsl(var(--devotional-border))]">
              <span className="font-medium" style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: wordCountColor(contentWords, budget) }}>
                Letter · {contentWords} / {budget} words
              </span>
            </div>
          </PageCanvas>
        ) : (
          /* ═══ EDIT MODE — SINGLE CARD ═══ */
          <PageCanvas previewMode={false} companionSlot={companionSlotEl}>
            <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground/40 mb-2" style={{ fontFamily: 'var(--font-body)' }}>
              Chapter {chapter.chapter_number}
            </p>
            <h1 className="text-[32px] font-bold leading-tight text-foreground mb-1" style={{ fontFamily: 'var(--font-heading)' }}>
              {chapter.title}
            </h1>

            {/* For recommended photo chapters, show layout selector prominently at the top */}
            {isDesignatedPhotoChapter && !isPhotoTemplate && photoUrls.length === 0 ? (
              <div className="mb-6">
                <TemplateSelector template={template} onTemplateChange={t => { setTemplate(t); setHasUnsavedChanges(true); }} photoChapterCount={photoChapterCount} maxPhotoChapters={maxPhotoChapters} photoUrl={hasUploadedPhoto ? primaryPhotoUrl : null} />
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setLayoutDrawerOpen(open => !open)}
                  aria-expanded={layoutDrawerOpen}
                  aria-controls="chapter-layout-selector"
                  className={`inline-flex items-center gap-1.5 text-[0.68rem] font-medium transition-colors ${layoutDrawerOpen ? 'text-primary mb-3' : 'text-primary/75 hover:text-primary mb-6'}`}
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  <Settings2 className="h-3 w-3" />
                  <span>Change Layout</span>
                </button>

                {layoutDrawerOpen && (
                  <div id="chapter-layout-selector">
                    <TemplateSelector template={template} onTemplateChange={t => { setTemplate(t); setHasUnsavedChanges(true); setLayoutDrawerOpen(false); }} photoChapterCount={photoChapterCount} maxPhotoChapters={maxPhotoChapters} photoUrl={hasUploadedPhoto ? primaryPhotoUrl : null} />
                  </div>
                )}

                {photoTemplateHelpMessage && (
                  <div className="mb-6 rounded-sm border border-[#D97706]/30 bg-[#D97706]/5 px-3 py-2">
                    <p className="text-[0.72rem] text-[#D97706]/90" style={{ fontFamily: 'var(--font-body)' }}>
                      {photoTemplateHelpMessage}
                    </p>
                  </div>
                )}
              </>
            )}

            {template === 'photo_top' && renderPhotoZone('horizontal')}

            <DevotionalVerse text={bibleVerseText} reference={bibleVerseRef} onTextChange={v => { setBibleVerseText(v); setVerseId(null); setHasUnsavedChanges(true); }} onRefChange={v => { setBibleVerseRef(v); setHasUnsavedChanges(true); }} onFindAlternatives={() => handleFindAlternatives('verse')} editing={editingVerse} onToggleEdit={() => setEditingVerse(!editingVerse)} previewMode={false} />

            <DevotionalQuote text={quoteText} attribution={quoteAttribution} onTextChange={v => { setQuoteText(v); setQuoteId(null); setHasUnsavedChanges(true); }} onAttrChange={v => { setQuoteAttribution(v); setHasUnsavedChanges(true); }} onFindAlternatives={() => handleFindAlternatives('quote')} editing={editingQuote} onToggleEdit={() => setEditingQuote(!editingQuote)} previewMode={false} />

            {/* ─── Two-textarea editor: Page 1 above, divider, Page 2 below ─── */}
            {(() => {
              const editPage1 = referenceText;
              const editPage2 = content;

              // Recombine the two textarea values back into mergedText.
              // The split function leaves a whitespace token at the seam
              // (usually a space — the one that separated the boundary
              // words). We preserve ANY whitespace at the seam; only when
              // there is literally none do we insert a single space.
              // Inserting "\n\n" here is wrong — it would turn each
              // overflowing character into its own paragraph as the user
              // typed past the page-1 boundary.
              const joinPages = (p1: string, p2: string) => {
                if (!p1) return p2;
                if (!p2) return p1;
                const hasSep = /\s$/.test(p1) || /^\s/.test(p2);
                return hasSep ? p1 + p2 : p1 + ' ' + p2;
              };

              const applyMerged = (next: string) => {
                if (next.length > MAX_CONTENT_LENGTH) return;
                setMergedText(next);
                setHasUnsavedChanges(true);
                if (!hasEditedWisdom) setHasEditedWisdom(true);
              };

              const totalChapterWords = countWords(mergedText);
              const showPageBreak = editPage2.trim().length > 0;
              const _page2Budget = Math.max(0, budget - PAGE_1_WORD_LIMIT);
              // Memory cards consume fixed page space; paragraph breaks should
              // not reduce available words in this meter.
              const _memoryWordCost = (placedMemories?.length ?? 0) * 40;
              const _page2Words =
                Math.max(0, totalChapterWords - PAGE_1_WORD_LIMIT) +
                _memoryWordCost;
              const isPage2Over = _page2Words > _page2Budget;

              const cardBase: React.CSSProperties = {
                background: '#FDFAF4',
                margin: '0 -8px',
                padding: '12px 8px 12px 19px',
              };
              const textareaClassName =
                'relative w-full border-0 bg-transparent resize-none outline-none px-0 text-[14px] leading-[1.75] text-foreground/55 placeholder:text-muted-foreground/25';
              const textareaStyle: React.CSSProperties = {
                fontFamily: 'var(--font-devotional)',
                overflow: 'hidden',
              };

              return (
                <>
                  {/* ── Page 1 textarea ── */}
                  <div className="my-8 relative">
                    <div
                      className="transition-all duration-200 rounded-sm relative"
                      style={{ ...cardBase, borderLeft: '3px solid #C9A84C' }}
                    >
                      <textarea
                        ref={refTextareaRef}
                        value={editPage1}
                        rows={4}
                        placeholder="Begin your chapter here..."
                        onChange={e => {
                          const ta = e.target;
                          const newP1 = ta.value;
                          const merged = joinPages(newP1, editPage2);
                          setReferenceText(newP1);
                          applyMerged(merged);
                          autoResize(ta);
                        }}
                        onPaste={e => {
                          e.preventDefault();
                          const text = e.clipboardData
                            .getData('text/plain')
                            .replace(/\r\n?/g, '\n');
                          const ta = e.target as HTMLTextAreaElement;
                          const start = ta.selectionStart;
                          const end = ta.selectionEnd;
                          const newP1 =
                            editPage1.slice(0, start) + text + editPage1.slice(end);
                          const merged = joinPages(newP1, editPage2);
                          if (merged.length > MAX_CONTENT_LENGTH) return;
                          setReferenceText(newP1);
                          applyMerged(merged);
                          const caret = start + text.length;
                          requestAnimationFrame(() => {
                            ta.selectionStart = ta.selectionEnd = caret;
                            autoResize(ta);
                          });
                        }}
                        className={textareaClassName}
                        style={textareaStyle}
                      />
                    </div>
                  </div>

                  {/* Page 2 divider — always rendered so layout space is
                      reserved (no jump when crossing 150 words). The label
                      brightens once page-2 actually has content. */}
                  <div
                    className="mt-2 mb-6 flex items-center gap-3 select-none transition-opacity duration-200"
                    aria-hidden="true"
                    style={{
                      fontFamily: 'var(--font-body)',
                      opacity: showPageBreak ? 1 : 0.4,
                    }}
                  >
                    <div className="flex-1 h-px bg-muted-foreground/20" />
                    <span className="text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground/55">
                      <span className="text-[#C9A84C] mr-1.5">✦</span>Page 2
                    </span>
                    <div className="flex-1 h-px bg-muted-foreground/20" />
                  </div>

            {template === 'photo_second' && (
              <div className="mb-4">
                {renderPhotoZone('vertical')}
              </div>
            )}

                  {/* ── Page 2 textarea ── */}
                  <div className="my-8 relative">
                    <div
                      className="transition-all duration-200 rounded-sm relative"
                      style={{
                        ...cardBase,
                        border: isPage2Over ? '2px solid #EF4444' : undefined,
                        borderLeft: isPage2Over
                          ? '2px solid #EF4444'
                          : '3px solid #C9A84C',
                      }}
                    >
                      <textarea
                        ref={wisdomTextareaRef}
                        value={editPage2}
                        rows={4}
                        placeholder="Page 2 continues here..."
                        onChange={e => {
                          const nextP2 = e.target.value;
                          setContent(nextP2);
                          applyMerged(joinPages(editPage1, nextP2));
                          autoResize(e.target);
                        }}
                        onPaste={e => {
                          e.preventDefault();
                          const text = e.clipboardData
                            .getData('text/plain')
                            .replace(/\r\n?/g, '\n');
                          const ta = e.target as HTMLTextAreaElement;
                          const start = ta.selectionStart;
                          const end = ta.selectionEnd;
                          const newP2 =
                            editPage2.slice(0, start) + text + editPage2.slice(end);
                          const merged = joinPages(editPage1, newP2);
                          if (merged.length > MAX_CONTENT_LENGTH) return;
                          setContent(newP2);
                          applyMerged(merged);
                          const caret = start + text.length;
                          requestAnimationFrame(() => {
                            ta.selectionStart = ta.selectionEnd = caret;
                            autoResize(ta);
                          });
                        }}
                        className={textareaClassName}
                        style={textareaStyle}
                      />
                    </div>
                  </div>
                </>
              );
            })()}

            {placedMemories.length > 0 && (
              <>
                {placedMemories.map(m => (
                  <PlacedMemory
                    key={m.id}
                    text={m.memory_text}
                    fromName={m.contributor_name}
                    onRemove={() => handleUnplaceMemory(m.id)}
                  />
                ))}
              </>
            )}
            {(() => {
              const page2Budget = Math.max(0, budget - PAGE_1_WORD_LIMIT);
              const rawText = mergedText;
              const combinedWords = countWords(rawText);
              const memoryWordCost = (placedMemories?.length ?? 0) * 40;
              const page2Words =
                Math.max(0, combinedWords - PAGE_1_WORD_LIMIT) +
                memoryWordCost;
              const page2Remaining = page2Budget - page2Words;
              if (page2Remaining < 0) {
                return (
                  <p
                    className="mt-6 text-center text-[0.78rem] italic text-[#EF4444]"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    Page 2 is full — trim your writing to add a memory.
                  </p>
                );
              }
              if (page2Remaining < 40) {
                return null;
              }
              return (
                <>
                  {showMemoryPlaceholder && placedMemories.length === 0 && (
                    <MemoryPlaceholder recipientName={recipientName} realistic />
                  )}
                  <MemorySuggestion
                    memories={unplacedMemories}
                    onPlace={(id) => handlePlaceSuggestion(id)}
                  />
                </>
              );
            })()}


            {/* Photo quality warning */}
            {photoWarning && (
              <div className="mt-4 flex items-start gap-2 px-3 py-2.5 rounded-sm border border-[#D97706]/30 bg-[#D97706]/5">
                <AlertTriangle className="h-3.5 w-3.5 text-[#D97706] flex-shrink-0 mt-0.5" />
                <p className="text-[0.65rem] text-[#D97706]/80 leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>
                  {photoWarning}
                </p>
              </div>
            )}

            {/* Comprehensive Page 1 & Page 2 status bar */}
            <div className="mt-8 pt-4 border-t border-[hsl(var(--devotional-border))] text-xs font-medium text-center" style={{ fontFamily: 'var(--font-body)' }}>
              {layoutMeasurement ? (
                <div className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[0.68rem] text-muted-foreground/80 leading-relaxed">
                  <span className="text-[#6B7280]">
                    Total Pages: <strong className="text-foreground">{layoutMeasurement.totalPages}</strong>
                  </span>
                  {layoutMeasurement.pages.map((page, index) => (
                    <span key={page.pageIndex}>
                      <span className="text-[#E5E7EB]">|</span>{' '}
                      Page {page.pageIndex + 1}: <strong className="text-foreground">{Math.round(page.fillPercent)}%</strong> full
                    </span>
                  ))}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-center gap-3">
                    <span style={{ color: '#6B7280' }}>
                      Measured preview pages: <strong>{chapterPreviewPageCount > 0 ? chapterPreviewPageCount : '...'}</strong>
                    </span>
                  </div>
                  <div className="text-[0.68rem] text-muted-foreground/70 text-center">
                    Loading exact layout metrics…
                  </div>
                </>
              )}
            </div>
          </PageCanvas>
        )}

        {!previewMode && exactPreviewHtml && (
          <iframe
            ref={exactPreviewIframeRef}
            title="Hidden exact chapter preview"
            srcDoc={exactPreviewHtml}
            onLoad={syncExactPreview}
            style={{ position: 'absolute', width: 0, height: 0, border: 0, opacity: 0, pointerEvents: 'none' }}
          />
        )}

        {/* Bottom actions */}
        {!previewMode && (
          <div className="flex gap-3 pt-8 mx-auto max-w-[600px]" style={{ padding: '32px 60px 64px' }}>
            <Button variant="outline" size="lg" className="flex-1 gap-2" onClick={() => save(false)} disabled={saving || photoTemplateNeedsUpload}>
              <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save Draft'}
            </Button>
            {isComplete ? (
              <Button
                size="lg"
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => { 
                  setChapter(prev => prev ? { ...prev, status: 'in_progress' } : prev);
                  save(false, 'in_progress');
                }}
                disabled={saving || photoTemplateNeedsUpload}
              >
                <Check className="h-4 w-4" /> Unmark Complete
              </Button>
            ) : (
              <Button size="lg" className="flex-1 gap-2" onClick={handleMarkComplete} disabled={saving || photoTemplateNeedsUpload}>
                <CheckCircle className="h-4 w-4" /> Mark Complete
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Content Search Panel */}
      <ContentSearchPanel
        open={searchPanelOpen}
        onClose={() => setSearchPanelOpen(false)}
        type={searchPanelType}
        defaultTopic={chapter.title}
        onSelect={handleSelectFromPanel}
        excludeText={searchPanelType === 'verse' ? bibleVerseText : quoteText}
        bookId={bookId}
      />

      {/* Unsaved changes dialog */}
      <AlertDialog
        open={showUnsavedDialog}
        onOpenChange={(open) => { if (!open) handleDialogCancel(); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>You have unsaved changes.</AlertDialogTitle>
            <AlertDialogDescription>
              Save before leaving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={handleDialogDiscard}>
              Leave without saving
            </Button>
            <AlertDialogAction onClick={handleDialogSaveAndContinue}>
              Save &amp; leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Overflow confirmation when placing a memory would exceed budget */}
      <AlertDialog
        open={overflowConfirm !== null}
        onOpenChange={(open) => { if (!open) setOverflowConfirm(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Over the word limit</AlertDialogTitle>
            <AlertDialogDescription>
              This memory would put you over the word limit. Place it anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setOverflowConfirm(null)}>No</Button>
            <AlertDialogAction
              onClick={() => {
                const id = overflowConfirm?.memoryId;
                setOverflowConfirm(null);
                if (id) placeSuggestionMemory(id);
              }}
            >
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Memory capture overlay (toolbar manual entry + post-complete guided flow) */}
      {bookId && (
        <MemoryCaptureOverlay
          open={memoryOverlayOpen}
          onClose={() => setMemoryOverlayOpen(false)}
          bookId={bookId}
          chapterId={chapterId}
          defaultFromName={authorName || 'Me'}
          mode={memoryOverlayMode}
          recipientName={recipientName}
          recipientGender={recipientGender}
          onSaved={async () => {
            // Refresh placed + unplaced memories so freshly-placed/added items show up
            const { data } = await supabase
              .from('memories')
              .select('id, chapter_id, memory_text, contributor_name, placed_at, created_at')
              .eq('book_id', bookId)
              .order('placed_at', { ascending: true, nullsFirst: false })
              .order('created_at', { ascending: true });
            if (data) {
              const rows = data as MemoryRow[];
              const counts: Record<string, number> = {};
              rows.forEach((m) => { if (m.chapter_id) counts[m.chapter_id] = (counts[m.chapter_id] || 0) + 1; });
              setMemoryCountsByChapter(counts);
              setPlacedMemories(
                rows
                  .filter((m) => m.chapter_id === chapterId)
                  .map((m) => ({ id: m.id, memory_text: m.memory_text, contributor_name: m.contributor_name }))
              );
              setUnplacedMemories(
                rows
                  .filter((m) => !m.chapter_id)
                  .map((m) => ({ id: m.id, memory_text: m.memory_text, contributor_name: m.contributor_name }))
              );
              setSuggestionIndex(0);
            }
            // A placed memory is a chapter change — author must explicitly Save Draft.
            setHasUnsavedChanges(true);
          }}
        />
      )}

    </div>
  );
};

export default ChapterEditor;
