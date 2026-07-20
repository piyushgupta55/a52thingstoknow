import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyWebhook, computeGuaranteeDeadline, type StripeEnv } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function handleCheckoutCompleted(session: any, env: StripeEnv) {
  const md = session.metadata ?? {};
  const userId = md.userId;
  const bookId = md.bookId;
  if (!userId || !bookId) {
    console.error("Missing userId/bookId in session metadata", session.id);
    return;
  }
  // Skip if we already recorded this session
  const { data: existing } = await supabase
    .from("book_purchases")
    .select("id")
    .eq("stripe_session_id", session.id)
    .maybeSingle();
  if (existing) return;

  const targetDate = md.targetDate || null;
  const deadline = computeGuaranteeDeadline(targetDate, new Date());

  await supabase.from("book_purchases").insert({
    user_id: userId,
    book_id: bookId,
    stripe_session_id: session.id,
    stripe_payment_intent_id: session.payment_intent ?? null,
    stripe_customer_id: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
    amount_paid_cents: session.amount_total ?? 0,
    currency: session.currency ?? "usd",
    extra_copies: Number(md.extraCopies || 0),
    shipping_address: session.shipping_details ?? session.collected_information?.shipping_details ?? null,
    target_date: targetDate,
    guarantee_deadline: isoDate(deadline),
    status: "active",
    environment: env,
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const rawEnv = new URL(req.url).searchParams.get("env");
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    return new Response(JSON.stringify({ received: true, ignored: "invalid env" }), { status: 200 });
  }
  const env: StripeEnv = rawEnv;
  try {
    const event = await verifyWebhook(req, env);
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object, env);
        break;
      default:
        console.log("Unhandled event:", event.type);
    }
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});
