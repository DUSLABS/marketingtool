"use server";

import { revalidatePath } from "next/cache";
import { getWorkspace } from "@/lib/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { revokeToken } from "@/lib/tiktok/api";

export async function disconnectAccount(accountId: string) {
  const { workspaceId } = await getWorkspace();
  const db = createAdminClient();
  const { data: account } = await db
    .from("tiktok_accounts")
    .select("id, tiktok_tokens(access_token)")
    .eq("id", accountId)
    .eq("workspace_id", workspaceId)
    .single();
  if (!account) throw new Error("Account not found");

  const token = (account.tiktok_tokens as unknown as { access_token: string } | null)?.access_token;
  if (token) await revokeToken(token).catch(() => undefined);
  const { error } = await db.from("tiktok_accounts").delete().eq("id", accountId);
  if (error) throw error;
  revalidatePath("/connections");
}
