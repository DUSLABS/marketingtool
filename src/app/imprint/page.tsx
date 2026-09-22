import { LegalPage, OPERATOR } from "@/components/app/legal-page";

export const metadata = { title: "Impressum" };

export default function ImprintPage() {
  return (
    <LegalPage title="Impressum" updated="2026-09-22">
      <h2>Angaben gemäß § 5 DDG</h2>
      <p>
        {OPERATOR.name}
        <br />
        {OPERATOR.street}
        <br />
        {OPERATOR.city}
        <br />
        Deutschland
      </p>
      <h2>Vertreten durch die Gesellschafter</h2>
      <p>{OPERATOR.partners.join(", ")}</p>
      <h2>Kontakt</h2>
      <p>
        E-Mail: <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>
        <br />
        Telefon: {OPERATOR.phone}
      </p>
      <h2>Verbraucherstreitbeilegung</h2>
      <p>
        Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle teilzunehmen.
      </p>
    </LegalPage>
  );
}
