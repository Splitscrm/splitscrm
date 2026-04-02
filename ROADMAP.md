# Splits CRM — Product Roadmap

## ✅ Completed — MVP

- Lead pipeline (10-stage, full lifecycle management)
- Deal management (collapsible groups, 50+ fields, pricing/fees/compliance/banking)
- Merchant management (collapsible groups, chargeback alerts, multi-MID, residual history)
- Partner management (sponsor banks, hardware, software, underwriting, pricing, merchants tab)
- AI-powered pricing schedule extraction from PDF
- AI-powered residual import with column mapping
- Merchant matching (auto + manual) with MID population
- Pending → Active merchant status via residual confirmation
- Data-driven dashboard (KPIs, pipeline, top merchants, revenue, agent breakdown, tasks)
- Communication system (call logging, email templates with merge tags, notes)
- Task & follow-up system with browser notifications
- Settings (profile, notifications, security, email templates)
- Search & filtering on all list pages
- Activity logging across all actions
- Lead-to-merchant conversion with full deal data flow
- Onboarding wizard + dashboard checklist
- Professional design system (emerald + slate) with custom Splits logo
- Landing page at splitscrm.com
- Google OAuth sign-in

---

## Build Queue — Prioritized

Items are grouped by dependency. Groups at the top can be built now. Lower groups depend on items above them being completed first.

---

### 🔓 No Dependencies — Can Build Anytime

These items don't depend on anything else and can be built in any order:

**Mobile Responsiveness**
- Responsive sidebar (collapsible on mobile)
- All pages optimized for phone/tablet viewing
- Touch-friendly inputs and buttons
- Mobile-first dashboard layout

**Export to CSV**
- Export leads list, merchants list, partners list
- Export residual import data
- Export filtered/searched results
- Date range filtering on exports

**Reporting Page**
- Dedicated /dashboard/reports page
- Partner profitability reports (revenue by partner, merchant count, average residual)
- Portfolio analytics (total revenue trending, merchant attrition, revenue concentration risk)
- Chart visualizations (line charts for trends, bar charts for comparisons)
- Date range picker and filter controls
- Pre-built report templates (Partner P&L, Portfolio Health)

**Residual Import Enhancements**
- Month-over-month residual trending charts
- Anomaly detection (volume drops, merchant churn alerts)
- Revenue by processor breakdown charts
- Residual comparison (this month vs last month per merchant)

**Email & SMS Notifications**
- Email reminders for upcoming/overdue tasks
- Daily digest email (morning summary)
- Weekly portfolio summary email
- Stage change email notifications
- Chargeback alert emails
- Implementation: Supabase Edge Functions + Resend or SendGrid
- Future: SMS via Twilio for urgent tasks

**Exportable Reports**
- PDF report generation for partner reviews
- CSV export of any report data
- Scheduled email reports (weekly/monthly)
- Custom date range filtering

---

### 🔗 Group A — Agent Foundation

These must be built together as they form the core agent system:

**Sub-Agent Management**
- Agent profiles (name, email, phone, role, status, tax status)
- Agent hierarchy: Owner → Manager → Master Agent → Agent → Sub-Agent → Referral Partner
- Parent agent relationship (defines the hierarchy tree)
- Split agreement per agent (profit split, revenue share, BPS override, buy rate)
- Override percentage for master agents (% of downline earnings)

**Agent Permissions**
- Role-based access control with granular action permissions
- Owner: full access to everything
- Manager: full access scoped to their office/branch
- Master Agent: manage downline agents, view downline merchants/leads/residuals, submit applications
- Agent: add leads, manage own leads, submit merchants, view own merchants and residuals, log communications
- Sub-Agent: add leads, submit merchants only — cannot edit merchant records, view residuals, or access settings
- Referral Partner: add leads only — no merchant access, no residual visibility
- Invite system: Owner/Manager can invite agents via email, agent gets their own login with restricted permissions
- Each role has a clear set of allowed actions:
  - Can add leads: All roles
  - Can submit/convert merchants: Owner, Manager, Master Agent, Agent, Sub-Agent
  - Can view own residuals: Owner, Manager, Master Agent, Agent
  - Can view all residuals: Owner, Manager only
  - Can manage partners: Owner, Manager only
  - Can manage settings: Owner only
  - Can invite agents: Owner, Manager
  - Can see buy rates / Schedule A: Owner only
- Critical: agents never see other agents' earnings, buy rates, or ISO-level financials
- Depends on: Sub-Agent Management


-
**Rep Code Management**
- Per-agent, per-partner rep code mapping table
- Auto-assign rep code when boarding merchant at a partner
- Use rep codes to match merchants → agents in residual imports
- Support different formats per processor (Fiserv: "F-XXXX", TSYS: hierarchical "55-01-02")
- Depends on: Sub-Agent Management

---

### 🔗 Group B — MPA Submission & Partner Workflow

Depends on: Group A (needs agents + rep codes)

**B.1 — MPA Template System**
- MPA templates linked to Partner → Sponsor Bank
- Each sponsor bank has one or more MPA templates
- Templates define required fields, field order, labels, conditional sections
- Template builder UI in partner/sponsor bank management
- Map deal fields to MPA template fields
- Hierarchy: Partner → Sponsor Bank → MPA Template

**B.2 — Universal Merchant Application**
- Agent fills out ONE form with all core merchant data
- System validates fields (EIN, SSN, bank routing format)
- Data stored centrally in the deal record
- Core fields: legal name, DBA, EIN, address, owners (SSN, DOB, ownership %), bank account, volume, avg ticket, MCC, equipment needs

**B.3 — Partner Setup Completion Checklist**
- Progress indicator on each partner ensuring all required info is present before submission
- Required: partner info, sponsor bank, MPA template, rep code, pricing schedule, MCC codes, underwriting guidelines
- Deals cannot be submitted to a partner until minimum setup is complete
- Displayed on partner detail page as a checklist/progress bar

**B.4 — Partner Cost Overlay on Deal Pricing**
- When filling deal pricing, show partner buy rate costs as hover tooltips on each fee field
- Costs pulled from uploaded pricing schedule (pricing_data JSON)
- "Select a partner to see buy rate costs" prompt if no partner associated
- Example: hover over "Chargeback Fee" → tooltip "Partner cost: $13.50 (from Payarc Schedule A)"
- Helps agents price correctly without switching between tabs

**B.5 — Suggested Pricing Engine**
- AI-suggested sell rates based on: partner buy rate, merchant MCC, monthly volume, pricing type
- Suggestions per pricing type: IC+ markup, dual pricing fee, surcharge %, flat rate
- Displayed as collapsible "💡 Suggested Pricing" section in deal pricing form
- Agent can accept (auto-fill) or ignore
- Future: factor in statement analysis to show savings vs. merchant's current rates

**B.6 — Forecasted Residuals Per Partner**
- Before submitting, show estimated residual comparison across eligible partners
- Calculation: merchant sell rate - partner buy rate = ISO margin × estimated volume = monthly residual
- Side-by-side partner comparison table showing: sell rate, buy rate, margin, estimated residual, agent split
- Helps ISO/agent choose the most profitable partner per deal

**B.7 — "Send for Signature" Status & MPA Generation**
- New pipeline status between "Submitted" and "Signed"
- Pre-flight blocking validations: pricing complete, at least one partner associated
- Pre-flight non-blocking warnings for owners >25% with incomplete info (SSN, DOB, etc.)
  - Options: "Send to owner to complete" (owner fills in sensitive fields during signing), "Send anyway" (blank fields), "Wait to complete"
- Generates completed MPA PDF for every partner/sponsor bank MPA template in the CRM
- Maps deal fields, owner info (Owner 1, 2, 3 based on >25% rule), agent rep codes, and pricing
- Merchant sees ONE unified signing experience — summary page with general authorization, not individual MPAs
- One signature covers all partner MPAs
- Multiple owners >25% each get their own signing section
- DocuSign integration: envelope with recipients per owner, parallel or sequential signing
- Fillable fields for owner self-completion if "send to owner to complete" was chosen

**B.8 — Signature Completion & Auto-Status Update**
- DocuSign webhook listens for completion
- Auto-moves deal from "Send for Signature" to "Signed"
- Stores signed envelope/document ID on deal
- Stores all signed MPAs on merchant profile
- Sends notification to agent/ISO owner
- Logs activity: "All signatures received"

**B.9 — "Submit to Partner" Status & Partner Selection**
- After signing, agent selects which partner(s) to submit to
- Modal shows: partner name, sponsor bank, estimated residual, setup status, rep code
- Can submit to one or multiple partners simultaneously
- Creates submission tracking record per partner (submitted, in review, approved, declined)
- Merchant becomes associated with selected partner
- Phase 1: manual download of signed MPA PDF for upload to partner portal
- Phase 2: API e-boarding where supported
- If declined: update status with reason, submit to other partners using same signed MPAs — no new signature
- If approved: agent enters MID, merchant activates, residual tracking begins

**B.10 — Merchant Profile — Signed Documents Section**
- Section/tab on merchant detail page listing all signed MPAs
- Per document: partner, sponsor bank, date signed, submission status, MID if approved
- Download link for each signed PDF
- Full submission history timeline

**B.11 — Statement Analysis Integration with Pricing Suggestions**
- If merchant's current processing statements uploaded in deal documents
- AI analyzes statement to extract current rates
- Compares current rates vs. suggested pricing to show savings
- Sales tool: "This merchant currently pays 2.9% + $0.30. Your rate saves them ~$X/month"
- Feeds into forecasted residual comparison (B.6)

*Note: B.7 through B.9 represent the core "submit once, sign once, route to many" workflow — the single biggest differentiator for Splits.*

---

### 🔗 Group C — Agent Portal & Payouts

Depends on: Group A (needs agent profiles + permissions + rep codes)

**Agent Self-Service Portal**
- Agents log in and see only their own merchants, leads, residuals
- View split calculations and payout history
- View rep codes per partner
- Cannot see other agents' data or ISO-level financials

**Agent Payout & Commission Tracking**
- Monthly payout calculation from residual imports + split agreements
- Override calculations for master agents (% of downline)
- Clawback tracking (merchants closed within clawback period)
- 1099 YTD totals per agent
- Payout approval workflow (owner approves → agent gets paid)
- Depends on: Agent Self-Service Portal

**Advanced Residual Features**
- Multi-level split chains (ISO → Master Agent → Agent → Sub-Agent)
- Minimum residual guarantees
- Reserve holdbacks
- Bonus/incentive program tracking
- Agent productivity reports
- Depends on: Agent Payout & Commission Tracking

---

### 🔗 Group D — White-Label & Enterprise

Depends on: Group A (needs multi-user/org support)

**Basic White-Label**
- Custom logo upload (replaces Splits logo)
- Custom primary brand color (replaces emerald)
- Custom company name in sidebar, headers, login
- Stored per-organization in settings
- CSS variable system makes color swapping seamless

**Advanced White-Label**
- Custom domain support (agent.theiriso.com)
- Custom login page branding
- Custom email templates with their branding
- Removable "Powered by Splits" footer
- Custom favicon upload
- Depends on: Basic White-Label

**Enterprise Features**
- Multi-organization support
- SSO (SAML/OAuth)
- Audit logging
- Custom data retention policies
- API access for custom integrations
- Dedicated support
- Depends on: Advanced White-Label

---

### 🔗 Group E — Direct Integrations

Depends on: Group B (MPA system should exist before adding API boarding)

**Direct Processor Integrations**
- Fiserv API e-boarding
- TSYS / Global Payments
- Priority / Worldpay
- Automated MID assignment and status updates

**Ecosystem Integrations**
- DocuSign / HelloSign (e-signature)
- QuickBooks / Xero (accounting sync)
- Twilio / SendGrid (SMS/email automation)
- Slack notifications
- Zapier / Make (5000+ app connections)
- Plaid (bank account verification)

**Mobile App**
- React Native or PWA
- Dashboard, merchant lookup, lead management
- Push notifications

---

### 🔗 Group F — Partner & Department Communications

Dependencies: Email service integration (SendGrid or Resend), department contacts on partners (built)

**F.1 — Email Sending from CRM**
- Send emails to partner departments directly from the platform
- Pre-fill recipient from partner department contacts
- Tag emails to specific merchants when sent from a merchant context

**F.2 — Inbound Email Routing**
- Receive reply emails via webhook (SendGrid/Resend inbound parse)
- Route replies to the correct partner + merchant thread based on thread ID or email headers

**F.3 — Partner Communications Tab**
- New tab on partner detail page showing all email threads grouped by department and merchant
- Collapsible thread view to reduce visual clutter

**F.4 — Merchant Partner Communications**
- "Partner Communications" section on merchant detail page showing only emails related to that specific merchant
- Slide-out panel or collapsible to save space

**F.5 — Communication Templates**
- Pre-built email templates for common partner interactions: "Request underwriting status", "Submit additional documents", "Chargeback dispute response", "Rate review request"
- Templates use merge tags for merchant/partner data

**F.6 — Internal Notes on Threads**
- Ability to add internal notes to a partner email thread that the partner doesn't see (for ISO team coordination)

**F.7 — Follow-Up Reminders**
- Set reminders on email threads: "Follow up with underwriting in 3 days if no response"

**F.8 — Call Logging to Departments**
- Log calls to specific partner departments with notes, tagged to merchant
- Shows in same communication timeline

Priority order: F.1 → F.2 → F.3 → F.4 → F.5 (remaining items are fast-follows)

Prerequisites:
- Email service account (Resend recommended — simpler API, $20/mo for 50K emails)
- Custom domain for sending (e.g. notifications@splitscrm.com) for deliverability
- Inbound email domain for receiving replies (e.g. reply@mail.splitscrm.com)

---

## Pricing Tiers

| Feature | Starter $99/mo | Growth $149/mo | Enterprise Custom |
|---|---|---|---|
| Merchants | Up to 200 | Up to 1,000 | Unlimited |
| Users | 1 | Up to 5 | Unlimited |
| AI extractions | 50/mo | 200/mo | Unlimited |
| Residual imports | 2 processors | Unlimited | Unlimited + custom |
| Sub-agent management | — | Up to 10 agents | Unlimited |
| Agent portal | — | Included | Included |
| Multi-partner MPA submission | 1 partner | Unlimited | Unlimited |
| White-label | — | — | Full white-label |
| Custom domain | — | — | Included |
| API access | — | — | Included |
| Support | Email | Email + Chat | Dedicated rep |

---

## Key Milestones

| Milestone | Target |
|---|---|
| First 5 beta users | Validate core product |
| Residual import enhancements | Strengthen #1 differentiator |
| First 25 paying users | Product-market fit confirmed |
| Agent system live (Group A) | Unlock multi-user value |
| MPA submission MVP (Group B) | "Submit once, sign once" |
| Agent portal live (Group C) | Reduce ISO support load |
| 100 paying users | $10K+ MRR |
| First white-label customer (Group D) | Enterprise tier validated |
| First processor API integration (Group E) | Automated boarding |

---

*Last updated: March 2026*
