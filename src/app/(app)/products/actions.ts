"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getWorkspace } from "@/lib/workspace";

export type ProductFormState = { error?: string; saved?: boolean };

export async function createProduct() {
  const { supabase, workspaceId } = await getWorkspace();
  const { data, error } = await supabase
    .from("products")
    .insert({ workspace_id: workspaceId, name: "Untitled product" })
    .select("id")
    .single();
  if (error) throw error;
  redirect(`/products/${data.id}`);
}

export async function updateProduct(id: string, _prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  const { supabase } = await getWorkspace();
  const field = (name: string) => String(formData.get(name) ?? "").trim();

  const name = field("name");
  if (!name) return { error: "Name is required." };

  const { error } = await supabase
    .from("products")
    .update({
      name,
      description: field("description"),
      facts: field("facts"),
      voice: field("voice"),
      avoid: field("avoid"),
      app_store_url: field("app_store_url") || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/products");
  return { saved: true };
}

export async function deleteProduct(id: string) {
  const { supabase } = await getWorkspace();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/products");
  redirect("/products");
}
