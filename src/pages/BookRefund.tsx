import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { getStripeEnvironment } from "@/lib/stripe";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const CREAM = "#F5F0E8";
const GOLD = "#BBA96A";
const SERIF = "'Lora', 'Georgia', 'Times New Roman', serif";

const REASONS = [
  { value: "too_busy", label: "Too busy right now" },
  { value: "harder_than_expected", label: "Harder than I expected" },
  { value: "changed_mind", label: "Changed my mind" },
  { value: "something_else", label: "Something else" },
];

export default function BookRefund() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const [purchase, setPurchase] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"intercept" | "confirm">("intercept");
  const [reason, setReason] = useState("");
  const [reasonText, setReasonText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!bookId) return;
    (async () => {
      const { data } = await supabase
        .from("book_purchases")
        .select("*, books!inner(recipient_name)")
        .eq("book_id", bookId)
        .eq("status", "active")
        .maybeSingle();
      setPurchase(data);
      setLoading(false);
    })();
  }, [bookId]);

  const submit = async () => {
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("request-book-refund", {
      body: { purchaseId: purchase.id, reason, reasonText, environment: getStripeEnvironment() },
    });
    setSubmitting(false);
    if (error || data?.error) {
      toast({ title: "Refund failed", description: data?.error || error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Refunded", description: "Your card will show the credit in a few business days." });
    navigate(`/book/${bookId}`);
  };

  if (loading) return <div className="p-8 text-center">Loading…</div>;

  if (!purchase) {
    return (
      <div className="min-h-screen" style={{ background: CREAM, fontFamily: SERIF }}>
        <Navbar />
        <div className="container mx-auto max-w-2xl px-4 py-10">
          <p>No active purchase found for this book.</p>
          <Button className="mt-4" onClick={() => navigate(`/book/${bookId}`)}>Back</Button>
        </div>
      </div>
    );
  }

  const deadline = new Date(purchase.guarantee_deadline + "T23:59:59");
  const withinWindow = new Date() < deadline;

  return (
    <div className="min-h-screen" style={{ background: CREAM, fontFamily: SERIF }}>
      <Navbar />
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={() => navigate(`/book/${bookId}/settings`)}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
        </Button>

        {!withinWindow ? (
          <div className="bg-white/70 rounded-xl p-6 border" style={{ borderColor: "rgba(187,169,106,0.3)" }}>
            <h1 className="font-heading text-2xl font-bold mb-2" style={{ color: "#2a1f1a" }}>Guarantee window closed</h1>
            <p style={{ color: "#5a4632" }}>Your refund window ended on {deadline.toLocaleDateString()}. Email help@52thingstoknow.com and we'll see what we can do.</p>
          </div>
        ) : step === "intercept" ? (
          <>
            <p className="uppercase tracking-[0.3em] text-xs mb-2" style={{ color: GOLD }}>Before you go</p>
            <h1 className="font-heading text-3xl font-bold mb-3" style={{ color: "#2a1f1a" }}>What's holding you up?</h1>
            <p className="mb-6" style={{ color: "#5a4632" }}>
              No wrong answers. Pick one — it helps us make this easier for the next parent.
            </p>

            <div className="space-y-2 mb-4">
              {REASONS.map((r) => (
                <label
                  key={r.value}
                  className="flex items-center gap-3 p-4 bg-white/70 rounded-lg border cursor-pointer hover:border-current"
                  style={{ borderColor: reason === r.value ? GOLD : "rgba(187,169,106,0.3)" }}
                >
                  <input type="radio" name="reason" checked={reason === r.value} onChange={() => setReason(r.value)} />
                  <span style={{ color: "#2a1f1a" }}>{r.label}</span>
                </label>
              ))}
            </div>

            <textarea
              className="w-full rounded-lg border p-3 mb-4 min-h-[100px] bg-white/70"
              style={{ borderColor: "rgba(187,169,106,0.3)", fontFamily: SERIF }}
              placeholder="Anything else you'd like to share (optional)"
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
            />

            <div className="bg-white rounded-xl p-4 mb-4 border-2" style={{ borderColor: GOLD }}>
              <p className="font-semibold mb-1" style={{ color: "#2a1f1a" }}>Can we help you finish?</p>
              <p className="text-sm" style={{ color: "#5a4632" }}>
                Reply to help@52thingstoknow.com and we'll walk you through it — often 10 minutes is all it takes to get unstuck.
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => navigate(`/book/${bookId}`)}>
                Keep my book
              </Button>
              <Button className="flex-1" disabled={!reason} onClick={() => setStep("confirm")}>
                Continue with refund
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white/70 rounded-xl p-6 mb-4 border" style={{ borderColor: "rgba(187,169,106,0.3)" }}>
              <Shield className="h-6 w-6 mb-2" style={{ color: GOLD }} />
              <h1 className="font-heading text-2xl font-bold mb-2" style={{ color: "#2a1f1a" }}>Confirm your refund</h1>
              <p style={{ color: "#5a4632" }}>
                We'll refund ${(purchase.amount_paid_cents / 100).toFixed(2)} to your card right now. Your book will lock back to preview so you can come back to it later if you change your mind.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep("intercept")} disabled={submitting}>Back</Button>
              <Button className="flex-1" onClick={submit} disabled={submitting}>
                {submitting ? "Processing…" : "Confirm refund"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
