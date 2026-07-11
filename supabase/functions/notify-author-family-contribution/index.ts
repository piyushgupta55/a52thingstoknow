import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  book_id: string;
  contributor_name: string;
  entry_type?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { book_id, contributor_name, entry_type } = (await req.json()) as Body;
    if (!book_id || !contributor_name) {
      return new Response(JSON.stringify({ error: "book_id + contributor_name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: book } = await admin
      .from("books").select("id, recipient_name, user_id").eq("id", book_id).maybeSingle();
    if (!book) throw new Error("book not found");

    const { data: profile } = await admin
      .from("profiles").select("display_name, email").eq("user_id", book.user_id).maybeSingle();
    if (!profile?.email) {
      return new Response(JSON.stringify({ ok: true, skipped: "no author email" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const kind = entry_type === "wisdom" ? "some wisdom" : "a memory";
    const subject = `${contributor_name} shared ${kind} for ${book.recipient_name}'s book`;
    const html = `
<div style="font-family: Georgia, serif; color:#2d2a26; line-height:1.6; max-width:520px; margin:0 auto;">
  <p>Good news — <strong>${escapeHtml(contributor_name)}</strong> just shared ${kind} for <strong>${escapeHtml(book.recipient_name)}</strong>'s book.</p>
  <p>Sign in to review it and place it in a chapter when you're ready.</p>
</div>`.trim();

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: `52 Things <onboarding@resend.dev>`,
        to: [profile.email],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("notify send failed", res.status, body);
      return new Response(JSON.stringify({ error: "send_failed", status: res.status, details: body }), { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("notify-author error", err);
    return new Response(JSON.stringify({ error: err?.message || "unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c]);
}
