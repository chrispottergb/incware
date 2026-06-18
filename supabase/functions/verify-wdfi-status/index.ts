// AUTHENTICATED: Requires valid JWT - protects FIRECRAWL_API_KEY from abuse.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface WDFIResult {
  entityName: string;
  entityId: string;
  status: string;
  mappedStatus: string;
  type?: string;
  statusDate?: string;
  annualReportYear?: string;
}

function mapWDFIStatus(rawStatus: string): string {
  const s = rawStatus.toLowerCase().trim();
  if (s.includes('organized') || s.includes('registered') || s.includes('incorporated') || s.includes('good standing')) return 'current';
  if (s.includes('delinquent')) return 'delinquent';
  if (s.includes('admin') && s.includes('dissolved')) return 'admin_dissolved';
  if (s.includes('dissolved')) return 'admin_dissolved';
  if (s.includes('revoked') || s.includes('suspended')) return 'admin_dissolved';
  return 'current';
}

function parseResults(markdown: string): WDFIResult[] {
  const results: WDFIResult[] = [];
  const lines = markdown.split('\n');

  for (const line of lines) {
    if (!line.includes('|') || line.includes('---')) continue;

    const cells = line.split('|').map(c => c.trim()).filter(c => c.length > 0);
    if (cells.length < 4) continue;

    const idCell = cells[0];
    const nameCell = cells[1];
    const statusCell = cells[3];

    if (idCell.toLowerCase().includes('id') || idCell.toLowerCase().includes('corporate') || idCell.toLowerCase().includes('search')) continue;
    if (!idCell.match(/^[A-Z0-9]/)) continue;

    const nameMatch = nameCell.match(/\[([^\]]+)\]/);
    const entityName = nameMatch ? nameMatch[1] : nameCell;

    if (entityName.toLowerCase() === 'entity name' || entityName.toLowerCase() === 'name') continue;

    const linkMatch = nameCell.match(/entityID=([A-Z0-9]+)/);
    const entityId = linkMatch ? linkMatch[1] : idCell;

    const statusParts = statusCell.split(/<br>/i);
    const rawStatus = statusParts[0]?.replace(/\d{2}\/\d{2}\/\d{4}/, '').trim() || '';
    const statusDateMatch = statusCell.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    const statusDate = statusDateMatch ? `${statusDateMatch[3]}-${statusDateMatch[1]}-${statusDateMatch[2]}` : undefined;

    let annualReportYear: string | undefined;
    const mapped = mapWDFIStatus(rawStatus);
    if (mapped === 'current') {
      const now = new Date();
      const currentYear = now.getFullYear();
      annualReportYear = String(currentYear - 1);
    }

    results.push({
      entityName,
      entityId,
      type: cells[2]?.replace(/<br>/g, ' ').trim() || '',
      status: rawStatus,
      mappedStatus: mapped,
      statusDate,
      annualReportYear,
    });
  }

  return results;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth check ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { company_name } = await req.json();

    if (!company_name) {
      return new Response(
        JSON.stringify({ success: false, error: 'Company name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured. Please connect Firecrawl in project settings.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const searchUrl = `https://apps.dfi.wi.gov/apps/CorpSearch/Results.aspx?Type=Simple&Search=${encodeURIComponent(company_name)}`;
    console.log('Scraping WDFI:', searchUrl);

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: searchUrl,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 3000,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Firecrawl error:', data);
      return new Response(
        JSON.stringify({ success: false, error: 'Lookup service is temporarily unavailable. Please try again.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const markdown = data.data?.markdown || data.markdown || '';
    console.log('Scraped markdown length:', markdown.length);

    const results = parseResults(markdown);

    if (results.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          results: [],
          message: 'No matching entities found on WDFI. The company may not be registered in Wisconsin.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        verificationDate: new Date().toISOString().split('T')[0],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error verifying WDFI status:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'An internal error occurred. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
