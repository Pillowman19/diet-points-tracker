import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';

function auth(req: NextRequest): boolean {
  return req.headers.get('x-app-secret') === process.env.APP_SECRET;
}

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const supabase = getSupabase();
  const { data, error } = await supabase.from('settings').select('*').eq('id', 1).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { daily_budget, weekly_flex } = await req.json();
  const supabase = getSupabase();
  const update: any = {};
  if (daily_budget !== undefined) update.daily_budget = daily_budget;
  if (weekly_flex !== undefined) update.weekly_flex = weekly_flex;
  const { data, error } = await supabase
    .from('settings')
    .update(update)
    .eq('id', 1)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
