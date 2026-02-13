

# EU AI Act Compliance -- AI Usage Documentation System

## Background: EU AI Act Requirements

The EU AI Act (Regulation 2024/1689), entering full force August 2, 2026, requires companies that deploy AI systems to maintain detailed documentation. Key obligations from Article 26 (Deployer Obligations) include:

- **Human Oversight** (Art. 26.2): Assign oversight to persons with necessary competence, training, and authority
- **Record-Keeping** (Art. 26.6): Keep automatically generated logs for at least 6 months
- **Monitoring** (Art. 26.5): Monitor AI system operation and report risks
- **Transparency** (Art. 26.11): Inform affected persons they are subject to AI use
- **Technical Documentation** (Art. 11, Annex IV): Maintain documentation of AI system purpose, capabilities, and limitations
- **Risk Management** (Art. 9): Establish and maintain a risk management system

## What We Will Build

A new **"AI Compliance"** tab on the Company Detail page and supporting database infrastructure to track and document all AI usage within each company's operations.

---

## Step 1: Database Tables

### Table: `ai_systems`
Registers each AI system used by a company.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | |
| company_id | uuid (FK -> companies) | |
| system_name | text | Name of the AI system (e.g., "ChatGPT", "EntityIQ Assistant") |
| provider | text | AI provider/vendor |
| risk_level | text | "minimal", "limited", "high", "unacceptable" |
| purpose | text | Intended purpose and use case |
| deployment_date | date | When the system was put into service |
| status | text | "active", "suspended", "decommissioned" |
| instructions_for_use | text | Provider's instructions summary |
| data_categories | text | Types of data processed |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### Table: `ai_oversight_persons`
Tracks the responsible human(s) assigned to oversee each AI system (Art. 26.2).

| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | |
| ai_system_id | uuid (FK -> ai_systems) | |
| person_name | text | Full name |
| title | text | Job title |
| competence_description | text | Relevant training/qualifications |
| authority_scope | text | What authority they have to intervene |
| assigned_date | date | |
| status | text | "active", "inactive" |
| created_at | timestamptz | |

### Table: `ai_usage_logs`
Documents each use of AI in company operations (Art. 26.6 -- 6-month minimum retention).

| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | |
| ai_system_id | uuid (FK -> ai_systems) | |
| company_id | uuid (FK -> companies) | |
| usage_date | timestamptz | When AI was used |
| usage_type | text | Category: "decision-support", "content-generation", "data-analysis", etc. |
| description | text | What the AI was used for |
| input_summary | text | Summary of input data (not raw data) |
| output_summary | text | Summary of AI output |
| human_reviewer | text | Person who reviewed the output |
| review_decision | text | "approved", "modified", "rejected" |
| review_notes | text | Notes on modifications or rejection reasons |
| affected_persons_notified | boolean | Were affected individuals informed? (Art. 26.11) |
| created_at | timestamptz | |

### Table: `ai_risk_incidents`
Tracks risk events and incidents (Art. 26.5).

| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | |
| ai_system_id | uuid (FK -> ai_systems) | |
| company_id | uuid (FK -> companies) | |
| incident_date | date | |
| severity | text | "low", "medium", "high", "serious" |
| description | text | What happened |
| actions_taken | text | Corrective actions |
| provider_notified | boolean | Was the AI provider informed? |
| authority_notified | boolean | Was the market surveillance authority informed? |
| reported_by | text | Person who reported |
| resolution_date | date | |
| status | text | "open", "investigating", "resolved" |
| created_at | timestamptz | |

All tables will have RLS policies scoped to the company owner (same pattern as existing tables).

---

## Step 2: Storage Bucket

Create a **`ai-compliance-docs`** storage bucket with folders for:
- `/company-{id}/technical-docs/` -- Technical documentation, instructions for use
- `/company-{id}/risk-assessments/` -- Risk assessment reports
- `/company-{id}/dpia/` -- Data Protection Impact Assessments (Art. 26.9)
- `/company-{id}/incident-reports/` -- Formal incident report documents

The bucket will have RLS policies so users can only access documents for their own companies.

---

## Step 3: Frontend -- AI Compliance Tab

Add a new **"AI Compliance"** tab to the Company Detail page with sub-sections:

### 3a. AI Systems Registry
- Table listing all registered AI systems with risk level badges
- Add/Edit dialog to register new AI systems
- Status indicators (active/suspended/decommissioned)

### 3b. Human Oversight Assignments
- For each AI system, show the assigned oversight person(s)
- Name, title, competence summary, authority scope
- Clearly highlights the **liable responsible human** per system

### 3c. Usage Log
- Chronological log of all AI usage events
- Filterable by system, date range, usage type
- Add entry form: what AI was used for, who reviewed output, decision made
- Indicator for whether affected persons were notified

### 3d. Risk & Incidents
- List of reported incidents with severity badges
- Track whether provider and authorities were notified
- Resolution tracking

### 3e. Document Upload
- Upload technical documentation, risk assessments, DPIAs
- Files stored in the `ai-compliance-docs` bucket
- Download/preview uploaded documents

---

## Step 4: File Structure

New files to create:
- `src/components/company/AIComplianceTab.tsx` -- Main tab container with sub-tabs
- `src/components/company/ai-compliance/AISystemsRegistry.tsx`
- `src/components/company/ai-compliance/AIOversightPersons.tsx`
- `src/components/company/ai-compliance/AIUsageLog.tsx`
- `src/components/company/ai-compliance/AIRiskIncidents.tsx`
- `src/components/company/ai-compliance/AIComplianceDocs.tsx`

Modified files:
- `src/pages/CompanyDetail.tsx` -- Add the AI Compliance tab

---

## Technical Details

- 4 new database tables with RLS policies matching the existing pattern (company owner scoped)
- 1 new storage bucket with RLS policies for authenticated users on their own company files
- Migration SQL for all tables, foreign keys, RLS policies, and updated_at triggers
- All frontend components follow existing patterns (shadcn/ui, Tanstack Query, Supabase client)

