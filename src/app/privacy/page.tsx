import { LegalPage, OPERATOR } from "@/components/app/legal-page";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="2026-09-22">
      <p>
        This tool is operated by {OPERATOR.name}, {OPERATOR.address}, and is used internally to create and
        publish slideshow posts to TikTok accounts owned by {OPERATOR.name}.
      </p>
      <h2>Data we process</h2>
      <p>
        When a TikTok account is connected, we receive the account&apos;s basic profile information (open ID,
        username, display name, avatar) and OAuth access tokens. Once analytics are enabled, we also read public
        statistics for posts published through the tool (views, likes, comments, shares).
      </p>
      <h2>Purpose</h2>
      <p>
        This data is used solely to publish content the account owner created in the tool, to show the status of
        those posts and to report their performance. It is not sold or shared with third parties.
      </p>
      <h2>Storage and retention</h2>
      <p>
        Data is stored with our hosting providers (Supabase, Vercel) in the EU where available. Tokens are deleted
        when an account is disconnected; all other data is deleted on request.
      </p>
      <h2>Your rights</h2>
      <p>
        You can request access to, correction or deletion of your data, or disconnect your account at any time, by
        contacting {OPERATOR.email}.
      </p>
    </LegalPage>
  );
}
