import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useIsAdmin } from "@/hooks/useIsAdmin";

export function useBookUnlocked(bookId: string | undefined) {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  useEffect(() => {
    const handleUnlocked = (event: Event) => {
      const detail = (event as CustomEvent<{ bookId?: string }>).detail;
      if (!bookId || detail?.bookId !== bookId) return;
      setUnlocked(true);
    };

    window.addEventListener("book-unlocked", handleUnlocked);
    return () => window.removeEventListener("book-unlocked", handleUnlocked);
  }, [bookId]);

  useEffect(() => {
    if (!bookId) { setUnlocked(false); return; }
    if (adminLoading) return;
    // Admins always have full access — no purchase required.
    if (isAdmin) { setUnlocked(true); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("book_purchases")
        .select("id")
        .eq("book_id", bookId)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (!cancelled) setUnlocked(!!data);
    })();
    return () => { cancelled = true; };
  }, [bookId, isAdmin, adminLoading]);

  return unlocked;
}

