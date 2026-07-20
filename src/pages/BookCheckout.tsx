import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const CREAM = "#F5F0E8";
const SERIF = "'Lora', 'Georgia', 'Times New Roman', serif";

export default function BookCheckout() {
  const { bookId } = useParams<{ bookId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const copies = Number(params.get("copies") || 0);
  const [error, setError] = useState<string | null>(null);

  const fetchClientSecret = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("create-book-checkout", {
      body: {
        bookId,
        extraCopies: copies,
        environment: getStripeEnvironment(),
        returnUrl: `${window.location.origin}/book/${bookId}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      },
    });
    if (error || !data?.clientSecret) {
      throw new Error(data?.error || error?.message || "Could not start checkout");
    }
    return data.clientSecret as string;
  }, [bookId, copies]);

  const [key] = useState(() => Math.random().toString(36));

  useEffect(() => {
    // trigger fetch once to catch errors early
    fetchClientSecret().catch((e) => setError(e.message));
  }, [fetchClientSecret]);

  return (
    <div className="min-h-screen" style={{ background: CREAM, fontFamily: SERIF }}>
      <PaymentTestModeBanner />
      <Navbar />
      <div className="container mx-auto max-w-3xl px-4 py-6">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={() => navigate(`/book/${bookId}/unlock`)}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
        </Button>
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
            <p className="font-semibold mb-1">Couldn't start checkout</p>
            <p className="text-sm">{error}</p>
          </div>
        ) : (
          <div id="checkout">
            <EmbeddedCheckoutProvider key={key} stripe={getStripe()} options={{ fetchClientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        )}
      </div>
    </div>
  );
}
