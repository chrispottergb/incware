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
  return 'current'; // default
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

    // For entities in good standing / current status, determine annual report year
    // The WDFI detail page shows the actual AR year but is too slow to scrape.
    // The search results page shows status date which is when the status was last updated.
    // For "current" status entities, the annual report year is typically the current year
    // if we're past the filing deadline, otherwise the previous year.
    let annualReportYear: string | undefined;
    const mapped = mapWDFIStatus(rawStatus);
    if (mapped === 'current') {
      const now = new Date();
      const currentYear = now.getFullYear();
      // The WDFI detail page shows the last filed annual report year.
      // For entities in good standing, the most recent filed AR is for the previous year
      // (e.g., in 2026, the most recent AR would be for 2025).
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

    const searchUrl = `https://apps.dfi.wi.gov/apps/CorpSearch/Results.aspx?type=Simple&q=${encodeURIComponent(company_name)}`;
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
        JSON.stringify({ success: false, error: data.error || `Firecrawl request failed (${response.status})` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const markdown = data.data?.markdown || data.markdown || '';
    console.log('Scraped markdown length:', markdown.length);
    console.log('Markdown preview:', markdown.substring(0, 500));

    const results = parseResults(markdown);
    console.log('Parsed results:', JSON.stringify(results));

    if (results.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          results: [],
          message: 'No matching entities found on WDFI. The company may not be registered in Wisconsin.',
          rawMarkdown: markdown.substring(0, 2000),
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
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
