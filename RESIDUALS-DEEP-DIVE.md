# Residual Management Deep Dive for ISOs

## 1. How ISOs Currently Track Residuals — The Real Workflow

### Monthly Cycle (What Actually Happens)

```
Day 1-30:    Merchants process transactions through their processor
Day 30-45:   Processor calculates residuals for the month
Day 45-60:   Processor sends residual report file to the ISO
Day 60-65:   ISO imports/reconciles data (manual or via CRM)
Day 65-70:   ISO calculates agent/sub-ISO splits
Day 70-75:   ISO pays out agents
```

**Key pain:** ISOs are flying blind on revenue for 45-60 days after a given month ends.

### Step-by-Step Workflow (Typical ISO with 200+ merchants, 3 processors)

**Step 1: Receive residual files from each processor**
- Each processor delivers a file (CSV, Excel, or proprietary format) via:
  - Email attachment
  - Partner portal download
  - SFTP drop
  - API pull (rare, only IRIS CRM-integrated processors)
- Files arrive at different times: Processor A on the 15th, Processor B on the 20th, Processor C on the 25th
- ISO must wait for ALL files before they can do complete calculations

**Step 2: Normalize the data**
- Every processor uses different column names, formats, and field structures
- ISO must map each processor's fields to a common format
- Example: Fiserv calls it "Merchant #", TSYS calls it "Merchant ID", Worldpay calls it "MID"
- Same data, different names — requires manual mapping or pre-configured templates

**Step 3: Match merchants to agents**
- Each merchant (MID) must be linked to the agent/sub-ISO who owns that relationship
- New merchants boarded that month may not be in the system yet
- Closed/attrited merchants must be identified and flagged
- Some MIDs change when merchants are re-boarded or migrate between platforms

**Step 4: Calculate per-merchant profit**
- For each merchant, determine:
  - Gross revenue (what the merchant was charged)
  - Processor costs (interchange + processor fees = the ISO's "buy rate")
  - Net profit = Gross revenue − Processor costs
- This is where the Schedule A comes in (see Section 3 below)

**Step 5: Apply agent splits**
- Look up each agent's compensation agreement (Schedule A / split agreement)
- Calculate what each agent earns based on their split type:
  - Revenue share (% of gross)
  - Profit split (% of net profit)
  - BPS override (basis points on volume)
  - Fixed per-merchant fee
- Handle multi-level hierarchies (agent → sub-agent → referral partner)

**Step 6: Apply adjustments**
- Subtract clawbacks (bonuses recouped for early merchant closures)
- Apply minimum payout thresholds
- Factor in reserves for high-risk merchants
- Account for chargebacks that reduce income
- Apply any overrides or bonuses (volume bonuses, recruitment overrides)

**Step 7: Generate payout reports**
- Create individual statements for each agent showing per-merchant detail
- Generate ACH/check payment instructions
- Produce 1099 data for year-end tax reporting

**Step 8: Reconcile against bank deposits**
- Match the processor's reported residual payment against actual bank deposit
- Investigate any discrepancies (common: 1-5% variance)

### How Small ISOs Do It (The Spreadsheet Reality)

```
1. Download CSV from each processor portal
2. Open in Excel/Google Sheets
3. VLOOKUP to match MIDs to agent names
4. Manually calculate profit per merchant
5. Apply split percentages via formulas
6. Copy-paste results into agent payout emails
7. Manually process ACH payments
8. Hope nothing was wrong
```

This process takes a small ISO (100 merchants, 10 agents, 2 processors) roughly **8-16 hours per month**. A mid-size ISO (1,000+ merchants, 50+ agents, 4+ processors) can spend **40-80 hours per month** on residuals alone.

---

## 2. Residual Report Formats by Processor

### What Processors Actually Send

Processors typically send a **CSV or Excel file** with one row per merchant per month. There is NO industry standard format — every processor is different.

### Common Fields Across Most Processor Reports

| Field | Description | Variations in Naming |
|-------|-------------|---------------------|
| MID | Merchant Identification Number | "Merchant #", "Merchant ID", "MID", "Acct Number" |
| DBA Name | Doing Business As name | "DBA", "Business Name", "Merchant Name" |
| Gross Volume | Total $ processed that month | "Sales Volume", "Gross Sales", "Processing Volume" |
| Transaction Count | Number of transactions | "Trans Count", "# Trans", "Transactions" |
| Gross Revenue | Total fees charged to merchant | "Gross Fees", "Total Revenue", "Billing Amount" |
| Interchange Cost | Card network fees (Visa/MC/etc.) | "IC Cost", "Interchange", "Network Fees" |
| Dues & Assessments | Card brand fees | "D&A", "Assessments", "Brand Fees" |
| Processor Fees | Processor's retained fees | "Processing Cost", "Acquirer Fees" |
| Net Revenue | Revenue after all costs | "Net Income", "Net Profit", "Residual Amount" |
| Agent ID | Identifier for assigned agent | "Rep Code", "Agent Code", "Sales Rep" |
| BPS | Basis points earned | "Basis Points", "BPS Earned" |
| Status | Active/Closed | "Account Status", "MID Status" |

### Processor-Specific Formats

#### Fiserv (First Data) — Largest US Processor
- **Delivery:** Partner portal download (ClientLine/AccessOne) or SFTP
- **Format:** CSV, multiple file types for different data
- **Quirks:**
  - Separates Visa/MC/Discover/Amex into different line items per merchant
  - May split PIN debit vs. signature debit
  - Multiple MIDs per merchant are common (one per terminal/location)
  - Auth fees, batch fees, and monthly fees are in separate columns
  - BIN sponsorship fee (2-6 BPS) deducted before profit calculation
- **Typical columns:** Merchant Number, DBA, Sales Count, Sales Amount, Credits Count, Credits Amount, Interchange, Assessments, Processing Fee, Net Revenue, Agent Number

#### TSYS (Global Payments) — Second Largest
- **Delivery:** Partner portal or SFTP
- **Format:** CSV or fixed-width text files
- **Quirks:**
  - Uses "agent hierarchy" codes for multi-level tracking
  - Tiered pricing and interchange-plus shown differently
  - May include equipment lease revenue in same report
  - Some reports use fixed-width columns (legacy format)
- **Typical columns:** Merchant ID, Merchant Name, MCC, Gross Sales, Total Transactions, Discount Revenue, Transaction Fees, Monthly Fees, Other Fees, Total Revenue, Total Expense, Net Income, Rep ID

#### Worldpay (FIS) — Major Global Processor
- **Delivery:** Partner portal download
- **Format:** CSV/Excel
- **Quirks:**
  - Complex multi-currency reporting for international merchants
  - Separate reports for card-present vs. card-not-present
  - Gateway fees may be in a separate report
  - Chargeback data often in a separate file
- **Typical columns:** MID, DBA Name, Processing Volume, Transaction Count, Discount Rate Revenue, Per-Item Revenue, Monthly Fee Revenue, Interchange Cost, Assessment Cost, Net Profit, Agent Code

#### PayArc — Newer/Mid-Size Processor
- **Delivery:** Partner portal or email
- **Format:** CSV/Excel
- **Quirks:**
  - Generally cleaner, more modern format
  - Often includes API access for automated pulls
  - May provide real-time or near-real-time data
  - Typically simpler fee structures (interchange-plus only)
- **Typical columns:** Merchant ID, Business Name, Monthly Volume, Transactions, Gross Revenue, Interchange, Assessments, Processing Fees, Net Revenue, Partner Code

#### Paysafe
- **Delivery:** Partner portal download
- **Format:** CSV
- **IRIS CRM supported:** Yes (pre-built mapping)

#### Priority Payment Systems
- **Delivery:** Partner portal
- **Format:** CSV
- **IRIS CRM supported:** Yes (pre-built mapping)

### Key Challenge: No Two Reports Look Alike

Even within the same processor, report formats can change:
- When the processor acquires another company (Fiserv + First Data merger changed formats)
- When they update their partner portal
- When a merchant migrates between platforms within the same processor
- Different product lines (POS, gateway, mobile) may generate separate reports

**This is THE core technical challenge for any ISO CRM: building a flexible field-mapping system that can normalize any processor's report into a common schema.**

---

## 3. Residual Calculations ISOs Need to Perform

### Understanding the Economics: The Waterfall

```
Merchant pays:         $1,000 in total processing fees for the month
                            │
                            ▼
Interchange (Visa/MC):   − $700  (non-negotiable, set by card networks)
Dues & Assessments:      − $50   (card brand fees)
                            │
                            ▼
Gross Markup:            = $250  (what's left after interchange + D&A)
                            │
                            ▼
Processor Keep:          − $80   (BIN sponsorship, platform fees, risk reserve)
                            │
                            ▼
ISO Net Revenue:         = $170  (what the ISO actually receives)
                            │
                            ▼
Agent Split (50%):       = $85   (agent payout)
ISO Keeps:               = $85   (ISO profit)
```

### The Schedule A — The ISO's Cost Basis

The Schedule A is the contract between the ISO and the processor that defines the ISO's costs (buy rates). It includes:

#### Per-Transaction Fees (Auth, Capture, Settlement)
```
Authorization fee:              $0.02 - $0.05 per transaction
Capture fee:                    $0.01 - $0.03 per transaction
Settlement fee:                 $0.01 - $0.02 per transaction
────────────────────────────────────────────────────────────
Total per-item cost:            $0.04 - $0.10 per transaction

If ISO charges merchant:        $0.10 per transaction
ISO cost (Schedule A):          $0.06 per transaction
ISO profit per transaction:     $0.04
```

#### BPS Markup (Basis Points on Volume)
```
Interchange:                    Passed through at cost
ISO buy rate (Schedule A):      + 5 BPS above interchange
ISO sell rate to merchant:      + 30 BPS above interchange
────────────────────────────────────────────────────────────
ISO profit:                     25 BPS on volume

On $50,000 monthly volume:
  25 BPS × $50,000 = $12.50/month per merchant
```

#### Monthly/Recurring Fees
```
Monthly minimum fee (to merchant):     $25.00
Monthly minimum cost (Schedule A):     $5.00
ISO profit:                            $20.00

Statement fee (to merchant):           $10.00
Statement fee cost (Schedule A):       $0.00
ISO profit:                            $10.00

PCI compliance fee (to merchant):      $14.95/mo
PCI compliance cost (Schedule A):      $4.95/mo
ISO profit:                            $10.00/mo

Batch/settlement fee (to merchant):    $0.30/batch
Batch fee cost (Schedule A):           $0.05/batch
ISO profit:                            $0.25/batch
```

#### BIN Sponsorship Fee
```
Processor retains 2-6 BPS before calculating ISO profit.
On $50,000 volume with 4 BPS bin sponsorship:
  Processor keeps: $50,000 × 0.0004 = $20.00
  This is deducted BEFORE the ISO's profit split
```

### Full Calculation Example: Single Merchant

```
MERCHANT: "Joe's Pizza" — MID 4812345678
PROCESSOR: Fiserv
MONTH: January 2026

Processing Data:
  Gross Volume:           $47,500
  Transaction Count:      1,250
  Batches:                30

Revenue to ISO (what merchant was charged above cost):
  BPS Markup (25 BPS):    $47,500 × 0.0025    = $11.88
  Per-item markup:        1,250 × $0.04         = $50.00
  Monthly minimum:        $0 (volume exceeds min)
  Statement fee:          $10.00
  PCI fee:                $10.00
  Batch fee profit:       30 × $0.25            = $7.50
  ──────────────────────────────────────────────
  Gross Profit:                                 = $89.38

Deductions:
  BIN sponsorship (4 BPS): $47,500 × 0.0004    = −$19.00
  Chargebacks (2):                              = −$50.00
  ──────────────────────────────────────────────
  Net ISO Revenue:                              = $20.38

Agent Split:
  Agent "Sarah" has 60/40 profit split
  Agent payout:           $20.38 × 0.60         = $12.23
  ISO keeps:              $20.38 × 0.40         = $8.15
```

### Multi-Level Split Example

```
MERCHANT: "Joe's Pizza"
Net ISO Revenue: $20.38

Hierarchy:
  Master Agent "Mike" recruited Agent "Sarah"
  Agent "Sarah" signed up the merchant
  Mike gets 10% override on Sarah's deals

Calculation:
  Sarah's split: 60% of $20.38                 = $12.23
  Mike's override: 10% of Sarah's portion       = $1.22
  ISO keeps: $20.38 − $12.23 − $1.22           = $6.93
```

### Types of Agent Compensation Structures

#### 1. Profit Split (Most Common)
```
Agent gets X% of NET profit (after all costs)
Typical: 50-70%
Pro: Simple to understand
Con: Agent must trust ISO's cost reporting
```

#### 2. Revenue Share
```
Agent gets X% of GROSS revenue (before processor costs)
Typical: 20-40%
Pro: Agent doesn't need to verify costs
Con: ISO bears risk if costs increase
```

#### 3. BPS Override
```
Agent gets fixed basis points on volume regardless of profitability
Example: 15 BPS on all volume
$50,000 volume × 0.0015 = $75/month
Pro: Predictable for agent
Con: ISO may lose money on thin-margin accounts
```

#### 4. Buy Rate Program
```
Agent is given a "buy rate" and keeps everything above it
ISO buy rate: Interchange + 10 BPS + $0.05/trans
Agent buy rate: Interchange + 15 BPS + $0.08/trans
Agent sets merchant price at: Interchange + 40 BPS + $0.12/trans
Agent keeps: 25 BPS + $0.04/trans
ISO keeps: 5 BPS + $0.03/trans
Pro: Agent has full pricing control
Con: Complex, and agent may underprice
```

### Additional Calculations ISOs Must Handle

#### Clawbacks
```
Agent received $500 upfront bonus for signing "Joe's Pizza"
Joe's Pizza closes after 2 months (clawback period is 6 months)
Clawback: $500 × (4 remaining months / 6 total) = $333.33 deducted from next residual
```

#### Minimum Payouts
```
Agent "Tom" earned $12.50 this month
Minimum payout threshold: $25.00
Tom's payout: $0 (rolls to next month)
Running balance: $12.50
Next month Tom earns $30.00
Total: $42.50 → pays out $42.50
```

#### Monthly Minimums (Merchant-Level)
```
Merchant agreed to $25/month minimum processing fee
Merchant only generated $8 in fees this month
Merchant charged: $25 (the minimum)
This means ISO earned an extra $17 in fee revenue
```

#### Attrition Tracking
```
Portfolio start of month:    500 merchants
New merchants boarded:       +15
Merchants closed:            -8
Merchants moved to competitor: -3
Portfolio end of month:      504
Attrition rate:              (8 + 3) / 500 = 2.2%
Annual attrition:            ~26.4% (industry avg: 15-25%)
```

#### 1099 Reporting
```
At year end, ISO must generate 1099-MISC for each agent
earning > $600/year with:
  - Total residuals paid
  - Total bonuses paid
  - Total clawbacks deducted
  - Net compensation
Must be filed with IRS and sent to agents by Jan 31
```

---

## 4. Common Complaints About Residual Tracking (IRIS CRM & Others)

### IRIS CRM Specific Issues (from G2, Capterra, TrustRadius reviews)

1. **Processor data inconsistency**: "Different processors provide different data so what you see is not always consistent across all possible processors" — this is partially a processor limitation, but IRIS doesn't normalize well enough

2. **2-year wait for new processor integrations**: Adding a new processor's data feed reportedly takes up to 2 years. If your ISO switches processors or adds a new one, you're stuck with manual imports

3. **Rigid user permissions**: Only 3 user classes (Basic, Advanced, Admin). If you want a sales manager to see portfolio profitability, they need Admin access — but that gives them too much access to other things

4. **File mapping is fragile**: When a processor changes their report format (even renaming a column), the import breaks. Users must manually re-map fields via drag-and-drop

5. **Mobile residuals viewing is weak**: Agents want to check their residuals on their phone — IRIS mobile "doesn't work as well as the PC version"

6. **No real-time data**: Most processor integrations are batch-based (monthly files). No daily or weekly revenue estimates

7. **Complex configuration**: "The configuration and customization process for functionality, permissions, and settings can be complex and ongoing"

8. **Dialer issues**: Built-in dialer recordings and call routing are "below expectations, lacking sophistication"

### Industry-Wide Complaints (All ISO CRM/Residual Tools)

1. **"I can't catch fee errors"**: Small changes in processor costs (1-2 BPS) go undetected because there's no automated comparison to Schedule A rates. Over a 500-merchant portfolio, this can mean thousands in lost revenue

2. **"Reconciliation is a nightmare"**: Matching processor residual reports to actual bank deposits is manual. Discrepancies of 1-5% are common and hard to trace

3. **"My agents don't trust the numbers"**: Without transparent, drill-down reporting that agents can self-service, every month turns into a flurry of "why is my residual lower?" inquiries

4. **"Clawbacks are manual"**: Tracking which bonuses are still in clawback period and auto-deducting from residuals requires manual spreadsheet tracking alongside the CRM

5. **"I can't see trends"**: No month-over-month comparison, no attrition alerts, no volume trend analysis. Just raw numbers each month

6. **"New merchant MIDs don't match"**: When a merchant is re-boarded or gets a new MID, the link between the old and new MID is lost. Historical data becomes orphaned

7. **"1099s are a disaster"**: Year-end tax reporting requires manually compiling 12 months of data across all processors, accounting for clawbacks and adjustments

8. **"I still need spreadsheets"**: Even IRIS CRM users export data to Excel for custom analysis, pricing schedule comparisons, and what-if scenarios. Quote from Nationwide Payment Systems: *"There's no exact science or AI software that can analyze your residual reports for you. Roll up your sleeves and get to work."*

---

## 5. The Dream Residual Management System

### What ISOs Actually Want (Synthesized from Reviews, Forums, Podcasts)

#### Instant Reconciliation
- Upload any processor's CSV/Excel file
- AI auto-detects columns and maps them (no manual drag-and-drop)
- System learns from previous imports — once mapped, always mapped
- Flags format changes: "Fiserv renamed 'Merchant #' to 'Merchant Number' — auto-matched"

#### Automated Anomaly Detection
- Compare this month's residuals to last month per merchant
- Alert: "Joe's Pizza volume dropped 40% — possible attrition risk"
- Alert: "Processor increased BIN sponsorship from 4 to 6 BPS — costing you $X/month"
- Alert: "12 merchants had $0 volume — may have closed"
- Alert: "Agent Sarah's portfolio is down 15% MoM — investigate"
- Compare processor costs against Schedule A terms — flag any discrepancy

#### Real-Time Revenue Estimates
- For processors with API access: show daily/weekly estimated residuals
- For file-based processors: use prior months to project current month
- Dashboard showing: "Estimated February residuals: $47,200 (based on January trends)"

#### Self-Service Agent Portal
- Each agent logs in and sees ONLY their merchants
- Drill down: Portfolio → Processor → Merchant → Transaction detail
- Shows: gross volume, net revenue, split %, payout amount
- Month-over-month comparison built in
- Agent can export their own data
- Eliminates 90% of "why is my residual lower?" support tickets

#### Flexible Split Engine
- Support ALL split types: profit split, revenue share, BPS override, buy rate
- Multi-level hierarchies: ISO → Super Agent → Agent → Sub-Agent → Referral
- Override rules: "Mike gets 10% of whatever Sarah earns on her merchants"
- Per-merchant overrides: "This specific merchant has a custom split of 70/30"
- Effective dates: "Sarah's split changes from 50% to 60% starting March 2026"
- Clawback automation: "If merchant closes within 6 months, recoup proportional bonus"

#### One-Click Payout
- After review, click "Approve Payouts"
- Auto-generate ACH file for batch payment
- Email each agent their detailed statement (PDF)
- Track payment status (pending, sent, cleared)
- Year-end: auto-generate 1099s

#### Portfolio Intelligence
- Attrition dashboard: which merchants closed, when, why (if known)
- Growth dashboard: new merchants by agent, processor, MCC
- Profitability heatmap: most/least profitable merchants, agents, processors
- Revenue projection: based on trends, estimate next 3-6 months
- Schedule A audit: continuously compare actual processor costs against contracted rates

#### Pricing Schedule Manager
- Store buy rates (Schedule A) for each processor
- Store sell rates for each merchant
- Calculate expected profit vs. actual profit
- "What-if" tool: "If I lower this merchant's rate by 10 BPS, my profit drops from $85 to $60/month"
- Rate comparison tool for sales: "Show me how my rates compare to the merchant's current processor"

### Priority Features for MVP

Based on pain point severity and competitive gaps:

1. **Universal file import with smart mapping** (solves the #1 daily pain)
2. **Multi-processor normalization** (unified view across all processors)
3. **Flexible split calculation engine** (handles all compensation types)
4. **Agent self-service portal** (eliminates support burden)
5. **Month-over-month anomaly detection** (catches errors and attrition early)
6. **Automated payout generation** (ACH file + agent statements)

These 6 features alone would make a viable competitor to IRIS CRM for small-to-mid ISOs at a fraction of the price.

---

## Sources

- [NMI MRM Residuals](https://www.nmi.com/mrm-residuals-calculation-reporting-and-management/)
- [IRIS CRM Residual Import Mapping](https://help.iriscrm.com/hc/en-us/articles/115001930168-How-to-Update-Mapping-for-Residual-Reports)
- [IRIS CRM Supported Processor Mappings](https://help.iriscrm.com/hc/en-us/articles/235222387-Supported-Residuals-Report-Mappings-By-Processor)
- [CCSalesPro - Understanding Schedule A](https://www.ccsalespro.com/blog/understanding-cost-2)
- [CCSalesPro - Understanding Your Residual Split](https://www.ccsalespro.com/blog/understanding-your-residual-split)
- [CCSalesPro - How Much Residual Can You Make](https://www.ccsalespro.com/blog/much-residual-can-make-selling-merchant-services-merchant-services-sales-commission)
- [ISOhub - Automated Residuals Management](https://theisohub.com/how-automated-residuals-management-solves-core-problems-of-isos/)
- [PayCompass - ISO Merchant Services Guide](https://paycompass.com/blog/iso-merchant-services/)
- [Nationwide Payment Systems - Residual Report Guide](https://nationwidepaymentsystems.com/residual-report-understanding-your-earnings-breakdown/)
- [Commissionly - ISO Commission Tracking](https://www.commissionly.io/iso-commission-tracking/)
- [IRIS CRM Reviews (G2)](https://www.g2.com/products/iris-crm/reviews)
- [IRIS CRM Pros & Cons (TrustRadius)](https://www.trustradius.com/products/iris-crm/reviews?qs=pros-and-cons)
- [Zen Payments - Merchant Processing Residuals](https://zenpayments.com/blog/merchant-processing-residuals/)
- [Green Sheet - Residuals: Are You Getting a Fair Shake?](http://www.greensheet.com/emagazine.php?article_id=6584)
- [Shaw Merchant Group - Commission Structure](https://shawmerchantgroup.medium.com/credit-card-processing-residual-income-merchant-services-commission-structure-ffef0fa69fff)
