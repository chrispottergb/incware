// entityIQ Market Strategy data. Static, presentation-only. Safe to edit.

export type Effort = "Low" | "Medium" | "High";
export type Impact = "Low" | "Medium" | "High";

export const positioning = {
  oneLiner:
    "entityIQ is the statute-cited, audit-defensible corporate records system that turns a chaotic shoebox of LLC, Corp and Non-Profit paperwork into a clean, AI-assisted minute book — in one click.",
  pillars: [
    {
      title: "Statutorily grounded",
      body: "Every meeting, resolution, and ledger entry maps to a specific section of Wis. Stat. Ch. 180/181/183, giving attorneys an audit-defensible paper trail no template kit can match.",
    },
    {
      title: "Single source of truth",
      body: "share_transactions drives every ownership calculation; the system recalculates units, interest %, and capital accounts automatically — eliminating spreadsheet drift.",
    },
    {
      title: "AI-assisted but lawyer-owned",
      body: "AI drafts bylaws, operating agreements, resolutions, and 1023-EZ screening; the attorney always reviews and signs. Built for professionals, not chatbots.",
    },
    {
      title: "One-click record book",
      body: "Compile a court-ready PDF binder (Arial 11pt, 1.25\" binder margin, steel-blue headers) with cover, TOC, bylaws, minutes, ledger, certificates, and AI summary in seconds.",
    },
    {
      title: "Multi-entity, multi-tenant",
      body: "RBAC, encrypted SSN/EIN, signed-URL document delivery, 30-min idle timeout, 12-char password minimum, HIBP detection. Built for firms that manage 20–500 client entities.",
    },
  ],
};

export const market = {
  tam: {
    label: "Total Addressable Market (US)",
    value: "$4.2B / yr",
    detail:
      "~21M LLCs + ~6M Corps + ~1.5M Non-Profits requiring ongoing corporate records. Avg willingness-to-pay $150/yr blended across DIY + professional channels.",
  },
  sam: {
    label: "Serviceable Addressable Market",
    value: "$680M / yr",
    detail:
      "Entities actively maintained by a professional (attorney, CPA, registered agent) — ~3.4M entities × $200 avg annual records spend.",
  },
  som: {
    label: "Serviceable Obtainable Market (Year 3)",
    value: "$12–24M ARR",
    detail:
      "Capturing 1.5–3% of the professional segment via Wisconsin beachhead + Midwest expansion + CPA channel + registered-agent OEM.",
  },
  entityCounts: [
    { label: "Active US LLCs", value: "~21.0M", source: "IRS SOI + state SOS filings, 2023" },
    { label: "Active US C/S-Corps", value: "~6.0M", source: "IRS SOI Corporation Returns, 2023" },
    { label: "US Non-Profits (501(c))", value: "~1.5M", source: "IRS EO Master File, 2024" },
    { label: "US active attorneys", value: "1.33M", source: "ABA Profile of the Legal Profession, 2024" },
    { label: "Solo + small firms (1–10)", value: "~620K attorneys", source: "ABA, 2024 (~75% of private practice)" },
    { label: "CPA firms in US", value: "~46K firms", source: "AICPA + Census NAICS 541211" },
    { label: "Active CPAs", value: "~672K", source: "NASBA, 2023" },
    { label: "Registered-agent / CSC firms", value: "~3,500", source: "Industry trade estimates" },
  ],
};

export type Competitor = {
  name: string;
  positioning: string;
  buyer: string;
  pricing: string;
  strengths: string[];
  weaknesses: string[];
  threat: "Low" | "Medium" | "High";
};

export const competitors: Competitor[] = [
  {
    name: "CSC Entity Management",
    positioning: "Enterprise entity management bundled with CSC's registered-agent footprint.",
    buyer: "Fortune 1000 / mid-market GCs",
    pricing: "Custom enterprise (est. $25K–$250K+/yr)",
    strengths: ["Brand trust", "RA integration", "Global jurisdictions"],
    weaknesses: ["Out of reach for solo / small firms", "Slow UX", "No AI drafting", "No statute-cited minutes"],
    threat: "Low",
  },
  {
    name: "Diligent Entities (Blueprint OneWorld)",
    positioning: "Governance + entity management suite for enterprise legal ops.",
    buyer: "In-house legal departments, large firms",
    pricing: "Custom enterprise ($30K+ entry)",
    strengths: ["Compliance calendaring", "Org charts", "GRC ecosystem"],
    weaknesses: ["High implementation cost", "Overkill for SMB", "No AI bylaws", "No one-click record book"],
    threat: "Low",
  },
  {
    name: "Athennian",
    positioning: "Cloud entity & subsidiary management for law firms and corporate legal teams.",
    buyer: "AmLaw 200, mid-market in-house",
    pricing: "Custom (typical $1K–$3K/entity/yr)",
    strengths: ["Modern UI", "Workflow automation", "API"],
    weaknesses: ["Per-entity pricing punishes small firms", "Light on AI drafting", "No SMB self-serve"],
    threat: "Medium",
  },
  {
    name: "EntityKeeper",
    positioning: "Document + entity management for SMB and family offices.",
    buyer: "SMB, family offices, small firms",
    pricing: "~$80–$300/mo",
    strengths: ["Affordable", "Document storage", "Simple UI"],
    weaknesses: ["No statute-cited resolutions", "No stock ledger depth", "No AI drafting", "No PDF binder export"],
    threat: "Medium",
  },
  {
    name: "Harbor Compliance",
    positioning: "Annual report + RA + license filing service.",
    buyer: "Non-profits, growing SMB",
    pricing: "$99–$300+/mo",
    strengths: ["Filing-as-a-service", "Non-profit focus", "RA bundling"],
    weaknesses: ["Service-led, not software-led", "Weak records / minute book", "No share ledger"],
    threat: "Medium",
  },
  {
    name: "Carta / Pulley / Capbase",
    positioning: "Cap table software for VC-backed startups.",
    buyer: "Venture-backed Delaware C-Corps",
    pricing: "$0–$2,800+/yr",
    strengths: ["Best-in-class cap table", "409A valuations", "Stakeholder portal"],
    weaknesses: ["C-Corp only", "No LLC, no Non-Profit", "No minute book", "No statute-cited compliance"],
    threat: "Low (different market)",
  },
  {
    name: "Clerky / Stripe Atlas",
    positioning: "Startup formation + post-formation templates.",
    buyer: "First-time founders forming Delaware C-Corps",
    pricing: "$99–$500 one-time + add-ons",
    strengths: ["Brand love with founders", "Clean templates"],
    weaknesses: ["Formation-first; weak ongoing records", "No LLC depth", "No firm/CPA tooling"],
    threat: "Low",
  },
  {
    name: "MyCorporation / ZenBusiness / Northwest RA",
    positioning: "Online incorporator + registered-agent services.",
    buyer: "DIY SMB owners",
    pricing: "$0–$300/yr + add-ons",
    strengths: ["Top-of-funnel volume", "Brand SEO dominance"],
    weaknesses: ["Records is an upsell, not a product", "No statute citation", "Customer hand-holding required for actual minutes"],
    threat: "High (channel partner > competitor)",
  },
  {
    name: "FileForms / Mosey / Corpora",
    positioning: "Newer entrants in compliance filing and entity-data automation.",
    buyer: "Mid-market ops / finance teams",
    pricing: "Custom",
    strengths: ["Modern UX", "API-first"],
    weaknesses: ["Filing-centric, not records-centric", "No AI minutes", "No record book"],
    threat: "Medium",
  },
];

export const marketGap = {
  headline: "The Missing Middle: Statute-Cited Records for Solo & Small Firms",
  body: "Enterprise tools (CSC, Diligent, Athennian) cost $25K+ and are over-engineered. DIY incorporators (ZenBusiness, LegalZoom) treat ongoing records as an upsell. Cap-table tools (Carta) ignore LLCs and Non-Profits. No incumbent ships a statute-cited, AI-drafted, one-click record book priced for the solo attorney maintaining 20–100 client entities — that is entityIQ's wedge.",
};

export type Persona = {
  id: string;
  name: string;
  title: string;
  segment: string;
  size: string;
  pains: string[];
  jobs: string[];
  triggers: string[];
  objections: { objection: string; response: string }[];
  wtp: string;
  channels: string[];
};

export const personas: Persona[] = [
  {
    id: "sarah",
    name: "Sarah",
    title: "Solo corporate attorney",
    segment: "Solo attorneys / small law firms (1–5 attorneys)",
    size: "~280K attorneys in 1–5 firm practice",
    pains: [
      "Maintains 20–100 client entities in Word + paper binders",
      "Annual meeting season is a 6-week scramble of copy-paste",
      "Fears a malpractice claim from a missed resolution or statute miscite",
      "Clients ghost on annual minutes until something forces them (loan, sale, audit)",
    ],
    jobs: [
      "Produce defensible minutes that cite the controlling statute",
      "Track ownership changes accurately across years",
      "Hand the client a clean record book on demand (sale, loan, IRS)",
      "Bill the work without burning evenings on formatting",
    ],
    triggers: [
      "Annual meeting cycle (Jan–Apr)",
      "Client triggers a sale, loan, or audit and demands the minute book",
      "A peer mentions a malpractice claim tied to records",
      "Office Word-template kit breaks on the latest macOS",
    ],
    objections: [
      {
        objection: "I already have Word templates that work.",
        response:
          "Templates don't cite the statute, don't recompute ownership, and don't survive a partner change. entityIQ produces the same minutes in 1/10 the time and stands up to a court request.",
      },
      {
        objection: "My clients won't pay for software.",
        response:
          "You bill them — not the software. At $199/mo for 100 entities you make this back on a single billable hour saved per month.",
      },
      {
        objection: "Cloud storage of client data scares me.",
        response:
          "Encrypted SSN/EIN, RLS-isolated tenant data, 30-min idle timeout, signed URLs, optional on-prem PDF export. We were built for fiduciary-grade workflows.",
      },
    ],
    wtp: "$149–$299/mo per attorney seat (replaces 4–8 hrs/mo of associate/paralegal time)",
    channels: ["State bar CLEs", "ABA Business Law Section", "Lawyerist podcast", "Clio ecosystem", "LinkedIn Sales Nav (Title: Corporate Attorney + firm 1–10)"],
  },
  {
    id: "david",
    name: "David",
    title: "Corporate partner, 10–25 attorney firm",
    segment: "Small-to-mid law firm (corporate practice group)",
    size: "~8,500 firms in the 10–25 attorney band",
    pains: [
      "Junior associates re-invent minute formatting weekly",
      "Inconsistent record quality across associates exposes the firm",
      "Hard to onboard new associates to firm's compliance standard",
      "Clients churn to bigger firms with more polished deliverables",
    ],
    jobs: [
      "Standardize the firm's corporate records work product",
      "Train associates faster",
      "Win mid-market clients with deliverables that match AmLaw quality",
    ],
    triggers: [
      "Associate turnover",
      "Losing a client RFP on \"firm technology\"",
      "Compliance scare from a sister firm",
    ],
    objections: [
      {
        objection: "We already evaluated Athennian.",
        response:
          "Athennian is great if you're billing $250K+/yr to one client. For a 200-entity book of mid-market clients, our per-firm pricing is 60–80% less and ships with AI drafting they don't have.",
      },
      {
        objection: "Change management is the killer.",
        response:
          "We migrate your Word templates in week one and onboard associates in 90 minutes. Firms see records hours drop 50% in the first quarter.",
      },
    ],
    wtp: "$999–$2,499/mo firm-wide seat bundle",
    channels: ["ABA Business Law Section", "Legaltech News", "ALM events", "State bar corporate sections", "Direct outbound + partner-to-partner referral"],
  },
  {
    id: "linda",
    name: "Linda",
    title: "CPA practice owner",
    segment: "CPA firms (1–20 staff) offering entity compliance",
    size: "~32K firms in the 1–20 staff band",
    pains: [
      "Clients confuse the CPA with the attorney and ask for minutes",
      "Tax season forces last-minute corporate housekeeping (S-elections, owner draws, loans)",
      "No good tool to track shareholder loans, distributions, and capital accounts across the year",
    ],
    jobs: [
      "Add a high-margin compliance service without hiring an attorney",
      "Tighten S-Corp reasonable-comp and shareholder-loan documentation",
      "Differentiate from the cheap-tax-prep crowd",
    ],
    triggers: [
      "Loses a client to a firm that \"handles everything\"",
      "IRS notice about an undocumented owner loan",
      "Year-end planning conversation reveals missing minutes",
    ],
    objections: [
      {
        objection: "We don't practice law.",
        response:
          "You document the financial transactions you already record (loans, distributions, comp). entityIQ produces the supporting resolutions; the client signs. You bill it as a compliance bundle.",
      },
    ],
    wtp: "$199–$499/mo + per-client revenue share",
    channels: ["AICPA ENGAGE", "State CPA societies", "CPA Practice Advisor", "Karbon / Canopy ecosystems", "Tax planning communities"],
  },
  {
    id: "marcus",
    name: "Marcus",
    title: "Operations Director, registered-agent company",
    segment: "Registered agents / corporate service companies",
    size: "~3,500 firms",
    pains: [
      "Customers ask for ongoing records — they answer \"we just do filings\"",
      "Churn to all-in-one competitors",
      "Building software in-house is expensive and off-mission",
    ],
    jobs: [
      "Add a white-label records product to raise ARPU",
      "Reduce churn with stickier deliverables",
      "Compete with ZenBusiness/Northwest's expanding suite",
    ],
    triggers: [
      "Board demands a new revenue line",
      "Lost RFP on \"do you handle minutes?\"",
      "Major customer asks for a record book and they have to refer out",
    ],
    objections: [
      {
        objection: "We can't expose customer data to a third party.",
        response:
          "White-label deployment with tenant isolation, encrypted PII, signed URLs, and your branding on every PDF. We disappear behind your domain.",
      },
    ],
    wtp: "$2K–$10K/mo platform fee + per-entity revenue share",
    channels: ["NAERA (National Assoc. Enrolled Agents)", "Direct BD", "Industry trade events"],
  },
  {
    id: "alex",
    name: "Alex",
    title: "DIY founder with 1–3 entities",
    segment: "Small business owners self-managing records",
    size: "~6M SMB owners actively maintaining own entity",
    pains: [
      "Got a $300 LLC kit from LegalZoom 4 years ago, hasn't held a meeting since",
      "Banker just asked for the most recent annual minutes",
      "Confused which form a one-person LLC even needs",
    ],
    jobs: [
      "Look legitimate to bankers, investors, IRS",
      "Spend zero time on it after initial setup",
    ],
    triggers: [
      "Bank/loan/audit request",
      "Selling the business",
      "Adding a partner",
    ],
    objections: [
      {
        objection: "Does a single-member LLC even need this?",
        response:
          "Yes — courts pierce the veil of LLCs without records. Our SMLLC bundle gives you the 9-article operating agreement and an annual consent in 10 minutes, ever.",
      },
    ],
    wtp: "$29–$79/mo per entity (or $299–$599/yr)",
    channels: ["SEO (templates)", "Reddit r/smallbusiness", "Indie Hackers", "LegalZoom / Incfile partnerships"],
  },
];

export type Pricing = {
  tier: string;
  price: string;
  audience: string;
  entitlements: string[];
  highlight?: boolean;
};

export const pricing: Pricing[] = [
  {
    tier: "DIY",
    price: "$39/mo or $399/yr",
    audience: "Owner with 1–3 entities",
    entitlements: [
      "Up to 3 entities",
      "Meetings, minutes, ledger, record book",
      "AI bylaws & operating agreement (1 draft / entity / yr)",
      "Email support",
    ],
  },
  {
    tier: "Solo Pro",
    price: "$199/mo per seat",
    audience: "Solo attorneys / CPA practices, up to 100 client entities",
    entitlements: [
      "Up to 100 entities",
      "Unlimited AI drafting (bylaws, OA, resolutions, 1023-EZ screening)",
      "Statute-cited minute templates",
      "PDF binder export",
      "Annual review hosted-snapshot links",
      "Standard support",
    ],
    highlight: true,
  },
  {
    tier: "Practice",
    price: "$999/mo (5 seats)",
    audience: "10–25 attorney firms / CPA firms",
    entitlements: [
      "Up to 500 entities",
      "5 included seats (+$129/mo per add'l)",
      "RBAC, audit log, multi-tenant isolation",
      "Bulk migration from Word/Access",
      "Priority support + dedicated CSM",
    ],
  },
  {
    tier: "Firm / White-Label",
    price: "From $4K/mo (custom)",
    audience: "Registered agents, mid-market firms, CSCs",
    entitlements: [
      "Unlimited entities",
      "White-label branding & custom domain",
      "SSO / SAML",
      "API + webhooks",
      "SLA, security review, custom contract",
    ],
  },
];

export type Play = {
  id: string;
  name: string;
  thesis: string;
  effort: Effort;
  impact: Impact;
  payback: string;
  motions: string[];
  kpis: string[];
};

export const plays: Play[] = [
  {
    id: "A",
    name: "Wisconsin Attorney Beachhead",
    thesis:
      "Own the only statute-cited records product for Wis. Stat. Ch. 180/181/183. Land 50 WI solo/small firms, then port the citation engine state-by-state.",
    effort: "Medium",
    impact: "High",
    payback: "3–4 months",
    motions: [
      "Speak/sponsor at State Bar of Wisconsin Business Law Section + CLE events",
      "Direct outbound to WI corporate attorneys (Sales Nav list, ~3,200 targets)",
      "Free 'Wis. Stat. Compliance Audit' tool that scans uploaded records and produces a citation report — top-of-funnel lead magnet",
      "Case study: \"How a Madison solo cut annual-meeting season from 6 weeks to 9 days\"",
    ],
    kpis: ["50 paying WI firms in 6 months", "$10K MRR from WI by month 6", "NPS > 50"],
  },
  {
    id: "B",
    name: "CPA Channel Partnership",
    thesis:
      "Make every CPA a reseller. Bundle entityIQ with year-end S-Corp / owner-comp / loan-documentation workflows. CPA earns 20% recurring rev-share.",
    effort: "Medium",
    impact: "High",
    payback: "4–6 months",
    motions: [
      "Build CPA partner portal with co-branded client onboarding",
      "Pre-built S-Corp reasonable-compensation + shareholder-loan resolution templates",
      "Sponsor state CPA society fall conferences (WICPA, ILCPA, MNCPA)",
      "Karbon / Canopy / TaxDome integration listings",
    ],
    kpis: ["100 CPA partner signups in Y1", "30% of new revenue via partner channel by month 12", "Partner-sourced client LTV ≥ 24 mo"],
  },
  {
    id: "C",
    name: "Registered-Agent White-Label",
    thesis:
      "Sell the platform to mid-tier registered-agent companies that want to add records-as-a-service. Avoid competing with CSC/Northwest at the top.",
    effort: "High",
    impact: "High",
    payback: "9–12 months",
    motions: [
      "White-label theme system (logo, domain, color, PDF letterhead)",
      "SSO + tenant isolation hardening",
      "Direct BD to top-200 non-CSC RA firms (lead: NAERA member list)",
      "Revenue model: $4K–$10K platform fee + per-entity rev share",
    ],
    kpis: ["3 signed white-label partners in Y1", "$30K MRR via white-label by month 18"],
  },
  {
    id: "D",
    name: "SEO + Template-Led Growth",
    thesis:
      "Own long-tail compliance keywords with the best free templates on the internet (minutes, resolutions, operating agreements). Each template gates a 'Generate as PDF' CTA.",
    effort: "Low",
    impact: "Medium",
    payback: "6–9 months",
    motions: [
      "Publish 50 free templates (annual minutes, special meeting, S-Corp election consent, banking resolution, distribution resolution, etc.)",
      "Target keywords: 'operating agreement template' (4.4K/mo), 'annual meeting minutes template' (40/mo high-intent), 'llc record book' (70/mo), 'corporate compliance software' (480/mo)",
      "Each template page has a 'Generate this as a PDF on entityIQ — free' button (email gate)",
      "Programmatic SEO: per-state corporate records pages (50 pages)",
    ],
    kpis: ["20K organic sessions/mo by month 12", "5% template→signup conversion", "$0.50 CAC for self-serve DIY tier"],
  },
  {
    id: "E",
    name: "DIY SMB via Incorporator Partnerships",
    thesis:
      "Be the records upsell that ZenBusiness, Incfile, Northwest, and MyCorporation don't want to build. Offer a rev-share or fixed bounty per converted customer.",
    effort: "Medium",
    impact: "Medium",
    payback: "12+ months",
    motions: [
      "BD outreach to incorporator product teams",
      "API to ingest new formation → spin up entityIQ workspace",
      "Co-branded onboarding email sequence",
    ],
    kpis: ["1 incorporator partnership signed by month 9", "10K SMB activations in Y2"],
  },
];

export type Milestone = { week: number; track: string; task: string; owner: string };

export const ninetyDayPlan: Milestone[] = [
  { week: 1, track: "Foundation", task: "Lock pricing page + Solo Pro / Practice tier checkout", owner: "Founder" },
  { week: 1, track: "Foundation", task: "Ship public marketing site with statute-cited positioning", owner: "Founder" },
  { week: 2, track: "WI Beachhead", task: "Build target list: 3,200 WI corporate attorneys (Sales Nav)", owner: "Founder" },
  { week: 2, track: "SEO", task: "Publish first 10 free templates + per-state landing pages", owner: "Content" },
  { week: 3, track: "WI Beachhead", task: "Submit CLE speaker proposal — State Bar of WI Business Law Section", owner: "Founder" },
  { week: 3, track: "Product", task: "Ship free 'Compliance Audit' upload tool (lead magnet)", owner: "Eng" },
  { week: 4, track: "Outbound", task: "Launch 5-touch email sequence to first 500 WI attorneys", owner: "Founder" },
  { week: 5, track: "CPA Channel", task: "Recruit 5 design-partner CPA firms (WICPA roster)", owner: "Founder" },
  { week: 6, track: "Product", task: "Ship CPA partner portal MVP + S-Corp comp/loan templates", owner: "Eng" },
  { week: 7, track: "Content", task: "Publish first case study (WI attorney, named, on-record)", owner: "Content" },
  { week: 8, track: "Outbound", task: "Second outbound wave — next 1,500 WI attorneys", owner: "Founder" },
  { week: 9, track: "Partnerships", task: "Begin BD calls with 10 mid-tier registered-agent firms", owner: "Founder" },
  { week: 10, track: "Events", task: "Sponsor + speak at WICPA fall conference", owner: "Founder" },
  { week: 11, track: "Product", task: "Ship white-label MVP (logo, domain, PDF letterhead)", owner: "Eng" },
  { week: 12, track: "Review", task: "QBR: pipeline, MRR, CAC, payback. Double down on best play.", owner: "Founder" },
];

export const kpis = [
  { name: "North Star", value: "Active Entities Under Management", target: "5,000 by month 12" },
  { name: "MRR", value: "Monthly Recurring Revenue", target: "$50K by month 12" },
  { name: "CAC", value: "Blended customer acquisition cost", target: "< $400 for Solo Pro" },
  { name: "Payback", value: "Months to recover CAC", target: "< 4 months Solo Pro" },
  { name: "Logo Retention", value: "12-mo logo retention", target: "> 90%" },
  { name: "NPS", value: "Net Promoter Score", target: "> 50" },
  { name: "Activation", value: "Trial → first PDF generated", target: "> 60% within 7 days" },
];

export const risks = [
  {
    risk: "Statute citations only cover Wisconsin today",
    mitigation: "Build a 'citation engine' abstraction; license/contract a state-by-state statute mapping rollout (start: IL, MN, IA, MI in Q2).",
  },
  {
    risk: "Athennian or a CSC moves down-market",
    mitigation: "Move fast on pricing + AI features they can't match; lock in CPA channel that enterprise tools won't touch.",
  },
  {
    risk: "AI hallucinated minutes create malpractice exposure",
    mitigation: "Lawyer-in-the-loop signing required; AI output watermarked as 'draft'; insurance partnership in Y2.",
  },
  {
    risk: "Slow attorney adoption of new tooling",
    mitigation: "Free migration from Word/Access; bar-association CLE credit for onboarding; case-study-driven sales.",
  },
];

export const seoKeywords = [
  { keyword: "operating agreement template", volume: 4400, kdi: 35, intent: "Template / DIY" },
  { keyword: "entity management software", volume: 720, kdi: 21, intent: "Comparison / B2B" },
  { keyword: "corporate compliance software", volume: 480, kdi: 49, intent: "B2B" },
  { keyword: "cap table software", volume: 390, kdi: 19, intent: "B2B startup" },
  { keyword: "llc record book", volume: 70, kdi: 12, intent: "DIY high-intent" },
  { keyword: "annual meeting minutes template", volume: 40, kdi: 19, intent: "Template / DIY" },
  { keyword: "llc minute book", volume: 40, kdi: 11, intent: "DIY high-intent" },
  { keyword: "corporate minute book software", volume: 20, kdi: 0, intent: "B2B (own this)" },
  { keyword: "stock ledger software", volume: 20, kdi: 0, intent: "B2B (own this)" },
  { keyword: "registered agent software", volume: 20, kdi: 0, intent: "Partner / B2B" },
];
