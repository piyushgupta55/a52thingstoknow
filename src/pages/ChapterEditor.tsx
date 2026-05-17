import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { getPage2Status } from '@/lib/page2Status';
import ChapterNav from '@/components/chapter/ChapterNav';
import ContentSearchPanel from '@/components/chapter/ContentSearchPanel';
import PageCanvas from '@/components/chapter/PageCanvas';
import CompanionBubble from '@/components/chapter/CompanionBubble';
import MemoryCaptureOverlay from '@/components/chapter/MemoryCaptureOverlay';
import { type CompanionEdit } from '@/hooks/useCompanionChat';
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

const MAX_CONTENT_LENGTH = 5000;

// Unified word budgets per template
const WORD_BUDGETS: Record<string, number> = {
  all_words: 450,
  photo_top: 350,
  photo_second: 350,
  letter: 200,
};

// Photo chapter designation is now loaded from database (chapter_templates.is_photo_chapter)
// instead of being hardcoded

interface PhotoValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
}

const validatePhoto = (file: File, variant: 'horizontal' | 'vertical'): Promise<PhotoValidationResult> => {
  return new Promise((resolve) => {
    // Format check
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      resolve({ valid: false, error: 'Only JPG and PNG formats are accepted for print quality.' });
      return;
    }
    // Size checks
    if (file.size < 500 * 1024) {
      resolve({ valid: false, error: 'This photo is under 500KB — it may be too low quality for print. Please choose a higher resolution image.' });
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      resolve({ valid: false, error: 'This photo exceeds the 15MB limit. Please compress or resize it before uploading.' });
      return;
    }
    // Resolution check
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      URL.revokeObjectURL(img.src);
      if (w < 300 || h < 300) {
        resolve({ valid: false, error: 'This photo is too low resolution for print. Please choose a higher quality image.' });
        return;
      }
      const minW = variant === 'horizontal' ? 1200 : 800;
      const minH = variant === 'horizontal' ? 800 : 1200;
      if (w < minW || h < minH) {
        resolve({ valid: true, warning: `This photo may appear blurry in print (${w}×${h}px). A minimum of ${minW}×${minH}px is recommended. You can still use it.` });
        return;
      }
      resolve({ valid: true });
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      resolve({ valid: false, error: 'Could not read this image file. Please try a different photo.' });
    };
    img.src = URL.createObjectURL(file);
  });
};

const getChapterIndicatorStatus = (ch: { status: string }) => {
  if (ch.status === 'complete') return 'complete';
  if (ch.status === 'in_progress') return 'in_progress';
  return 'not_started';
};

const ChapterEditor = () => {
  const { bookId, chapterId } = useParams<{ bookId: string; chapterId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [chapter, setChapter] = useState<ChapterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [bibleVerseText, setBibleVerseText] = useState('');
  const [bibleVerseRef, setBibleVerseRef] = useState('');
  const [quoteText, setQuoteText] = useState('');
  const [quoteAttribution, setQuoteAttribution] = useState('');
  const [content, setContent] = useState('');
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
  const isLetterChapter = chapter?.chapter_number === 0;
  const budget = WORD_BUDGETS[template] || WORD_BUDGETS.all_words;
  const showMemoryPlaceholder = !isLetterChapter && content.trim().split(/\s+/).filter(Boolean).length < 150;
  const isComplete = chapter?.status === 'complete';

  // Split reference text at paragraph boundary — used only for preview/print
  const splitForPreview = (text: string) => {
    const paragraphs = text.split(/\n\n/);
    const totalWords = text.replace(/\n/g, ' ').trim().split(/\s+/).filter(Boolean).length;
    const target = Math.floor(totalWords / 2);

    let count = 0;
    let splitIndex = 0;
    for (let i = 0; i < paragraphs.length; i++) {
      count += paragraphs[i].trim().split(/\s+/).filter(Boolean).length;
      if (count >= target) {
        splitIndex = i + 1;
        break;
      }
    }

    return {
      page1: paragraphs.slice(0, splitIndex).join('\n\n'),
      page2: paragraphs.slice(splitIndex).join('\n\n')
    };
  };

  // Unified word count
  const refWords = referenceText.replace(/\n/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  const contentWords = content.replace(/\n/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  const paragraphBreaks = (referenceText.match(/\n\n/g) || []).length;
  // Show the empty placeholder slot only when there are no real placed memories
  const memorySlots = showMemoryPlaceholder && (placedMemories?.length ?? 0) === 0 ? 1 : 0;
  // Use actual word counts from memory text for display accuracy.
  // The 40-word flat estimate is kept only for the overflow guard (conservative buffer).
  const placedMemoryWords = (placedMemories ?? []).reduce((sum, m) => {
    return sum + (m.memory_text || '').trim().split(/\s+/).filter(Boolean).length;
  }, 0);
  const totalWords = refWords + contentWords + (paragraphBreaks * 3) + (memorySlots * 40) + placedMemoryWords;

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
  // Auto-size textareas when entering edit mode
    setTimeout(() => {
      if (refTextareaRef.current) {
        refTextareaRef.current.style.height = 'auto';
        refTextareaRef.current.style.height = refTextareaRef.current.scrollHeight + 'px';
      }
      if (wisdomTextareaRef.current) {
        wisdomTextareaRef.current.style.height = 'auto';
        wisdomTextareaRef.current.style.height = wisdomTextareaRef.current.scrollHeight + 'px';
      }
    }, 50);
  };

  useEffect(() => {
    const handleScroll = () => {
      scrollPositionRef.current = window.scrollY;
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
      const genderTpls = (allTpls || []).filter((t: any) => t.gender === bookGender);
      const photoNums = new Set<number>(genderTpls.filter((t: any) => t.is_photo_chapter).map((t: any) => t.chapter_number as number));
      setPhotoChapterNums(photoNums);
      // Map chapter_number -> authoritative title from templates (gender-specific)
      const titleByNumber = new Map<number, string>(genderTpls.map((t: any) => [t.chapter_number as number, t.title as string]));
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
          if (chapterData.reference_text) {
            setReferenceText(chapterData.reference_text);
          } else if (rawRef) {
            const cleaned = replaceTokens(rawRef, {
              recipientName: bookData?.recipient_name || 'your child',
              recipientGender: bookData?.recipient_gender || '',
              authorLabel: bookData?.author_label,
            });
            setReferenceText(cleaned);
          }

          initialRef.current = { referenceText: chapterData.reference_text || rawRef || '', content: chapterData.content || '' };
          lastSavedRef.current = { referenceText: chapterData.reference_text || rawRef || '', content: chapterData.content || '' };
        }
      }
      if (bookData) {
        setRecipientName(bookData.recipient_name || '');
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
        const counts: Record<string, number> = {};
        memoriesData.forEach((m: any) => { if (m.chapter_id) counts[m.chapter_id] = (counts[m.chapter_id] || 0) + 1; });
        setMemoryCountsByChapter(counts);
        setPlacedMemories(
          memoriesData
            .filter((m: any) => m.chapter_id === chapterId)
            .map((m: any) => ({ id: m.id, memory_text: m.memory_text, contributor_name: m.contributor_name }))
        );
        setUnplacedMemories(
          memoriesData
            .filter((m: any) => !m.chapter_id)
            .map((m: any) => ({ id: m.id, memory_text: m.memory_text, contributor_name: m.contributor_name }))
        );
        setSuggestionIndex(0);
      }
      if (allCh) {
        const withCorrectTitles = allCh.map((c: any) =>
          c.chapter_number > 0
            ? { ...c, title: titleByNumber.get(c.chapter_number) || c.title }
            : c
        );
        setAllChapters(withCorrectTitles);
        const siblings = withCorrectTitles.filter((c: any) => c.id !== chapterId);
        setPhotoChapterCount(siblings.filter((s: any) => s.chapter_template === 'photo_top' || s.chapter_template === 'photo_second').length);
      }
      setLoading(false);
      const thisHasContent = ((chapterData?.content || '') as string).trim().length > 0;
      setPreviewMode(!thisHasContent);

      // After data is fully loaded, auto-resize the merged wisdom textarea
      // so it fits its content with no empty gap on first edit.
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (wisdomTextareaRef.current) {
            wisdomTextareaRef.current.style.height = 'auto';
            wisdomTextareaRef.current.style.height = wisdomTextareaRef.current.scrollHeight + 'px';
          }
        }, 100);
      });
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
    const page2HasContent =
      content.trim().length > 0 ||
      placedMemories.length > 0 ||
      photoUrls.length > 0;
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
    setSaving(true);
    const savedAt = new Date().toISOString();
    const newStatus = statusOverride || (markComplete ? 'complete' : chapter?.status === 'complete' ? 'complete' : 'in_progress');
    const { error } = await supabase.from('chapters').update({
      bible_verse_text: bibleVerseText || null,
      bible_verse_reference: bibleVerseRef || null,
      quote_text: quoteText || null,
      quote_attribution: quoteAttribution || null,
      content: content || null,
      reference_text: referenceText || null,
      photo_urls: photoUrls,
      chapter_template: template,
      verse_id: verseId,
      quote_id: quoteId,
      status: newStatus,
      updated_at: savedAt,
    }).eq('id', chapterId);

    if (error) {
      toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
    } else {
      setChapter(prev => prev ? { ...prev, status: newStatus } : prev);
      setAllChapters(prev => prev.map(c => c.id === chapterId ? { ...c, status: newStatus, updated_at: savedAt, content: content || null } : c));
      setHasUnsavedChanges(false);
      hasUnsavedRef.current = false;
      // Update last saved snapshot for revert
      lastSavedRef.current = { referenceText: referenceText || '', content: content || '' };
      toast({ title: markComplete ? 'Chapter marked complete!' : 'Draft saved!' });
      // After Mark Complete, advance to the next chapter that isn't complete yet
      if (markComplete) {
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
      requestAnimationFrame(() => {
        if (refTextareaRef.current) {
          refTextareaRef.current.style.height = 'auto';
          refTextareaRef.current.style.height = refTextareaRef.current.scrollHeight + 'px';
        }
      });
    } else {
      setContent(nextContent);
      setChapter(prev => prev ? { ...prev, content: nextContent } : prev);
      setAllChapters(prev => prev.map(c => c.id === chapterId ? { ...c, content: nextContent } : c));
      requestAnimationFrame(() => {
        if (wisdomTextareaRef.current) {
          wisdomTextareaRef.current.style.height = 'auto';
          wisdomTextareaRef.current.style.height = wisdomTextareaRef.current.scrollHeight + 'px';
        }
      });
    }
    setHasUnsavedChanges(true);
    toast({ title: 'Change applied', description: edit.summary });
  }, [chapterId, toast]);

  const handleRevertToSaved = useCallback(() => {
    const saved = lastSavedRef.current;
    setReferenceText(saved.referenceText);
    setContent(saved.content);
    setChapter(prev => prev ? { ...prev, content: saved.content || null, reference_text: saved.referenceText || null } : prev);
    setAllChapters(prev => prev.map(c => c.id === chapterId ? { ...c, content: saved.content || null, reference_text: saved.referenceText || null } : c));
    setHasUnsavedChanges(false);
    hasUnsavedRef.current = false;
    requestAnimationFrame(() => {
      if (refTextareaRef.current) {
        refTextareaRef.current.style.height = 'auto';
        refTextareaRef.current.style.height = refTextareaRef.current.scrollHeight + 'px';
      }
      if (wisdomTextareaRef.current) {
        wisdomTextareaRef.current.style.height = 'auto';
        wisdomTextareaRef.current.style.height = wisdomTextareaRef.current.scrollHeight + 'px';
      }
    });
    toast({ title: 'Reverted to last saved' });
  }, [chapterId, toast]);

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

    window.history.pushState = function (data: any, unused: string, url?: string | URL | null) {
      const target = url ? (typeof url === 'string' ? url : url.toString()) : currentPath;
      if (intercept(target)) return;
      return origPush.apply(this, [data, unused, url] as any);
    };
    window.history.replaceState = function (data: any, unused: string, url?: string | URL | null) {
      const target = url ? (typeof url === 'string' ? url : url.toString()) : currentPath;
      if (intercept(target)) return;
      return origReplace.apply(this, [data, unused, url] as any);
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
    // Use the same components as the displayed totalWords so the warning
    // matches what the author sees in the word counter.
    const projectedMemoryCount = placedMemories.length + 1;
    // After placement the empty placeholder slot disappears, so don't count it.
    const projected =
      refWords + contentWords + paragraphBreaks * 3 + projectedMemoryCount * 40;
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

  const renderParagraphs = (text: string, withDropCap: boolean, suppressDropCap: boolean, variant: 'body' | 'reference' = 'body') => {
    const paragraphs = text.split(/\n\n+/).filter(Boolean);
    const isRef = variant === 'reference';
    return paragraphs.map((p, i) => {
      const lines = p.split('\n');
      return (
        <p
          key={i}
          className={`${isRef ? 'text-[14px] italic leading-[1.75] text-foreground/55' : 'text-[15px] leading-[1.8] text-foreground/80'} ${
            i === 0 && withDropCap && !suppressDropCap ? 'drop-cap' : ''
          }`}
          style={{
            fontFamily: 'var(--font-devotional)',
            marginBottom: i < paragraphs.length - 1 ? '1.4em' : 0,
          }}
        >
          {lines.map((line, idx) => (
            <span key={idx} className="block">
              {line || '\u00A0'}
            </span>
          ))}
        </p>
      );
    });
  };

  const renderPhotoZone = (variant: 'horizontal' | 'vertical' = 'horizontal') => {
    if (previewMode) {
      if (photoUrls.length === 0) return null;
      const isVert = variant === 'vertical';
      return (
        <div className={`rounded-sm overflow-hidden mb-6 ${isVert ? 'flex justify-center' : ''}`}>
          <img
            src={photoUrls[0]}
            alt="Chapter photo"
            className="object-cover"
            style={{
              width: isVert ? '260px' : '100%',
              height: isVert ? '340px' : '200px',
            }}
          />
        </div>
      );
    }
    return (
      <PhotoUploadZone
        photoUrls={photoUrls}
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

  // Split reference text by word count for the editor's two-page visual.
  // page1Limit = ~150 words for classic chapters, ~75 for photo chapters
  // (photo chapters give half of page 1 to the image).
  const splitRefByWordLimit = (text: string, wordLimit: number) => {
    if (!text) return { page1: '', page2: '' };
    // Tokenize while preserving whitespace so we can re-join exactly.
    const tokens = text.split(/(\s+)/);
    let words = 0;
    let splitAt = tokens.length;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] && !/^\s+$/.test(tokens[i])) {
        words++;
        if (words > wordLimit) { splitAt = i; break; }
      }
    }
    return {
      page1: tokens.slice(0, splitAt).join(''),
      page2: tokens.slice(splitAt).join('').replace(/^\s+/, ''),
    };
  };

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

  // Preview split — only computed for preview/print rendering
  const previewSplit = previewMode ? splitForPreview(referenceText) : { page1: referenceText, page2: '' };


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
              <Button variant="ghost" size="sm" onClick={() => save(false)} disabled={saving} className="gap-1.5 text-xs h-8">
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
          isLetterChapter ? (
            <>
              {/* ═══ LETTER PREVIEW — single right-hand page ═══ */}
              <PageCanvas previewMode pageNumber={1} companionSlot={companionSlotEl}>
                <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground/40 mb-2" style={{ fontFamily: 'var(--font-body)' }}>
                  Letter from the Author
                </p>
                <h1 className="text-[32px] font-bold leading-tight text-foreground mb-1" style={{ fontFamily: 'var(--font-heading)' }}>
                  {chapter.title}
                </h1>
                <div className="mb-6" />
                {(content?.trim() || referenceText) && (
                  <div className="my-8">{renderParagraphs(content?.trim() ? content : referenceText, false, true, 'reference')}</div>
                )}
              </PageCanvas>
            </>
          ) : (
          <>
            {/* ═══ PREVIEW PAGE 1 ═══ */}
            <PageCanvas previewMode pageNumber={1} companionSlot={companionSlotEl}>
              <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground/40 mb-2" style={{ fontFamily: 'var(--font-body)' }}>
                Chapter {chapter.chapter_number}
              </p>
              <h1 className="text-[32px] font-bold leading-tight text-foreground mb-1" style={{ fontFamily: 'var(--font-heading)' }}>
                {chapter.title}
              </h1>
              <div className="mb-6" />
              {template === 'photo_top' && renderPhotoZone('horizontal')}
              <DevotionalVerse text={bibleVerseText} reference={bibleVerseRef} onTextChange={() => {}} onRefChange={() => {}} onFindAlternatives={() => {}} editing={false} onToggleEdit={() => {}} previewMode />
              <DevotionalQuote text={quoteText} attribution={quoteAttribution} onTextChange={() => {}} onAttrChange={() => {}} onFindAlternatives={() => {}} editing={false} onToggleEdit={() => {}} previewMode />
              {referenceText && (
                <div className="my-8">{renderParagraphs(previewSplit.page1, true, false, 'reference')}</div>
              )}
              {placedMemories.length > 0 && !previewSplit.page2 && (
                <>
                  {placedMemories.map(m => (
                    <PlacedMemory key={m.id} text={m.memory_text} fromName={m.contributor_name} />
                  ))}
                </>
              )}
              {showMemoryPlaceholder && placedMemories.length === 0 && !previewSplit.page2 && <MemoryPlaceholder recipientName={recipientName} realistic />}
            </PageCanvas>

            <div style={{ height: '32px' }} />

            {/* ═══ PREVIEW PAGE 2 ═══ */}
            <PageCanvas previewMode pageNumber={2}>
              {template === 'photo_second' && renderPhotoZone('vertical')}
              {previewSplit.page2 && (
                <div className="mb-6">{renderParagraphs(previewSplit.page2, false, true, 'reference')}</div>
              )}
              {content && <div className="min-h-[300px]">{renderParagraphs(content, true, false)}</div>}
              {placedMemories.length > 0 && (
                <>
                  {placedMemories.map(m => (
                    <PlacedMemory key={m.id} text={m.memory_text} fromName={m.contributor_name} />
                  ))}
                </>
              )}
              {showMemoryPlaceholder && placedMemories.length === 0 && <MemoryPlaceholder recipientName={recipientName} realistic />}
            </PageCanvas>
          </>
          )
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
              <div className="transition-all duration-200 rounded-sm inline-block w-full" style={{ borderLeft: '3px solid #C9A84C', background: '#FDFAF4', margin: '0 -8px', padding: '12px 8px 12px 19px' }}>
                <textarea
                  ref={wisdomTextareaRef}
                  placeholder=""
                  value={content}
                  onInput={e => {
                    const ta = e.target as HTMLTextAreaElement;
                    if (ta.value.length <= MAX_CONTENT_LENGTH) {
                      setContent(ta.value);
                      setHasUnsavedChanges(true);
                    }
                    ta.style.height = 'auto';
                    ta.style.height = ta.scrollHeight + 'px';
                  }}
                  onPaste={e => {
                    e.preventDefault();
                    const text = e.clipboardData.getData('text/plain');
                    const ta = e.target as HTMLTextAreaElement;
                    const start = ta.selectionStart;
                    const end = ta.selectionEnd;
                    const newVal = content.slice(0, start) + text + content.slice(end);
                    if (newVal.length <= MAX_CONTENT_LENGTH) {
                      setContent(newVal);
                      setHasUnsavedChanges(true);
                    }
                    requestAnimationFrame(() => {
                      ta.selectionStart = ta.selectionEnd = start + text.length;
                      ta.style.height = 'auto';
                      ta.style.height = ta.scrollHeight + 'px';
                    });
                  }}
                  rows={6}
                  className="w-full border-0 bg-transparent resize-none outline-none px-0 text-[15px] leading-[1.8] text-foreground/80"
                  style={{ fontFamily: 'var(--font-devotional)', minHeight: '200px', overflow: 'hidden' }}
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
                <TemplateSelector template={template} onTemplateChange={t => { setTemplate(t); setHasUnsavedChanges(true); }} photoChapterCount={photoChapterCount} maxPhotoChapters={maxPhotoChapters} photoUrl={photoUrls[0] || null} />
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
                    <TemplateSelector template={template} onTemplateChange={t => { setTemplate(t); setHasUnsavedChanges(true); setLayoutDrawerOpen(false); }} photoChapterCount={photoChapterCount} maxPhotoChapters={maxPhotoChapters} photoUrl={photoUrls[0] || null} />
                  </div>
                )}
              </>
            )}

            {template === 'photo_top' && renderPhotoZone('horizontal')}

            <DevotionalVerse text={bibleVerseText} reference={bibleVerseRef} onTextChange={v => { setBibleVerseText(v); setVerseId(null); setHasUnsavedChanges(true); }} onRefChange={v => { setBibleVerseRef(v); setHasUnsavedChanges(true); }} onFindAlternatives={() => handleFindAlternatives('verse')} editing={editingVerse} onToggleEdit={() => setEditingVerse(!editingVerse)} previewMode={false} />

            <DevotionalQuote text={quoteText} attribution={quoteAttribution} onTextChange={v => { setQuoteText(v); setQuoteId(null); setHasUnsavedChanges(true); }} onAttrChange={v => { setQuoteAttribution(v); setHasUnsavedChanges(true); }} onFindAlternatives={() => handleFindAlternatives('quote')} editing={editingQuote} onToggleEdit={() => setEditingQuote(!editingQuote)} previewMode={false} />

            {template === 'photo_second' && renderPhotoZone('vertical')}

            {/* ─── Single continuous chapter textarea ─── */}
            {(() => {
              // Join without an artificial paragraph break — splitAtWordLimit
              // preserves the boundary whitespace token in `ref`, so plain
              // concatenation reconstructs the original text. Insert a single
              // space only when neither side has a boundary whitespace
              // (can happen after loading legacy DB rows).
              const needsSpace =
                referenceText.length > 0 &&
                content.length > 0 &&
                !/\s$/.test(referenceText) &&
                !/^\s/.test(content);
              const combined = referenceText + (needsSpace ? ' ' : '') + content;

              // Page 1 word boundary — classic 150, photo templates 75
              const isPhotoTpl = template === 'photo_top' || template === 'photo_second';
              const PAGE_1_WORD_LIMIT = isPhotoTpl ? 75 : 150;

              const splitAtWordLimit = (text: string, limit: number) => {
                const tokens = text.split(/(\s+)/);
                let words = 0;
                let splitAt = tokens.length;
                for (let i = 0; i < tokens.length; i++) {
                  if (tokens[i] && !/^\s+$/.test(tokens[i])) {
                    words++;
                    if (words > limit) { splitAt = i; break; }
                  }
                }
                return {
                  ref: tokens.slice(0, splitAt).join(''),
                  rest: tokens.slice(splitAt).join('').replace(/^\s+/, ''),
                };
              };

              const applyCombined = (newVal: string) => {
                const { ref, rest } = splitAtWordLimit(newVal, PAGE_1_WORD_LIMIT);
                setReferenceText(ref);
                setContent(rest);
                setHasUnsavedChanges(true);
                if (!hasEditedWisdom) setHasEditedWisdom(true);
              };

              const totalChapterWords = combined.replace(/\n/g, ' ').trim().split(/\s+/).filter(Boolean).length;
              const showPageBreak = totalChapterWords > PAGE_1_WORD_LIMIT;

              // Live page-2 over-budget check (mirrors the status bar formula below)
              const _page2Budget = Math.max(0, budget - PAGE_1_WORD_LIMIT);
              const _paragraphBreaks = (combined.match(/\n\n/g) || []).length;
              const _emptySlotCount = showMemoryPlaceholder ? 1 : 0;
              const _memoryWordCost = (_emptySlotCount + (placedMemories?.length ?? 0)) * 40;
              const _page2Words =
                Math.max(0, totalChapterWords - PAGE_1_WORD_LIMIT) +
                _paragraphBreaks * 3 +
                _memoryWordCost;
              const isPage2Over = _page2Words > _page2Budget;

              // Compute split point in `combined` so that overflow words can be highlighted.
              // Allowed text words = page 1 limit + (page 2 budget minus paragraph-break and memory costs).
              const _allowedPage2TextWords = Math.max(0, _page2Budget - _paragraphBreaks * 3 - _memoryWordCost);
              const _allowedTextWords = PAGE_1_WORD_LIMIT + _allowedPage2TextWords;
              let _splitIdx = combined.length;
              if (isPage2Over) {
                const tokenRe = /\s+|\S+/g;
                let wordCount = 0;
                let m: RegExpExecArray | null;
                while ((m = tokenRe.exec(combined)) !== null) {
                  if (!/^\s+$/.test(m[0])) {
                    wordCount++;
                    if (wordCount > _allowedTextWords) {
                      _splitIdx = m.index;
                      break;
                    }
                  }
                }
              }
              const _normalText = combined.slice(0, _splitIdx);
              const _overflowText = combined.slice(_splitIdx);

              return (
                <>
                  <div className="my-8 relative">
                    <div
                      className="transition-all duration-200 rounded-sm"
                      style={{
                        border: isPage2Over ? '2px solid #EF4444' : undefined,
                        borderLeft: isPage2Over ? '2px solid #EF4444' : '3px solid #C9A84C',
                        background: '#FDFAF4',
                        margin: '0 -8px',
                        padding: '12px 8px 12px 19px',
                      }}
                    >
                      <div className="relative">
                        {isPage2Over && (
                          <div
                            aria-hidden="true"
                            className="absolute inset-0 pointer-events-none text-[14px] italic leading-[1.75] px-0"
                            style={{
                              fontFamily: 'var(--font-devotional)',
                              whiteSpace: 'pre-wrap',
                              wordWrap: 'break-word',
                              overflowWrap: 'break-word',
                              color: 'transparent',
                              minHeight: '300px',
                            }}
                          >
                            {_normalText}
                            <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.28)', borderRadius: '2px' }}>
                              {_overflowText}
                            </span>
                            {'\u200b'}
                          </div>
                        )}
                        <textarea
                          ref={wisdomTextareaRef}
                          value={combined}
                          onFocus={e => {
                            e.target.setAttribute('data-no-scroll', 'true');
                            const scrollY = window.scrollY;
                            requestAnimationFrame(() => {
                              window.scrollTo({ top: scrollY });
                            });
                          }}
                          onChange={e => {
                            if (e.target.value.length <= MAX_CONTENT_LENGTH) {
                              applyCombined(e.target.value);
                            }
                            const ta = e.target;
                            const prevScroll = window.scrollY;
                            ta.style.height = 'auto';
                            ta.style.height = ta.scrollHeight + 'px';
                            if (window.scrollY !== prevScroll) {
                              window.scrollTo({ top: prevScroll });
                            }
                          }}
                          onPaste={e => {
                            e.preventDefault();
                            const text = e.clipboardData.getData('text/plain');
                            const ta = e.target as HTMLTextAreaElement;
                            const start = ta.selectionStart;
                            const end = ta.selectionEnd;
                            const newVal = combined.slice(0, start) + text + combined.slice(end);
                            if (newVal.length <= MAX_CONTENT_LENGTH) {
                              applyCombined(newVal);
                            }
                            requestAnimationFrame(() => {
                              ta.selectionStart = ta.selectionEnd = start + text.length;
                              ta.style.height = 'auto';
                              ta.style.height = ta.scrollHeight + 'px';
                            });
                          }}
                          className="relative w-full border-0 bg-transparent resize-none outline-none px-0 text-[14px] italic leading-[1.75] text-foreground/55 placeholder:text-muted-foreground/25"
                          style={{ fontFamily: 'var(--font-devotional)', overflow: 'hidden', minHeight: '300px' }}
                        />
                      </div>
                    </div>
                  </div>

                  {showPageBreak && (
                    <div
                      className="mt-2 mb-6 flex items-center gap-3 select-none"
                      aria-hidden="true"
                      style={{ fontFamily: 'var(--font-body)' }}
                    >
                      <div className="flex-1 h-px bg-muted-foreground/20" />
                      <span className="text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground/55">
                        <span className="text-[#C9A84C] mr-1.5">✦</span>Page 2
                      </span>
                      <div className="flex-1 h-px bg-muted-foreground/20" />
                    </div>
                  )}
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
              const isPhotoTpl = template === 'photo_top' || template === 'photo_second';
              const PAGE_1_LIMIT = isPhotoTpl ? 75 : 150;
              const page2Budget = Math.max(0, budget - PAGE_1_LIMIT);
              const rawText = referenceText + ' ' + content;
              const combinedWords = rawText.trim().split(/\s+/).filter(Boolean).length;
              const allParagraphBreaks = (rawText.match(/\n\n/g) || []).length;
              const memoryWordCost = (placedMemories?.length ?? 0) * 40;
              const page2Words =
                Math.max(0, combinedWords - PAGE_1_LIMIT) +
                allParagraphBreaks * 3 +
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

            {/* Page 2 status — single simple line */}
            <div className="text-center mt-8 pt-4 border-t border-[hsl(var(--devotional-border))]">
              {(() => {
                const isPhotoTpl = template === 'photo_top' || template === 'photo_second';
                const PAGE_1_LIMIT = isPhotoTpl ? 75 : 150;
                const page2Budget = Math.max(0, budget - PAGE_1_LIMIT);
                const rawText = wisdomTextareaRef.current?.value ?? (referenceText + ' ' + content);
                const combinedWords = rawText.trim().split(/\s+/).filter(Boolean).length;
                const allParagraphBreaks = (rawText.match(/\n\n/g) || []).length;
                // Each placed memory costs 40 words; the empty placeholder slot (if shown) also costs 40.
                const emptySlotCount = showMemoryPlaceholder ? 1 : 0;
                const memoryWordCost = (emptySlotCount + (placedMemories?.length ?? 0)) * 40;
                const page2Words =
                  Math.max(0, combinedWords - PAGE_1_LIMIT) +
                  allParagraphBreaks * 3 +
                  memoryWordCost;
                const remaining = page2Budget - page2Words;
                const isOver = remaining < 0;
                const color = isOver ? '#EF4444' : '#16A34A';
                let label: string;
                if (isOver) {
                  const over = Math.abs(remaining);
                  label = `Page 2 · ${over} word${over === 1 ? '' : 's'} over`;
                } else if (remaining === 0) {
                  label = 'Page 2 · Full';
                } else {
                  label = `Page 2 · ${remaining} word${remaining === 1 ? '' : 's'} available`;
                }
                return (
                  <span className="font-medium" style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color }}>
                    {label}
                  </span>
                );
              })()}
            </div>
          </PageCanvas>
        )}

        {/* Bottom actions */}
        {!previewMode && (
          <div className="flex gap-3 pt-8 mx-auto max-w-[600px]" style={{ padding: '32px 60px 64px' }}>
            <Button variant="outline" size="lg" className="flex-1 gap-2" onClick={() => save(false)} disabled={saving}>
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
                disabled={saving}
              >
                <Check className="h-4 w-4" /> Unmark Complete
              </Button>
            ) : (
              <Button size="lg" className="flex-1 gap-2" onClick={handleMarkComplete} disabled={saving}>
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
              const counts: Record<string, number> = {};
              data.forEach((m: any) => { if (m.chapter_id) counts[m.chapter_id] = (counts[m.chapter_id] || 0) + 1; });
              setMemoryCountsByChapter(counts);
              setPlacedMemories(
                data
                  .filter((m: any) => m.chapter_id === chapterId)
                  .map((m: any) => ({ id: m.id, memory_text: m.memory_text, contributor_name: m.contributor_name }))
              );
              setUnplacedMemories(
                data
                  .filter((m: any) => !m.chapter_id)
                  .map((m: any) => ({ id: m.id, memory_text: m.memory_text, contributor_name: m.contributor_name }))
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
