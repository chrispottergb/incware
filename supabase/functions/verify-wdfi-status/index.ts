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
}

function mapWDFIStatus(rawStatus: string): string {
  const s = rawStatus.toLowerCase().trim();
  if (s.includes('organized') || s.includes('registered') || s.includes('incorporated')) return 'current';
  if (s.includes('delinquent')) return 'delinquent';
  if (s.includes('dissolved')) return 'dissolved';
  if (s.includes('revoked') || s.includes('suspended')) return 'suspended';
  return 'current'; // default
}

function parseResults(markdown: string): WDFIResult[] {
  const results: WDFIResult[] = [];

  // Try to parse table rows from markdown - WDFI returns results in a table format
  // Look for patterns like: | Entity Name | Entity ID | Type | Status |
  const lines = markdown.split('\n');

  for (const line of lines) {
    // Skip header/separator lines
    if (line.includes('---') || !line.includes('|')) continue;

    const cells = line.split('|').map(c => c.trim()).filter(c => c.length > 0);
    if (cells.length < 2) continue;

    // Try to identify entity name, ID, and status from cells
    // WDFI tables typically have: Entity Name, Entity ID, Entity Type, Status
    const entityName = cells[0];
    if (!entityName || entityName.toLowerCase() === 'entity name' || entityName.toLowerCase() === 'name') continue;

    const entityId = cells.length > 1 ? cells[1] : '';
    const type = cells.length > 2 ? cells[2] : '';
    const rawStatus = cells.length > 3 ? cells[3] : (cells.length > 2 ? cells[2] : '');

    // Skip if this looks like a header row
    if (entityId.toLowerCase() === 'entity id' || entityId.toLowerCase() === 'id') continue;

    results.push({
      entityName,
      entityId,
      type,
      status: rawStatus,
      mappedStatus: mapWDFIStatus(rawStatus),
    });
  }

  // Fallback: try to find status keywords in the text if no table rows found
  if (results.length === 0) {
    const statusPatterns = [
      { pattern: /(?:entity|company|corporation)[\s:]*(.+?)[\s]*(?:status|:)[\s]*(\w[\w\s.]*)/gi },
      { pattern: /status[\s:]+(\w[\w\s.]*)/gi },
    ];

    // Try to extract entity name and status from free-form text
    const nameMatch = markdown.match(/(?:entity name|corporation|company)[\s:]+([^\n|]+)/i);
    const statusMatch = markdown.match(/(?:status|standing)[\s:]+([^\n|]+)/i);
    const idMatch = markdown.match(/(?:entity id|id number|filing number)[\s:]+([A-Z0-9-]+)/i);

    if (statusMatch) {
      results.push({
        entityName: nameMatch ? nameMatch[1].trim() : 'Unknown',
        entityId: idMatch ? idMatch[1].trim() : '',
        status: statusMatch[1].trim(),
        mappedStatus: mapWDFIStatus(statusMatch[1].trim()),
      });
    }
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

    const searchUrl = `https://www.wdfi.org/apps/CorpSearch/Results.aspx?type=Simple&q=${encodeURIComponent(company_name)}`;
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
        waitFor: 3000, // WDFI may need time to load results
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
