import type { ReactNode } from "react";

// TODO(legal): fill in the operator's legal name, address and contact email before submitting the TikTok app.
export const OPERATOR = { name: "[Company name]", address: "[Address]", email: "[contact@yourdomain.com]" };

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
