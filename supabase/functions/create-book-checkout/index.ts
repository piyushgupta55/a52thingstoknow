import { createClient } from "npm:@supabase/supabase-js@2";
import { createStripeClient, PRICING as PRICING_DEFAULTS, type StripeEnv } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) throw new Error("Unauthorized");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) throw new Error("Unauthorized");
    const user = userData.user;

    const { bookId, extraCopies = 0, returnUrl, environment } = await req.json();
    if (!bookId) throw new Error("bookId required");
    const env: StripeEnv = environment === "live" ? "live" : "sandbox";
    const copies = Math.max(0, Math.min(10, Number(extraCopies) || 0));

    // Verify book belongs to user and load target date + recipient
    const { data: book } = await supabase
      .from("books")
      .select("id, user_id, recipient_name, milestone_date")
      .eq("id", bookId)
      .maybeSingle();
    if (!book || book.user_id !== user.id) throw new Error("Book not found");
    if (!book.milestone_date) throw new Error("Book target date is required before checkout");

    // Already unlocked? Short-circuit.
    const { data: existing } = await supabase
      .from("book_purchases")
      .select("id")
      .eq("book_id", bookId)
      .eq("status", "active")
      .maybeSingle();
    if (existing) throw new Error("Book already unlocked");

    const stripe = createStripeClient(env);

    // Read pricing from admin settings at checkout time (spec: prices must be changeable in admin
    // and take effect immediately). Fall back to seed defaults only if the row is missing.
    const { data: pricingRow } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "pricing")
      .maybeSingle();
    const p = (pricingRow?.value ?? {}) as Record<string, number>;
    const bookCents = Number.isFinite(p.book_cents) ? p.book_cents : PRICING_DEFAULTS.bookCents;
    const extraCopyCents = Number.isFinite(p.extra_copy_cents) ? p.extra_copy_cents : PRICING_DEFAULTS.extraCopyCents;

    // Resolve/create Stripe customer with userId metadata
    let customerId: string | undefined;
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${user.id}'`,
      limit: 1,
    });
    if (found.data.length) customerId = found.data[0].id;
    else {
      const created = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { userId: user.id },
      });
      customerId = created.id;
    }

    // Prices are shipping-inclusive — no separate shipping line item.
    const lineItems: any[] = [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${book.recipient_name}'s Gift — Printed Keepsake Book`,
            description: "Shipping included",
          },
          unit_amount: bookCents,
          tax_behavior: "exclusive",
        },
        quantity: 1,
      },
    ];
    if (copies > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: "Extra printed copy", description: "Shipping included" },
          unit_amount: extraCopyCents,
          tax_behavior: "exclusive",
        },
        quantity: copies,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      ui_mode: "embedded_page",
      customer: customerId,
      line_items: lineItems,
      return_url: returnUrl || `${req.headers.get("origin") || ""}/book/${bookId}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      shipping_address_collection: {
        allowed_countries: ["US"],
      },
      // automatic_tax disabled until Stripe head office address is set in dashboard settings
      payment_intent_data: {
        description: `Gift book unlock for ${book.recipient_name}`,
      },
      metadata: {
        userId: user.id,
        bookId,
        extraCopies: String(copies),
        targetDate: book.milestone_date,
      },
    });

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("create-book-checkout error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
