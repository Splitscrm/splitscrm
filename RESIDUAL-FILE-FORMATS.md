# Processor Residual Report File Format Research

Research conducted March 2026. This document catalogs residual report column names, field structures, and format documentation from payment processors and CRM systems.

## Key Finding: No Industry Standard Format

There is NO standard residual file format across the payment processing industry. Each processor sends residual data in its own proprietary CSV/Excel format with different column names, structures, and granularity. This confirms that **smart field mapping is the #1 technical challenge** for any residual calculation system.

---

## 1. IRIS CRM / NMI Merchant Central (Industry Standard CRM)

IRIS CRM (now NMI Merchant Central) is the market leader for residual management. Their system defines the canonical set of fields that processor files must be mapped TO. This is the closest thing to an industry standard schema.

### Core Residual Summary Fields (per merchant, per month)
- **Volume** - Total processing volume in dollars
- **Transactions** - Number of transactions processed
- **Income** - Total revenue/fees collected from merchant
- **Expenses** - Total costs (interchange, dues & assessments, processor keep)
- **ISO Net** - Net income for the ISO (Income minus Expenses)
- **BPS** (Basis Points %) - Net profit expressed as basis points of volume
- **Agent Split** - Percentage split assigned to the agent
- **Agent Net** - Dollar amount the agent receives

### Detail Tab Fields
- **MID** (Merchant ID) - Unique identifier per merchant account
- **Return Volume** - Dollar value of refunds/returns

### Profitability Tab Fields
- **Monthly Volume Growth** ($ and %)
- **Monthly Revenue Growth** ($ and %)
- **Average Profit per Merchant**
- **Year-to-Date Profit** ($ and BPS)
- **Lifetime Profit** ($ and BPS)

### Calculated/Derived Fields
- **Adjusted Net** = Net Profit minus Line Items attributed to the merchant(s)
- **BPS Profit** = Adjusted Net / Processing Volume

### Residual Field Types (from API documentation)
- **Integer fields**: Number of Transactions, Auth Count
- **Float fields**: Income, Expense (monetary values with decimals)

### Supported Processor Integrations
IRIS CRM has pre-built residual file mappings for:
- Fiserv (First Data)
- TSYS (Wholesale and Retail)
- Paysafe
- Priority
- WorldPay (Vantiv)
- TriSource
- Elavon
- Nuvei

### Import Process
1. Upload CSV/Excel file from processor
2. Select processor, month, and year
3. If column names match existing mapping, auto-maps; otherwise opens mapping page
4. Drag-and-drop processor columns to CRM residual fields
5. System normalizes all processor data into common schema

---

## 2. Authorize.net (Partner/Reseller Residual Report)

The most detailed publicly documented residual report format found. These are gateway-level residuals for Authorize.net resellers.

### Residual Detail Report Fields (Table 26 from documentation)
| Field | Description |
|-------|-------------|
| **Payment Gateway ID** | Numeric ID identifying merchant on Authorize.net gateway |
| **Reference ID** | Identifier assigned by reseller to distinguish merchant |
| **Setup Fee** | Fee charged for setting up the account |
| **Gateway Fee** | Monthly fee charged for use of payment gateway |
| **Credit Card Transaction Fee** | Per-transaction fee for credit card submissions |
| **eCheck Fee** | Fee charged for eCheck transactions |
| **Fraud Detection Suite Fee** | Monthly fee for Advanced Fraud Detection Suite |
| **Automated Recurring Billing Fee** | Monthly fee for ARB services |
| **Other Fee** | Additional associated charges |
| **Residual Adjustments** | Modifications made to residual amounts |
| **Collection Attempts** | Efforts to collect fees from merchants |
| **Collection Returns/Subsidized Fees** | Credits issued for fees |
| **Residual Amount** | Final amount of residuals |
| **Collection Month** | Time period for fee collection |
| **Collection Year** | Year during which fees were collected |

Additionally, the report includes: merchant billing information, payment gateway account status, creation date, transaction statistics, sell rates, Sales Representative name, Sales Rep ID, and commission.

---

## 3. USAePay (Gateway/Reseller Reports)

### Billing / Residual Report Fields
| Field | Description |
|-------|-------------|
| **Company** | Name of Merchant Company |
| **Total Collected** | Total amount charged to Merchant by gateway company |
| **Reseller Cost** | Amount charged to reseller |
| **Collection Fee** | Fee charged by gateway company for merchant billing |
| **Residual Payout** | Difference: positive = paid to reseller, negative = billed |

### Feature Usage Report Fields (useful for reconciliation)
**Merchant Statistics:** Company, Used Package, Billed Package, # CC Trans, # Check Trans, # Debit Trans

**Transaction Amounts:** Total dollar amount, Total Sales, Total Declines, Total Voids, Total Credits

**Customer Data:** Customers in DB, Customers w/Billing, Num Batches, Num Sources

**Merchant Info:** Merch ID, Date Activated, Reseller ID, Reseller Company, Account status

**Contact Info:** Contact, Street, City, State, Zip, Country, Email, Phone

**Processing Platforms:** TSys, Cardinal, Pay Tech, Planet, FDMS North, VeriCheck

Export format: Tab-delimited or comma-delimited (CSV). Fields are customizable -- add/remove via UI.

---

## 4. Elavon (via Varicent Portal)

Elavon delivers residual data through the Varicent commission management system, imported monthly around the 15th-20th.

### File Types in Elavon Residual Package
1. **Merchant Summary** - Volume and transaction summary per merchant
2. **IC Qualification** - Interchange qualification details
3. **Auth Detail** - Authorization-level transaction detail
4. **Misc Expense** - Miscellaneous costs applied to merchants
5. **Fee Report** - All fees/income items per merchant for the billing month

### Key Field
- **Amount Due MSP** - The "gross profit bucket" and starting amount for commission calculations

### Usage Notes
- Merchant Summary provides volume and transaction counts
- Fee and expense files provide income and cost line items
- Some items must be exempted from profit calculations (identified per ISO agreement)

---

## 5. TSYS / Global Payments

TSYS data is accessible via the Agent Portal at agentportal.tsys.com. From the mreports.com documentation (TSYS merchant management system), the following fields are documented:

### Merchant Identification Fields
- **Merchant ID** - 12-digit Visa/MasterCard Merchant ID
- **Merchant Number** - 16-digit number for routing chargebacks/retrievals
- **Merchant Name** - Business name on terminal receipt
- **Seller Legal Name** - Legal business name
- **Seller DBA Name** - Doing Business As name
- **Seller MCC** - 4-digit Merchant Category Code
- **SE Number** - AMEX Service Establishment Number
- **Disc/PayPal ID** - 15-digit Discover Merchant ID
- **Store** - 4-digit store/location number
- **Member ID** - 8-character merchant identification

### Financial/Billing Fields
- **Discount Amount** - Total dollar amount of daily discount paid by merchant
- **Discount Per Item** - Per-item rate for card plan discount calculation
- **Discount Percent** - Discount percentage for card plan
- **Discount Rate** - Rate communicated to merchant for AMEX/Discover
- **Discount Type** - Whether discount calculated on gross or net sales
- **Daily Discount** - Whether merchant participates in daily discount or interchange (D/I/B/N)
- **Per Item** - Expense or processing charge for each billing item
- **EXP** - Client's expense base calculation

### Merchant Status Fields
- **Merchant Status** - Account status codes: O(Open), B(Boarded), C(Closed), D(Declined), F(Fraud), I(Inactive), P(Pending), S(Suspended), Z(Seasonal)
- **Date Opened** - Account open date
- **Date Closed** - Account close date
- **Date of Last Activity** - Last transaction date

### Agent/Sales Fields
- **Sales Code** - 1-16 character sales code ID
- **Sales Rep ID** - Discover sales representative ID
- **SPID** - 20-character Sales Person Identifier
- **MSR Name** - Merchant sales representative name
- **Sales Channel** - Sales channel ID

### Volume Tracking Fields
- **Merchant Volume (MVI)** - Merchant eligibility for volume program
- **Estimated Average Charge** - Merchant's average charge amount
- **Percentage Key Entered** - Hand-entered transaction percentage
- **Percentage of E-Commerce** - Electronic transaction percentage
- **Percentage of Retail** - Swipe transaction percentage

---

## 6. Fiserv / First Data

Fiserv provides ISO residual data through partner portals. Specific file layouts are not publicly documented, but merchant statement structure reveals the data elements available:

### Merchant Statement Sections (Interchange Plus Pricing)
- Processing summary by card brand (Visa, Mastercard, Amex, Discover)
- Fee breakdown per card brand
- Interchange detail with qualification levels
- Statement/service fees
- Deposit summary

### Known Data Elements from Statement
- Merchant ID
- Statement period
- Gross sales by card type
- Number of transactions by card type
- Interchange fees
- Dues & assessments
- Processor markup fees
- Monthly fees (statement, PCI compliance, etc.)
- Net deposit amounts
- Batch dates and amounts

---

## 7. Priority Payment Systems

### Reporting Structure
- Residual report with total monthly merchant fees
- Agent portal shows **Gross Income** and **Gain/Loss** figures
- Five tabs of rate and fee detail
- **Gain/Loss Overview** tab -- total residual matches the Gain/Loss amount
- Drill-down capability to interchange level
- Concise Schedule A showing terms and exact payout

### Known Issues
- Default reporting is not fully transparent about fees
- Full reports available on request
- No public documentation of column-level format

---

## 8. Paysafe (formerly iPayment)

### Residual Payment Details
- Residuals paid between 18th-22nd of each month
- Managed via iAccess portal (iaccessportal.com)
- Over 20 years of ISO partnership experience
- No public documentation of file format or columns

---

## 9. PayArc

### Agent Portal Features
- **My Residuals** feature -- monthly residual details
- **Partner Hub** dashboard with:
  - Merchant activations
  - Bonuses to be earned
  - Bonus activities
  - Commissions
  - Deposits
  - Batch reporting
  - Transaction records
  - Chargebacks and ACH returns
- Agent splits: up to 90% of residual commission for retail accounts
- No public documentation of CSV export format

---

## 10. Common Merchant Statement Fields (Cross-Processor)

Based on analysis of multiple processor statement guides, these fields appear universally:

### Account Identification
- Business Name / DBA (Doing Business As)
- Merchant ID (MID)
- Statement period (start/end dates)
- Processor/provider name

### Volume Summary
- **Gross sales** (total card volume before deductions)
- **Refunds** (returns/reversals)
- **Chargebacks** (disputed transactions)
- **Net sales** (after refunds/chargebacks, before fees)
- **Number of transactions**
- Card type breakdown: Visa, Mastercard, Amex, Discover
- Entry method: swiped, dipped (chip), tapped (contactless), keyed

### Fee Categories
**Per-Transaction:** Auth Fee, Transaction Fee
**Percentage-Based:** Discount Rate, Processing Rate, Qualified/Non-Qualified Rate
**Monthly:** Statement fee, Gateway fee, Terminal rental
**Miscellaneous:** Batch fees, AVS fees, PCI compliance fees, Voice auth fees, Network access fees, Account maintenance, Security fee, PCI non-compliance fee

### Deposit/Batch Summary
- Batch/deposit date
- Total batch amount (gross sales)
- Fees deducted
- Net deposit amount
- Bank deposit date

---

## 11. Commission Calculation Fields (QCommission / Industry Standard)

### Data Elements Used in Residual Calculations
- Payment Processor name
- ISO/Agent identifier
- Sales Rep identifier
- Merchant identifier
- Revenue
- Gross margin
- Recurring margin
- Units / Volume
- PIN debit amounts
- Gift card amounts
- Residual revenue
- Commission rates (tiered)
- Split commission rates
- Manager overrides
- Referral commissions
- Draws / guaranteed payouts
- Cumulative totals

---

## 12. Proposed Normalized Schema for ISOCRM

Based on this research, here is the recommended common schema that all processor files should be mapped into:

### Merchant Identification
| Field | Type | Description |
|-------|------|-------------|
| merchant_id (MID) | string | Unique merchant identifier from processor |
| dba_name | string | Doing Business As name |
| legal_name | string | Legal entity name |
| mcc | string(4) | Merchant Category Code |
| status | enum | Open/Closed/Inactive/Suspended |
| open_date | date | Account activation date |
| close_date | date | Account closure date (nullable) |
| agent_code | string | Agent/sales rep identifier |
| processor | string | Source processor name |

### Monthly Residual Data (per merchant, per month)
| Field | Type | Description |
|-------|------|-------------|
| reporting_month | date | Month/year of the residual period |
| gross_volume | decimal | Total processing volume ($) |
| net_volume | decimal | Volume minus refunds/chargebacks |
| transaction_count | integer | Number of transactions |
| refund_volume | decimal | Total refunds ($) |
| refund_count | integer | Number of refunds |
| chargeback_volume | decimal | Total chargebacks ($) |
| chargeback_count | integer | Number of chargebacks |

### Income (Revenue) Fields
| Field | Type | Description |
|-------|------|-------------|
| total_income | decimal | All fees collected from merchant |
| discount_income | decimal | Discount rate revenue |
| per_item_income | decimal | Per-transaction fee revenue |
| other_income | decimal | Misc fees (monthly, PCI, etc.) |

### Expense (Cost) Fields
| Field | Type | Description |
|-------|------|-------------|
| total_expenses | decimal | All costs for the merchant |
| interchange_expense | decimal | Interchange fees paid |
| dues_assessments | decimal | Card brand dues & assessments |
| processor_expense | decimal | Processor's keep |
| other_expense | decimal | Misc costs |

### Calculated Fields
| Field | Type | Description |
|-------|------|-------------|
| iso_net | decimal | total_income - total_expenses |
| bps | decimal | (iso_net / gross_volume) * 10000 |
| agent_split_pct | decimal | Agent's split percentage |
| agent_net | decimal | iso_net * agent_split_pct |

### Optional Card Brand Breakdown
| Field | Type | Description |
|-------|------|-------------|
| visa_volume | decimal | Visa processing volume |
| visa_transactions | integer | Visa transaction count |
| mc_volume | decimal | Mastercard processing volume |
| mc_transactions | integer | Mastercard transaction count |
| amex_volume | decimal | Amex processing volume |
| amex_transactions | integer | Amex transaction count |
| discover_volume | decimal | Discover processing volume |
| discover_transactions | integer | Discover transaction count |

---

## 13. Key Technical Notes for Implementation

### File Format Variations by Processor
- **Fiserv/First Data**: Typically CSV, multiple files may be needed (summary + detail)
- **TSYS**: CSV from agent portal, column names vary between Wholesale and Retail platforms
- **Elavon**: Multiple files via Varicent (Merchant Summary, IC Qualification, Auth Detail, Misc Expense, Fee Report)
- **Worldpay/Vantiv**: Customizable column reports from Business Manager portal
- **Priority**: Portal-based with drill-down to interchange level
- **Paysafe**: Monthly via iAccess portal
- **Authorize.net**: CSV/tab-delimited export from partner interface

### Common Column Name Variations (Same Data, Different Names)
| Concept | Possible Column Names |
|---------|----------------------|
| Merchant ID | MID, Merchant Number, Merchant ID, Merchant #, Account Number, Member ID, Seller ID |
| Business Name | DBA, DBA Name, Merchant Name, Company, Business Name, Seller DBA Name |
| Volume | Volume, Sales Volume, Gross Sales, Total Volume, Processing Volume, Net Volume |
| Transactions | Transactions, Trans Count, # Transactions, Number of Transactions, Trans, Items |
| Income | Income, Revenue, Total Fees, Gross Revenue, Total Collected, Fees Collected |
| Expenses | Expenses, Cost, Interchange, Buy Rate Cost, Reseller Cost, Processor Cost |
| Net | Net, Net Income, Net Revenue, Net Profit, ISO Net, Residual Amount, Residual Payout |
| Agent | Agent, Agent Code, Sales Rep, Rep ID, Sales Code, SPID, Sales Representative |

### Multi-File Processors
Some processors (notably Elavon) send residual data across multiple files that must be joined:
1. Merchant Summary (volume, transactions)
2. Fee Report (income items)
3. Expense files (interchange, D&A, misc costs)
4. Auth Detail (transaction-level detail for drill-down)

### Level 12 Case Study Insight
A real-world merchant residuals calculator project (built by Level 12, Inc.) revealed:
- Input files use **multi-line, fixed-width record format** (not just CSV)
- No formal specification existed -- required 18 months of iterative validation
- 1,650+ tests needed with 93% code coverage
- Edge cases in calculations were the primary challenge
- Built on PostgreSQL + Python + SQLAlchemy

---

## 14. Sample CSV Files

Four realistic sample residual files are in `sample-residual-data/`, each representing a different processor format with the same 15 merchants. These files are designed to test AI column mapping by using different:
- Column names for the same data concepts
- File structures (metadata headers vs flat, single-row vs multi-row per merchant)
- Data formatting (parentheses for negatives, % symbols, uppercase DBA names)
- Granularity levels (aggregated vs card-brand breakdown)

### File Inventory

| File | Processor | Key Format Quirks |
|------|-----------|-------------------|
| `fiserv_north_residuals_202602.csv` | Fiserv/First Data North | 5-line metadata header, "Merch Nbr" for MID, "Return Amt" for refunds, TOTALS row at bottom |
| `tsys_wholesale_residuals_202602.csv` | TSYS Wholesale | Flat CSV, ALL CAPS merchant names, "Sales Code" + "SPID" for agent ID, status codes (O/C/etc), 0.60 format for split |
| `worldpay_vantiv_residuals_202602.csv` | Worldpay/Vantiv | 4-line metadata header, **multiple rows per merchant** (one per card type: VISA/MC/DISC/AMEX), "Merchant Number" for MID, "Items" for transaction count, "Effective Rate" in BPS |
| `priority_payments_residuals_202602.csv` | Priority Payment Systems | Flat CSV with most columns of any format (33 cols), card-brand volume split into separate columns, parentheses for negative amounts, "60.00%" format for splits, Bonus/Clawback columns |

### Column Name Mapping Across Sample Files

| Concept | Fiserv | TSYS | Worldpay | Priority |
|---------|--------|------|----------|----------|
| Merchant ID | Merch Nbr | MID | Merchant Number | Account Number |
| Business Name | DBA Name | Merchant Name | Merchant DBA | Account DBA |
| Agent ID | Rep Code | Sales Code | Agent ID | Agent Code |
| Agent Name | Sales Rep | *(not included)* | Agent Name | Agent Name |
| Volume | Gross Sales | Volume | Gross Amount | Total Volume |
| Transactions | Trans Count | # Trans | Items | Total Trans |
| Refunds | Return Amt | Refund Volume | Credits | Refund Amt |
| Interchange | Interchange | IC Expense | IC Cost | Interchange Fees |
| D&A | Dues & Assess | D&A Expense | Assessments | Card Brand Fees |
| Total Cost | Total Expense | Total Cost | Total Cost | Buy Rate Cost |
| Total Revenue | Total Income | Gross Income | Revenue | Sell Rate Revenue |
| Net Profit | Net Revenue | Net Profit | Profit | Gross Profit |
| Split % | Split % | Agent Split | Agent % | Agent Split Pct |
| Agent Payout | Agent Payout | Agent Commission | Agent Amt | Agent Residual |

---

## Sources

- [Authorize.net Residual Detail Report Fields](https://partner.authorize.net/widget/Areas/Widget/Help/PINT/residual_detail.htm)
- [IRIS CRM Supported Residuals Report Mappings By Processor](https://help.iriscrm.com/hc/en-us/articles/235222387-Supported-Residuals-Report-Mappings-By-Processor)
- [IRIS CRM How to Update Mapping for Residual Reports](https://help.iriscrm.com/hc/en-us/articles/115001930168-How-to-Update-Mapping-for-Residual-Reports)
- [IRIS CRM Merchant Residuals Profitability](https://help.iriscrm.com/hc/en-us/articles/115000255747-Merchant-Residuals-Profitability)
- [NMI Merchant Central Residuals Calculation](https://www.nmi.com/products/merchant-relationship-management/residuals-calculation/)
- [NMI MRM Residuals Management](https://www.nmi.com/nmi-residuals-management/)
- [USAePay Reseller Reports](https://help.usaepay.info/reseller/guide/reports_index/)
- [PulsePoint/MSPware Residual Raw Data Files](https://support.fidano.com/en/articles/5717902-step-2-residual-raw-data-files)
- [Elavon Varicent Guide](https://www.elavon.co.uk/content/dam/elavon/en-gb/v2/documents/partners/Elavon-Varicent-Guide-2023.pdf)
- [TSYS/Global Payments Agent Portal](https://agentportal.tsys.com/)
- [TSYS Field Notes (mreports.com)](https://www.mreports.com/spmod/webhelp/43083.htm)
- [Secure Global Pay - Payment Processing Statement Guide](https://secureglobalpay.net/payment-processing-statement/)
- [QCommission Merchant Services](https://www.qcommission.com/industries/industries-four/merchant-services.html)
- [Level 12 Merchant Residuals Calculator Case Study](https://www.level12.io/projects/case-study-merchant-residuals-calculator/)
- [CCSalesPro Understanding Your Residual Split](https://www.ccsalespro.com/blog/understanding-your-residual-split)
- [PegasusCRM Universal Residual Reporting](https://pegasuscrm.net/modules/universal_residual_reporting.html)
- [IRIS CRM PHP SDK (GitHub)](https://github.com/iris-crm/php-sdk)
