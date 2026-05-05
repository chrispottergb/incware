// INTENTIONALLY PUBLIC: Accessed by external clients via secure, time-limited
// token (not a JWT). All data access scoped to the company linked to the token.
// Returns a read-only snapshot only — no submission/editing endpoint.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const last4 = (s: string | null | undefined) =>
  s ? s.replace(/\D/g, "").slice(-4) || null : null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "load";

    if (req.method !== "GET") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action !== "load") {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = url.searchParams.get("token");
    if (!token) {
      return new Response(JSON.stringify({ error: "Token required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Token lookup
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

    if (new Date(link.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "This review link has expired" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyId = link.company_id;

    // Audit log line — picked up by Supabase function logs
    console.log(JSON.stringify({
      event: "annual_review_load",
      token_id: link.id,
      company_id: companyId,
      ip: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
      user_agent: req.headers.get("user-agent"),
      ts: new Date().toISOString(),
    }));

    // Parallel fetch of all data needed for snapshot
    const [
      companyRes,
      accountantsRes,
      attorneysRes,
      banksRes,
      bankSignersRes,
      shareholdersRes,
      shareTxRes,
      directorsRes,
      assetsRes,
      latestMeetingsRes,
      aiSystemsRes,
      aiUsageRes,
    ] = await Promise.all([
      supabase.from("companies").select("*").eq("id", companyId).single(),
      supabase.from("accountants").select("*").eq("company_id", companyId).order("created_at"),
      supabase.from("attorneys").select("*").eq("company_id", companyId).order("created_at"),
      supabase.from("company_banks").select("*").eq("company_id", companyId).order("created_at"),
      supabase.from("bank_authorized_signers").select("*").eq("company_id", companyId).order("created_at"),
      supabase.from("shareholders").select("*").eq("company_id", companyId).order("name"),
      supabase.from("share_transactions").select("shareholder_id, num_shares, transaction_type, status, effective_date").eq("company_id", companyId),
      supabase.from("directors").select("*").eq("company_id", companyId).order("name"),
      supabase.from("company_assets").select("*").eq("company_id", companyId),
      supabase.from("meetings").select("id, meeting_date, meeting_location").eq("company_id", companyId).order("meeting_date", { ascending: false }).limit(5),
      supabase.from("ai_systems").select("id, status").eq("company_id", companyId),
      supabase.from("ai_usage_logs").select("id, usage_date").eq("company_id", companyId).gte("usage_date", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    if (companyRes.error || !companyRes.data) {
      return new Response(JSON.stringify({ error: "Company not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const company = companyRes.data;

    // Lookup firm details for accountant + attorney
    const accountant = accountantsRes.data?.[0] || null;
    const attorney = attorneysRes.data?.[0] || null;

    let accountantFirm: any = null;
    let attorneyFirm: any = null;
    if (accountant?.firm_id) {
      const { data } = await supabase.from("accountant_firms").select("*").eq("id", accountant.firm_id).maybeSingle();
      accountantFirm = data;
    }
    if (attorney?.firm_id) {
      const { data } = await supabase.from("attorney_firms").select("*").eq("id", attorney.firm_id).maybeSingle();
      attorneyFirm = data;
    }

    // Latest meeting + meeting-derived data (officers, benefits, loans, agreements, counsel)
    const latestMeetings = latestMeetingsRes.data || [];
    const latestMeetingId = latestMeetings[0]?.id || null;

    let officers: any[] = [];
    let benefits: any[] = [];
    let loans: any[] = [];
    let contributions: any[] = [];
    let counsel: any = null;

    if (latestMeetingId) {
      const [officersRes, benefitsRes, loansRes, agreementsRes, counselRes] = await Promise.all([
        supabase.from("meeting_officers").select("*").eq("meeting_id", latestMeetingId),
        supabase.from("meeting_benefits").select("*").eq("meeting_id", latestMeetingId),
        supabase.from("meeting_loans").select("*").eq("meeting_id", latestMeetingId),
        supabase.from("agreements").select("*").eq("meeting_id", latestMeetingId),
        supabase.from("meeting_counsel").select("*").eq("meeting_id", latestMeetingId).maybeSingle(),
      ]);
      officers = officersRes.data || [];
      benefits = benefitsRes.data || [];
      loans = loansRes.data || [];
      contributions = agreementsRes.data || [];
      counsel = counselRes.data || null;

      // If no benefits at latest meeting, walk back to find one that has them
      if (benefits.length === 0) {
        for (const m of latestMeetings.slice(1)) {
          const { data } = await supabase.from("meeting_benefits").select("*").eq("meeting_id", m.id);
          if (data && data.length > 0) { benefits = data; break; }
        }
      }

      // Same fallback for officers — latest meeting may not include officers
      if (officers.length === 0) {
        for (const m of latestMeetings.slice(1)) {
          const { data } = await supabase.from("meeting_officers").select("*").eq("meeting_id", m.id);
          if (data && data.length > 0) { officers = data; break; }
        }
      }
    }

    // Compute shares_held per shareholder from share_transactions
    const sharesByHolder: Record<string, number> = {};
    for (const tx of (shareTxRes.data || [])) {
      if (!tx.shareholder_id || tx.status === "corrected") continue;
      const t = tx.transaction_type;
      const isAdd = ["Issuance", "Capital Contribution", "Initial Contribution", "initial_issuance", "initial_contribution", "opening_balance"].includes(t);
      const isSub = ["Redemption", "Cancellation", "Return of Capital", "redemption"].includes(t);
      const n = Number(tx.num_shares) || 0;
      sharesByHolder[tx.shareholder_id] = (sharesByHolder[tx.shareholder_id] || 0) + (isAdd ? n : isSub ? -n : 0);
    }

    // Split assets: leases (all) vs vehicles/equipment
    const allAssets = assetsRes.data || [];
    const leaseAssets = allAssets.filter((a: any) => a.asset_type === "lease");
    const physicalAssets = allAssets.filter((a: any) => a.asset_type !== "lease" && a.asset_type !== "benefit");

    // AI usage frequency derivation
    const aiSystemsCount = (aiSystemsRes.data || []).filter((s: any) => s.status === "active").length;
    const recentAiUsage = (aiUsageRes.data || []).length;
    let aiFrequency = "no";
    if (aiSystemsCount > 0 && recentAiUsage >= 10) aiFrequency = "regularly";
    else if (aiSystemsCount > 0 && recentAiUsage > 0) aiFrequency = "occasionally";
    else if (aiSystemsCount > 0) aiFrequency = "not_aware";

    // Latest meeting "other notes" parse — meeting_other is a separate table
    let meetingNotes: string | null = null;
    if (latestMeetingId) {
      const { data: moRows } = await supabase
        .from("meeting_other")
        .select("notes")
        .eq("meeting_id", latestMeetingId);
      if (moRows && moRows.length > 0) {
        meetingNotes = moRows.map((r: any) => r.notes).filter(Boolean).join("\n\n") || null;
      }
    }

    const payload = {
      link_id: link.id,
      company_id: companyId,
      review_year: link.review_year,
      company_name: company.name,
      last_updated: company.updated_at,

      company: {
        name: company.name,
        entity_type: company.entity_type,
        address: company.address,
        address_2: company.address_2,
        city: company.city,
        state: company.state,
        zip: company.zip,
        phone: company.phone,
        incorporation_date: company.incorporation_date,
        ein_last4: last4(company.ein),
        fiscal_year_end: company.fiscal_year_end,
        s_election_date: company.s_election_date,
        contact_webpage: company.contact_webpage,
        status: company.status,
        corporate_status: company.corporate_status,
      },

      contacts: {
        contact_full_name: company.contact_full_name,
        salutation_name: company.salutation_name,
        contact_email: company.contact_email,
        contact_phone: company.contact_phone,
        contact_cell: company.contact_cell,
      },

      registeredAgent: {
        name: company.registered_agent_name,
        type: company.registered_agent_type,
        address: company.registered_agent_address,
        address_2: company.registered_agent_address_2,
        city: company.registered_agent_city,
        state: company.registered_agent_state,
        zip: company.registered_agent_zip,
        phone: company.registered_agent_phone,
        email: company.registered_agent_email,
        annual_filing_status: company.corporate_status,
        annual_filing_fee_year: company.annual_report_year,
      },

      accountant: accountant ? {
        accountant_name: accountant.accountant_name,
        firm_name: accountantFirm?.firm_name || null,
        address: accountantFirm?.address || null,
        city: accountantFirm?.city || null,
        state: accountantFirm?.state || null,
        zip: accountantFirm?.zip || null,
        phone: accountant.phone || accountantFirm?.phone || null,
        email: accountant.email || accountantFirm?.email || null,
      } : null,

      attorney: attorney ? {
        attorney_name: attorney.attorney_name,
        firm_name: attorneyFirm?.firm_name || null,
        address: attorneyFirm?.address || null,
        city: attorneyFirm?.city || null,
        state: attorneyFirm?.state || null,
        zip: attorneyFirm?.zip || null,
        phone: attorney.phone || attorneyFirm?.phone || null,
        email: attorney.email || attorneyFirm?.email || null,
      } : null,

      banking: {
        // Legacy single-bank alias (first bank). Prefer `banks` (array) below.
        bank: (banksRes.data && banksRes.data[0]) ? {
          bank_name: banksRes.data[0].bank_name,
          address: banksRes.data[0].address,
          city: banksRes.data[0].city,
          state: banksRes.data[0].state,
          zip: banksRes.data[0].zip,
          account_type: banksRes.data[0].account_type,
          account_number_last4: last4(banksRes.data[0].account_number),
          loc_amount: counsel?.loc_amount ?? null,
          loc_rate: counsel?.loc_interest_rate ?? null,
          loc_lender: counsel?.bank_name ?? banksRes.data[0].bank_name ?? null,
        } : null,
        banks: (banksRes.data || []).map((b: any, idx: number) => ({
          id: b.id,
          bank_name: b.bank_name,
          address: b.address,
          address_2: b.address_2,
          city: b.city,
          state: b.state,
          zip: b.zip,
          account_type: b.account_type,
          account_number_last4: last4(b.account_number),
          // LOC info is meeting-level; only attach to the first bank
          loc_amount: idx === 0 ? counsel?.loc_amount ?? null : null,
          loc_rate: idx === 0 ? counsel?.loc_interest_rate ?? null : null,
          loc_lender: idx === 0 ? (counsel?.bank_name ?? b.bank_name ?? null) : null,
        })),
        signers: (bankSignersRes.data || []).map((s: any) => ({
          signer_name: s.signer_name,
          title: s.title,
          bank_id: s.bank_id ?? null,
        })),
      },

      shareholders: (shareholdersRes.data || []).map((s: any) => ({
        name: s.name,
        address: s.address,
        city: s.city,
        state: s.state,
        zip: s.zip,
        shares_held: sharesByHolder[s.id] || 0,
        ownership_percentage: s.ownership_percentage,
        distribution_amount: s.capital_account_balance ?? null,
        can_bind_llc: !!s.is_authorized_binder,
      })),

      directors: (directorsRes.data || []).map((d: any) => ({ name: d.name })),

      officers: officers.map((o: any) => ({
        title: o.title,
        name: o.name,
        salary: o.salary,
        bonus: o.bonus,
        compensation_status: o.compensation_status ?? null,
        compensation_note: o.compensation_note ?? null,
      })),

      // Legacy single-lease alias (first lease). Prefer `leases` (array) below.
      lease: leaseAssets[0] ? {
        property_address: [leaseAssets[0].address, leaseAssets[0].address_2].filter(Boolean).join(", "),
        landlord_name: leaseAssets[0].landlord_name,
        landlord_address: leaseAssets[0].landlord_address,
        monthly_payment: leaseAssets[0].monthly_payment ?? leaseAssets[0].lease_amount,
        lease_start_date: leaseAssets[0].lease_start_date,
        lease_end_date: leaseAssets[0].lease_end_date,
        leasehold_improvements: leaseAssets[0].leasehold_improvement_description,
        leasehold_improvement_amount: leaseAssets[0].leasehold_improvement_amount,
      } : null,

      leases: leaseAssets.map((la: any) => ({
        property_address: [la.address, la.address_2].filter(Boolean).join(", "),
        landlord_name: la.landlord_name,
        landlord_address: la.landlord_address,
        monthly_payment: la.monthly_payment ?? la.lease_amount,
        lease_start_date: la.lease_start_date,
        lease_end_date: la.lease_end_date,
        lease_classification: la.lease_classification,
        leasehold_improvements: la.leasehold_improvement_description,
        leasehold_improvement_amount: la.leasehold_improvement_amount,
      })),

      benefits: benefits.map((b: any) => ({
        benefit_type: b.benefit_type,
        benefit_description: b.benefit_description,
        provider: b.provider,
        insurance_agency: b.insurance_agency,
        agent_administrator: b.agent_administrator,
        eligibility_comments: b.eligibility_comments,
        retirement_contribution: b.retirement_contribution,
      })),

      assets: physicalAssets.map((a: any) => ({
        asset_type: a.asset_type,
        year: a.year,
        make: a.make,
        model: a.model,
        vin: a.vin,
        description: a.description,
        purchase_date: a.purchase_date,
        purchase_amount: a.purchase_amount,
        ownership_type: a.ownership_type,
        manufacturer: a.manufacturer,
      })),

      loans: loans.map((l: any) => ({
        lender_name: l.lender_name,
        borrower_name: l.borrower_name,
        loan_amount: l.loan_amount,
        loan_rate: l.loan_rate,
        loan_direction: l.loan_direction,
      })),

      contributions: contributions.map((a: any) => ({
        agreement_type: a.agreement_type,
        agreement_with: a.agreement_with,
        amount: a.amount,
        agreement_date: a.agreement_date,
        agreement_purpose: a.agreement_purpose,
      })),

      meeting: latestMeetings[0] ? {
        meeting_date: latestMeetings[0].meeting_date,
        location: latestMeetings[0].meeting_location,
        attendees: null,
        notes: meetingNotes,
      } : null,

      ai: {
        systems_count: aiSystemsCount,
        recent_usage_count: recentAiUsage,
        frequency: aiFrequency,
      },
    };

    return new Response(JSON.stringify(payload), {
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
