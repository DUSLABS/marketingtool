import { LegalPage, OPERATOR, OPERATOR_ADDRESS } from "@/components/app/legal-page";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="2026-09-22">
      <h2>1. Controller</h2>
      <p>
        {OPERATOR.name} ({OPERATOR.brand}), {OPERATOR_ADDRESS}. Email: {OPERATOR.email}, phone: {OPERATOR.phone}.
      </p>
      <p>
        Slides Autopilot is an internal tool. It is used by invited members of our team to create photo slideshow
        posts for our own apps and to publish them to TikTok accounts owned by us.
      </p>

      <h2>2. Visiting this website</h2>
      <p>
        When you open this website, our hosting provider automatically processes technical data such as your IP
        address, date and time of the request, the requested page and your browser&apos;s user agent. This is
        necessary to deliver the website and keep it secure (Art. 6(1)(f) GDPR). These logs are kept only for a
        short period. We do not use tracking or advertising cookies.
      </p>

      <h2>3. Team accounts</h2>
      <p>
        For invited team members we store email address, a hashed password and a session cookie that keeps you
        signed in. The session cookie is strictly necessary for the service. Legal basis: Art. 6(1)(b) and (f) GDPR.
      </p>

      <h2>4. TikTok accounts</h2>
      <p>
        When a team member connects a TikTok account through TikTok Login Kit, we receive the account&apos;s basic
        profile information (open ID, username, display name, avatar) and OAuth access and refresh tokens. We use them
        only to publish content created in this tool to that account, to show the status of those posts and, where
        enabled, to read statistics of those posts (views, likes, comments, shares). We do not access other content,
        messages or followers, and we never sell or share this data. Tokens are deleted when the account is
        disconnected; access can also be revoked at any time in the TikTok app settings. Legal basis: Art. 6(1)(b)
        and (f) GDPR.
      </p>

      <h2>5. Content</h2>
      <p>
        Images, texts and generated posts created in the tool are stored so they can be published and reused. Text
        may be generated with the help of an AI service; only campaign instructions and product descriptions are sent
        to it, no personal data of TikTok users.
      </p>

      <h2>6. Service providers</h2>
      <p>We use the following processors, bound by data processing agreements where required:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>Vercel Inc. (hosting)</li>
        <li>Supabase Inc. (database, authentication, file storage; EU region)</li>
        <li>Cloudflare Inc. (DNS)</li>
        <li>Anthropic PBC (AI text generation)</li>
        <li>TikTok (publishing, as the platform the content is published to)</li>
      </ul>
      <p>
        Some of these providers are based in the USA. Transfers rely on the EU-U.S. Data Privacy Framework or on
        standard contractual clauses.
      </p>

      <h2>7. Retention</h2>
      <p>
        We keep data only as long as it is needed for the purposes above or as required by law, and delete it on
        request.
      </p>

      <h2>8. Your rights</h2>
      <p>
        You have the right to access, rectification, erasure, restriction of processing, data portability and to
        object to processing (Art. 15–21 GDPR). Contact us at {OPERATOR.email}. You also have the right to lodge a
        complaint with a supervisory authority, for example the Landesbeauftragte für Datenschutz und
        Informationsfreiheit Nordrhein-Westfalen.
      </p>
    </LegalPage>
  );
}
