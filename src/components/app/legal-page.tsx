import type { ReactNode } from "react";

export const OPERATOR = {
  name: "Florian Nowak & Maximilian Förster GbR",
  brand: "DUSLABS",
  partners: ["Florian Nowak", "Maximilian Förster"],
  street: "Walter-Eucken-Straße 105",
  city: "40235 Düsseldorf",
  country: "Germany",
  email: "hello@duslabs.de",
  phone: "+49 17238192040",
};

export const OPERATOR_ADDRESS = `${OPERATOR.street}, ${OPERATOR.city}, ${OPERATOR.country}`;

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Last updated: {updated}</p>
      <div className="mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground [&_h2]:pt-4 [&_h2]:text-base [&_h2]:font-medium [&_h2]:text-foreground">
        {children}
      </div>
    </main>
  );
}
