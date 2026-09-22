-- Scheduler trigger: calls /api/cron/tick every 5 minutes.
-- Run once in the Supabase SQL editor. Replace <CRON_SECRET> with the value of CRON_SECRET
-- (the same value must be set as an environment variable in Vercel).
-- A ready-to-run copy with the secret filled in is generated locally as cron-setup.local.sql (not committed).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('<CRON_SECRET>', 'slides_autopilot_cron_secret');

select cron.schedule(
  'slides-autopilot-tick',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := 'https://marketingtool.duslabs.de/api/cron/tick',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'slides_autopilot_cron_secret')
    ),
    timeout_milliseconds := 300000
  );
  $$
);
