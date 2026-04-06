export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white text-gray-900 px-6 py-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: April 2026</p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">1. Introduction</h2>
        <p className="text-gray-700 leading-relaxed">
          Financial Friend ("we", "our", or "us") operates the website financialfriend.in. This Privacy Policy explains how we collect, use, and protect your personal information when you use our service.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">2. Information We Collect</h2>
        <p className="text-gray-700 leading-relaxed mb-2">We collect the following types of information:</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li><strong>Account information:</strong> Name, email address, and password when you register.</li>
          <li><strong>Financial data:</strong> Consolidated Account Statements (CAS) and mutual fund portfolio data that you upload or that we retrieve from your Gmail with your explicit consent.</li>
          <li><strong>Gmail access:</strong> If you connect your Gmail account, we access only emails from known CAS senders (CAMS, KFintech, MF Central, NSDL, CDSL) to automatically retrieve your CAS PDFs. We do not read, store, or share any other emails.</li>
          <li><strong>Usage data:</strong> Log data including pages visited, features used, and timestamps.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">3. How We Use Your Information</h2>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>To provide and improve our portfolio analysis service.</li>
          <li>To automatically import and analyse your CAS documents from Gmail (only with your explicit consent).</li>
          <li>To generate financial reports and insights personalised to your portfolio.</li>
          <li>To communicate with you about your account or service updates.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">4. Gmail Data Usage</h2>
        <p className="text-gray-700 leading-relaxed">
          Financial Friend's use of information received from Google APIs adheres to the{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements. We access Gmail solely to retrieve CAS PDF attachments from authorised financial senders. We do not use Gmail data for advertising or share it with third parties.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">5. Data Storage and Security</h2>
        <p className="text-gray-700 leading-relaxed">
          Your data is stored securely in our database. We use industry-standard security measures including encrypted connections (HTTPS) and secure credential storage. We do not sell your personal or financial data to third parties.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">6. Data Retention</h2>
        <p className="text-gray-700 leading-relaxed">
          We retain your data for as long as your account is active. You may request deletion of your account and all associated data at any time by contacting us.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">7. Your Rights</h2>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>Access the personal data we hold about you.</li>
          <li>Request correction or deletion of your data.</li>
          <li>Disconnect your Gmail account at any time from within the app.</li>
          <li>Withdraw consent for Gmail access at any time.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">8. Contact Us</h2>
        <p className="text-gray-700 leading-relaxed">
          If you have any questions about this Privacy Policy, please contact us at:{" "}
          <a href="mailto:support@financialfriend.in" className="text-blue-600 underline">
            support@financialfriend.in
          </a>
        </p>
      </section>
    </div>
  );
}
