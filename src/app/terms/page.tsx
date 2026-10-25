import { LegalPage, OPERATOR } from "@/components/app/legal-page";

// Linked nowhere in the tool: only the URL registered in the TikTok developer app points here.
export const metadata = { title: "Terms of Service", robots: { index: false, follow: false } };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="2026-09-22">
      <h2>1. Provider</h2>
      <p>
        Slides Autopilot is operated by our team for its own use. Contact details are in section 6.
      </p>
      <h2>2. Scope</h2>
      <p>
        The tool is for internal use by our team only. Access is by invitation; there is no public sign-up and no
        paid offering.
      </p>
      <h2>3. Use of TikTok</h2>
      <p>
        Content published through this tool must comply with TikTok&apos;s Terms of Service, Community Guidelines and
        Music Usage Confirmation. Users are responsible for the content they publish and for holding the rights to all
        images used. Connected TikTok accounts can be disconnected at any time.
      </p>
      <h2>4. Availability and liability</h2>
      <p>
        The tool is provided without guarantees of availability. We are liable without limitation for intent and gross
        negligence; otherwise liability is excluded to the extent permitted by law.
      </p>
      <h2>5. Law</h2>
      <p>German law applies.</p>
      <h2>6. Contact</h2>
      <p>{OPERATOR.email}</p>
    </LegalPage>
  );
}
