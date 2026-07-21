import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Shield } from "lucide-react";
import { toast } from "sonner";

const CREAM = "#F5F0E8";
const GOLD = "#BBA96A";
const SERIF = "'Lora', 'Georgia', 'Times New Roman', serif";

export default function BookCheckoutReturn() {
  const { bookId } = useParams<{ bookId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = params.get("session_id");
  const [purchase, setPurchase] = useState<any>(null);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    const poll = async () => {
      const { data } = await supabase
        .from("book_purchases")
        .select("*")
        .eq("stripe_session_id", sessionId)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setPurchase(data);
        toast.success("Your trial edits were saved — nothing was lost.");
      } else if (tries < 20) setTimeout(() => setTries((t) => t + 1), 1000);
    };
    poll();
    return () => { cancelled = true; };
  }, [sessionId, tries]);

  return (
    <div className="min-h-screen" style={{ background: CREAM, fontFamily: SERIF }}>
      <Navbar />
      <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
        {purchase ? (
          <>
            <CheckCircle2 className="h-16 w-16 mx-auto mb-4" style={{ color: GOLD }} />
            <h1 className="font-heading text-4xl font-bold mb-3" style={{ color: "#2a1f1a" }}>You're in.</h1>
            <p className="text-lg mb-6" style={{ color: "#5a4632" }}>
              The full book is unlocked. Start writing whenever you're ready.
            </p>
            <div className="bg-white/70 rounded-xl p-5 mb-6 text-left border" style={{ borderColor: "rgba(187,169,106,0.3)" }}>
              <div className="flex gap-3 items-start">
                <Shield className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />
                <div>
                  <p className="font-heading font-bold" style={{ color: "#2a1f1a" }}>Full refund available until {new Date(purchase.guarantee_deadline).toLocaleDateString()}</p>
                  <p className="text-sm mt-1" style={{ color: "#5a4632" }}>
                    Change your mind before then and we'll refund you in full — no questions barred, just a couple asked so we can improve.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-center">
              <Button size="lg" onClick={() => navigate(`/book/${bookId}`)}>Go to your book</Button>
            </div>
          </>
        ) : (
          <p className="text-lg" style={{ color: "#5a4632" }}>Finalizing your purchase…</p>
        )}
      </div>
    </div>
  );
}
