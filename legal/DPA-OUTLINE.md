# Splits CRM — Data Processing Agreement (DRAFT OUTLINE)

**Effective Date:** [DATE]
**Last Updated:** [DATE]

> DISCLAIMER: This is a draft outline for attorney review. It is NOT legal advice
> and should NOT be published without review by a qualified attorney.

---

## 1. Scope and Roles

- **Data Controller:** Customer (the ISO)
- **Data Processor:** Splits CRM
- This DPA supplements the Terms of Service and Privacy Policy
- Applies to all Customer Data containing personal information processed by Splits CRM on behalf of Customer

## 2. Definitions

- **Personal Data** — Any information relating to an identified or identifiable person (merchants, agents, partners)
- **Sensitive Personal Data** — SSNs, dates of birth, financial account information
- **Processing** — Any operation performed on Personal Data (collection, storage, use, disclosure, deletion)
- **Subprocessor** — Third party engaged by Splits CRM to process Personal Data
- **Data Breach** — Unauthorized access, acquisition, or disclosure of Personal Data

## 3. Processing Purpose and Scope

### Data Categories Processed:

| Category | Data Elements | Sensitivity |
|---|---|---|
| Merchant PII | Names, addresses, phone, email, DOB, **SSN** | **High** |
| Business Data | MIDs, processing volumes, revenue, fees | Medium |
| Agent/Partner Data | Names, contact info, split structures, payouts | Medium |
| Documents | Applications, contracts, residual files | High |

### Processing Purposes (limited to):
- Providing the CRM and residual management Service
- AI-powered data extraction and normalization
- Generating reports and calculations as directed by Customer
- Maintaining security and integrity of the Service

### Splits CRM shall NOT:
- Process Personal Data for any purpose other than providing the Service
- Sell Personal Data
- Combine Customer's Personal Data with data from other customers
- Retain Personal Data longer than necessary to provide the Service

## 4. Customer Obligations

- Ensure lawful basis for collection and sharing of Personal Data with Splits CRM
- Obtain necessary consents from data subjects (merchants, agents) before uploading their data
- Comply with applicable privacy laws (CCPA, GLBA, state SSN laws)
- Promptly notify Splits CRM of any data subject requests that require our assistance
- Ensure accuracy of data uploaded to the Service

## 5. Security Measures

### Technical Measures:
- AES-256 encryption at rest (via Supabase)
- TLS 1.2+ encryption in transit
- Row-level security (RLS) — strict data isolation between customers
- Role-based access controls (RBAC)
- Session timeout with inactivity detection
- Rate limiting on all API endpoints
- Security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
- Input validation and sanitization

### SSN-Specific Protections:
- Encrypted storage in dedicated columns
- Masked display in UI (only last 4 digits shown)
- Access logging for all SSN reads
- [FUTURE: Field-level encryption separate from database encryption]

### Organizational Measures:
- Access limited to personnel with business need
- [FUTURE: Employee security training]
- [FUTURE: Background checks for personnel with data access]
- [FUTURE: SOC 2 Type II audit]

## 6. Subprocessors

### Current Subprocessors:

| Subprocessor | Purpose | Location | Data Shared |
|---|---|---|---|
| **Supabase** | Database, authentication, file storage | US (AWS) | All Customer Data |
| **Vercel** | Application hosting | US (AWS/Edge) | Request/usage data |
| **Anthropic** | AI features (Claude API) | US | Document contents, data samples for extraction/mapping |
| **Google** | OAuth authentication | US | Email, name |

### Subprocessor Management:
- Splits CRM will maintain an up-to-date list of subprocessors at [URL or in-app]
- Customer will be notified at least [30] days before adding a new subprocessor
- Customer may object to a new subprocessor within [15] days of notification
- If objection cannot be resolved, Customer may terminate the affected Service
- Splits CRM ensures all subprocessors are bound by data protection obligations no less protective than this DPA

## 7. Data Breach Notification

- Splits CRM will notify Customer of a confirmed Data Breach within **72 hours** of becoming aware
- Notification will include:
  - Nature of the breach
  - Categories and approximate number of records affected
  - Likely consequences
  - Measures taken or proposed to mitigate
- Splits CRM will cooperate with Customer's breach response and notification obligations
- Splits CRM will maintain an incident response plan
- [ATTORNEY: Review state-specific breach notification timelines — some states require faster notification]

## 8. Data Subject Rights

- Splits CRM will assist Customer in responding to data subject requests (access, deletion, correction, portability)
- Splits CRM will respond to Customer's instructions within [10] business days
- If a data subject contacts Splits CRM directly, we will redirect them to the Customer
- Technical capabilities for fulfilling requests:
  - Data export in CSV/JSON format
  - Targeted deletion of specific records
  - Correction of data fields via API or UI

## 9. Data Retention and Deletion

- Customer Data is retained for the duration of the subscription
- Upon termination:
  - Customer may export data for [30] days
  - After export period, all Customer Data will be deleted from production systems within [30] days
  - Backup copies will be purged within [90] days of termination
  - SSNs will be purged on the same schedule as other Customer Data
- Splits CRM will provide written confirmation of deletion upon Customer request

## 10. Audit Rights

- Customer may audit Splits CRM's compliance with this DPA once per [12-month] period
- Audits require [30] days advance written notice
- Splits CRM may satisfy audit requests by providing:
  - SOC 2 Type II report (when available)
  - Completed security questionnaire
  - Evidence of security measures and controls
- On-site audits (if necessary) shall be at Customer's expense, during business hours, and subject to confidentiality obligations
- [ATTORNEY: At early stage, questionnaire-based audits are standard. Add SOC 2 commitment with timeline.]

## 11. Cross-Border Data Transfers

- All primary data processing occurs in the United States
- Subprocessors may process data in regions where their infrastructure is located
- If data is transferred outside the US, Splits CRM will ensure appropriate safeguards are in place
- [ATTORNEY: If any subprocessor processes data outside the US, document transfer mechanisms]

## 12. CCPA-Specific Provisions

- Splits CRM is a "Service Provider" as defined by CCPA/CPRA
- We process Personal Information only on behalf of and under the instructions of Customer
- We do not sell or share Personal Information
- We do not retain, use, or disclose Personal Information for any purpose other than providing the Service
- We will comply with CCPA requirements applicable to Service Providers
- We certify that we understand and will comply with CCPA restrictions on Personal Information

## 13. Term and Termination

- This DPA is effective for the duration of the Service agreement
- Data processing obligations survive until all Customer Data is deleted
- DPA cannot be terminated independently from the main Service agreement
- Confidentiality and security obligations survive indefinitely for SSN data

## 14. Liability

- Liability under this DPA is subject to the limitations in the Terms of Service
- [ATTORNEY: Consider whether DPA breaches involving SSNs should have a higher liability cap]

## 15. Contact

- **Data Protection Contact:** [NAME/TITLE]
- **Email:** privacy@splitscrm.com
- **Address:** [COMPANY ADDRESS]

---

## ATTORNEY REVIEW NOTES

1. **GLBA Compliance:** If ISOs are GLBA-covered entities, this DPA may need to incorporate GLBA Safeguards Rule requirements explicitly. Consider a GLBA addendum.
2. **SSN Liability Cap:** Standard limitation of liability may be insufficient for SSN breaches. Consider a separate, higher cap for security incidents involving SSNs.
3. **Anthropic as Subprocessor:** Review Anthropic's current DPA/API terms to ensure our obligations flow down. Anthropic retains API inputs for 30 days — ensure this is acceptable under our DPA commitments.
4. **Supabase DPA:** Confirm Supabase's DPA adequately covers SSN-level sensitive data. Verify their encryption and access control commitments.
5. **Breach Notification Timeline:** 72 hours is GDPR-standard. Some US state laws require notification "without unreasonable delay" or within specific windows (e.g., 60 days in some states). Align with the strictest applicable standard.
6. **SOC 2 Timeline:** Consider committing to a SOC 2 Type II audit timeline (e.g., within 18 months). Enterprise ISO customers will ask for this.
7. **Cyber Insurance:** Consider requiring minimum cyber insurance coverage and disclosing coverage to customers.
8. **PCI DSS:** While we don't store card numbers, confirm that no processing volume data or transaction data triggers any PCI obligations.
