# ISO CRM Market Research (March 2026)

## 1. Existing Tools ISOs Currently Use

### Tier 1: Purpose-Built ISO CRMs

#### IRIS CRM / NMI Merchant Relationship Management (Market Leader)
- Acquired by NMI in Jan 2022, now branded "Merchant Central"
- ~245 companies globally, ~187 in the US (81%)
- **Modules:** Merchant Central (onboarding, residuals), ScanX (KYC/KYB/AML), MonitorX (risk alerts)
- **Processor integrations:** Fiserv, TSYS/Global Payments, Elavon, Paysafe, Worldpay, Priority (~20+ processors)
- **Key features:** TurboApp (streamlined boarding), built-in power dialer, helpdesk/ticketing, REST API, multi-tier agent portals
- **Strengths:** Tightest processor integrations, mature residual engine, purpose-built data model (MIDs, interchange, etc.)
- **Weaknesses:** Dated UI, weak mobile app, 2-year turnaround for new processor feeds, steep learning curve, expensive
- **Pricing:** ~$1,799/mo base (custom plans). Some sources cite $50-150+/user/mo. Setup fees apply.
- Sources: [G2](https://www.g2.com/products/merchant-relationship-management-by-nmi/reviews) | [Pricing](https://www.iriscrm.com/pricing) | [TrustRadius](https://www.trustradius.com/products/iris-crm/reviews)

#### Pulse CRM (Growing Competitor)
- Purpose-built for ISOs and payment processors
- Lead acquisition, underwriting, boarding, residual payouts, portfolio analytics
- **Pricing:** Starts at ~$19/mo (likely per-user, basic tier)
- Source: [pulsecrm.com/pricing](https://pulsecrm.com/pricing/)

#### PegasusCRM (Cloud-Based ISO CRM)
- Sales funnel engine, partner/agent portals, digital signatures, VoIP/email integration
- Equipment tracking, residual reporting suite
- **Pricing:** Contact for quote
- Source: [pegasuscrm.net](https://pegasuscrm.net/)

#### ISOhub (Newer Entrant)
- Merchant management, automated residuals, team performance tracking
- Growing content marketing presence (blog posts on ISO operations)
- **Pricing:** Contact for quote
- Source: [theisohub.com](https://theisohub.com/)

#### Other Niche Players
- **Privvy ISO CRM** — Account management portal for ISOs/agents/resellers/merchants
- **Payitiv CRM** — Rate-comparison proposals, electronic contracts, residual automation
- **RiseCRM** — Same-day merchant activation, automated underwriting, residual revenue reporting
- **Vanquish (formerly NXGEN)** — ISO management platform (CRM, boarding, residuals, agent portals)
- **Profituity** — ISO portfolio management and residuals (more affordable than Shaw)
- **Residual Hub** — Standalone residual calculation/reporting tool
- **Payzli Connect** — Payment processor CRM

### Tier 2: General CRMs with Payment Customization

#### Salesforce + Financial Services Cloud
- Used by larger ISOs; extremely flexible but requires heavy customization
- No native understanding of MIDs, interchange, residuals, or e-boarding
- Plugins: Cloudsquare Broker (MCA-focused), DocuSign/PandaDoc, Chargebacks911
- Most ISOs build custom objects for Merchants, MIDs, Processors, Pricing
- **Pricing:** $25-330/user/mo base + $10K-50K+ custom development
- **Total cost for ISO:** $500-2,000+/mo for small ISO (5-10 users)

#### HubSpot, Zoho, Pipedrive
- Some smaller ISOs use for lead management only (no residuals capability)
- HubSpot: Free-$150/user/mo | Zoho: $14-52/user/mo
- Require custom integrations for anything payment-specific

### Tier 3: Back-Office / Legacy Systems

#### Shaw Systems (SHAWMAN)
- 50+ year old company, primarily **loan servicing** (not true ISO CRM)
- Used by some large/enterprise ISOs for back-office residual management
- Often paired with a separate CRM (IRIS or Salesforce) for front-end
- **Pricing:** ~$50,000 one-time license or $2,000-10,000+/mo. Setup fees $5K-25K+
- Multi-year contracts common
- Source: [GetApp](https://www.getapp.com/finance-accounting-software/a/shaw-systems/)

### Tier 4: Processor-Provided Portals
Each major processor provides reporting tools for their ISOs, but these are:
- Limited to merchants on that specific processor
- Focused on reporting, not CRM/sales pipeline
- Not designed for multi-processor portfolio management
- Key portals: Fiserv AccessOne/ClientLine, Global Payments ProPay/Genius, Worldpay iQ, Priority portal, Paysafe portal

### Tier 5: Spreadsheets (Still Extremely Common)
- **Estimated 40-60% of ISOs** still rely on spreadsheets for critical workflows
- Primary uses: residual calculations, pricing schedules (buy/sell rates), agent commission tracking, lead lists
- Common among small ISOs (1-20 agents) and even mid-size ISOs for specific functions
- Problems: error-prone, no audit trail, doesn't scale past ~50-100 merchants, security risks (SSNs/EINs in unprotected files), single point of failure (one person understands the formulas)

---

## 2. Biggest Pain Points

### #1: Residuals Management (Universal Top Pain Point)
- Each processor sends residual files in **different formats** — reconciliation is a nightmare
- Residual data arrives **30-45+ days after month-end** — ISOs fly blind on revenue
- Discrepancies of **5-15% are common** and often go undetected
- Multi-level splits (sub-agents, sub-ISOs, referral partners with tiered/flat/BPS structures) break most tools
- No real-time or near-real-time revenue visibility
- Manual spreadsheet calculations are error-prone and costly
- **Errors erode agent trust**, leading to attrition
- Clawback tracking for early merchant closures is largely manual
- 1099 year-end reporting for agents is painful

### #2: Processor Integrations
- IRIS CRM supports ~20 processors, but 100+ exist in the market
- Users report **2-year wait** for IRIS to add new processor data feeds
- Boarding APIs frequently break when processors update requirements
- Most integrations are **one-way** (pull only, can't push pricing changes back)
- Inconsistent data refresh rates (daily vs. weekly vs. monthly) across processors
- Live data vs. stale nightly batch feeds is a major frustration

### #3: Merchant Onboarding Friction
- Only **23% of merchants** describe onboarding as "transparent"
- ~75% experience friction or frustration
- Manual data transfer is the slowest, most error-prone step
- Paper-heavy processes persist despite "e-app" capabilities
- Status tracking is opaque — ISOs can't see where apps are in processor approval pipeline
- Pre-boarding data doesn't flow cleanly into post-boarding (requires re-entry)
- KYC/AML requirements keep changing; tools are slow to update

### #4: Cost of Existing Solutions
- IRIS CRM at ~$1,799/mo is **prohibitive for smaller ISOs**
- Per-merchant pricing means costs scale as portfolio grows (misaligned incentive)
- Salesforce requires $10K-50K+ in customization before it's useful
- Long-term contracts make switching painful
- Feature nickel-and-diming (e-signatures, API access, extra seats = add-on charges)
- **Many ISOs default to spreadsheets** because alternatives are too expensive

### #5: Weak Lead Management & Sales Pipeline
- Most ISO CRMs started as residual/portfolio tools — lead management is an afterthought
- No intelligent lead scoring or attrition risk prediction
- Poor marketing automation (no drip campaigns, no behavior-based follow-ups)
- Inferior to dedicated CRMs like Salesforce or HubSpot for pure sales workflows

### #6: Reporting & Analytics Gaps
- Inflexible canned reports with no ad-hoc query capability
- Poor data export (incomplete CSVs, no BI tool integration)
- No portfolio analytics: attrition trends, volume trends, profitability by agent/processor/MCC
- No merchant health scoring or predictive analytics
- No projected revenue modeling

### #7: Mobile Experience
- Mobile apps described as "barely functional" or "just a responsive website"
- No offline capability for agents visiting merchants in poor-connectivity areas
- Missing: mobile signature capture, document OCR, GPS-based merchant mapping
- IRIS CRM's mobile is notably weak compared to desktop

### #8: Customization & Flexibility
- Rigid workflows that can't match ISO-specific processes
- Limited custom fields; constrained data models
- No workflow automation builder ("if merchant volume drops 30%, alert agent")
- APIs often poorly documented, rate-limited, or missing key endpoints

### #9: AI/Automation Gap (Emerging 2025-2026)
- ISOs see AI in mainstream CRMs but ISO-specific tools lag far behind
- Want: predictive analytics, automated merchant communications, intelligent pricing optimization
- Embedded payments/PayFac shift — traditional ISO CRMs not adapting to hybrid models
- Compliance acceleration outpacing tool capabilities

### #10: Vendor Lock-In & Switching Costs
- Migrating means losing years of historical data, merchant notes, communications
- Custom configurations and pricing templates represent sunk investment
- All processor connections must be re-established

---

## 3. Pricing Comparison

| Tool | Pricing Model | Starting Price | Target |
|------|--------------|----------------|--------|
| IRIS CRM (NMI MRM) | Monthly subscription | ~$1,799/mo | Mid-size ISOs |
| Shaw Systems | One-time license | ~$50,000 (or $2K-10K/mo) | Enterprise ISOs |
| Salesforce + custom | Per-user + dev costs | $500-2,000+/mo total | Large ISOs |
| Pulse CRM | Per-user/month | ~$19/mo | Small-mid ISOs |
| PegasusCRM | Custom quote | Not public | Mid-size ISOs |
| ISOhub | Custom quote | Not public | Small-mid ISOs |
| HubSpot | Per-user/month | Free-$150/user/mo | Small ISOs (no residuals) |
| Zoho | Per-user/month | $14-52/user/mo | Small ISOs (no residuals) |
| Spreadsheets | N/A | $0-20/mo | Everyone (by default) |

### Pricing Gap Opportunity
There is a clear gap between Pulse CRM (~$19/mo, likely limited) and IRIS CRM (~$1,799/mo, full-featured). A product in the **$99-499/mo range** with solid residuals + modern CRM could capture the underserved small-to-mid ISO market.

---

## 4. Where ISO Agents Hang Out Online

### Reddit
| Subreddit | Size | Relevance |
|-----------|------|-----------|
| r/PaymentProcessing | ~2K members | Most relevant; medium activity |
| r/sales | 500K+ members | General sales; search "merchant services" |
| r/smallbusiness | 1M+ members | Merchant perspective; ISO topics surface |
| r/Entrepreneur | Large | Tangential; payment processing discussed |
| r/fintech | Medium | Tangential; payments industry topics |

No dedicated high-traffic ISO agent subreddit exists.

### Facebook Groups (Most Active Day-to-Day Community)
- **"Merchant Services ISO Agent Forum"** — mid-sized; residuals, buyout offers, processor comparisons
- **"Credit Card Processing Sales Professionals"** — sales techniques, leads, industry news
- **"Payment Processing Professionals"** — broader group including ISOs, ISVs, PayFacs
- Various processor-specific agent groups (NAB agents, etc.)
- Groups range from 1K to 10K+ members each
- **Facebook is the most active platform for working ISO agents**

### LinkedIn
- **"Merchant Services Professionals"** — 10K+ members (largest)
- **"ISO & Agent - Merchant Services"** — narrower focus on ISO agents
- **"Payment Processing & Fintech Professionals"** — broader fintech focus
- **ETA (Electronic Transactions Association)** — official group; professional tone
- Activity has declined as LinkedIn shifted to main feed, but still useful for networking

### Industry Publications
- **The Green Sheet** (greensheet.com) — THE industry bible for ISOs and payment professionals; "Street SmartsSM" column targets agents specifically
- **PaymentsJournal, PYMNTS.com, Digital Transactions** — industry news
- **Merchant Maverick** — processor reviews; draws industry professionals

### Podcasts & Training (Key Influencer Channel)
- **Merchant Sales Podcast** (CCSalesPro + The Green Sheet) — #1 ISO-specific podcast
  - Host: James Shepherd (since 2008)
  - Audience: 40K+ (27K email, 11K YouTube subscribers, 7K LinkedIn)
  - Weekly episodes with industry guests
  - [Apple Podcasts](https://podcasts.apple.com/us/podcast/merchant-sales-podcast/id492171266) | [ccsalespro.com](https://www.ccsalespro.com/)
- **"PayPod" by Soar Payments** — payments industry interviews
- **"Payments on Fire"** — industry trends
- **"Transaction Trends Podcast" by ETA** — official ETA podcast

### Industry Associations & Events
- **ETA (Electronic Transactions Association)** — 500+ member companies
  - **TRANSACT** — largest annual payments conference (spring, Las Vegas)
  - Regional events in Atlanta, San Francisco
  - Fintech Forum, Strategic Leadership Forum
  - CPP certification program
  - [electran.org](https://electran.org/)
- **SEAA (Southeast Acquirers Association)** — regional; intimate, agent-friendly annual conference
- **MWAA (Midwest Acquirers Association)** — regional
- **WSAA (Western States Acquirers Association)** — regional

### Discord / Slack
- **No dominant Discord server** for ISO agents (notable gap/opportunity)
- Fintech Slack communities exist but are invite-only and more product/tech focused
- Not a primary channel for field-level ISO agents

### X (Twitter)
- Payments professionals active; hashtags: #payments, #fintech, #merchantservices, #ISO
- Industry thought leaders post regularly

### Other
- **Processor partner portals** sometimes have community features (behind login walls)
- **Portfolio brokerage sites** (PortfoliosBuy.com etc.) have forums/listings where agents discuss valuations

---

## 5. Key Takeaways for ISOCRM Build

### Product Strategy
1. **Residuals are THE killer feature** — nail multi-processor residual import, calculation, and agent payout and you win customers
2. **Price in the gap** — $99-499/mo range between Pulse ($19) and IRIS ($1,799)
3. **Processor integrations matter** — start with Fiserv, TSYS, Elavon, Paysafe (the Big 4)
4. **Mobile-first** — existing tools have weak mobile; this is a differentiator
5. **Modern UI** — competitors are stuck in 2015-era interfaces; your Next.js app will stand out
6. **Pricing schedule management** — buy rates, sell rates, interchange-plus modeling is poorly served (everyone uses spreadsheets)
7. **Multi-level agent hierarchies** — support complex commission structures that simple tools can't handle

### Go-to-Market
1. **CCSalesPro/Merchant Sales Podcast** — the #1 channel to reach ISO agents (40K+ audience)
2. **The Green Sheet** — advertising/content here reaches the entire industry
3. **ETA TRANSACT** — booth/sponsorship reaches decision-makers
4. **Facebook Groups** — organic community engagement with working agents
5. **Regional acquirer conferences** (SEAA, MWAA, WSAA) — more intimate, agent-focused
6. **LinkedIn** — professional networking with ISO owners/managers

### Competitive Moats to Build
1. **Data portability** — make it easy to import AND export; reduce lock-in fear
2. **Community** — the ISO agent community is fragmented; build community features into product
3. **AI-powered insights** — predictive analytics, merchant health scoring, attrition alerts
4. **Workflow automation** — "if-this-then-that" rules for merchant events
5. **Speed of processor integration** — be faster than IRIS's reported 2-year turnaround

---

*Research compiled March 2026. Sources include web searches, G2/TrustRadius/Capterra reviews, industry publications, and background agent research.*
