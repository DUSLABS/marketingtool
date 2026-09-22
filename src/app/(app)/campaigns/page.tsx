import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { getWorkspace } from "@/lib/workspace";
import { NewCampaignDialog } from "./new-campaign-dialog";

export const metadata = { title: "Campaigns" };

const STATUS_VARIANT = { draft: "outline", active: "default", paused: "secondary" } as const;

export default async function CampaignsPage() {
  const { supabase } = await getWorkspace();
  const [{ data: campaigns, error }, { data: products }] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, name, status, updated_at, product:products(name), campaign_hooks(count)")
      .order("updated_at", { ascending: false }),
    supabase.from("products").select("id, name").order("created_at"),
  ]);
  if (error) throw error;

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Each campaign is a set of rules that turns into a fresh slideshow every time it posts."
        actions={<NewCampaignDialog products={products ?? []} />}
      />
      {campaigns.length === 0 ? (
        <div className="panel p-10 text-center text-sm text-muted-foreground">
          No campaigns yet. Create one to start writing hooks and content.
        </div>
      ) : (
        <div className="panel divide-y divide-border">
          {campaigns.map((c) => {
            const product = c.product as unknown as { name: string } | null;
            const hookCount = (c.campaign_hooks as unknown as { count: number }[])[0]?.count ?? 0;
            return (
              <Link
                key={c.id}
                href={`/campaigns/${c.id}`}
                className="flex items-center gap-4 px-5 py-4 transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-secondary"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {product?.name ?? "No product"} · {hookCount} hook{hookCount === 1 ? "" : "s"}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[c.status as keyof typeof STATUS_VARIANT]} className="capitalize">
                  {c.status}
                </Badge>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
