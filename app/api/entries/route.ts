import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';

function auth(req: NextRequest): boolean {
  const secret = req.headers.get('x-app-secret');
  return secret === process.env.APP_SECRET;
}

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const all = searchParams.get('all');
  const supabase = getSupabase();

  if (all === '1') {
    // Return history grouped by date
    const { data, error } = await supabase
      .from('entries')
      .select('*')
      .order('date', { ascending: false })
      .limit(500);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ entries: data || [] });
  }

  if (!date) return NextResponse.json({ error: 'missing date' }, { status: 400 });
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('date', date)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data || [] });
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json();
  const { kind, date, name, points, note } = body;
  if (!kind || !date || !name || points === undefined) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  }
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('entries')
    .insert({ kind, date, name, points, note: note || '' })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry: data });
}

export async function PATCH(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id, points } = await req.json();
  if (!id || points === undefined) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  }
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('entries')
    .update({ points, edited: true })
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry: data });
}

export async function DELETE(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });
  const supabase = getSupabase();
  const { error } = await supabase.from('entries').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
