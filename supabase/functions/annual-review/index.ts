import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // GET: Load form data by token
    if (req.method === "GET" && action === "load") {
      const token = url.searchParams.get("token");
      if (!token) {
        return new Response(JSON.stringify({ error: "Token required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find the link
      const { data: link, error: linkError } = await supabase
        .from("annual_review_links")
        .select("*")
        .eq("token", token)
        .single();

      if (linkError || !link) {
        return new Response(JSON.stringify({ error: "Invalid or expired link" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check expiry
      if (new Date(link.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: "This review link has expired" }), {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if already submitted
      const { data: existingSub } = await supabase
        .from("annual_review_submissions")
        .select("id, status, submitted_at")
        .eq("link_id", link.id)
        .maybeSingle();

      if (existingSub?.status === "submitted" || existingSub?.status === "reviewed") {
        return new Response(JSON.stringify({ 
          error: "This review has already been submitted",
          already_submitted: true
        }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const companyId = link.company_id;

      // Fetch all company data in parallel
      const [
        companyRes, officersRes, directorsRes, shareholdersRes,
        banksRes, bankSignersRes, meetingCounselRes, meetingLoansRes,
        assetsRes, certificatesRes, latestMeetingForBenefitsRes
      ] = await Promise.all([
        supabase.from("companies").select("*").eq("id", companyId).single(),
        supabase.from("officers").select("*").eq("company_id", companyId).maybeSingle(),
        supabase.from("directors").select("*").eq("company_id", companyId).order("name"),
        supabase.from("shareholders").select("id, name, ownership_percentage, capital_account_balance, status, address, city, state, zip").eq("company_id", companyId).eq("is_treasury", false).order("name"),
        supabase.from("company_banks").select("*").eq("company_id", companyId),
        supabase.from("bank_authorized_signers").select("*").eq("company_id", companyId),
        // Get most recent meeting counsel for LOC info
        supabase.from("meetings").select("id").eq("company_id", companyId).order("meeting_date", { ascending: false }).limit(1),
        // Get loan data from most recent meeting
        supabase.from("meetings").select("id").eq("company_id", companyId).order("meeting_date", { ascending: false }).limit(1),
        supabase.from("company_assets").select("*").eq("company_id", companyId),
        supabase.from("stock_certificates").select("shareholder_id, num_shares, share_class, status").eq("company_id", companyId).eq("status", "active"),
        // Get latest meeting id for benefits
        supabase.from("meetings").select("id").eq("company_id", companyId).order("meeting_date", { ascending: false }).limit(1),
      ]);

      if (companyRes.error) {
        return new Response(JSON.stringify({ error: "Company not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get meeting counsel, loans & benefits from most recent meeting(s)
      let counselData = null;
      let loansData: any[] = [];
      let benefitsData: any[] = [];
      if (meetingCounselRes.data && meetingCounselRes.data.length > 0) {
        const latestMeetingId = meetingCounselRes.data[0].id;
        const [counselRes, loanRes] = await Promise.all([
          supabase.from("meeting_counsel").select("*").eq("meeting_id", latestMeetingId).maybeSingle(),
          supabase.from("meeting_loans").select("*").eq("meeting_id", latestMeetingId),
        ]);
        counselData = counselRes.data;
        loansData = loanRes.data || [];
      }

      // Find benefits from the most recent meeting that has them
      const { data: allMeetings } = await supabase
        .from("meetings")
        .select("id")
        .eq("company_id", companyId)
        .order("meeting_date", { ascending: false });

      if (allMeetings) {
        for (const mtg of allMeetings) {
          const { data: bens } = await supabase
            .from("meeting_benefits")
            .select("*")
            .eq("meeting_id", mtg.id);
          if (bens && bens.length > 0) {
            benefitsData = bens;
            break;
          }
        }
      }

      // Get share transactions for share counts
      const { data: transactions } = await supabase
        .from("share_transactions")
        .select("shareholder_id, num_shares, transaction_type, share_class")
        .eq("company_id", companyId);

      const company = companyRes.data;

      // Compute share counts per shareholder from active certificates
      const certsByHolder: Record<string, { total: number; byClass: Record<string, number> }> = {};
      for (const cert of (certificatesRes.data || [])) {
        if (!cert.shareholder_id) continue;
        if (!certsByHolder[cert.shareholder_id]) {
          certsByHolder[cert.shareholder_id] = { total: 0, byClass: {} };
        }
        certsByHolder[cert.shareholder_id].total += cert.num_shares || 0;
        const cls = cert.share_class || "Common";
        certsByHolder[cert.shareholder_id].byClass[cls] = (certsByHolder[cert.shareholder_id].byClass[cls] || 0) + (cert.num_shares || 0);
      }
      
      const snapshot = {
        company: {
          name: company.name,
          entity_type: company.entity_type,
          address: company.address,
          address_2: company.address_2,
          city: company.city,
          state: company.state,
          zip: company.zip,
        },
        shareholders: (shareholdersRes.data || []).map((s: any) => {
          const shares = certsByHolder[s.id];
          return {
            name: s.name,
            ownership_percentage: s.ownership_percentage,
            total_shares: shares?.total || 0,
            shares_by_class: shares?.byClass || {},
            address: s.address,
            city: s.city,
            state: s.state,
            zip: s.zip,
          };
        }),
        directors: (directorsRes.data || []).map((d: any) => ({
          name: d.name,
        })),
        officers: officersRes.data ? {
          president: officersRes.data.president,
          vice_president: officersRes.data.vice_president,
          secretary: officersRes.data.secretary,
          treasurer: officersRes.data.treasurer,
        } : null,
        registered_agent: {
          name: company.registered_agent_name,
          address: company.registered_agent_address,
          city: company.registered_agent_city,
          state: company.registered_agent_state,
          zip: company.registered_agent_zip,
        },
        banks: (banksRes.data || []).map((b: any) => ({
          bank_name: b.bank_name,
          account_type: b.account_type,
          account_number_last4: b.account_number ? b.account_number.slice(-4) : null,
        })),
        line_of_credit: counselData ? {
          bank: counselData.bank_name,
          loc_amount: counselData.loc_amount,
          loc_interest_rate: counselData.loc_interest_rate,
          agent_administrator: counselData.counsel_name,
          loc_enabled: counselData.loc_enabled,
        } : null,
        loans: loansData.map((l: any) => ({
          lender_name: l.lender_name,
          borrower_name: l.borrower_name,
          loan_amount: l.loan_amount,
          loan_rate: l.loan_rate,
          loan_direction: l.loan_direction,
          balance_to_shareholder: l.balance_to_shareholder,
          balance_from_shareholder: l.balance_from_shareholder,
        })),
        vehicles: (assetsRes.data || []).filter((a: any) => a.asset_type === "Vehicle").map((v: any) => ({
          description: v.description,
          year: v.year,
          make: v.make,
          model: v.model,
          vin: v.vin,
        })),
        leases: (assetsRes.data || []).filter((a: any) => 
          a.asset_type !== "Vehicle" && a.asset_type !== "Equipment" && (a.landlord_name || a.lease_start_date || a.lease_amount || a.monthly_payment)
        ).map((l: any) => ({
          description: l.description,
          landlord_name: l.landlord_name,
          landlord_address: l.landlord_address,
          address: l.address,
          address_2: l.address_2,
          lease_start_date: l.lease_start_date,
          lease_end_date: l.lease_end_date,
          monthly_payment: l.monthly_payment || l.lease_amount,
        })),
        benefits: benefitsData.map((b: any) => ({
          benefit_type: b.benefit_type,
          benefit_description: b.benefit_description,
          provider: b.provider,
          agent_administrator: b.agent_administrator,
          insurance_agency: b.insurance_agency,
          new_plan_effective_date: b.new_plan_effective_date,
          eligibility_comments: b.eligibility_comments,
        })),
        review_year: link.review_year,
      };

      return new Response(JSON.stringify({
        link_id: link.id,
        company_name: company.name,
        review_year: link.review_year,
        snapshot,
        existing_draft: existingSub ? {
          id: existingSub.id,
          change_flags: {},
          new_entries: {},
        } : null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST: Submit form data
    if (req.method === "POST" && action === "submit") {
      const body = await req.json();
      const { token, change_flags, new_entries } = body;

      if (!token) {
        return new Response(JSON.stringify({ error: "Token required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find the link
      const { data: link, error: linkError } = await supabase
        .from("annual_review_links")
        .select("*")
        .eq("token", token)
        .single();

      if (linkError || !link) {
        return new Response(JSON.stringify({ error: "Invalid link" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (new Date(link.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: "Link expired" }), {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check existing submission
      const { data: existingSub } = await supabase
        .from("annual_review_submissions")
        .select("id, status")
        .eq("link_id", link.id)
        .maybeSingle();

      if (existingSub?.status === "submitted" || existingSub?.status === "reviewed") {
        return new Response(JSON.stringify({ error: "Already submitted" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch snapshot for storage
      // (We re-fetch to ensure we have current data at submission time)
      const { data: company } = await supabase
        .from("companies")
        .select("name")
        .eq("id", link.company_id)
        .single();

      const submissionData = {
        link_id: link.id,
        company_id: link.company_id,
        status: "pending_review",
        pre_populated_snapshot: body.snapshot || {},
        change_flags: change_flags || {},
        new_entries: new_entries || {},
        submitted_at: new Date().toISOString(),
      };

      let result;
      if (existingSub) {
        // Update existing draft
        result = await supabase
          .from("annual_review_submissions")
          .update(submissionData)
          .eq("id", existingSub.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from("annual_review_submissions")
          .insert(submissionData)
          .select()
          .single();
      }

      if (result.error) {
        console.error("Submission error:", result.error);
        return new Response(JSON.stringify({ error: "Failed to save submission" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update link status
      await supabase
        .from("annual_review_links")
        .update({ status: "submitted", updated_at: new Date().toISOString() })
        .eq("id", link.id);

      // Send admin notification email via Resend
      try {
        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
        if (RESEND_API_KEY) {
          const companyName = company?.name || "Unknown Entity";
          const reviewYear = link.review_year;
          const submittedAt = new Date().toLocaleDateString("en-US", {
            year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
          });

          // Build sections filled summary
          const newEntriesSections: string[] = [];
          const ne = new_entries || {};
          if (ne.vehicle_purchases?.length) newEntriesSections.push(`Vehicles (${ne.vehicle_purchases.length})`);
          if (ne.equipment_purchases?.length) newEntriesSections.push(`Equipment (${ne.equipment_purchases.length})`);
          if (ne.new_loans?.length) newEntriesSections.push(`Loans (${ne.new_loans.length})`);
          if (ne.share_transactions?.length) newEntriesSections.push(`Share Transactions (${ne.share_transactions.length})`);
          if (ne.new_leases?.length) newEntriesSections.push(`Leases (${ne.new_leases.length})`);
          if (ne.new_benefits?.length) newEntriesSections.push(`Benefits (${ne.new_benefits.length})`);
          if (ne.investments?.length) newEntriesSections.push(`Investments (${ne.investments.length})`);
          if (ne.charitable_contributions?.length) newEntriesSections.push(`Charitable Contributions (${ne.charitable_contributions.length})`);
          if (ne.annual_meeting?.date || ne.annual_meeting?.has_resolutions) newEntriesSections.push("Annual Meeting Details");
          if (ne.excess_earnings?.has_excess) newEntriesSections.push("Excess Earnings");
          if (ne.other_notes) newEntriesSections.push("Other Notes");

          const sectionsSummary = newEntriesSections.length > 0
            ? newEntriesSections.join(", ")
            : "None";

          // Build flagged items summary
          const cf = change_flags || {};
          const flaggedItems = Object.entries(cf)
            .filter(([_, v]: [string, any]) => v?.flagged)
            .map(([key]: [string, any]) => {
              // Convert keys like "company_address" to readable labels
              return key.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
            });
          const flaggedSummary = flaggedItems.length > 0
            ? flaggedItems.join(", ")
            : "None";

          // Dashboard link to pending reviews
          const dashboardUrl = "https://incware.lovable.app/pending-reviews";

          const notificationHtml = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background-color:#1a1a2e;padding:28px 40px;text-align:center;">
              <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">EntityIQ</h1>
              <p style="margin:6px 0 0;font-size:12px;color:#8b8fa3;text-transform:uppercase;letter-spacing:1.5px;">Annual Review Submission</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px 20px;">
              <h2 style="margin:0 0 20px;font-size:20px;color:#1a1a2e;font-weight:600;">New Review Submitted</h2>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3c3c4a;">
                A client has submitted their annual review worksheet. Here's a summary:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
                <tr>
                  <td style="padding:10px 14px;background-color:#f8f9fa;border-radius:6px 6px 0 0;border-bottom:1px solid #eee;">
                    <strong style="color:#1a1a2e;font-size:13px;">Entity:</strong>
                    <span style="color:#3c3c4a;font-size:14px;margin-left:8px;">${companyName}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;background-color:#f8f9fa;border-bottom:1px solid #eee;">
                    <strong style="color:#1a1a2e;font-size:13px;">Review Year:</strong>
                    <span style="color:#3c3c4a;font-size:14px;margin-left:8px;">${reviewYear}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;background-color:#f8f9fa;border-bottom:1px solid #eee;">
                    <strong style="color:#1a1a2e;font-size:13px;">Submitted:</strong>
                    <span style="color:#3c3c4a;font-size:14px;margin-left:8px;">${submittedAt}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;background-color:#f8f9fa;border-bottom:1px solid #eee;">
                    <strong style="color:#1a1a2e;font-size:13px;">Sections Filled:</strong>
                    <span style="color:#3c3c4a;font-size:14px;margin-left:8px;">${sectionsSummary}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;background-color:#f8f9fa;border-radius:0 0 6px 6px;">
                    <strong style="color:#1a1a2e;font-size:13px;">Flagged for Changes:</strong>
                    <span style="color:#3c3c4a;font-size:14px;margin-left:8px;">${flaggedSummary}</span>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 20px;">
                    <a href="${dashboardUrl}" target="_blank"
                       style="display:inline-block;background-color:#2563eb;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:6px;letter-spacing:0.3px;">
                      View Submission in Dashboard
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px 32px;border-top:1px solid #eee;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;text-align:center;">
                This is an automated notification from EntityIQ.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "EntityIQ <noreply@entityiq.net>",
              to: ["mike@klecknerlaw.com"],
              subject: `Annual Review Submitted: ${companyName} (${reviewYear})`,
              html: notificationHtml,
            }),
          });
        }
      } catch (emailErr) {
        // Don't fail the submission if notification email fails
        console.error("Failed to send admin notification email:", emailErr);
      }

      return new Response(JSON.stringify({
        success: true,
        submission_id: result.data.id,
        company_name: company?.name,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Annual review error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
