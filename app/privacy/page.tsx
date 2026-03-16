import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy — Splits CRM',
  description: 'Privacy Policy for Splits CRM, a B2B SaaS platform for Independent Sales Organizations in the payments industry.',
}

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <Link href="/" className="text-emerald-600 hover:text-emerald-700 text-sm font-medium inline-flex items-center gap-1 mb-8">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Back to home
        </Link>

        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
        <p className="text-slate-500 text-sm mb-10">Last updated: March 16, 2026</p>

        {/* 1. Introduction */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-slate-900 mb-3">1. Introduction</h2>
          <p className="text-slate-600 leading-relaxed">
            Splits CRM (&ldquo;Splits,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) operates the website and platform located at splitscrm.com. This Privacy Policy applies to all users of our business-to-business software-as-a-service platform. We provide customer relationship management and residual management tools designed specifically for Independent Sales Organizations (ISOs) in the payments industry. By accessing or using our Service, you acknowledge that you have read, understood, and agree to be bound by this Privacy Policy. If you do not agree with the terms of this Privacy Policy, please do not access or use the Service.
          </p>
        </section>

        {/* 2. Information We Collect */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-slate-900 mb-3">2. Information We Collect</h2>

          <h3 className="text-lg font-medium text-slate-800 mt-5 mb-2">2.1 Account Information</h3>
          <p className="text-slate-600 leading-relaxed">
            When you create an account, we collect information that you provide directly to us, including your full name, email address, phone number, and company or organization name. If you sign in using Google OAuth, we receive your name, email address, and profile picture from Google.
          </p>

          <h3 className="text-lg font-medium text-slate-800 mt-5 mb-2">2.2 Customer Business Data</h3>
          <p className="text-slate-600 leading-relaxed">
            In the course of using our Service, you and your organization may upload or enter business data including merchant business information (names, addresses, and Merchant IDs), Social Security Numbers (SSNs) which are encrypted at rest and in transit, dates of birth, processing volumes and transaction data, residual revenue and commission data, partner and agent information including split structures, and uploaded documents such as applications, contracts, and residual files. You are solely responsible for the data you upload to the Service and for ensuring that you have the legal authority to do so.
          </p>

          <h3 className="text-lg font-medium text-slate-800 mt-5 mb-2">2.3 Automatically Collected Information</h3>
          <p className="text-slate-600 leading-relaxed">
            When you access our Service, we automatically collect certain technical information including your IP address, browser type and version, device information, and usage data such as pages visited, features used, and timestamps. We also use cookies and similar technologies as described in Section 8 of this policy.
          </p>

          <h3 className="text-lg font-medium text-slate-800 mt-5 mb-2">2.4 Information from Third Parties</h3>
          <p className="text-slate-600 leading-relaxed">
            We receive limited information from Google when you authenticate via Google OAuth, including your name, email address, and profile picture. We do not purchase or otherwise obtain personal information from data brokers or other third-party sources.
          </p>
        </section>

        {/* 3. How We Use Your Information */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-slate-900 mb-3">3. How We Use Your Information</h2>
          <p className="text-slate-600 leading-relaxed">
            We use the information we collect to provide and maintain the Service, authenticate users via Google OAuth, process and normalize residual data across payment processors, power AI features including PDF data extraction, column mapping, and data normalization, and send service-related communications such as account alerts and billing notices. We also use information to improve and develop new features, comply with legal obligations, and detect and prevent fraud or abuse of the Service.
          </p>
        </section>

        {/* 4. How We Share Your Information */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-slate-900 mb-3">4. How We Share Your Information</h2>
          <p className="text-slate-600 leading-relaxed mb-4">
            We share your information only with the following third-party service providers, each of which is necessary to operate the Service:
          </p>
          <ul className="list-disc list-inside text-slate-600 leading-relaxed space-y-2 mb-4">
            <li><span className="font-medium">Supabase</span> provides our database, authentication, and file storage infrastructure. All customer data is stored and processed through Supabase.</li>
            <li><span className="font-medium">Vercel</span> provides application hosting and content delivery. Usage and request data is processed through Vercel.</li>
            <li><span className="font-medium">Anthropic</span> provides AI capabilities through the Claude API. Document contents, column headers, and sample data rows are sent to Anthropic to power our AI features such as PDF extraction and column mapping.</li>
            <li><span className="font-medium">Google</span> provides OAuth authentication. Your email address and name are shared with Google during the authentication process.</li>
          </ul>
          <p className="text-slate-600 leading-relaxed mb-4">
            We do not sell personal information to any party. We do not share data with advertisers. We do not use data for cross-context behavioral advertising. We do not share Social Security Numbers with any party except as required by law.
          </p>
          <p className="text-slate-600 leading-relaxed">
            We may also disclose your information if required to do so by law or in response to valid legal process such as a subpoena or court order, to protect the rights, safety, or property of Splits CRM, our users, or the public, or in connection with a merger, acquisition, or sale of assets, in which case we will provide notice to affected users.
          </p>
        </section>

        {/* 5. Social Security Numbers */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-slate-900 mb-3">5. Social Security Numbers</h2>
          <p className="text-slate-600 leading-relaxed">
            We understand the sensitive nature of Social Security Numbers and take special precautions to protect them. SSNs are collected solely for the purpose of merchant application processing and compliance, as uploaded by our ISO customers. All SSNs are encrypted at rest using AES-256 encryption and encrypted in transit using TLS 1.2 or higher. Access to SSNs is restricted to authorized personnel on a strict need-to-know basis. SSNs are never displayed in full within the user interface; only masked or truncated versions are shown. SSNs are never used for marketing, advertising, or any purpose unrelated to the Service. We comply with all applicable state Social Security Number protection laws.
          </p>
        </section>

        {/* 6. Data Security */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-slate-900 mb-3">6. Data Security</h2>
          <p className="text-slate-600 leading-relaxed">
            We implement industry-standard security measures to protect your data. These measures include encryption at rest using AES-256 via Supabase, encryption in transit using TLS 1.2 or higher, row-level security in our database ensuring that customers can only access their own data, role-based access controls, session timeout with inactivity detection, rate limiting on API endpoints, and security headers including Content Security Policy, HTTP Strict Transport Security, X-Frame-Options, and X-Content-Type-Options. We conduct regular security assessments of our systems and infrastructure. However, no method of electronic transmission or storage is completely secure, and we cannot guarantee absolute security of your data.
          </p>
        </section>

        {/* 7. Data Retention */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-slate-900 mb-3">7. Data Retention</h2>
          <p className="text-slate-600 leading-relaxed">
            We retain your account data for as long as your account is active and for a period of thirty (30) days following account termination. Customer business data is retained while your account is active and will be deleted or returned upon termination in accordance with our Data Processing Agreement. Backup copies are retained for up to ninety (90) days after deletion from production systems. Usage logs are retained for twelve (12) months. Data sent to Anthropic through our AI features may be retained by Anthropic for up to thirty (30) days for trust and safety purposes in accordance with their API terms, after which it is deleted.
          </p>
        </section>

        {/* 8. Cookies and Tracking Technologies */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-slate-900 mb-3">8. Cookies and Tracking Technologies</h2>
          <p className="text-slate-600 leading-relaxed">
            We use essential cookies for session management and authentication, which are required for the Service to function properly. We do not use advertising cookies or trackers. We do not participate in cross-site tracking or behavioral advertising. If we implement analytics in the future, we will update this policy and provide an opt-out mechanism where required by law.
          </p>
        </section>

        {/* 9. Your Privacy Rights */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-slate-900 mb-3">9. Your Privacy Rights</h2>

          <h3 className="text-lg font-medium text-slate-800 mt-5 mb-2">9.1 All Users</h3>
          <p className="text-slate-600 leading-relaxed">
            All users of our Service have the right to access their personal data, correct inaccurate data, request deletion of their data, export their data in a portable format, and withdraw consent where consent is the legal basis for processing.
          </p>

          <h3 className="text-lg font-medium text-slate-800 mt-5 mb-2">9.2 California Residents</h3>
          <p className="text-slate-600 leading-relaxed">
            If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA) and the California Privacy Rights Act (CPRA). These include the right to know what personal information is collected and why, the right to delete personal information, the right to correct inaccurate personal information, the right to opt out of the sale or sharing of personal information (we do not sell or share personal information), the right to non-discrimination for exercising your privacy rights, and the right to limit use of sensitive personal information including Social Security Numbers. Authorized agents may submit requests on your behalf with proper documentation. To exercise any of these rights, please contact us at support@splitscrm.com.
          </p>

          <h3 className="text-lg font-medium text-slate-800 mt-5 mb-2">9.3 Other State Rights</h3>
          <p className="text-slate-600 leading-relaxed">
            Residents of other states may have additional privacy rights under applicable state laws, including but not limited to the Virginia Consumer Data Protection Act, the Colorado Privacy Act, the Connecticut Data Privacy Act, and the Utah Consumer Privacy Act. We will honor valid requests made under these laws. Please contact us at support@splitscrm.com to exercise your rights.
          </p>
        </section>

        {/* 10. AI Feature Disclosures */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-slate-900 mb-3">10. AI Feature Disclosures</h2>
          <p className="text-slate-600 leading-relaxed">
            We use Anthropic&rsquo;s Claude API to provide AI-powered features within our Service. These features include automated PDF data extraction for merchant applications and residual files, smart column mapping for residual file imports, and data normalization across payment processor formats. When you use these features, document contents, column headers, sample data rows, and related metadata necessary to perform the AI function are sent to Anthropic for processing. Anthropic does not use API inputs to train their models, as specified in Anthropic&rsquo;s API Terms of Service. API inputs may be retained by Anthropic for up to thirty (30) days for trust and safety purposes, after which they are deleted. AI-generated outputs, including extracted data and mapped columns, are provided as suggestions only. Customers are responsible for reviewing and verifying all AI outputs before relying on them for business decisions. Anthropic is listed as a subprocessor in our Data Processing Agreement.
          </p>
        </section>

        {/* 11. Children's Privacy */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-slate-900 mb-3">11. Children&rsquo;s Privacy</h2>
          <p className="text-slate-600 leading-relaxed">
            Our Service is designed exclusively for business use and is not intended for individuals under the age of eighteen (18). We do not knowingly collect personal information from children under the age of thirteen (13). If we become aware that we have collected personal data from a child under 13, we will take steps to delete that information promptly. If you believe a child under 13 has provided us with personal information, please contact us at support@splitscrm.com.
          </p>
        </section>

        {/* 12. International Data Transfers */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-slate-900 mb-3">12. International Data Transfers</h2>
          <p className="text-slate-600 leading-relaxed">
            Our Service is hosted in the United States using infrastructure provided by Vercel and Supabase. We primarily serve US-based Independent Sales Organizations. If you access the Service from outside the United States, please be aware that your data will be transferred to and processed in the United States, where data protection laws may differ from those in your jurisdiction. By using the Service, you consent to the transfer and processing of your data in the United States.
          </p>
        </section>

        {/* 13. Changes to This Privacy Policy */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-slate-900 mb-3">13. Changes to This Privacy Policy</h2>
          <p className="text-slate-600 leading-relaxed">
            We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors. If we make material changes, we will notify you by email and/or through an in-app notification at least thirty (30) days before the changes take effect. Your continued use of the Service after the effective date of a revised Privacy Policy constitutes your acceptance of the updated terms. Prior versions of this policy will be archived and made available upon request.
          </p>
        </section>

        {/* 14. Contact Information */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-slate-900 mb-3">14. Contact Information</h2>
          <p className="text-slate-600 leading-relaxed">
            If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us at <a href="mailto:support@splitscrm.com" className="text-emerald-600 hover:text-emerald-700">support@splitscrm.com</a>.
          </p>
        </section>

        <div className="border-t border-slate-200 pt-8 mt-12">
          <p className="text-slate-400 text-sm text-center">&copy; 2026 Splits CRM. All rights reserved.</p>
        </div>
      </div>
    </main>
  )
}
