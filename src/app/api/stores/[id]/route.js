import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function supabaseClient(key) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function parseSettings(body) {
  if (typeof body.storeName !== 'string') {
    return { error: 'Store name must be text.' };
  }
  const storeName = body.storeName.trim();
  if (!storeName || storeName.length > 100) {
    return { error: 'Store name must be between 1 and 100 characters.' };
  }

  if (typeof body.tagline !== 'string') {
    return { error: 'Tagline must be text.' };
  }
  const tagline = body.tagline.trim();
  if (tagline.length > 180) {
    return { error: 'Tagline must be 180 characters or fewer.' };
  }

  if (typeof body.whatsapp !== 'string') {
    return { error: 'WhatsApp number must be text.' };
  }
  const whatsapp = body.whatsapp.replace(/\D/g, '');
  if (!/^\d{10,15}$/.test(whatsapp)) {
    return { error: 'Add a WhatsApp number with its country code.' };
  }

  if (typeof body.haggleMode !== 'boolean' || typeof body.malayalamMode !== 'boolean') {
    return { error: 'Store modes must be turned on or off.' };
  }

  return {
    updates: {
      store_name: storeName,
      tagline,
      whatsapp_number: whatsapp,
      haggle_mode: body.haggleMode,
      malayalam_mode: body.malayalamMode,
    },
  };
}

export async function PATCH(request, context) {
  try {
    const { id } = await context.params;
    if (!UUID_PATTERN.test(id || '')) {
      return NextResponse.json({ error: 'Choose a valid storefront.' }, { status: 400 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Send a valid JSON request.' }, { status: 400 });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Send valid storefront settings.' }, { status: 400 });
    }

    const accessToken = typeof body.accessToken === 'string' ? body.accessToken.trim() : '';
    if (!accessToken) {
      return NextResponse.json({ error: 'Sign in again before saving store settings.' }, { status: 401 });
    }

    const required = [
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ];
    if (required.some((value) => !value)) {
      return NextResponse.json({ error: 'Server-side storefront updates are not configured.' }, { status: 503 });
    }

    const parsed = parseSettings(body);
    if (parsed.error) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const userClient = supabaseClient(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Your session expired. Sign in and try again.' }, { status: 401 });
    }

    const admin = supabaseClient(process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: ownedStore, error: ownershipError } = await admin
      .from('stores')
      .select('id')
      .eq('id', id)
      .eq('owner_id', userData.user.id)
      .maybeSingle();

    if (ownershipError) {
      console.error('Store settings ownership lookup failed:', ownershipError);
      return NextResponse.json({ error: 'The storefront could not be checked.' }, { status: 500 });
    }
    if (!ownedStore) {
      return NextResponse.json({ error: 'This storefront does not belong to the signed-in seller.' }, { status: 403 });
    }

    const { data: updatedStore, error: updateError } = await admin
      .from('stores')
      .update(parsed.updates)
      .eq('id', ownedStore.id)
      .eq('owner_id', userData.user.id)
      .select('*')
      .maybeSingle();

    if (updateError) {
      console.error('Store settings update failed:', updateError);
      return NextResponse.json({ error: 'The storefront settings could not be saved.' }, { status: 500 });
    }
    if (!updatedStore) {
      return NextResponse.json({ error: 'Storefront not found.' }, { status: 404 });
    }

    return NextResponse.json({ store: updatedStore });
  } catch (error) {
    console.error('Store settings update failed:', error);
    return NextResponse.json({ error: 'The storefront settings could not be saved.' }, { status: 500 });
  }
}
