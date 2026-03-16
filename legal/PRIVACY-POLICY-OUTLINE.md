# Splits CRM — Privacy Policy (DRAFT OUTLINE)

**Effective Date:** [DATE]
**Last Updated:** [DATE]
**Website:** splitscrm.com

> DISCLAIMER: This is a draft outline for attorney review. It is NOT legal advice
> and should NOT be published without review by a qualified attorney.

---

## 1. Introduction

- Splits CRM ("Splits," "we," "us," "our") operates splitscrm.com
- This policy applies to all users of our B2B SaaS platform
- We provide CRM and residual management tools for Independent Sales Organizations (ISOs) in the payments industry
- By using our Service, you agree to this Privacy Policy

## 2. Information We Collect

### 2a. Account Information (collected directly)
- Full name
- Email address
- Phone number
- Company/organization name
- Google account information (via Google OAuth)

### 2b. Customer Business Data (uploaded by customers)
- Merchant business information (names, addresses, MIDs)
- **Social Security Numbers (SSNs)** — encrypted at rest and in transit
- Dates of birth
- Processing volumes and transaction data
- Residual revenue and commission data
- Partner/agent information and split structures
- Uploaded documents (applications, contracts, residual files)

### 2c. Automatically Collected Information
- IP address
- Browser type and version
- Device information
- Usage data (pages visited, features used, timestamps)
- Cookies and similar technologies (see Section 8)

### 2d. Information from Third Parties
- Google (via OAuth): name, email, profile picture
- No information is purchased from data brokers

## 3. How We Use Your Information

- Provide and maintain the Service
- Authenticate users via Google OAuth
- Process and normalize residual data across payment processors
- AI-powered features: PDF data extraction, column mapping, data normalization
- Send service-related communications (account alerts, billing)
- Improve and develop new features
- Comply with legal obligations
- Detect and prevent fraud or abuse

## 4. How We Share Your Information

### We share data ONLY with:

| Third Party | Purpose | Data Shared |
|---|---|---|
| **Supabase** (database/auth/storage) | Infrastructure — hosting, authentication, file storage | All customer data |
| **Vercel** (hosting) | Application hosting and delivery | Usage/request data |
| **Anthropic** (Claude API) | AI features — PDF extraction, column mapping | Document contents, column headers, sample data rows |
| **Google** (OAuth) | Authentication | Email, name |

### We do NOT:
- Sell personal information
- Share data with advertisers
- Use data for cross-context behavioral advertising
- Share SSNs with any party except as required by law

### We may also disclose data:
- To comply with legal process (subpoena, court order)
- To protect rights, safety, or property
- In connection with a merger, acquisition, or asset sale (with notice)

## 5. Social Security Numbers (SSN-Specific Disclosures)

- SSNs are collected solely for the purpose of merchant application processing and compliance, as uploaded by our ISO customers
- SSNs are encrypted at rest using AES-256 encryption
- SSNs are encrypted in transit using TLS 1.2+
- Access to SSNs is restricted to authorized personnel on a need-to-know basis
- SSNs are never displayed in full in the UI (masked/truncated display only)
- SSNs are never used for marketing, advertising, or any purpose unrelated to the Service
- We comply with all applicable state SSN protection laws
- [ATTORNEY: Review against CA Civil Code §1798.85, TX Bus. & Com. Code §501, and other state-specific SSN laws]

## 6. Data Security

- Encryption at rest (AES-256 via Supabase)
- Encryption in transit (TLS 1.2+)
- Row-level security (RLS) in database — customers can only access their own data
- Role-based access controls
- Session timeout with inactivity detection
- Rate limiting on API endpoints
- Security headers (CSP, HSTS, X-Frame-Options, etc.)
- Regular security assessments
- [FUTURE: SOC 2 Type II certification — reference timeline if available]
- No method of transmission or storage is 100% secure; we cannot guarantee absolute security

## 7. Data Retention

- Account data: retained while account is active + [30/60/90] days after termination
- Customer business data: retained while account is active; deleted or returned upon termination per DPA
- SSNs: [define specific retention period — ATTORNEY TO ADVISE]
- Backups: retained for [X] days after deletion from production
- Usage logs: retained for [12] months
- Anthropic API: inputs retained by Anthropic for up to 30 days for trust & safety per their terms

## 8. Cookies and Tracking Technologies

- Essential cookies: session management, authentication (required)
- Analytics cookies: [specify if using any — e.g., Vercel Analytics]
- We do NOT use advertising cookies or trackers
- We do NOT participate in cross-site tracking
- [If using any analytics: provide opt-out mechanism]

## 9. Your Privacy Rights

### All Users:
- Access your personal data
- Correct inaccurate data
- Request deletion of your data
- Export your data in a portable format
- Withdraw consent (where consent is the legal basis)

### California Residents (CCPA/CPRA):
- Right to know what personal information is collected and why
- Right to delete personal information
- Right to correct inaccurate personal information
- Right to opt out of the sale/sharing of personal information (we do not sell)
- Right to non-discrimination for exercising privacy rights
- Right to limit use of sensitive personal information (SSNs)
- Authorized agents may submit requests on your behalf
- **To exercise rights:** email privacy@splitscrm.com or use [in-app privacy center]

### Other State Rights:
- [ATTORNEY: Review Virginia (VCDPA), Colorado (CPA), Connecticut (CTDPA), Utah (UCPA), and other state laws as applicable]

## 10. AI Feature Disclosures

- We use Anthropic's Claude API to provide AI-powered features including:
  - Automated PDF data extraction (merchant applications, residual files)
  - Smart column mapping for residual file imports
  - Data normalization across payment processor formats
- **What data is sent to Anthropic:** Document contents, column headers, sample data rows, and related metadata necessary to perform the AI function
- **What Anthropic does NOT do:** Anthropic does not use API inputs to train their models (per Anthropic API Terms)
- **Anthropic data retention:** API inputs may be retained by Anthropic for up to 30 days for trust and safety purposes, then deleted
- **Accuracy:** AI-generated outputs (extracted data, mapped columns) are provided as suggestions. Customers are responsible for reviewing and verifying AI outputs before relying on them.
- **Subprocessor:** Anthropic is listed as a subprocessor in our Data Processing Agreement
- [ATTORNEY: Review Anthropic's current API terms and DPA for alignment]

## 11. Children's Privacy

- Our Service is designed for business use and is not intended for individuals under 18
- We do not knowingly collect personal information from children under 13
- If we learn we have collected data from a child under 13, we will delete it promptly

## 12. International Data Transfers

- Our Service is hosted in the United States (Vercel, Supabase infrastructure)
- We primarily serve US-based ISOs
- If you access the Service from outside the US, your data will be transferred to and processed in the US
- [ATTORNEY: If expanding internationally, review GDPR, SCCs, and other transfer mechanisms]

## 13. Changes to This Privacy Policy

- We may update this Privacy Policy from time to time
- Material changes will be communicated via email and/or in-app notification at least [30] days before taking effect
- Continued use after changes constitutes acceptance
- Prior versions will be archived and available upon request

## 14. Contact Information

- **Email:** privacy@splitscrm.com
- **Mailing Address:** [COMPANY ADDRESS]
- **Data Protection Contact:** [NAME/TITLE]

---

## ATTORNEY REVIEW NOTES

1. **GLBA Applicability:** Determine if Splits CRM qualifies as a "service provider" under GLBA Safeguards Rule. If so, additional security requirements and disclosures may apply.
2. **State SSN Laws:** Review compliance with all state-specific SSN protection statutes (30+ states).
3. **CCPA Service Provider Status:** Ensure privacy policy language aligns with CCPA "service provider" requirements since we process data on behalf of ISO businesses.
4. **Anthropic Terms:** Review current Anthropic API Terms of Service and Data Processing Agreement for any updates to data handling, retention, or usage policies.
5. **Supabase DPA:** Confirm Supabase's DPA covers the data categories we store (especially SSNs).
6. **Breach Notification:** Add state-specific breach notification procedures or reference a separate Incident Response Plan.
7. **Insurance:** Consider cyber liability insurance disclosure.
