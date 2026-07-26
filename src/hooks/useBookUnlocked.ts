import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function useBookUnlocked(bookId: string | undefined) {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);

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
  }, [bookId]);

  return unlocked;
}
