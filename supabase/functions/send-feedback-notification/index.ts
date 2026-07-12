import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  feedback_id: string;
}

const SUPPORT_ADDRESS = "help@52thingstoknow.com";

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c]);
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

    const { feedback_id } = (await req.json()) as Body;
    if (!feedback_id) {
      return new Response(JSON.stringify({ error: "feedback_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: fb, error: fbErr } = await admin
      .from("feedback")
      .select("*")
      .eq("id", feedback_id)
      .maybeSingle();
    if (fbErr || !fb) throw new Error(fbErr?.message || "feedback not found");
    if (fb.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Signed URLs for all screenshots (7 days). Falls back to legacy single field.
    const paths: string[] =
      (Array.isArray(fb.screenshot_urls) && fb.screenshot_urls.length > 0)
        ? fb.screenshot_urls
        : (fb.screenshot_url ? [fb.screenshot_url] : []);

    const screenshotLinks: string[] = [];
    for (const p of paths) {
      const { data: signed } = await admin.storage
        .from("feedback-screenshots")
        .createSignedUrl(p, 60 * 60 * 24 * 7);
      if (signed?.signedUrl) screenshotLinks.push(signed.signedUrl);
    }

    const typeLabel: Record<string, string> = { bug: "Bug", question: "Question", suggestion: "Suggestion" };
    const subject = `[Feedback: ${typeLabel[fb.issue_type] || fb.issue_type}] from ${fb.user_name || fb.user_email || "tester"}`;

    const html = `
<div style="font-family: -apple-system, Segoe UI, Georgia, serif; color: #2d2a26; line-height: 1.6; max-width: 620px; margin: 0 auto;">
  <h2 style="margin:0 0 12px;">New feedback: ${escapeHtml(typeLabel[fb.issue_type] || fb.issue_type)}</h2>
  <table style="border-collapse:collapse; font-size:14px; margin-bottom:16px;">
    <tr><td style="padding:4px 12px 4px 0; color:#666;">From</td><td>${escapeHtml(fb.user_name || "—")} &lt;${escapeHtml(fb.user_email || "—")}&gt;</td></tr>
    <tr><td style="padding:4px 12px 4px 0; color:#666;">Page</td><td>${escapeHtml(fb.page_url || "—")}</td></tr>
    <tr><td style="padding:4px 12px 4px 0; color:#666;">Submitted</td><td>${escapeHtml(new Date(fb.created_at).toISOString())}</td></tr>
    <tr><td style="padding:4px 12px 4px 0; color:#666;">ID</td><td style="font-family:monospace; font-size:12px;">${escapeHtml(fb.id)}</td></tr>
  </table>
  <h3 style="margin:16px 0 4px;">Message</h3>
  <div style="white-space:pre-wrap; padding:12px; background:#f7f3ec; border-radius:8px; border:1px solid #e5ddc9;">${escapeHtml(fb.message)}</div>
  ${screenshotLink ? `<p style="margin-top:16px;"><a href="${screenshotLink}" style="color:#C9A84C;">View screenshot</a> (link valid 7 days)</p><p><img src="${screenshotLink}" alt="screenshot" style="max-width:100%; border:1px solid #ddd; border-radius:6px;"/></p>` : ""}
  <p style="font-size:12px; color:#999; margin-top:24px;">Reply directly to this email to respond to the tester.</p>
</div>`.trim();

    const text = `New feedback: ${typeLabel[fb.issue_type] || fb.issue_type}
From: ${fb.user_name || "—"} <${fb.user_email || "—"}>
Page: ${fb.page_url || "—"}
Submitted: ${new Date(fb.created_at).toISOString()}

Message:
${fb.message}
${screenshotLink ? `\nScreenshot: ${screenshotLink}` : ""}`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `52 Things Feedback <${SUPPORT_ADDRESS}>`,
        to: [SUPPORT_ADDRESS],
        subject,
        html,
        text,
        reply_to: fb.user_email || undefined,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error("Resend send failed", resendRes.status, errBody);
      return new Response(JSON.stringify({ error: "email_send_failed", status: resendRes.status, details: errBody }), { status: resendRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("send-feedback-notification error", err);
    return new Response(JSON.stringify({ error: err?.message || "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
