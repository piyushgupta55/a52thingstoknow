import { useBookUnlocked } from "@/hooks/useBookUnlocked";
import { usePreviewSets, isInSet } from "@/lib/previewSets";

export interface ChapterAccess {
  loading: boolean;
  purchased: boolean;
  /** User can read the chapter body in the app. */
  canRead: boolean;
  /** User can edit the chapter (Edit tab, autosave). */
  canEdit: boolean;
  /** User can use paid extras: photos, memories, family invites, PDF, mark complete. */
  canUsePaidFeatures: boolean;
  inTrialReadable: boolean;
  inTrialEditable: boolean;
}

/**
 * Determines what the current user is allowed to do with a chapter, based on
 * whether the book is purchased and (if not) whether the chapter is in the
 * admin-configured trial preview sets.
 */
export function useChapterAccess(bookId: string | undefined, chapterTitle: string | null | undefined): ChapterAccess {
  const unlocked = useBookUnlocked(bookId);
  const { sets, loading: setsLoading } = usePreviewSets();

  const purchased = unlocked === true;
  const inTrialReadable = isInSet(chapterTitle, sets.trial_readable);
  const inTrialEditable = isInSet(chapterTitle, sets.trial_editable);
  const canRead = purchased || inTrialReadable || inTrialEditable;
  const canEdit = purchased || inTrialEditable;
  const canUsePaidFeatures = purchased;

  return {
    loading: unlocked === null || setsLoading,
    purchased,
    canRead,
    canEdit,
    canUsePaidFeatures,
    inTrialReadable,
    inTrialEditable,
  };
}
