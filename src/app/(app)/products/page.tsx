import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { getWorkspace } from "@/lib/workspace";
import { createProduct } from "./actions";

export const metadata = { title: "Products" };

export default async function ProductsPage() {
  const { supabase } = await getWorkspace();
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, description, app_store_url")
    .order("created_at");
  if (error) throw error;

  return (
    <>
      <PageHeader
        title="Products"
        description="The apps you market, with the facts the AI is allowed to use."
        actions={
          <form action={createProduct}>
            <Button type="submit" className="glow-hover">
              <Plus /> New product
            </Button>
          </form>
        }
      />
      {products.length === 0 ? (
        <div className="panel p-10 text-center text-sm text-muted-foreground">
          No products yet. Add your first app to give campaigns their context.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <Link key={p.id} href={`/products/${p.id}`} className="panel p-5 transition-colors hover:bg-secondary">
              <h2 className="font-medium">{p.name}</h2>
              <p className="mt-1.5 line-clamp-3 text-sm text-muted-foreground">
                {p.description || "No description yet."}
              </p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
