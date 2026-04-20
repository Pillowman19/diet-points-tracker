import { createClient } from '@supabase/supabase-js';

export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

export function checkSecret(slug: string | string[] | undefined): boolean {
  const secret = process.env.APP_SECRET;
  if (!secret) return false;
  return slug === secret;
}

export function getLocalDate(): string {
  // Server always returns UTC; let client send its local date
  // This helper is only used as a fallback
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
