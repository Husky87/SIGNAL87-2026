import React from 'react';

export const PrivacyPolicy: React.FC = () => {
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '60px 20px', background: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ background: 'white', padding: '40px' }}>
        <header style={{ marginBottom: '40px', borderBottom: '2px solid #0891b2', paddingBottom: '20px' }}>
          <h1 style={{ fontSize: '2.5rem', color: '#0f172a', marginBottom: '10px' }}>Privacy Policy</h1>
          <p style={{ fontSize: '0.95rem', color: '#64748b' }}>Last updated: August 12, 2026</p>
        </header>

        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '1.5rem', color: '#0f172a', marginBottom: '15px' }}>Introduction</h2>
          <p style={{ marginBottom: '15px', color: '#475569' }}>Signal87 ("we," "us," "our," or "Company") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform, including our website and mobile applications (the "Service").</p>
          <p style={{ color: '#475569' }}>Please read this Privacy Policy carefully. If you do not agree with our policies and practices, please do not use our Service.</p>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '1.5rem', color: '#0f172a', marginBottom: '15px' }}>1. Information We Collect</h2>

          <h3 style={{ fontSize: '1.1rem', color: '#1e293b', marginTop: '25px', marginBottom: '10px' }}>1.1 Information You Provide Directly</h3>
          <ul style={{ marginLeft: '20px', marginBottom: '15px', color: '#475569' }}>
            <li style={{ marginBottom: '8px' }}><strong>Account Registration:</strong> Email address, name, password, and profile information</li>
            <li style={{ marginBottom: '8px' }}><strong>Documents:</strong> Files you upload to analyze, including PDFs, Word documents, spreadsheets, and other supported formats</li>
            <li style={{ marginBottom: '8px' }}><strong>Usage Data:</strong> Chat history, queries, saved reports, and analysis results</li>
            <li style={{ marginBottom: '8px' }}><strong>Communication:</strong> Messages, feedback, and support requests</li>
          </ul>

          <h3 style={{ fontSize: '1.1rem', color: '#1e293b', marginTop: '25px', marginBottom: '10px' }}>1.2 Information Collected Automatically</h3>
          <ul style={{ marginLeft: '20px', marginBottom: '15px', color: '#475569' }}>
            <li style={{ marginBottom: '8px' }}><strong>Device Information:</strong> Browser type, IP address, operating system, and device identifiers</li>
            <li style={{ marginBottom: '8px' }}><strong>Usage Analytics:</strong> Pages visited, time spent, features used, and interaction patterns</li>
            <li style={{ marginBottom: '8px' }}><strong>Cookies and Tracking:</strong> We use cookies and similar technologies to enhance your experience</li>
          </ul>

          <h3 style={{ fontSize: '1.1rem', color: '#1e293b', marginTop: '25px', marginBottom: '10px' }}>1.3 Information from Third Parties</h3>
          <ul style={{ marginLeft: '20px', marginBottom: '15px', color: '#475569' }}>
            <li style={{ marginBottom: '8px' }}><strong>Google OAuth:</strong> When you sign in with Google, we receive your email, name, and profile picture from Google</li>
            <li style={{ marginBottom: '8px' }}><strong>Firebase Authentication:</strong> Account data processed through Google's Firebase platform</li>
          </ul>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '1.5rem', color: '#0f172a', marginBottom: '15px' }}>2. How We Use Your Information</h2>
          <p style={{ marginBottom: '15px', color: '#475569' }}>We use the collected information for:</p>
          <ul style={{ marginLeft: '20px', marginBottom: '15px', color: '#475569' }}>
            <li style={{ marginBottom: '8px' }}>Providing and maintaining the Service</li>
            <li style={{ marginBottom: '8px' }}>Processing and analyzing documents you upload</li>
            <li style={{ marginBottom: '8px' }}>Generating AI-powered insights and analysis</li>
            <li style={{ marginBottom: '8px' }}>Authenticating your account and securing your data</li>
            <li style={{ marginBottom: '8px' }}>Communicating with you about updates, support, and policy changes</li>
            <li style={{ marginBottom: '8px' }}>Improving and optimizing the Service</li>
            <li style={{ marginBottom: '8px' }}>Complying with legal obligations</li>
            <li style={{ marginBottom: '8px' }}>Detecting and preventing fraud or security issues</li>
          </ul>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '1.5rem', color: '#0f172a', marginBottom: '15px' }}>3. AI Processing and Analysis</h2>
          <p style={{ marginBottom: '15px', color: '#475569' }}>Signal87 uses advanced AI models (including Google Gemini and OpenAI GPT) to analyze your documents and provide insights. When you submit documents for analysis:</p>
          <ul style={{ marginLeft: '20px', marginBottom: '15px', color: '#475569' }}>
            <li style={{ marginBottom: '8px' }}>Your document content is temporarily processed by AI providers</li>
            <li style={{ marginBottom: '8px' }}>We do not permanently store your documents with third-party AI providers</li>
            <li style={{ marginBottom: '8px' }}>AI responses are processed according to each provider's terms</li>
            <li style={{ marginBottom: '8px' }}>You maintain full ownership of your documents and analysis results</li>
          </ul>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '1.5rem', color: '#0f172a', marginBottom: '15px' }}>4. Data Storage and Security</h2>
          <p style={{ marginBottom: '15px', color: '#475569' }}>Your data is stored securely using:</p>
          <ul style={{ marginLeft: '20px', marginBottom: '15px', color: '#475569' }}>
            <li style={{ marginBottom: '8px' }}><strong>Google Firebase:</strong> Your documents and analysis history are stored in Google's secure cloud infrastructure</li>
            <li style={{ marginBottom: '8px' }}><strong>Encryption:</strong> Data in transit and at rest is encrypted using industry-standard protocols</li>
            <li style={{ marginBottom: '8px' }}><strong>Access Controls:</strong> Only you can access your documents and data (unless you explicitly share)</li>
          </ul>
          <p style={{ color: '#475569' }}>While we implement comprehensive security measures, no system is 100% secure. We cannot guarantee absolute security of your information.</p>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '1.5rem', color: '#0f172a', marginBottom: '15px' }}>5. Sharing Your Information</h2>
          <p style={{ marginBottom: '15px', color: '#475569' }}>We do NOT sell, trade, or rent your personal information. We may share information:</p>
          <ul style={{ marginLeft: '20px', marginBottom: '15px', color: '#475569' }}>
            <li style={{ marginBottom: '8px' }}><strong>With Service Providers:</strong> Google, Firebase, AI providers, and hosting services that help us operate the platform</li>
            <li style={{ marginBottom: '8px' }}><strong>Legal Compliance:</strong> When required by law, court order, or government request</li>
            <li style={{ marginBottom: '8px' }}><strong>Business Transfers:</strong> In the event of merger, acquisition, or asset sale</li>
            <li style={{ marginBottom: '8px' }}><strong>With Your Consent:</strong> When you explicitly authorize us to share your information</li>
          </ul>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '1.5rem', color: '#0f172a', marginBottom: '15px' }}>6. Your Rights and Choices</h2>
          <p style={{ marginBottom: '15px', color: '#475569' }}>Depending on your location, you may have the right to:</p>
          <ul style={{ marginLeft: '20px', marginBottom: '15px', color: '#475569' }}>
            <li style={{ marginBottom: '8px' }}><strong>Access:</strong> Request a copy of your personal data</li>
            <li style={{ marginBottom: '8px' }}><strong>Correction:</strong> Update or correct your information</li>
            <li style={{ marginBottom: '8px' }}><strong>Deletion:</strong> Request deletion of your account and associated data</li>
            <li style={{ marginBottom: '8px' }}><strong>Portability:</strong> Receive your data in a portable format</li>
            <li style={{ marginBottom: '8px' }}><strong>Opt-Out:</strong> Unsubscribe from marketing communications</li>
          </ul>
          <p style={{ color: '#475569' }}>To exercise these rights, contact us at the address below.</p>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '1.5rem', color: '#0f172a', marginBottom: '15px' }}>7. Contact Us</h2>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '20px', borderRadius: '8px', marginTop: '20px' }}>
            <p style={{ marginBottom: '8px', color: '#475569' }}><strong>Signal87</strong></p>
            <p style={{ marginBottom: '8px', color: '#475569' }}>Email: <a href="mailto:privacy@signal87.ai" style={{ color: '#0891b2', textDecoration: 'none' }}>privacy@signal87.ai</a></p>
            <p style={{ marginBottom: '8px', color: '#475569' }}>Email: <a href="mailto:ceo@signal87.ai" style={{ color: '#0891b2', textDecoration: 'none' }}>ceo@signal87.ai</a></p>
            <p style={{ color: '#475569' }}>We will respond to your inquiry within 30 days.</p>
          </div>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '1.5rem', color: '#0f172a', marginBottom: '15px' }}>8. California Privacy Rights (CCPA)</h2>
          <p style={{ marginBottom: '15px', color: '#475569' }}>If you are a California resident, you have specific rights under the California Consumer Privacy Act:</p>
          <ul style={{ marginLeft: '20px', marginBottom: '15px', color: '#475569' }}>
            <li style={{ marginBottom: '8px' }}>Right to know what personal information is collected, used, and shared</li>
            <li style={{ marginBottom: '8px' }}>Right to delete personal information</li>
            <li style={{ marginBottom: '8px' }}>Right to opt-out of the sale or sharing of personal information</li>
            <li style={{ marginBottom: '8px' }}>Right to non-discrimination for exercising your rights</li>
          </ul>
          <p style={{ color: '#475569' }}>Contact us to exercise these rights.</p>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '1.5rem', color: '#0f172a', marginBottom: '15px' }}>9. EU General Data Protection Regulation (GDPR)</h2>
          <p style={{ marginBottom: '15px', color: '#475569' }}>If you are located in the EU, UK, or EEA, you have rights under GDPR including the right to access, rectify, erase, and port your data. We process your information based on:</p>
          <ul style={{ marginLeft: '20px', marginBottom: '15px', color: '#475569' }}>
            <li style={{ marginBottom: '8px' }}>Your consent (for account creation and AI analysis)</li>
            <li style={{ marginBottom: '8px' }}>Legitimate interests (for security and service improvement)</li>
            <li style={{ marginBottom: '8px' }}>Legal obligation (for compliance)</li>
          </ul>
          <p style={{ color: '#475569' }}>Contact us for any GDPR-related requests.</p>
        </section>
      </div>
    </div>
  );
};
