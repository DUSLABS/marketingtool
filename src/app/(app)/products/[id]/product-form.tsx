"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteProduct, updateProduct, type ProductFormState } from "../actions";

type Product = {
  id: string;
  name: string;
  description: string;
  facts: string;
  voice: string;
  avoid: string;
  app_store_url: string | null;
};

const fields = [
  {
    name: "description",
    label: "What it is",
    hint: "One or two sentences. Used as context for every generated post.",
    placeholder: "e.g. SameRoll is a shared photo roll for events: every guest's photos in one place.",
    rows: 3,
  },
  {
    name: "facts",
    label: "Facts & features",
    hint: "The only product claims the AI may make. One per line. Anything not listed here will not be claimed.",
    placeholder: "e.g.\nGuests join by scanning a QR code, no app download needed\nPhotos appear in the shared roll in real time\nFree for up to 50 guests",
    rows: 6,
  },
  {
    name: "voice",
    label: "Brand voice",
    hint: "How posts should sound.",
    placeholder: "e.g. Emotional, modern, short sentences, slightly playful, never corporate.",
    rows: 2,
  },
  {
    name: "avoid",
    label: "Avoid",
    hint: "Words, claims or styles the AI must not use.",
    placeholder: "e.g. Marketing jargon, invented statistics, \"game-changer\", emojis in slides.",
    rows: 2,
  },
] as const;

export function ProductForm({ product }: { product: Product }) {
  const [state, action, pending] = useActionState<ProductFormState, FormData>(
    updateProduct.bind(null, product.id),
    {},
  );

  useEffect(() => {
    if (state.saved) toast.success("Product saved");
  }, [state]);

  return (
    <form action={action} className="panel max-w-3xl space-y-6 p-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={product.name} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="app_store_url">App Store link</Label>
          <Input
            id="app_store_url"
            name="app_store_url"
            type="url"
            placeholder="https://apps.apple.com/…"
            defaultValue={product.app_store_url ?? ""}
          />
        </div>
      </div>

      {fields.map((f) => (
        <div key={f.name} className="space-y-2">
          <Label htmlFor={f.name}>{f.label}</Label>
          <Textarea id={f.name} name={f.name} rows={f.rows} placeholder={f.placeholder} defaultValue={product[f.name]} />
          <p className="text-xs text-muted-foreground">{f.hint}</p>
        </div>
      ))}

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex items-center justify-between border-t border-border pt-5">
        <Button
          type="button"
          variant="destructive"
          onClick={() => {
            if (confirm(`Delete "${product.name}"? Campaigns using it keep working but lose their product context.`)) {
              void deleteProduct(product.id);
            }
          }}
        >
          Delete
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
