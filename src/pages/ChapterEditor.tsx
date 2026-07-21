import { useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { replaceTokens } from '@/lib/tokenReplacer';
import { toBookGender } from '@/lib/genderMap';

import { Button } from '@/components/ui/button';
import { Save, CheckCircle, AlertTriangle, Settings2, Check, Sparkles, MessageCircleHeart, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Navbar from '@/components/Navbar';
import { LockedPage } from '@/components/BookLockBanner';
import { useBookUnlocked } from '@/hooks/useBookUnlocked';
import { usePreviewSets, isInSet } from '@/lib/previewSets';
import DevotionalVerse from '@/components/chapter/DevotionalVerse';
import DevotionalQuote from '@/components/chapter/DevotionalQuote';
import PhotoUploadZone from '@/components/chapter/PhotoUploadZone';
import TemplateSelector, { type ChapterTemplate } from '@/components/chapter/TemplateSelector';
import PlacedMemory from '@/components/chapter/PlacedMemory';
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
} from '@/features/chapter-editor/constants';
import { validatePhoto } from '@/features/chapter-editor/photoValidation';
import { mergeRefAndContent, normalizeWhitespace } from '@/features/chapter-editor/textSplit';
import { getPhotoImageStyle, parsePhotoRenderLayout, serializePhotoRenderLayout } from '@/features/photoRendering';
import {
  PREVIEW_PHOTO_HORIZONTAL_HEIGHT,
  PREVIEW_PHOTO_VERTICAL_HEIGHT,
  PREVIEW_PHOTO_VERTICAL_WIDTH,
  PREVIEW_PAGE_HEIGHT,
  PREVIEW_PAGE_WIDTH,
} from '@/features/preview/geometry';
import { extractExactChapterSplit, measureLayout, isRenderablePage, type ExactChapterSplitResult, type LayoutMeasurementResult } from '@/features/preview/layoutMeasurement';
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
  reference_text?: string | null;
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
  const unlocked = useBookUnlocked(bookId);
  const { sets: previewSets } = usePreviewSets();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const returnLabel = searchParams.get('returnLabel');
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
  const [photoLayout, setPhotoLayout] = useState<string>(serializePhotoRenderLayout(parsePhotoRenderLayout(null)));
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
  const [exactChapterSplit, setExactChapterSplit] = useState<ExactChapterSplitResult | null>(null);
  const previewMeasurementRunId = useRef(0);

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

  const [allChapters, setAllChapters] = useState<{ id: string; chapter_number: number; title: string; status: string; created_at: string; updated_at: string; content: string | null; verse_id: string | null; quote_id: string | null; bible_verse_text: string | null; quote_text: string | null; chapter_template: string; photo_layout?: string | null; photo_urls?: string[] }[]>([]);
  const [photoChapterNums, setPhotoChapterNums] = useState<Set<number>>(new Set());
  const [memoryCountsByChapter, setMemoryCountsByChapter] = useState<Record<string, number>>({});
  const [placedMemories, setPlacedMemories] = useState<{ id: string; memory_text: string; contributor_name: string }[]>([]);

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
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollPositionRef = useRef(0);

  const autoResizeTitle = useCallback(() => {
    const el = titleTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, []);

  const isPhotoTemplate = template === 'photo_top' || template === 'photo_second';
  const primaryPhotoUrl = (photoUrls[0] || '').trim();
  const hasUploadedPhoto = /^(https?:|data:image\/|blob:)/i.test(primaryPhotoUrl);
  const usesPhotoCapacity = isPhotoTemplate;
  const requiresPhotoForTemplate = isPhotoTemplate;
  const photoTemplateNeedsUpload = requiresPhotoForTemplate && !hasUploadedPhoto;
  const photoTemplateHelpMessage = photoTemplateNeedsUpload
    ? 'You need to add a photo or select a classic template.'
    : null;
  const isLetterChapter = chapter?.chapter_number === 0;
  const isComplete = chapter?.status === 'complete';

  useLayoutEffect(() => {
    autoResizeTitle();
  }, [chapter?.title, autoResizeTitle]);

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

  // Trial gating: chapters in trial_readable (but not trial_editable) are
  // read-only until the book is unlocked. Force preview mode on.
  useEffect(() => {
    if (loading || !chapter) return;
    const editable = unlocked === true || isInSet(chapter.title, previewSets.trial_editable);
    if (!editable && !previewMode) setPreviewMode(true);
  }, [loading, chapter, unlocked, previewSets, previewMode]);

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
        supabase.from('chapters').select('id, chapter_number, title, status, created_at, updated_at, content, verse_id, quote_id, bible_verse_text, quote_text, chapter_template, photo_urls, photo_layout').eq('book_id', bookId).order('chapter_number'),
        supabase.from('books').select('recipient_name, recipient_gender, gender, user_id, author_label').eq('id', bookId).single(),
        supabase.from('memories').select('id, chapter_id, memory_text, contributor_name, placed_at, created_at').eq('book_id', bookId).or('entry_type.is.null,entry_type.eq.memory').order('placed_at', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true }),
        supabase.from('app_settings').select('value').eq('key', 'photo_chapter_cap').single(),
        supabase.from('chapter_templates').select('chapter_number, is_photo_chapter, gender, title'),
      ]);
      if (capData) setMaxPhotoChapters(Number(capData.value) || 15);
      const bookGender = toBookGender(bookData?.recipient_gender);
      const genderTpls = ((allTpls || []) as ChapterTemplateRow[]).filter((t) => t.gender === bookGender);
      const photoNums = new Set<number>(genderTpls.filter((t) => t.is_photo_chapter).map((t) => t.chapter_number));
      setPhotoChapterNums(photoNums);
      // Map chapter_number -> authoritative title from templates (gender-specific)
      const titleByNumber = new Map<number, string>(genderTpls.map((t) => [t.chapter_number, t.title]));
      if (chapterData) {
        // Use the chapter's own title (user-editable). Fall back to the
        // gender-specific template title only when the chapter has no title.
        const authoritativeTitle = chapterData.title
          || (chapterData.chapter_number > 0 ? titleByNumber.get(chapterData.chapter_number) : '')
          || '';
        setChapter({ ...chapterData, title: authoritativeTitle } as ChapterData);
        setBibleVerseText(chapterData.bible_verse_text || '');
        setBibleVerseRef(chapterData.bible_verse_reference || '');
        setQuoteText(chapterData.quote_text || '');
        setQuoteAttribution(chapterData.quote_attribution || '');
        setContent(chapterData.content || '');
        setPhotoUrls(chapterData.photo_urls || []);
        setPhotoLayout(chapterData.photo_layout || serializePhotoRenderLayout(parsePhotoRenderLayout(null)));
        setTemplate((chapterData.chapter_template as ChapterTemplate) || 'all_words');
        setVerseId(chapterData.verse_id || null);
        setQuoteId(chapterData.quote_id || null);

        // Letter chapters (chapter_number=0) don't use chapter_templates
        if (chapterData.chapter_number === 0) {
          setIsDesignatedPhotoChapter(false);
          setReferenceContent(null);
          const normalizedRefText = normalizeWhitespace(chapterData.reference_text || '');
          const normalizedContentText = normalizeWhitespace(chapterData.content || '');
          setReferenceText(normalizedRefText);
          // Letter editor binds to `content`; keep mergedText coherent.
          setContent(normalizedContentText);
          setMergedText(normalizedContentText);
          setTemplate('letter' as ChapterTemplate);
          initialRef.current = { referenceText: normalizedRefText, content: normalizedContentText };
          lastSavedRef.current = { referenceText: normalizedRefText, content: normalizedContentText };
        } else {
          const tplGender = toBookGender(bookData?.recipient_gender);
          const { data: tpl } = await supabase
            .from('chapter_templates')
            .select('reference_content, is_photo_chapter')
            .eq('chapter_number', chapterData.chapter_number)
            .eq('gender', tplGender)
            .maybeSingle();
          setIsDesignatedPhotoChapter(tpl?.is_photo_chapter || false);
          const rawRef = tpl?.reference_content ?? null;
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
          const contentVal = chapterData.reference_text !== null ? (chapterData.content || '') : '';
          
          let finalRefVal = refVal;
          let finalContentVal = contentVal;
          let isDuplicated = false;

          if (rawRef) {
            const personalizedTpl = replaceTokens(rawRef, {
              recipientName: bookData?.recipient_name || 'your child',
              recipientGender: bookData?.recipient_gender || '',
              authorLabel: bookData?.author_label,
            });
            const normTpl = normalizeWhitespace(personalizedTpl);
            const initialMerged = mergeRefAndContent(refVal, contentVal);
            const normMerged = normalizeWhitespace(initialMerged);

            const pattern = normTpl.length > 50 
              ? normTpl.slice(15, Math.min(115, normTpl.length)) 
              : normTpl;

            const firstIdx = normMerged.indexOf(pattern);
            const lastIdx = normMerged.lastIndexOf(pattern);
            
            const halfLen = Math.floor(normMerged.length / 2);
            const firstHalf = normMerged.slice(0, halfLen).trim();
            const secondHalf = normMerged.slice(halfLen).trim();

            if (
              (firstIdx !== -1 && lastIdx !== -1 && firstIdx !== lastIdx) ||
              (firstHalf.length > 50 && firstHalf === secondHalf)
            ) {
              isDuplicated = true;
              finalRefVal = personalizedTpl;
              finalContentVal = '';
            }
          }

          const normalizedRefVal = normalizeWhitespace(finalRefVal);
          const normalizedContentVal = normalizeWhitespace(finalContentVal);
          
          setReferenceText(normalizedRefVal);
          setContent(normalizedContentVal);
          // Seed the unified editor buffer from the saved split.
          setMergedText(mergeRefAndContent(normalizedRefVal, normalizedContentVal));

          initialRef.current = { referenceText: normalizedRefVal, content: normalizedContentVal };
          lastSavedRef.current = { referenceText: normalizedRefVal, content: normalizedContentVal };
          if (isDuplicated) {
            setHasUnsavedChanges(true);
          }
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
      }
      if (allCh) {
        const withCorrectTitles = allCh.map((c) =>
          c.chapter_number > 0 && !c.title
            ? { ...c, title: titleByNumber.get(c.chapter_number) || c.title }
            : c
        );
        setAllChapters(withCorrectTitles);
        const siblings = withCorrectTitles.filter((c) => c.id !== chapterId);
        setPhotoChapterCount(siblings.filter((s) => s.chapter_template === 'photo_top' || s.chapter_template === 'photo_second').length);
      }
      setLoading(false);
      setPreviewMode(false);
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

  const hasOverflow = layoutMeasurement?.pages?.some(p => p.overflows) || (layoutMeasurement?.totalPages || 0) > 2;

  const canMarkComplete = () => {
    if (isLetterChapter) return true;
    if (hasOverflow) return false;
    return layoutMeasurement?.pages.some((page) => page.fillPercent > 0) || false;
  };

  const handleMarkComplete = () => {
    if (hasOverflow && !isLetterChapter) {
      toast({
        title: 'Layout Overflow',
        description: 'This chapter exceeds the two-page limit. Please shorten the text or memory before marking complete.',
        variant: 'destructive',
      });
      return;
    }
    if (!canMarkComplete()) {
      toast({
        title: 'Nothing to complete yet',
        description: 'Add chapter content before marking this chapter complete.',
        variant: 'destructive',
      });
      return;
    }

    save(true);
  };

  const validateMemoryPlacement = (text: string, contributorName: string): boolean | string => {
    const iframe = exactPreviewIframeRef.current;
    if (!iframe?.contentDocument) return true;

    const doc = iframe.contentDocument;
    const pages = Array.from(doc.querySelectorAll(`.page[data-chapter="${chapter?.chapter_number}"]`));
    const page = pages[pages.length - 1];
    if (!page) return true;

    let memoriesSection = page.querySelector('.memories-section');
    let createdSection = false;
    if (!memoriesSection) {
      memoriesSection = doc.createElement('div');
      memoriesSection.className = 'memories-section';
      const wisdomText = page.querySelector('.wisdom-text');
      if (wisdomText) {
        wisdomText.after(memoriesSection);
      } else {
        page.appendChild(memoriesSection);
      }
      createdSection = true;
    }

    const dummyMemory = doc.createElement('div');
    dummyMemory.className = 'memory-item mt-4 px-4 py-4 rounded-lg relative';
    dummyMemory.style.background = '#F5F0E8';
    dummyMemory.style.breakInside = 'avoid';
    dummyMemory.innerHTML = `
      <p style="font-family: 'Caveat', cursive; font-size: 15px; color: #2D3748; line-height: 1.6;">
        <span class="text-[#C9A84C] mr-1">✦</span>
        ${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
      </p>
      ${contributorName ? `<p class="mt-2 text-[8px] uppercase tracking-[0.12em] text-muted-foreground/60" style="font-family: 'Lora', serif;">— ${contributorName.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>` : ''}
    `;

    memoriesSection.appendChild(dummyMemory);

    const measurement = measureLayout(doc);
    const chapterPages = measurement.pages.filter(p => p.chapter === String(chapter?.chapter_number));
    const memoryOverflow = chapterPages.some(p => p.overflows) || chapterPages.length > 2;

    dummyMemory.remove();
    if (createdSection) {
      memoriesSection.remove();
    }

    if (memoryOverflow) {
      return "This chapter is already full. Please shorten this memory or trim the chapter's main text to make room.";
    }

    return true;
  };

  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);

  useEffect(() => {
    if (!primaryPhotoUrl) {
      setImageAspectRatio(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      setImageAspectRatio(img.naturalWidth / img.naturalHeight);
    };
    img.src = primaryPhotoUrl;
  }, [primaryPhotoUrl]);

  const FRAME_ASPECT_RATIO = 2.7 / 3.54; // 0.7627
  const isHorizontalCrop = imageAspectRatio ? imageAspectRatio > FRAME_ASPECT_RATIO : true;
  const currentLayout = parsePhotoRenderLayout(photoLayout);
  const currentPreset = currentLayout.preset || 'center';

  const handlePresetChange = (preset: string) => {
    const nextLayout = {
      ...currentLayout,
      preset
    };
    setPhotoLayout(serializePhotoRenderLayout(nextLayout));
    setHasUnsavedChanges(true);
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

    let refToSave = referenceText;
    let contentToSave = content;

    if (!isLetterChapter) {
      const iframe = exactPreviewIframeRef.current;
      const doc = iframe?.contentDocument;
      if (doc && chapter) {
        const exactSplit = extractExactChapterSplit(doc, String(chapter.chapter_number));
        refToSave = normalizeWhitespace(exactSplit.page1);
        contentToSave = normalizeWhitespace(exactSplit.page2);

        // Sync screen values silently
        setReferenceText(refToSave);
        setContent(contentToSave);
        setMergedText(mergeRefAndContent(refToSave, contentToSave));

        setTimeout(() => {
          if (refTextareaRef.current) autoResize(refTextareaRef.current);
          if (wisdomTextareaRef.current) autoResize(wisdomTextareaRef.current);
        }, 50);
      } else {
        refToSave = normalizeWhitespace(referenceText);
        contentToSave = normalizeWhitespace(mergedText);
      }
    } else {
      contentToSave = normalizeWhitespace(content);
      setContent(contentToSave);
      setMergedText(contentToSave);

      setTimeout(() => {
        if (wisdomTextareaRef.current) autoResize(wisdomTextareaRef.current);
      }, 50);
    }

    if (!isLetterChapter) {
      if (exactPreviewLoading) {
        toast({
          title: 'Evaluating Layout',
          description: 'Please wait a moment for the layout engine to finish updating with your latest text.',
        });
        setSaving(false);
        return;
      }

      const iframe = exactPreviewIframeRef.current;
      const doc = iframe?.contentDocument;
      if (doc && chapter) {
        const measurement = measureLayout(doc);
        const chapterPages = measurement.pages.filter(p => p.chapter === String(chapter.chapter_number));
        const overflow = chapterPages.some(p => p.overflows) || chapterPages.length > 2;
        if (overflow) {
          toast({
            title: 'Layout Overflow',
            description: `This chapter exceeds the 2-page limit. Please shorten the text or choose a different photo layout.`,
            variant: 'destructive',
          });
          if (markComplete) {
            setSaving(false);
            return;
          }
        }
      }

      if (markComplete) {
        const page1HasPhoto = template === 'photo_top' && hasUploadedPhoto;
        const page1HasContent = !!refToSave.trim() || page1HasPhoto;
        
        const page2HasPhoto = template === 'photo_second' && hasUploadedPhoto;
        const page2HasMemory = placedMemories.length > 0;
        const page2HasContent = !!contentToSave.trim() || page2HasPhoto || page2HasMemory;

        if (!page1HasContent || !page2HasContent) {
          toast({
            title: 'Missing Page Content',
            description: 'Both pages need some content before you can mark the chapter complete. Make sure you have text, a photo, or a memory on each page.',
            variant: 'destructive',
          });
          setSaving(false);
          return;
        }
      }
    }

    const { error } = await supabase.from('chapters').update({
      title: chapter?.title ?? null,
      bible_verse_text: bibleVerseText || null,
      bible_verse_reference: bibleVerseRef || null,
      quote_text: quoteText || null,
      quote_attribution: quoteAttribution || null,
      content: contentToSave || null,
      reference_text: refToSave || null,
      photo_urls: hasUploadedPhoto ? [primaryPhotoUrl] : [],
      photo_layout: photoLayout,
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
      setAllChapters(prev => prev.map(c => c.id === chapterId ? { ...c, title: chapter?.title ?? c.title, status: newStatus, updated_at: savedAt, content: contentToSave || null, photo_layout: photoLayout } : c));
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

  const handleUnplaceMemory = async (memoryId: string) => {
    const { error } = await supabase
      .from('memories')
      .update({ chapter_id: null, status: 'unplaced', placed_at: null })
      .eq('id', memoryId);
    if (error) {
      toast({ title: 'Could not remove memory', description: error.message, variant: 'destructive' });
      return;
    }
    setPlacedMemories(prev => prev.filter(m => m.id !== memoryId));
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
      const layout = parsePhotoRenderLayout(photoLayout);
      const photoClass = isVert ? 'chapter-photo vertical-photo' : 'chapter-photo';
      return (
        <div className={`mb-6 ${isVert ? 'flex justify-center' : 'w-full'}`}>
          <div
            className="relative overflow-hidden rounded-sm"
            style={{ width: isVert ? 'fit-content' : '100%', height: 'auto' }}
          >
            <img
              src={primaryPhotoUrl}
              alt="Chapter photo"
              className={photoClass}
              style={getPhotoImageStyle(layout)}
            />
          </div>
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
        photoLayout={photoLayout}
      />
    );
  };

  useEffect(() => {
    if (!chapter) return;

    const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || 'https://pdf-render-service-33np.onrender.com';
    const chapterPayload = {
      chapter_number: chapter.chapter_number,
      title: chapter.title,
      chapter_template: template,
      content: normalizeWhitespace(isLetterChapter ? mergeRefAndContent(referenceText, content) : mergedText),
      photo_urls: hasUploadedPhoto ? [primaryPhotoUrl] : [],
      photo_layout: photoLayout,
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
      setExactChapterSplit(null);
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
  }, [chapter, template, mergedText, referenceText, content, hasUploadedPhoto, primaryPhotoUrl, photoLayout, bibleVerseText, bibleVerseRef, quoteText, quoteAttribution, placedMemories, authorName, recipientName, isLetterChapter]);

  const syncExactPreview = () => {
    const iframe = exactPreviewIframeRef.current;
    if (!iframe?.contentDocument || !chapter) return;

    const doc = iframe.contentDocument;
    const chapterKey = String(chapter.chapter_number);

    const waitForLayoutFinal = async () => {
      for (let i = 0; i < 120; i += 1) {
        if (doc.readyState === 'complete' && doc.body?.classList.contains('layout-final')) return;
        await new Promise(resolve => window.setTimeout(resolve, 50));
      }
    };

    const waitForStableLayout = async () => {
      await waitForLayoutFinal();
      if (doc.fonts) {
        try {
          await doc.fonts.ready;
          await Promise.all([
            doc.fonts.load('1em Lora'),
            doc.fonts.load('700 1em Lora'),
            doc.fonts.load('italic 1em Lora')
          ]);
        } catch {
          // Ignore font load failures and measure what rendered.
        }
      }
      await new Promise<void>((resolve) => {
        const raf = doc.defaultView?.requestAnimationFrame ?? window.requestAnimationFrame;
        raf(() => raf(() => resolve()));
      });
    };

    const waitForCurrentImages = async () => {
      const images = Array.from(doc.querySelectorAll<HTMLImageElement>('img'));
      await Promise.all(images.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        });
      }));
    };

    const scheduleMeasurement = () => {
      const runId = ++previewMeasurementRunId.current;
      void (async () => {
        await waitForStableLayout();
        if (runId !== previewMeasurementRunId.current) return;

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

        const finalizeMeasurement = async (runId: number) => {
          await waitForCurrentImages();
          await waitForStableLayout();
          if (runId !== previewMeasurementRunId.current) return;
          const split = extractExactChapterSplit(doc, chapterKey);
          setExactChapterSplit(split);
          setChapterPreviewPageCount(pageNodes.length);
          setLayoutMeasurement(measureLayout(doc));

          if (!isLetterChapter) {
            if (!hasUnsavedRef.current && (!chapter.reference_text || content === '')) {
              const normPage1 = normalizeWhitespace(split.page1);
              const normPage2 = normalizeWhitespace(split.page2);
              if (normPage1 !== referenceText || normPage2 !== content) {
                setReferenceText(normPage1);
                setContent(normPage2);
                initialRef.current = { referenceText: normPage1, content: normPage2 };
                lastSavedRef.current = { referenceText: normPage1, content: normPage2 };
                setTimeout(() => {
                  if (refTextareaRef.current) autoResize(refTextareaRef.current);
                  if (wisdomTextareaRef.current) autoResize(wisdomTextareaRef.current);
                }, 50);
              }
            }
          }
        };

        const remeasure = () => {
          const nextRunId = ++previewMeasurementRunId.current;
          void finalizeMeasurement(nextRunId);
        };

        Array.from(doc.querySelectorAll('img')).forEach((img) => {
          img.addEventListener('load', remeasure, { once: true });
          img.addEventListener('error', remeasure, { once: true });
        });

        void finalizeMeasurement(runId);
      })();
    };

    scheduleMeasurement();
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

  const chapterInReadable = isInSet(chapter?.title, previewSets.trial_readable);
  const chapterInEditable = isInSet(chapter?.title, previewSets.trial_editable);
  const canEdit = unlocked === true || chapterInEditable;
  const canReadChapter = unlocked === true || chapterInReadable || chapterInEditable;

  if (unlocked === false && !canReadChapter) return (
    <div className="min-h-screen bg-[hsl(var(--devotional-bg))]">
      <Navbar />
      <LockedPage bookId={bookId!} title="This chapter is part of the full book" message="Unlock the book to open every chapter. Your trial gives you a sample from every theme, plus one chapter you can edit yourself." />
    </div>
  );


  return (
    <div className="min-h-screen bg-[hsl(var(--devotional-bg))]">
      <Navbar />

      {/* Toolbar */}
      <div className="sticky top-0 z-20 border-b border-[hsl(var(--devotional-border))]" style={{ background: 'hsla(40, 33%, 97%, 0.95)', backdropFilter: 'blur(8px)' }}>
        <div className="container mx-auto max-w-screen-xl px-4 py-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1 flex-wrap sm:flex-nowrap">
            {returnTo && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 px-3 text-xs flex-shrink-0"
                onClick={() => {
                  if (hasUnsavedChanges) {
                    setPendingNavigation(returnTo);
                    setShowUnsavedDialog(true);
                  } else {
                    navigate(returnTo);
                  }
                }}
                title="Back to list"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to list</span>
              </Button>
            )}
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

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-start sm:justify-end">
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
              <>
                <Button variant="ghost" size="sm" onClick={() => save(false)} disabled={saving || photoTemplateNeedsUpload} className="gap-1.5 text-xs h-8">
                  <Save className="h-3 w-3" /> {saving ? 'Saving…' : 'Save Draft'}
                </Button>
                {isComplete ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs h-8"
                    onClick={() => {
                      setChapter((prev) => (prev ? { ...prev, status: 'in_progress' } : prev));
                      save(false, 'in_progress');
                    }}
                    disabled={saving || photoTemplateNeedsUpload}
                  >
                    <Check className="h-3.5 w-3.5" /> Unmark Complete
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="gap-1.5 text-xs h-8"
                    onClick={handleMarkComplete}
                    disabled={saving || photoTemplateNeedsUpload}
                  >
                    <CheckCircle className="h-3.5 w-3.5" /> Mark Complete
                  </Button>
                )}
              </>
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
            <textarea
              ref={titleTextareaRef}
              value={chapter.title}
              onChange={e => {
                const v = e.target.value;
                setChapter(prev => prev ? { ...prev, title: v } : prev);
                setAllChapters(prev => prev.map(c => c.id === chapterId ? { ...c, title: v } : c));
                setHasUnsavedChanges(true);
              }}
              placeholder="Chapter title"
              aria-label="Chapter title"
              maxLength={45}
              rows={1}
              className="w-full border-0 bg-transparent outline-none focus:bg-[#FDFAF4] rounded-sm px-1 -mx-1 text-[32px] font-bold leading-tight text-foreground mb-1 resize-none overflow-hidden"
              style={{ fontFamily: 'var(--font-heading)' }}
            />
            <div className="text-[11px] text-muted-foreground/60 text-right -mt-1 mb-2" style={{ fontFamily: 'var(--font-body)' }}>
              {chapter.title.length}/45
            </div>
            <div className="mb-6" />

            {(() => {
              const page1Fill = layoutMeasurement?.pages?.[0]?.fillPercent ?? 0;
              const totalPages = layoutMeasurement?.totalPages ?? 1;
              const letterAtLimit = !!layoutMeasurement && (totalPages > 1 || page1Fill >= 100);
              return (
                <>
                  <div className="my-8 relative">
                    <div className="transition-all duration-200 rounded-sm inline-block w-full relative" style={{ borderLeft: '3px solid #C9A84C', background: '#FDFAF4', margin: '0 -8px', padding: '12px 8px 12px 19px' }}>
                      <textarea
                        ref={wisdomTextareaRef}
                        placeholder=""
                        value={content}
                        onChange={e => {
                          const ta = e.target;
                          const next = ta.value;
                          // Always allow shrinking (so users can edit down over-long content)
                          const isShrinking = next.length <= content.length;
                          if (next.length <= MAX_CONTENT_LENGTH && (isShrinking || !letterAtLimit)) {
                            setContent(next);
                            setHasUnsavedChanges(true);
                          } else if (!isShrinking && letterAtLimit) {
                            // Soft-block: revert to previous value
                            ta.value = content;
                          }
                          autoResize(ta);
                        }}
                        onBeforeInput={e => {
                          if (letterAtLimit) {
                            const ta = e.target as HTMLTextAreaElement;
                            // Block insertions; allow deletions (deleteContent*) and selection replacement
                            const it = (e as any).inputType as string | undefined;
                            const isInsert = !it || it.startsWith('insert');
                            const hasSelection = ta.selectionStart !== ta.selectionEnd;
                            if (isInsert && !hasSelection) {
                              e.preventDefault();
                            }
                          }
                        }}
                        onPaste={e => {
                          e.preventDefault();
                          if (letterAtLimit) return;
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
                        onBlur={e => {
                          const normalized = normalizeWhitespace(e.target.value);
                          setContent(normalized);
                          setMergedText(normalized);
                          autoResize(e.target);
                        }}
                        className="relative w-full border-0 bg-transparent resize-none outline-none px-0 text-[15px] leading-[1.8] text-foreground/80"
                        style={{ fontFamily: 'var(--font-devotional)', overflow: 'hidden' }}
                      />
                    </div>
                    {letterAtLimit && (
                      <div
                        className="mt-3 px-3 py-2 rounded-sm text-[0.78rem] text-foreground/75"
                        style={{ fontFamily: 'var(--font-body)', background: '#FDFAF4', borderLeft: '3px solid #C9A84C' }}
                        role="status"
                        aria-live="polite"
                      >
                        You've reached the end of the letter page. There's plenty of room to share more in the 52 chapters ahead.
                      </div>
                    )}
                  </div>

                  <div className="mt-8 pt-4 border-t border-[hsl(var(--devotional-border))] text-xs font-medium text-center" style={{ fontFamily: 'var(--font-body)' }}>
                    {layoutMeasurement ? (
                      <div className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[0.68rem] text-muted-foreground/80 leading-relaxed">
                        <span className="text-[#6B7280]">
                          Total Pages: <strong className="text-foreground">{layoutMeasurement.totalPages}</strong>
                        </span>
                        {layoutMeasurement.pages.map((page) => (
                          <span key={page.pageIndex}>
                            <span className="text-[#E5E7EB]">|</span>{' '}
                            Page {page.pageIndex + 1}:{' '}
                            {page.overflows ? (
                              <strong className="text-red-500 font-bold">Overflow</strong>
                            ) : (
                              <><strong className="text-foreground">{Math.round(page.fillPercent)}%</strong> full</>
                            )}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </>
              );
            })()}
          </PageCanvas>
        ) : (
          /* ═══ EDIT MODE — SINGLE CARD ═══ */
          <PageCanvas previewMode={false} companionSlot={companionSlotEl}>
            <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground/40 mb-2" style={{ fontFamily: 'var(--font-body)' }}>
              Chapter {chapter.chapter_number}
            </p>
            <textarea
              ref={titleTextareaRef}
              value={chapter.title}
              onChange={e => {
                const v = e.target.value;
                setChapter(prev => prev ? { ...prev, title: v } : prev);
                setAllChapters(prev => prev.map(c => c.id === chapterId ? { ...c, title: v } : c));
                setHasUnsavedChanges(true);
              }}
              placeholder="Chapter title"
              aria-label="Chapter title"
              maxLength={45}
              rows={1}
              className="w-full border-0 bg-transparent outline-none focus:bg-[#FDFAF4] rounded-sm px-1 -mx-1 text-[32px] font-bold leading-tight text-foreground mb-1 resize-none overflow-hidden"
              style={{ fontFamily: 'var(--font-heading)' }}
            />
            <div className="text-[11px] text-muted-foreground/60 text-right -mt-1 mb-2" style={{ fontFamily: 'var(--font-body)' }}>
              {chapter.title.length}/45
            </div>

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

            {template === 'photo_top' && (
              <div className="mb-4">
                {renderPhotoZone('horizontal')}
              </div>
            )}

            <DevotionalVerse text={bibleVerseText} reference={bibleVerseRef} onTextChange={v => { setBibleVerseText(v); setVerseId(null); setHasUnsavedChanges(true); }} onRefChange={v => { setBibleVerseRef(v); setHasUnsavedChanges(true); }} onFindAlternatives={() => handleFindAlternatives('verse')} editing={editingVerse} onToggleEdit={() => setEditingVerse(!editingVerse)} previewMode={false} />

            <DevotionalQuote text={quoteText} attribution={quoteAttribution} onTextChange={v => { setQuoteText(v); setQuoteId(null); setHasUnsavedChanges(true); }} onAttrChange={v => { setQuoteAttribution(v); setHasUnsavedChanges(true); }} onFindAlternatives={() => handleFindAlternatives('quote')} editing={editingQuote} onToggleEdit={() => setEditingQuote(!editingQuote)} previewMode={false} />

            <div className="my-8 relative">
              <div
                className="transition-all duration-200 rounded-sm relative"
                style={{ borderLeft: '3px solid #C9A84C', background: '#FDFAF4', margin: '0 -8px', padding: '12px 8px 12px 19px' }}
              >
                <textarea
                  ref={refTextareaRef}
                  value={referenceText}
                  rows={6}
                  placeholder="Begin your chapter here..."
                  onChange={e => {
                    const next = e.target.value;
                    if (next.length <= MAX_CONTENT_LENGTH) {
                      setReferenceText(next);
                      setMergedText(mergeRefAndContent(next, content));
                      setHasUnsavedChanges(true);
                      if (!hasEditedWisdom) setHasEditedWisdom(true);
                    }
                    autoResize(e.target);
                  }}
                  onPaste={e => {
                    e.preventDefault();
                    const text = e.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n');
                    const ta = e.target as HTMLTextAreaElement;
                    const start = ta.selectionStart;
                    const end = ta.selectionEnd;
                    const next = referenceText.slice(0, start) + text + referenceText.slice(end);
                    if (next.length > MAX_CONTENT_LENGTH) return;
                    setReferenceText(next);
                    setMergedText(mergeRefAndContent(next, content));
                    setHasUnsavedChanges(true);
                    if (!hasEditedWisdom) setHasEditedWisdom(true);
                    const caret = start + text.length;
                    requestAnimationFrame(() => {
                      ta.selectionStart = ta.selectionEnd = caret;
                      autoResize(ta);
                    });
                  }}
                  onBlur={e => {
                    const normalized = normalizeWhitespace(e.target.value);
                    setReferenceText(normalized);
                    setMergedText(mergeRefAndContent(normalized, content));
                    autoResize(e.target);
                  }}
                  className="relative w-full border-0 bg-transparent resize-none outline-none px-0 text-[15px] leading-[1.8] text-foreground/80"
                  style={{ fontFamily: 'var(--font-devotional)', overflow: 'hidden' }}
                />

                <div className="my-6 flex items-center justify-center gap-3 select-none" aria-hidden="true" style={{ fontFamily: 'var(--font-body)' }}>
                  <div className="h-px flex-1 bg-[#C9A84C]/70 max-w-[120px]" />
                  <span className="inline-flex items-center gap-1.5 text-[0.72rem] tracking-[0.24em] uppercase text-[#8A8A8A]">
                    <span className="text-[#C9A84C] text-[0.7rem] leading-none">✦</span>
                    Page 2
                  </span>
                  <div className="h-px flex-1 bg-[#C9A84C]/70 max-w-[120px]" />
                </div>

                {template === 'photo_second' && (
                  <div className="mb-4">
                    {renderPhotoZone('vertical')}
                  </div>
                )}

                <textarea
                  ref={wisdomTextareaRef}
                  value={content}
                  rows={6}
                  placeholder="Page 2 continues here..."
                  onChange={e => {
                    const next = e.target.value;
                    if (next.length <= MAX_CONTENT_LENGTH) {
                      setContent(next);
                      setMergedText(mergeRefAndContent(referenceText, next));
                      setHasUnsavedChanges(true);
                      if (!hasEditedWisdom) setHasEditedWisdom(true);
                    }
                    autoResize(e.target);
                  }}
                  onPaste={e => {
                    e.preventDefault();
                    const text = e.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n');
                    const ta = e.target as HTMLTextAreaElement;
                    const start = ta.selectionStart;
                    const end = ta.selectionEnd;
                    const next = content.slice(0, start) + text + content.slice(end);
                    if (next.length > MAX_CONTENT_LENGTH) return;
                    setContent(next);
                    setMergedText(mergeRefAndContent(referenceText, next));
                    setHasUnsavedChanges(true);
                    if (!hasEditedWisdom) setHasEditedWisdom(true);
                    const caret = start + text.length;
                    requestAnimationFrame(() => {
                      ta.selectionStart = ta.selectionEnd = caret;
                      autoResize(ta);
                    });
                  }}
                  onBlur={e => {
                    const normalized = normalizeWhitespace(e.target.value);
                    setContent(normalized);
                    setMergedText(mergeRefAndContent(referenceText, normalized));
                    autoResize(e.target);
                  }}
                  className="relative w-full border-0 bg-transparent resize-none outline-none px-0 text-[15px] leading-[1.8] text-foreground/80"
                  style={{ fontFamily: 'var(--font-devotional)', overflow: 'hidden' }}
                />
              </div>
            </div>

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
                      Page {page.pageIndex + 1}:{' '}
                      {page.overflows ? (
                        <strong className="text-red-500 font-bold">Overflow</strong>
                      ) : (
                        <><strong className="text-foreground">{Math.round(page.fillPercent)}%</strong> full</>
                      )}
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
            style={{ position: 'absolute', width: '1024px', height: '768px', left: '-9999px', top: '-9999px', border: 0, opacity: 0, pointerEvents: 'none' }}
          />
        )}

        {/* Bottom actions */}
        {!previewMode && (
          <div className="flex flex-col items-center gap-3 pt-8 mx-auto max-w-[600px]" style={{ padding: '32px 60px 64px' }}>
            <div className="flex w-full gap-3">
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
            <p className="text-[11px] text-muted-foreground/75 italic text-center mt-1" style={{ fontFamily: 'var(--font-body)' }}>
              Please save draft before marking complete to ensure correct formatting and accurate page preview.
            </p>
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

      {/* Memory capture overlay (toolbar manual entry + post-complete guided flow) */}
      {bookId && (
        <MemoryCaptureOverlay
          open={memoryOverlayOpen}
          onClose={() => setMemoryOverlayOpen(false)}
          bookId={bookId}
          chapterId={chapterId}
          onValidatePlacement={validateMemoryPlacement}
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
              .or('entry_type.is.null,entry_type.eq.memory')
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
              // Refresh placed memories after saving from the overlay.
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
