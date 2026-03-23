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
