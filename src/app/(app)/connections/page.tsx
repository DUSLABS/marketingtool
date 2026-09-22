import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { buttonVariants } from "@/components/ui/button";
import { getWorkspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";
import { AccountRow, ConnectionToasts } from "./connections-client";

export const metadata = { title: "Connections" };

export default async function ConnectionsPage() {
  const { supabase } = await getWorkspace();
  const { data: accounts, error } = await supabase
    .from("tiktok_accounts")
    .select("id, username, display_name, avatar_url, status, last_error, created_at, campaigns(count)")
    .order("created_at");
  if (error) throw error;

  return (
    <>
      <Suspense>
        <ConnectionToasts />
      </Suspense>
      <PageHeader
        title="Connections"
        description="TikTok accounts campaigns can post to."
        actions={
          // A plain link: the connect route redirects to TikTok's login page.
          <a href="/api/tiktok/connect" className={cn(buttonVariants(), "glow-hover")}>
            Connect TikTok account
          </a>
        }
      />
      {accounts.length === 0 ? (
        <div className="panel p-10 text-center text-sm text-muted-foreground">
          No accounts connected yet. Tip: sign out of other TikTok accounts in this browser first, otherwise TikTok
          connects the one you are logged into.
        </div>
      ) : (
        <div className="panel divide-y divide-border">
          {accounts.map((a) => (
            <AccountRow
              key={a.id}
              account={{
                id: a.id,
                name: a.username ? `@${a.username}` : (a.display_name ?? "TikTok account"),
                displayName: a.display_name,
                avatarUrl: a.avatar_url,
                status: a.status,
                lastError: a.last_error,
                campaignCount: (a.campaigns as unknown as { count: number }[])[0]?.count ?? 0,
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}
