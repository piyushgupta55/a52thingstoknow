import { createClient } from "npm:@supabase/supabase-js@2";
import { createStripeClient, type StripeEnv } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ADMIN_EMAIL = "help@52thingstoknow.com";

async function notifyAdmin(purchase: any, reason: string, reasonText: string, book: any) {
  if (!RESEND_API_KEY) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "refunds@52thingstoknow.com",
        to: [ADMIN_EMAIL],
        subject: `Refund issued — ${book?.recipient_name || "unknown"}'s book`,
        html: `
          <h2>Refund issued</h2>
          <p><b>Book:</b> ${book?.recipient_name || "?"}</p>
          <p><b>User ID:</b> ${purchase.user_id}</p>
          <p><b>Amount:</b> $${(purchase.amount_paid_cents / 100).toFixed(2)}</p>
          <p><b>Reason:</b> ${reason}</p>
          <p><b>Details:</b> ${reasonText || "(none)"}</p>
          <p><b>Purchase ID:</b> ${purchase.id}</p>
        `,
      }),
    });
  } catch (e) {
    console.error("Failed to email admin:", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) throw new Error("Unauthorized");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) throw new Error("Unauthorized");
    const user = userData.user;

    const { purchaseId, reason, reasonText, environment } = await req.json();
    const env: StripeEnv = environment === "live" ? "live" : "sandbox";

    const { data: purchase } = await supabase
      .from("book_purchases")
      .select("*")
      .eq("id", purchaseId)
      .maybeSingle();
    if (!purchase || purchase.user_id !== user.id) throw new Error("Purchase not found");
    if (purchase.status !== "active") throw new Error("Purchase is not refundable");

    // Guarantee window check
    const deadline = new Date(purchase.guarantee_deadline + "T23:59:59Z");
    if (new Date() > deadline) throw new Error("Guarantee window has expired");
    if (!purchase.stripe_payment_intent_id) throw new Error("Missing payment reference");

    const stripe = createStripeClient(env);
    const refund = await stripe.refunds.create({
      payment_intent: purchase.stripe_payment_intent_id,
      reason: "requested_by_customer",
    });

    await supabase
      .from("book_purchases")
      .update({
        status: "refunded",
        refund_reason: reason || null,
        refund_reason_text: reasonText || null,
        refunded_at: new Date().toISOString(),
      })
      .eq("id", purchaseId);

    // Notify admin (fire-and-forget)
    const { data: book } = await supabase
      .from("books")
      .select("recipient_name")
      .eq("id", purchase.book_id)
      .maybeSingle();
    notifyAdmin(purchase, reason || "not_stated", reasonText || "", book);

    return new Response(JSON.stringify({ ok: true, refundId: refund.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("request-book-refund error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
