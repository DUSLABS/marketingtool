-- Scheduling: one post per campaign and slot time (makes the scheduler idempotent), plus
-- TikTok status tracking.

create unique index posts_campaign_slot_uidx on posts (campaign_id, scheduled_for) where scheduled_for is not null;

alter table posts add column tiktok_status text;          -- raw status from /publish/status/fetch/
alter table posts add column published_mode text check (published_mode in ('draft', 'direct'));
alter table tiktok_accounts add column last_error text;
