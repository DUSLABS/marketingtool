import { LegalPage, OPERATOR } from "@/components/app/legal-page";

export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="2026-09-22">
      <p>
        This tool is provided by {OPERATOR.name} for internal use by its team. Access is by invitation only.
      </p>
      <h2>Use of TikTok</h2>
      <p>
        Content published through this tool must comply with TikTok&apos;s Terms of Service, Community Guidelines
        and Music Usage Confirmation. Users are responsible for the content they publish and for holding the rights
        to all images used.
      </p>
      <h2>Availability</h2>
      <p>The tool is provided as is, without guarantees of availability.</p>
      <h2>Contact</h2>
      <p>{OPERATOR.email}</p>
    </LegalPage>
  );
}
