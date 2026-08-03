import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles } from "lucide-react";
import { useBookUnlocked } from "@/hooks/useBookUnlocked";
import { supabase } from "@/lib/supabase";
import { useState } from "react";
import { toast } from "sonner";
import { usePricing, formatUSD } from "@/hooks/usePricing";

const GOLD = "#BBA96A";

export function BookLockBanner({ bookId }: { bookId: string }) {
  const navigate = useNavigate();
  const unlocked = useBookUnlocked(bookId);
  const { pricing } = usePricing();
  const [claiming, setClaiming] = useState(false);
  const [justUnlocked, setJustUnlocked] = useState(false);
  if (unlocked === null || unlocked || justUnlocked) return null;

  const finishCompUnlock = () => {
    setJustUnlocked(true);
    window.dispatchEvent(new CustomEvent("book-unlocked", { detail: { bookId } }));
    toast.success("Complimentary access applied. Your book is unlocked.");
    navigate(`/book/${bookId}`, { replace: true });
  };

  const handleUnlock = async () => {
    setClaiming(true);
    try {
      const { data } = await supabase.rpc("claim_pending_comp", { _book_id: bookId });
      if ((data as { claimed?: boolean } | null)?.claimed) {
        finishCompUnlock();
        return;
      }
    } catch {
      /* continue to normal unlock page */
    } finally {
      setClaiming(false);
    }
    navigate(`/book/${bookId}/unlock`);
  };

  return (
    <div className="w-full border-b" style={{ background: "rgba(187,169,106,0.12)", borderColor: "rgba(187,169,106,0.35)" }}>
      <div className="container mx-auto px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2 text-sm" style={{ color: "#5a4632" }}>
          <Sparkles className="h-4 w-4" style={{ color: GOLD }} />
          <span><b>Preview mode.</b> Read through the first group free. Unlock{pricing ? ` for ${formatUSD(pricing.book_cents)}` : ""} to personalize every chapter and ship the printed keepsake.</span>
        </div>
        <Button size="sm" style={{ background: GOLD, color: "#fff" }} onClick={handleUnlock} disabled={claiming}>
          {claiming ? "Checking access…" : "Unlock full book"}
        </Button>
      </div>
    </div>
  );
}

/** Full-page redirect notice for gated pages when not unlocked. */
export function LockedPage({ bookId, title, message }: { bookId: string; title: string; message: string }) {
  const navigate = useNavigate();
  const { pricing } = usePricing();
  const [claiming, setClaiming] = useState(false);

  const finishCompUnlock = () => {
    window.dispatchEvent(new CustomEvent("book-unlocked", { detail: { bookId } }));
    toast.success("Complimentary access applied. Your book is unlocked.");
    navigate(`/book/${bookId}`, { replace: true });
  };

  const handleUnlock = async () => {
    setClaiming(true);
    try {
      const { data } = await supabase.rpc("claim_pending_comp", { _book_id: bookId });
      if ((data as { claimed?: boolean } | null)?.claimed) {
        finishCompUnlock();
        return;
      }
    } catch {
      /* continue to normal unlock page */
    } finally {
      setClaiming(false);
    }
    navigate(`/book/${bookId}/unlock`);
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md text-center bg-white/70 rounded-xl p-8 border" style={{ borderColor: "rgba(187,169,106,0.3)" }}>
        <Lock className="h-8 w-8 mx-auto mb-3" style={{ color: GOLD }} />
        <h2 className="font-heading text-2xl font-bold mb-2" style={{ color: "#2a1f1a" }}>{title}</h2>
        <p className="mb-5 text-sm" style={{ color: "#5a4632" }}>{message}</p>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" onClick={() => navigate(`/book/${bookId}`)}>Back to book</Button>
          <Button style={{ background: GOLD, color: "#fff" }} onClick={handleUnlock} disabled={claiming}>
            {claiming ? "Checking access…" : (pricing ? `Unlock ${formatUSD(pricing.book_cents)}` : "Unlock full book")}
          </Button>
        </div>
      </div>
    </div>
  );
}
