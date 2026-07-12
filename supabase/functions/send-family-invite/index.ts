import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  book_id: string;
  name: string;
  email: string;
  app_origin?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = (await req.json()) as Body;
    const { book_id, name, email, app_origin } = body;
    if (!book_id || !name?.trim() || !email?.trim()) {
      return new Response(JSON.stringify({ error: "book_id, name, email required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "invalid email" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load book + author (owner-scoped)
    const { data: book, error: bookErr } = await supabase
      .from("books")
      .select("id, recipient_name, user_id, occasion, from_label")
      .eq("id", book_id)
      .maybeSingle();
    if (bookErr || !book) throw new Error(bookErr?.message || "book not found");
    if (book.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: profile } = await admin
      .from("profiles").select("display_name, email").eq("user_id", book.user_id).maybeSingle();
    const authorName = profile?.display_name || book.from_label || "The Author";
    const replyTo = profile?.email || undefined;

    // Reuse or mint invite token
    const { data: existingInv } = await admin
      .from("memory_invites")
      .select("token").eq("book_id", book_id).is("revoked_at", null)
      .order("created_at", { ascending: false }).limit(1);
    let token: string;
    if (existingInv && existingInv.length > 0) {
      token = existingInv[0].token;
    } else {
      token = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "").slice(0, 32);
      const { error: invErr } = await admin.from("memory_invites").insert({
        book_id, token, created_by: user.id,
      });
      if (invErr) throw invErr;
    }

    const origin = app_origin || req.headers.get("origin") || "https://a52thingstoknow.lovable.app";
    const link = `${origin}/invite/${token}`;
    const recipient = book.recipient_name;
    const contributorFirst = name.trim().split(/\s+/)[0];
    const occasion = book.occasion?.trim() || null;

    const subject = `Will you share a memory or a bit of wisdom for ${recipient}?`;

    const html = `
<div style="font-family: Georgia, serif; color: #2d2a26; line-height: 1.6; max-width: 560px; margin: 0 auto;">
  <p>Hi ${escapeHtml(contributorFirst)},</p>
  <p>I'm putting together something special for ${escapeHtml(recipient)} — a keepsake book called <em>"52 Things to Know,"</em> filled with wisdom, memories, and love to carry into this next chapter of life.</p>
  <p>I would love for your voice to be a part of it.</p>
  <p>It's easy — and it can be short. You don't have to write much. Just click the link below and share either (or both):</p>
  <ul>
    <li><strong>A memory</strong> — a moment with ${escapeHtml(recipient)} you've never forgotten.</li>
    <li><strong>A bit of wisdom</strong> — some advice or a lesson you'd want ${escapeHtml(recipient)} to carry. It can even be something you've heard someone else say ("Grandpa always says...").</li>
  </ul>
  <p>Write a sentence or two, or write more if the words are flowing. I'll gather everything and shape it into the book, so anything you share is a gift.</p>
  <p style="text-align:center; margin: 32px 0;">
    <a href="${link}" style="background:#C9A84C; color:#fff; padding: 14px 28px; border-radius: 8px; text-decoration:none; font-weight: bold; display: inline-block;">Share a memory or wisdom for ${escapeHtml(recipient)}</a>
  </p>
  <p style="font-size: 12px; color: #888;">Or paste this link into your browser: <br/>${link}</p>
  <p>Thank you for being part of this. It means more than you know.</p>
  <p>With love,<br/>${escapeHtml(authorName)}</p>
</div>`.trim();

    const text = `Hi ${contributorFirst},

I'm putting together something special for ${recipient} — a keepsake book called "52 Things to Know," filled with wisdom, memories, and love to carry into this next chapter of life.

I would love for your voice to be a part of it.

It's easy — and it can be short. Just click the link below and share either (or both):
• A memory — a moment with ${recipient} you've never forgotten.
• A bit of wisdom — advice or a lesson you'd want ${recipient} to carry. It can even be something you've heard someone else say ("Grandpa always says...").

Write a sentence or two, or write more if the words are flowing.

Share here: ${link}

Thank you for being part of this. It means more than you know.

With love,
${authorName}`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${authorName} <memories@52thingstoknow.com>`,
        to: [email.trim()],
        subject,
        html,
        text,
        reply_to: replyTo,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error("Resend send failed", resendRes.status, errBody);
      return new Response(JSON.stringify({ error: "email_send_failed", status: resendRes.status, details: errBody }), { status: resendRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Upsert invitee
    const now = new Date().toISOString();
    const { data: existing } = await admin
      .from("memory_invitees")
      .select("id").eq("book_id", book_id).ilike("email", email.trim()).maybeSingle();

    if (existing) {
      await admin.from("memory_invitees")
        .update({ name: name.trim(), last_sent_at: now, invite_token: token })
        .eq("id", existing.id);
    } else {
      await admin.from("memory_invitees").insert({
        book_id, name: name.trim(), email: email.trim().toLowerCase(),
        invite_token: token, sent_at: now, last_sent_at: now,
      });
    }

    return new Response(JSON.stringify({ ok: true, link }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("send-family-invite error", err);
    return new Response(JSON.stringify({ error: err?.message || "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c]);
}
