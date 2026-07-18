import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const required = {
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnon: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabaseServer: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
  };

  if (!required.supabaseUrl || !required.supabaseAnon) {
    return NextResponse.json({ status: 'unconfigured', services: required }, { status: 503 });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error } = await supabase.from('stores').select('id').limit(1);
    const healthy = !error && required.supabaseServer && required.gemini;
    return NextResponse.json(
      { status: healthy ? 'healthy' : 'degraded', services: { ...required, database: !error } },
      { status: healthy ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { status: 'unavailable', services: { ...required, database: false } },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
