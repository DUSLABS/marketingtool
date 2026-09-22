"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { selectClass } from "@/components/app/segmented";
import { createCampaign } from "./actions";

export function NewCampaignDialog({ products }: { products: { id: string; name: string }[] }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button className="glow-hover" />}>
        <Plus /> New campaign
      </DialogTrigger>
      <DialogContent>
        <form action={createCampaign} className="space-y-5">
          <DialogHeader>
            <DialogTitle>New campaign</DialogTitle>
            <DialogDescription>One campaign = one account and one angle, e.g. “SameRoll – Wedding”.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" placeholder="SameRoll – Wedding" autoFocus required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product_id">Product</Label>
            <select id="product_id" name="product_id" className={`${selectClass} w-full`} defaultValue={products[0]?.id ?? ""}>
              <option value="">No product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button type="submit">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
