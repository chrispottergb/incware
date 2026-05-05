// AUTHENTICATED: Requires valid JWT - only authorized users can send review emails.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth check ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const {
      contactName,
      contactEmail,
      entityName,
      reviewYear,
      reviewUrl,
      expiresAt,
    } = await req.json();

    if (!contactEmail || !entityName || !reviewYear || !reviewUrl) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const salutation = contactName || "there";
    const expirationDate = new Date(expiresAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color:#1a1a2e;padding:28px 40px;text-align:center;">
              <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">EntityIQ</h1>
              <p style="margin:6px 0 0;font-size:12px;color:#8b8fa3;text-transform:uppercase;letter-spacing:1.5px;">Annual Review System</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 20px;">
              <h2 style="margin:0 0 20px;font-size:20px;color:#1a1a2e;font-weight:600;">Hi ${salutation},</h2>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3c3c4a;">
                Your <strong>${reviewYear} Annual Review Worksheet</strong> for <strong>${entityName}</strong> is ready for you to complete.
              </p>
              <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#3c3c4a;">
                Please take a few minutes to review the pre-populated information and provide any updates for the current year. This helps us keep your entity records accurate and up to date.
              </p>
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:0 0 28px;">
                    <a href="${reviewUrl}" target="_blank"
                       style="display:inline-block;background-color:#2563eb;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:6px;letter-spacing:0.3px;">
                      Complete Your Annual Review
                    </a>
                  </td>
                </tr>
              </table>
              <!-- Expiration Notice -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fef9e7;border-radius:6px;border:1px solid #f5e6a3;">
                <tr>
                  <td style="padding:14px 18px;">
                    <p style="margin:0;font-size:13px;color:#92680a;">
                      ⏳ <strong>This link expires on ${expirationDate}.</strong> Please complete your review before this date.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 32px;border-top:1px solid #eee;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;text-align:center;">
                This is an automated message from EntityIQ. If you have questions, please reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "EntityIQ <onboarding@resend.dev>",
        reply_to: "mike@klecknerlaw.com",
        to: [contactEmail],
        subject: `Action Required: ${reviewYear} Annual Review — ${entityName}`,
        html: htmlBody,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error("Resend API error:", result);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: result }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error sending reminder:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
