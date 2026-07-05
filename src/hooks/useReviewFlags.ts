import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { ReviewAction } from '@/lib/reviewTags';

/**
 * Loads per-<review>-span action flags for a chapter and provides a setter that
 * upserts into `chapter_review_flags`. Default action is 'keep' (no row).
 */
export function useReviewFlags(chapterId: string | null | undefined) {
  const [flags, setFlags] = useState<Record<number, ReviewAction>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!chapterId) { setFlags({}); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('chapter_review_flags')
        .select('tag_index, action')
        .eq('chapter_id', chapterId);
      if (!cancelled) {
        const map: Record<number, ReviewAction> = {};
        (data || []).forEach((r: any) => { map[r.tag_index] = r.action as ReviewAction; });
        setFlags(map);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [chapterId]);

  const setFlag = useCallback(async (tagIndex: number, action: ReviewAction) => {
    if (!chapterId) return;
    setFlags(prev => ({ ...prev, [tagIndex]: action }));
    await supabase
      .from('chapter_review_flags')
      .upsert({ chapter_id: chapterId, tag_index: tagIndex, action }, { onConflict: 'chapter_id,tag_index' });
  }, [chapterId]);

  return { flags, setFlag, loading };
}
