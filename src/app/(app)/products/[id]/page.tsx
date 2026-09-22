import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { getWorkspace } from "@/lib/workspace";
import { ProductForm } from "./product-form";

export default async function ProductPage({ params }: PageProps<"/products/[id]">) {
  const { id } = await params;
  const { supabase } = await getWorkspace();
  const { data: product } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (!product) notFound();

  return (
    <>
      <PageHeader title={product.name} description="Everything campaigns for this product build on." />
      {/* Remount after save so uncontrolled inputs pick up the stored values. */}
      <ProductForm key={JSON.stringify(product)} product={product} />
    </>
  );
}
