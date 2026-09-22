# Slides Autopilot

Internal tool that turns campaigns (hooks, content prompt, CTAs, image libraries) into TikTok slideshow posts on a schedule.
Product spec: [SPEC.md](SPEC.md) · long-term vision: [marketing_tool_tiktok_slides_prd.md](marketing_tool_tiktok_slides_prd.md).

## Setup

1. Create a Supabase project (region EU, e.g. Frankfurt).
2. Apply the schema: Supabase dashboard → SQL Editor → run `supabase/migrations/20260922000000_init.sql`
   (or `npx supabase link` + `npx supabase db push`).
3. Auth → Sign In / Providers: disable "Allow new users to sign up". Create users under Auth → Users → Add user.
   The first user becomes owner of the default workspace.
4. `cp .env.example .env.local` and fill in URL + keys from Project Settings → API Keys.
5. `npm install && npm run dev` → http://localhost:3000

## Stack

Next.js 16 (App Router, `src/proxy.ts` handles the session), Tailwind 4, shadcn/ui (Base UI), Supabase (Postgres, Auth, Storage).
