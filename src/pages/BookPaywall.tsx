import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Shield, Truck, BookOpen } from "lucide-react";
import { PRICING, formatUSD } from "@/lib/stripe";

const CREAM = "#F5F0E8";
const GOLD = "#BBA96A";
const SERIF = "'Lora', 'Georgia', 'Times New Roman', serif";

interface Pricing {
  book_cents: number;
  extra_copy_cents: number;
  shipping_first_cents: number;
  shipping_extra_cents: number;
}
const DEFAULT_PRICING: Pricing = {
  book_cents: PRICING.bookCents,
  extra_copy_cents: PRICING.extraCopyCents,
  shipping_first_cents: PRICING.shippingFirstCents,
  shipping_extra_cents: PRICING.shippingExtraCents,
};

export default function BookPaywall() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [extraCopies, setExtraCopies] = useState(0);
  const [pricing, setPricing] = useState<Pricing>(DEFAULT_PRICING);

  useEffect(() => {
    if (!bookId) return;
    (async () => {
      const [{ data: bookData }, { data: priceData }] = await Promise.all([
        supabase
          .from("books")
          .select("id, recipient_name, milestone_date")
          .eq("id", bookId)
          .maybeSingle(),
        supabase.from("app_settings").select("value").eq("key", "pricing").maybeSingle(),
      ]);
      setBook(bookData);
      if (priceData?.value) setPricing({ ...DEFAULT_PRICING, ...(priceData.value as any) });
      setLoading(false);
    })();
  }, [bookId]);

  if (loading) return <div className="min-h-screen" style={{ background: CREAM, fontFamily: SERIF }}><Navbar /><div className="p-8 text-center">Loading…</div></div>;

  if (!book) return <div className="p-8">Book not found</div>;

  if (!book.milestone_date) {
    return (
      <div className="min-h-screen" style={{ background: CREAM, fontFamily: SERIF }}>
        <Navbar />
        <div className="container mx-auto max-w-2xl px-4 py-10">
          <h1 className="font-heading text-3xl font-bold mb-3" style={{ color: "#2a1f1a" }}>Set a target date first</h1>
          <p className="mb-6" style={{ color: "#5a4632" }}>
            We use your target date to set your guarantee window. Add it in Book Settings, then come back.
          </p>
          <Button onClick={() => navigate(`/book/${bookId}/settings`)}>Open Book Settings</Button>
        </div>
      </div>
    );
  }

  const shippingCents = pricing.shipping_first_cents + extraCopies * pricing.shipping_extra_cents;
  const subtotal = pricing.book_cents + extraCopies * pricing.extra_copy_cents + shippingCents;

  return (
    <div className="min-h-screen" style={{ background: CREAM, fontFamily: SERIF }}>
      <Navbar />
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={() => navigate(`/book/${bookId}`)}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
        </Button>

        <p className="uppercase tracking-[0.3em] text-xs mb-2" style={{ color: GOLD }}>Unlock the full book</p>
        <h1 className="font-heading text-4xl font-bold mb-4" style={{ color: "#2a1f1a" }}>
          Build {book.recipient_name}'s gift for {formatUSD(pricing.book_cents)}
        </h1>
        <p className="text-lg leading-relaxed mb-8" style={{ color: "#5a4632" }}>
          You've read the first group and felt the shape of the book. Unlock the rest to personalize every chapter, add memories and photos, invite family, and ship a printed hardcover keepsake.
        </p>

        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <div className="bg-white/70 rounded-xl p-5 border" style={{ borderColor: "rgba(187,169,106,0.3)" }}>
            <BookOpen className="h-5 w-5 mb-2" style={{ color: GOLD }} />
            <h3 className="font-heading font-bold mb-1" style={{ color: "#2a1f1a" }}>What's included</h3>
            <ul className="text-sm space-y-1.5" style={{ color: "#5a4632" }}>
              <li className="flex gap-2"><Check className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: GOLD }} /> All 52 chapters, editable</li>
              <li className="flex gap-2"><Check className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: GOLD }} /> Memories &amp; photos from family</li>
              <li className="flex gap-2"><Check className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: GOLD }} /> Preview &amp; PDF export</li>
              <li className="flex gap-2"><Check className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: GOLD }} /> Printed hardcover in leatherette sleeve &amp; gift box</li>
              <li className="flex gap-2"><Check className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: GOLD }} /> Shipped USPS Ground Advantage, insured</li>
            </ul>
          </div>
          <div className="bg-white/70 rounded-xl p-5 border" style={{ borderColor: "rgba(187,169,106,0.3)" }}>
            <Shield className="h-5 w-5 mb-2" style={{ color: GOLD }} />
            <h3 className="font-heading font-bold mb-1" style={{ color: "#2a1f1a" }}>Money-back guarantee</h3>
            <p className="text-sm" style={{ color: "#5a4632" }}>
              Full refund available up to 90 days before your target date, or at least 30 days from purchase — whichever is longer.
            </p>
          </div>
        </div>

        <div className="bg-white/70 rounded-xl p-5 mb-6 border" style={{ borderColor: "rgba(187,169,106,0.3)" }}>
          <h3 className="font-heading font-bold mb-3 flex items-center gap-2" style={{ color: "#2a1f1a" }}>
            <Truck className="h-4 w-4" style={{ color: GOLD }} /> Extra copies (optional)
          </h3>
          <p className="text-sm mb-3" style={{ color: "#5a4632" }}>
            A great gift for grandparents or siblings. Extra copies are the printed book only (no sleeve or gift box) — {formatUSD(pricing.extra_copy_cents)} each, plus {formatUSD(pricing.shipping_extra_cents)} shipping per copy.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setExtraCopies(Math.max(0, extraCopies - 1))}>−</Button>
            <span className="font-semibold w-8 text-center">{extraCopies}</span>
            <Button variant="outline" size="sm" onClick={() => setExtraCopies(Math.min(10, extraCopies + 1))}>+</Button>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 mb-6 border-2" style={{ borderColor: GOLD }}>
          <div className="flex justify-between mb-1 text-sm" style={{ color: "#5a4632" }}>
            <span>Book unlock</span><span>{formatUSD(PRICING.bookCents)}</span>
          </div>
          {extraCopies > 0 && (
            <div className="flex justify-between mb-1 text-sm" style={{ color: "#5a4632" }}>
              <span>Extra copies × {extraCopies}</span><span>{formatUSD(PRICING.extraCopyCents * extraCopies)}</span>
            </div>
          )}
          <div className="flex justify-between mb-2 text-sm" style={{ color: "#5a4632" }}>
            <span>Shipping</span><span>{formatUSD(shippingCents)}</span>
          </div>
          <div className="flex justify-between font-heading text-xl font-bold pt-2 border-t" style={{ color: "#2a1f1a", borderColor: "rgba(187,169,106,0.3)" }}>
            <span>Subtotal</span><span>{formatUSD(subtotal)}</span>
          </div>
          <p className="text-xs mt-2" style={{ color: "#8a7560" }}>Tax calculated at checkout based on shipping address.</p>
        </div>

        <Button
          size="lg"
          className="w-full text-base"
          style={{ background: GOLD, color: "#fff" }}
          onClick={() => navigate(`/book/${bookId}/checkout?copies=${extraCopies}`)}
        >
          Continue to secure checkout
        </Button>
      </div>
    </div>
  );
}
