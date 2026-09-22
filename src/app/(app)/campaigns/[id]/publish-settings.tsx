"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Pause, Play, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Segmented, selectClass } from "@/components/app/segmented";
import { cn } from "@/lib/utils";
import {
  addScheduleSlot,
  deleteScheduleSlot,
  getCreatorOptions,
  setCampaignStatus,
  updateScheduleSlot,
  type CampaignPatch,
  type Slot,
} from "../actions";

export type PublishCampaign = {
  id: string;
  status: string;
  tiktok_account_id: string | null;
  publish_mode: "draft" | "direct";
  privacy_level: string | null;
  allow_comments: boolean;
  disclose_commercial: boolean;
  ai_label: boolean;
  timezone: string;
  max_posts_per_day: number;
};

export type PublishAccount = { id: string; name: string; status: string };

const PRIVACY_LABELS: Record<string, string> = {
  PUBLIC_TO_EVERYONE: "Everyone",
  MUTUAL_FOLLOW_FRIENDS: "Friends",
  FOLLOWER_OF_CREATOR: "Followers",
  SELF_ONLY: "Only me",
};

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const COMMON_TIMEZONES = ["Europe/Berlin", "Europe/London", "America/New_York", "America/Los_Angeles"];

export function PublishSettings({
  campaign,
  patch,
  accounts,
  slots: initialSlots,
  beforeStart,
}: {
  campaign: PublishCampaign;
  patch: (p: CampaignPatch) => void;
  accounts: PublishAccount[];
  slots: Slot[];
  beforeStart: () => Promise<void>;
}) {
  const [slots, setSlots] = useState(initialSlots);
  const [status, setStatus] = useState(campaign.status);
  const [privacyLevels, setPrivacyLevels] = useState<string[] | null>(null);
  const [pending, start] = useTransition();
  const direct = campaign.publish_mode === "direct";

  // Direct posts must use a privacy level TikTok currently offers this creator.
  useEffect(() => {
    if (!direct || !campaign.tiktok_account_id) return;
    let cancelled = false;
    void getCreatorOptions(campaign.tiktok_account_id).then((res) => {
      if (cancelled) return;
      if (res.ok) setPrivacyLevels(res.data.privacyLevels);
      else toast.error(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [direct, campaign.tiktok_account_id]);

  const postsPerWeek = slots.reduce((n, s) => n + s.weekdays.length, 0);
  const timezones = [...new Set([...COMMON_TIMEZONES, campaign.timezone, ...Intl.supportedValuesOf("timeZone")])];

  function updateSlot(slot: Slot, p: Partial<Slot>) {
    setSlots((all) => all.map((s) => (s.id === slot.id ? { ...s, ...p } : s)));
    start(() => updateScheduleSlot(slot.id, p));
  }

  function toggleStatus() {
    const next = status === "active" ? "paused" : "active";
    start(async () => {
      await beforeStart();
      const res = await setCampaignStatus(campaign.id, next);
      if (!res.ok) return void toast.error(res.error, { duration: 10_000 });
      setStatus(next);
      toast.success(next === "active" ? "Campaign started. It posts at the times below." : "Campaign paused");
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-secondary/50 p-4">
        <div>
          <p className="text-sm font-medium">{status === "active" ? "Running" : "Not running"}</p>
          <p className="text-xs text-muted-foreground">
            {status === "active"
              ? `Posts automatically, ${postsPerWeek} time${postsPerWeek === 1 ? "" : "s"} a week.`
              : "Start the campaign to post automatically at the times below."}
          </p>
        </div>
        <Button onClick={toggleStatus} disabled={pending} variant={status === "active" ? "outline" : "default"} className={cn(status !== "active" && "glow-hover")}>
          {status === "active" ? <Pause /> : <Play />} {status === "active" ? "Pause" : "Start"}
        </Button>
      </div>

      <div className="space-y-2">
        <Label className="text-muted-foreground">Post from</Label>
        {accounts.length === 0 ? (
          <p className="text-sm">
            No TikTok account connected.{" "}
            <Link href="/connections" className="text-primary hover:underline">
              Connect one
            </Link>
          </p>
        ) : (
          <select
            value={campaign.tiktok_account_id ?? ""}
            onChange={(e) => patch({ tiktok_account_id: e.target.value || null, privacy_level: null })}
            className={cn(selectClass, "w-64")}
          >
            <option value="">Choose account…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id} disabled={a.status !== "active"}>
                {a.name}
                {a.status !== "active" ? " (reconnect)" : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-muted-foreground">Posts go</Label>
        <Segmented
          value={campaign.publish_mode}
          onChange={(publish_mode) => patch({ publish_mode })}
          options={[
            { value: "draft", label: "To drafts for review" },
            { value: "direct", label: "Straight to the profile" },
          ]}
        />
        <p className="text-xs text-muted-foreground">
          {direct
            ? "Posts are published automatically. Until TikTok has approved this app, direct posts are only visible to you."
            : "Posts land in your TikTok inbox; you publish them from the app. The safer way to warm up a new account."}
        </p>
      </div>

      {direct && (
        <div className="space-y-4 rounded-xl border border-border p-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Who can see these posts</Label>
            {privacyLevels ? (
              <Segmented
                value={campaign.privacy_level ?? ""}
                onChange={(privacy_level) => patch({ privacy_level })}
                options={privacyLevels.map((p) => ({ value: p, label: PRIVACY_LABELS[p] ?? p }))}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {campaign.tiktok_account_id ? "Loading options from TikTok…" : "Choose an account first."}
              </p>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={campaign.allow_comments}
              onChange={(e) => patch({ allow_comments: e.target.checked })}
              className="size-4 accent-[var(--accent-primary)]"
            />
            Allow comments
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={campaign.disclose_commercial}
              onChange={(e) => patch({ disclose_commercial: e.target.checked })}
              className="size-4 accent-[var(--accent-primary)]"
            />
            Disclose commercial content (promotes your own business)
          </label>
          <p className="text-xs text-muted-foreground">
            By posting, you agree to TikTok&apos;s{" "}
            <a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noreferrer" className="underline">
              Music Usage Confirmation
            </a>
            . TikTok takes a few minutes to process each post before it appears on the profile.
          </p>
        </div>
      )}

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={campaign.ai_label}
          onChange={(e) => patch({ ai_label: e.target.checked })}
          className="mt-0.5 size-4 accent-[var(--accent-primary)]"
        />
        <span>
          Label posts as AI-generated
          <span className="block text-xs text-muted-foreground">
            TikTok requires this for realistic AI-generated people or scenes. Labeled posts reach fewer viewers.
          </span>
        </span>
      </label>

      <div className="space-y-3 border-t border-border pt-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Posting times</Label>
            <select value={campaign.timezone} onChange={(e) => patch({ timezone: e.target.value })} className={cn(selectClass, "w-64")}>
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <span className="text-sm text-muted-foreground tabular-nums">{postsPerWeek}/week</span>
        </div>

        {slots.map((slot) => (
          <div key={slot.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
            <input
              type="time"
              value={slot.time_of_day.slice(0, 5)}
              onChange={(e) => e.target.value && updateSlot(slot, { time_of_day: e.target.value })}
              className={cn(selectClass, "w-28 [color-scheme:dark]")}
            />
            <div className="flex gap-1">
              {WEEKDAYS.map((label, day) => {
                const on = slot.weekdays.includes(day);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() =>
                      updateSlot(slot, {
                        weekdays: on ? slot.weekdays.filter((d) => d !== day) : [...slot.weekdays, day].sort(),
                      })
                    }
                    className={cn(
                      "size-8 rounded-lg border text-xs transition-colors",
                      on ? "border-primary/70 bg-primary/10 text-foreground" : "border-border text-muted-foreground",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="ml-auto"
              aria-label="Remove posting time"
              onClick={() => {
                setSlots((all) => all.filter((s) => s.id !== slot.id));
                start(() => deleteScheduleSlot(slot.id));
              }}
            >
              <X />
            </Button>
          </div>
        ))}

        <Button
          variant="outline"
          className="w-full"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const slot = await addScheduleSlot(campaign.id, slots.length ? "18:00" : "09:00");
              setSlots((all) => [...all, slot]);
            })
          }
        >
          <Plus /> Add a posting time
        </Button>

        <div className="flex items-center gap-3 pt-2">
          <Label className="text-muted-foreground">Max posts per day</Label>
          <select
            value={campaign.max_posts_per_day}
            onChange={(e) => patch({ max_posts_per_day: Number(e.target.value) })}
            className={cn(selectClass, "w-20")}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
