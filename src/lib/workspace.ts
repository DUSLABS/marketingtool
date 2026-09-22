import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Resolves the signed-in user's workspace once per request. Redirects to /login without a session.
export const getWorkspace = cache(async () => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) redirect("/login");

  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .single();
  if (error || !data) throw new Error("User is not a member of any workspace");

  return { supabase, userId, workspaceId: data.workspace_id as string };
});
