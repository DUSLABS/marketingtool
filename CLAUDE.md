@AGENTS.md

# Project notes

- Spec for what to build: `SPEC.md` (phases in §9). The PRD is the long-term vision, not the build plan.
- Next.js 16: middleware is `src/proxy.ts`; read `node_modules/next/dist/docs/` before using unfamiliar APIs.
- Supabase: server client `@/lib/supabase/server`, browser client `@/lib/supabase/client`. All tables are scoped by `workspace_id` with RLS via `is_member()`. Schema changes go into a new file in `supabase/migrations/`.
- UI: dark-only design tokens in `src/app/globals.css` (`.panel`, `.glow`, `.glow-hover`). UI copy in English.
