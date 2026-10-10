-- Existing campaigns keep their current behavior; new campaigns use automatic images.
alter table campaigns
  add column image_mode text not null default 'library' check (image_mode in ('library', 'auto')),
  add column image_style text not null default 'Natural, candid photography. Warm natural light, believable everyday scenes, consistent colors. No text, logos or watermarks.',
  add column image_max_uses int not null default 3 check (image_max_uses between 1 and 20),
  add column image_cooldown_days int not null default 7 check (image_cooldown_days between 0 and 365);
alter table campaigns alter column image_mode set default 'auto';
alter table libraries add column generated_campaign_id uuid unique references campaigns on delete cascade;

alter table assets
  add column source text not null default 'upload' check (source in ('upload', 'generated')),
  add column generation_prompt text,
  add column generation_model text,
  add column origin_campaign_id uuid references campaigns on delete set null;

alter table posts drop constraint posts_status_check;
alter table posts add constraint posts_status_check check (status in
  ('generating', 'preview', 'queued', 'rendering', 'uploading', 'in_drafts', 'published', 'failed'));
alter table posts add column image_generation jsonb;
alter table post_slides
  add column visual_prompt text,
  add column image_library_id uuid references libraries on delete set null,
  add column image_rejected_assets uuid[] not null default '{}',
  add column image_attempts int not null default 0;

-- Serialize image decisions within each campaign so concurrent previews/cron ticks
-- cannot reuse an image before another post records its usage. Service-role only.
create table image_generation_leases (
  campaign_id uuid primary key references campaigns on delete cascade,
  token uuid not null,
  expires_at timestamptz not null
);
alter table image_generation_leases enable row level security;

create function claim_image_generation(p_campaign_id uuid, p_token uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  insert into image_generation_leases(campaign_id, token, expires_at)
  values (p_campaign_id, p_token, now() + interval '5 minutes')
  on conflict (campaign_id) do update set token = excluded.token, expires_at = excluded.expires_at
    where image_generation_leases.expires_at < now();
  return found;
end;
$$;
revoke all on function claim_image_generation(uuid, uuid) from public, anon, authenticated;
grant execute on function claim_image_generation(uuid, uuid) to service_role;

-- Aggregate the entire history, not just a recent page. Existing drafts also reserve
-- their images. Count posts rather than slides and retain the most recent usage time.
create function campaign_image_usage(p_workspace_id uuid, p_campaign_id uuid)
returns jsonb
language sql stable security invoker set search_path = public as $$
  select coalesce(jsonb_agg(usage), '[]'::jsonb) from (
    select s.asset_id, count(distinct p.id) as uses, max(p.created_at) as last_used
    from post_slides s join posts p on p.id = s.post_id
    where p.workspace_id = p_workspace_id and p.campaign_id = p_campaign_id and s.asset_id is not null
    group by s.asset_id
  ) usage;
$$;
revoke all on function campaign_image_usage(uuid, uuid) from public, anon, authenticated;
grant execute on function campaign_image_usage(uuid, uuid) to service_role;
