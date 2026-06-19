# entityIQ Market Research & Go-to-Market Playbook

## Goal
Produce a deep, evidence-backed market research report and full GTM playbook for entityIQ — a web-based corporate records system (LLC/Corp/Non-Profit) with statutory compliance, meetings, stock ledger, PDF record book, annual review, business sales, multi-tenant RBAC. Cover four buyer segments (solo attorneys/small law firms, CPAs, registered agents/CSCs, DIY SMB owners), national US.

## Deliverables
1. **In-chat written summary** — executive findings + headline GTM plays.
2. **Downloadable PDF** at `/mnt/documents/entityIQ-GTM-Playbook.pdf` — full report.
3. **In-app Strategy page** at `/strategy` (admin-only, `demoguys1@yahoo.com`) inside entityIQ — interactive view of personas, segments, channels, 90-day plan.

## Research Phase (read-only, no code changes)
1. **Feature inventory** — sweep `src/components/`, `src/pages/`, `supabase/functions/` to build an authoritative feature list (meetings, stock ledger, share transactions, PDF record book, AI bylaws, WDFI verification, annual review, business sales, banking authority, loans, leases, IRS forms, RBAC, encryption).
2. **Competitive scan** (Firecrawl + web search): CSC Entity Management, Diligent Entities (formerly Blueprint OneWorld), Athennian, EntityKeeper, Harbor Compliance, MyCorporation, ZenBusiness, Northwest Registered Agent, LegalZoom, Carta (cap table only), Pulley, Clerky, Stripe Atlas. Capture: positioning, pricing, target buyer, feature gaps, weaknesses.
3. **SEO/demand signals** (Semrush): keyword research for "corporate minute book software", "entity management software", "stock ledger software", "annual meeting minutes template", "operating agreement software", "registered agent software", LLC/Corp compliance terms. Pull domain analysis on top 3 competitors, competitive gap analysis.
4. **TAM/SAM/SOM** — US entity counts (33M+ small businesses, ~21M LLCs, ~6M corps, ~1.5M non-profits), attorney/CPA counts, addressable spend per segment.
5. **Pricing intel** — competitor price points to anchor entityIQ tiers.

## Output: Report Structure
1. Executive Summary
2. Product Positioning — what entityIQ uniquely is (statute-cited, audit-defensible, AI-assisted, multi-entity, full record book in one click)
3. Market Sizing — TAM/SAM/SOM by segment with sources
4. Competitive Landscape — feature matrix + positioning map + pricing table
5. ICP & Personas (4) — solo attorney "Sarah", small-firm partner "David", CPA practice owner "Linda", registered-agent ops lead "Marcus", DIY founder "Alex". Each with pains, jobs-to-be-done, buying triggers, objections, willingness-to-pay, channels.
6. Positioning & Messaging Framework — one master narrative + per-persona value props, proof points, objection handlers
7. Pricing & Packaging — proposed tiers (Solo / Practice / Firm / White-Label) with price points and entitlements
8. Go-to-Market Strategies (5 plays, ranked by ROI/speed):
   - **Play A:** Wisconsin attorney beachhead → expand state-by-state (statute citation moat)
   - **Play B:** CPA channel partnerships (referral + revenue share, bundled with annual filings)
   - **Play C:** Registered-agent white-label/OEM
   - **Play D:** SEO + template-led growth (free minute/resolution templates → upsell)
   - **Play E:** DIY SMB self-serve via LegalZoom/incorporator partnerships
9. Channel Plan — SEO (target keyword list with KDI/volume), content, paid (Google Ads keyword set), outbound (state bar + state CPA society lists), partnerships, communities (r/smallbusiness, attorney listservs), events (state bar CLE, AICPA).
10. Outbound Sequences — 5-touch email + LinkedIn sequences per ICP
11. Partnership Targets — named list (CSC, Wolters Kluwer, state bar associations, AICPA, state CPA societies, incorporators)
12. 90-Day Launch Plan — week-by-week milestones, owner, KPIs (signups, demos, paid conversions, CAC, payback)
13. KPI Dashboard Spec — north-star + funnel metrics
14. Risks & Mitigations
15. Appendix — full SEO keyword table, competitor deep-dives, sources

## In-App Strategy Page (Technical)
- New route `/strategy` registered in `src/App.tsx`, wrapped in `ProtectedRoute` + admin check (`useUserRole`).
- New page `src/pages/Strategy.tsx` with sidebar nav: Overview / Market / Competitors / Personas / Pricing / GTM Plays / 90-Day Plan / KPIs.
- Reusable cards: persona cards, competitor matrix table, pricing tier cards, play cards with effort/impact badges, Gantt-style 90-day timeline.
- Data lives in `src/data/strategy/` as typed TS modules (no DB writes) so the page is purely presentational and edit-safe.
- Link added to admin sidebar (`AppLayout.tsx`) under a new "Strategy" section, admin-only via `useUserRole`.
- Styling matches existing entityIQ tokens (steel-blue accents, Arial/system stack, `bg-background/95`, no mobile breakpoints — desktop-only per project rules).
- "Download PDF" button on the page links to the generated `/mnt/documents/entityIQ-GTM-Playbook.pdf` (served via Supabase Storage `generated-documents` bucket, signed URL, mirroring the existing record-book pattern).

## PDF Generation
- Built with the docx skill or jsPDF (consistent with existing `lib/*-pdf.ts` patterns), Arial 11pt, 1.15 line-height, steel-blue (#D6E4F0) section headers, 1" margins — matches project PDF standard.
- Includes charts: positioning map (2x2), competitive matrix table, TAM/SAM/SOM funnel, 90-day Gantt. Charts rendered as embedded images.
- Verified page-by-page (image conversion + visual QA) before delivery.

## Order of Execution
1. Feature inventory sweep (parallel file reads).
2. Spawn parallel research subagents: (a) competitor scan, (b) SEO/keyword research, (c) TAM/persona research.
3. Synthesize findings into structured TS data modules.
4. Build `/strategy` page + sidebar link.
5. Generate PDF, QA every page, save to `/mnt/documents/`.
6. Post in-chat executive summary with `<presentation-artifact>` tag + link to `/strategy`.

## Out of Scope
- No changes to existing meeting, stock ledger, or compliance code.
- No new database tables — strategy content is static TS.
- No public marketing site changes (the `/strategy` page is internal/admin only).
