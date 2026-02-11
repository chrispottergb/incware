

# IncWare Web — Modern Corporate Records Management

A modern, polished web application rebuilding your mom's IncWare corporate records management system for the browser. Built with a sleek UI, multi-client support, and full document generation capabilities.

---

## Phase 1: Foundation & Authentication

### User Login & Multi-Client Access
- Secure login system with email/password authentication
- User roles (admin, staff) to control access
- Clean login page with modern styling

### Dashboard
- Overview of all client companies at a glance
- Quick-access cards showing each company's name, entity type, state, and next scheduled meeting
- Search and filter clients by name, state, or entity type
- "Add New Client" button prominently displayed

---

## Phase 2: Client / Company Management (Core)

### Client List & Search
- Searchable, sortable table of all corporate clients
- Quick filters by entity type (Corporation, LLC, S-Corp, etc.) and state

### Incorporation Info Tab
- Company name, entity type, state of incorporation
- Incorporation date, fiscal year end, authorized shares (with par value details)
- Registered agent name and address
- S-election date tracking
- Support for both Corporations and LLCs

### Organizational Info Tab
- Officers (President, VP, Secretary, Treasurer) with names
- Directors list with ability to add/remove
- Shareholders/Members overview
- Benefits, vehicles/equipment, leases, property tracking
- Current address and company contact details

---

## Phase 3: Meetings Module

### Meetings List
- View all meetings for a client organized by type (Annual, Organizational, Special Board Meetings)
- Each meeting shows date, location, and meeting type
- Quick navigation to meeting details

### Create / Edit Meeting
- Meeting type selection (Annual, Organizational, Special Meeting of Board of Directors) with conditional sub-type for special meetings
- Date, time, tax year, location fields
- Chairperson, meeting secretary, and others present
- Prior meeting date and next annual meeting date tracking
- Company name and address on the day of the meeting (historical accuracy)

### Financial Summary in Meetings
- Current year vs. previous year comparison panel
- Total Sales, Gross Profit, COG, COG Ratio, Net Income
- Visual bar charts for Annual Financial Comparison and COG Comparison (using Recharts)

### Meeting Sub-Sections (tabs within a meeting)
- **Shareholders/Members**: Add shareholders to meetings, view shares held
- **Directors**: Directors present at the meeting
- **Officers**: Officer elections and assignments
- **Counsel / Banking / Loans**: Track legal counsel, banking relationships, loans
- **Vehicles/Equipment / Leases / Property**: Asset tracking per meeting
- **Amendments**: Track corporate amendments
- **Resolutions**: Select from predefined resolution purposes or create custom resolutions with editable text
- **Benefits**: Employee benefit discussions
- **Other**: Miscellaneous meeting items

---

## Phase 4: Shareholders & Stock Ledger

### Shareholder Management
- Add/edit shareholders with name, home address, and contact info
- Track common shares, preferred shares held, and distributions
- Link shareholders to specific meetings

### Share Transactions
- Record share issuances, transfers, and retirements
- Transaction details: date, quantity, share type, transaction type, par value, payment
- Track certificate numbers (issued and surrendered)
- "Shares Transferred To" and "Shares Transferred From" fields
- Asset tracking per transaction (type, description, value)

### Stock Ledger View
- Complete ledger showing all share transactions per company
- Running totals of shares outstanding

---

## Phase 5: Timeline & Annual Review

### Corporate Timeline
- Auto-generated chronological timeline of all key events
- Incorporation date, meeting dates, S-election dates pulled automatically
- Manually add additional events (address changes, name changes, key decisions)
- Printable "Timeline of Events" document

### Annual Review Worksheet
- Pre-meeting review summary showing current corporate data on file
- Serves as a checklist/reminder letter for the upcoming annual meeting

---

## Phase 6: Document Generation (PDF)

### Meeting Minutes
- Generate formatted PDF meeting minutes from meeting data
- Preview before printing/downloading
- Includes all resolutions, officer elections, financial data

### Bylaws / Operating Agreements
- Generate bylaws for corporations
- Generate operating agreements for LLCs

### Articles of Dissolution
- Generate dissolution documents with vote tallies (for/against)

### Stock Certificates & Bills of Sale
- Print stock certificates from shareholder transaction data
- Generate bills of sale for share transfers

### Timeline Document
- Formatted printable timeline showing incorporation info, shareholders, directors, officers, and chronological events

---

## Phase 7: Additional Features

### Dissolution Tab
- Track dissolution type, date, authorized by, votes for/against
- Delayed dissolution date support
- Link to online articles of dissolution

### Web Links / Resources
- Configurable links to IRS forms, state forms, SIC codes, business formation resources
- Editable hyperlinks per client

### Responsive Design
- Works on desktop and tablet
- Modern card-based layout with smooth animations
- Dark/light mode support

---

## Technical Approach
- **Backend**: Lovable Cloud (Supabase) for database, authentication, and file storage
- **Frontend**: React + TypeScript with Tailwind CSS and shadcn/ui components
- **Charts**: Recharts for financial comparison visualizations
- **PDF Generation**: Client-side PDF generation for documents
- **Design**: Modern, polished UI with cards, clean typography, and subtle animations

