import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service client for background work (rendering, scheduler). Bypasses RLS: callers must scope
// every query to a workspace they have checked.
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
