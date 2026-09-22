-- Initial schema for the TikTok slideshow autopilot (see SPEC.md §8).
-- Every table carries workspace_id so the tool can become multi-tenant later without a rewrite.

create extension if not exists pgcrypto;

-- ─── Workspaces ──────────────────────────────────────────────────────────────

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid not null references workspaces on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create or replace function is_member(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from workspace_members where workspace_id = ws and user_id = auth.uid());
$$;

-- Internal tool: exactly one workspace, every invited user joins it automatically.
insert into workspaces (name) values ('Default');

create or replace function add_user_to_default_workspace() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into workspace_members (workspace_id, user_id, role)
  select id, new.id, case when (select count(*) from workspace_members) = 0 then 'owner' else 'member' end
  from workspaces order by created_at limit 1;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function add_user_to_default_workspace();

-- ─── Products (the apps we market) ───────────────────────────────────────────

create table products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces on delete cascade,
  name text not null,
  description text not null default '',
  facts text not null default '',          -- the only product claims the AI may use
  voice text not null default '',
  avoid text not null default '',
  app_store_url text,
  created_at timestamptz not null default now()
);

-- ─── Assets & libraries ──────────────────────────────────────────────────────

create table libraries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces on delete cascade,
  storage_path text not null,
  thumb_path text,
  width int,
  height int,
  sha256 text,
  favorite boolean not null default false,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (workspace_id, sha256)
);

create table library_assets (
  library_id uuid not null references libraries on delete cascade,
  asset_id uuid not null references assets on delete cascade,
  added_at timestamptz not null default now(),
  primary key (library_id, asset_id)
);

create table text_styles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces on delete cascade,
  name text not null,
  spec jsonb not null,                     -- font, size, weight, color, stroke, shadow, background box, align
  created_at timestamptz not null default now()
);

-- ─── TikTok accounts ─────────────────────────────────────────────────────────

create table tiktok_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces on delete cascade,
  open_id text not null unique,
  username text,
  display_name text,
  avatar_url text,
  scopes text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'expired', 'revoked')),
  created_at timestamptz not null default now()
);

-- Tokens are only ever touched by the server with the secret key: RLS on, no policies.
create table tiktok_tokens (
  account_id uuid primary key references tiktok_accounts on delete cascade,
  access_token text not null,
  refresh_token text not null,
  access_expires_at timestamptz not null,
  refresh_expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

-- ─── Campaigns ───────────────────────────────────────────────────────────────

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces on delete cascade,
  product_id uuid references products on delete set null,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused')),
  language text not null default 'en',

  content_prompt text not null default '',
  content_slide_count int not null default 5 check (content_slide_count between 1 and 10),
  content_format text not null default 'numbered' check (content_format in ('numbered', 'steps', 'plain')),
  content_length text not null default 'medium' check (content_length in ('short', 'medium', 'long')),
  tone text not null default 'plain' check (tone in ('plain', 'punchy', 'expert', 'warm')),
  web_research boolean not null default false,

  caption_prompt text not null default '',
  hashtags text[] not null default '{}',

  -- Per slide kind: { hook|content|cta: { library_id, text_style_id, box: {x,y,w}, per_slide_library_ids? } }
  layout jsonb not null default '{}',
  cta_enabled boolean not null default true,

  tiktok_account_id uuid references tiktok_accounts on delete set null,
  publish_mode text not null default 'draft' check (publish_mode in ('draft', 'direct')),
  privacy_level text,                      -- chosen from creator_info options; no default by TikTok UX rules
  allow_comments boolean not null default true,
  disclose_commercial boolean not null default false,
  ai_label boolean not null default false,
  timezone text not null default 'Europe/Berlin',
  max_posts_per_day int not null default 3,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table campaign_hooks (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns on delete cascade,
  text text not null,
  enabled boolean not null default true,
  style text,                              -- e.g. listicle, pov, contrarian (for later analytics)
  source text not null default 'manual' check (source in ('manual', 'ai')),
  created_at timestamptz not null default now()
);

create table campaign_ctas (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns on delete cascade,
  text text not null default '',           -- empty = image-only CTA slide
  enabled boolean not null default true,
  source text not null default 'manual' check (source in ('manual', 'ai')),
  created_at timestamptz not null default now()
);

create table schedule_slots (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns on delete cascade,
  time_of_day time not null,
  weekdays int[] not null default '{0,1,2,3,4,5,6}', -- 0 = Sunday, in the campaign's timezone
  created_at timestamptz not null default now()
);

-- ─── Posts ───────────────────────────────────────────────────────────────────

create table posts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces on delete cascade,
  campaign_id uuid not null references campaigns on delete cascade,
  tiktok_account_id uuid references tiktok_accounts on delete set null,
  status text not null default 'preview' check (status in
    ('preview', 'queued', 'rendering', 'uploading', 'in_drafts', 'published', 'failed')),
  scheduled_for timestamptz,
  hook_id uuid references campaign_hooks on delete set null,
  cta_id uuid references campaign_ctas on delete set null,
  caption text,
  combination_hash text,
  tiktok_publish_id text,
  tiktok_post_id text,
  error text,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create index posts_due_idx on posts (status, scheduled_for);
create index posts_campaign_idx on posts (campaign_id, created_at desc);

create table post_slides (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts on delete cascade,
  position int not null,
  kind text not null check (kind in ('hook', 'content', 'cta')),
  asset_id uuid references assets on delete set null,
  text text not null default '',
  box jsonb,
  text_style_id uuid references text_styles on delete set null,
  rendered_path text,
  unique (post_id, position)
);

create index post_slides_asset_idx on post_slides (asset_id);

create table post_metrics (
  post_id uuid not null references posts on delete cascade,
  recorded_at timestamptz not null default now(),
  views bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  primary key (post_id, recorded_at)
);

-- ─── Row level security ──────────────────────────────────────────────────────

alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table products enable row level security;
alter table libraries enable row level security;
alter table assets enable row level security;
alter table library_assets enable row level security;
alter table text_styles enable row level security;
alter table tiktok_accounts enable row level security;
alter table tiktok_tokens enable row level security;
alter table campaigns enable row level security;
alter table campaign_hooks enable row level security;
alter table campaign_ctas enable row level security;
alter table schedule_slots enable row level security;
alter table posts enable row level security;
alter table post_slides enable row level security;
alter table post_metrics enable row level security;

create policy "members read workspace" on workspaces for select using (is_member(id));
create policy "members read membership" on workspace_members for select using (is_member(workspace_id));

-- Tables with their own workspace_id.
do $$
declare t text;
begin
  foreach t in array array['products', 'libraries', 'assets', 'text_styles', 'tiktok_accounts', 'campaigns', 'posts']
  loop
    execute format(
      'create policy "members manage %1$s" on %1$I for all using (is_member(workspace_id)) with check (is_member(workspace_id))', t);
  end loop;
end $$;

-- Child tables inherit access from their parent.
create policy "members manage library_assets" on library_assets for all
  using (exists (select 1 from libraries l where l.id = library_id and is_member(l.workspace_id)))
  with check (exists (select 1 from libraries l where l.id = library_id and is_member(l.workspace_id)));

do $$
declare t text;
begin
  foreach t in array array['campaign_hooks', 'campaign_ctas', 'schedule_slots']
  loop
    execute format(
      'create policy "members manage %1$s" on %1$I for all
         using (exists (select 1 from campaigns c where c.id = campaign_id and is_member(c.workspace_id)))
         with check (exists (select 1 from campaigns c where c.id = campaign_id and is_member(c.workspace_id)))', t);
  end loop;
  foreach t in array array['post_slides', 'post_metrics']
  loop
    execute format(
      'create policy "members manage %1$s" on %1$I for all
         using (exists (select 1 from posts p where p.id = post_id and is_member(p.workspace_id)))
         with check (exists (select 1 from posts p where p.id = post_id and is_member(p.workspace_id)))', t);
  end loop;
end $$;

-- ─── Storage ─────────────────────────────────────────────────────────────────
-- Object paths start with the workspace id: <workspace_id>/<...>.

insert into storage.buckets (id, name, public) values
  ('assets', 'assets', false),
  ('renders', 'renders', false);

create policy "members manage workspace objects" on storage.objects for all
  using (bucket_id in ('assets', 'renders') and is_member(((storage.foldername(name))[1])::uuid))
  with check (bucket_id in ('assets', 'renders') and is_member(((storage.foldername(name))[1])::uuid));
