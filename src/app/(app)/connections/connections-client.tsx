"use client";

import { useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { disconnectAccount } from "./actions";

/** Shows the result of the TikTok OAuth redirect once, then cleans the URL. */
export function ConnectionToasts() {
  const params = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    const connected = params.get("connected");
    const error = params.get("error");
    if (connected) toast.success(`Connected ${connected.startsWith("@") ? connected : `@${connected}`}`);
    if (error) toast.error(error, { duration: 10_000 });
    if (connected || error) router.replace("/connections");
  }, [params, router]);
  return null;
}

type Account = {
  id: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: string;
  lastError: string | null;
  campaignCount: number;
};

export function AccountRow({ account }: { account: Account }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      {account.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- TikTok CDN avatar
        <img src={account.avatarUrl} alt="" className="size-10 rounded-full" />
      ) : (
        <div className="size-10 rounded-full bg-secondary" />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-medium">{account.name}</p>
        <p className="text-sm text-muted-foreground">
          {account.displayName && `${account.displayName} · `}
          {account.campaignCount} campaign{account.campaignCount === 1 ? "" : "s"}
        </p>
        {account.lastError && account.status !== "active" && <p className="text-sm text-destructive">{account.lastError}</p>}
      </div>
      <Badge variant={account.status === "active" ? "secondary" : "destructive"} className="capitalize">
        {account.status === "active" ? "Connected" : account.status}
      </Badge>
      {account.status !== "active" && (
        <a href="/api/tiktok/connect" className="text-sm text-primary hover:underline">
          Reconnect
        </a>
      )}
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (confirm(`Disconnect ${account.name}? Campaigns using it stop posting until you pick another account.`)) {
            start(() => disconnectAccount(account.id));
          }
        }}
      >
        Disconnect
      </Button>
    </div>
  );
}
