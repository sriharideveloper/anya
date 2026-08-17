import { createBrowserClient } from '@supabase/ssr';

let client;

function readConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey || url.includes('your-project') || anonKey.includes('your-anon-key')) {
    const error = new Error('Supabase browser credentials are missing.');
    error.code = 'SUPABASE_CONFIG_ERROR';
    throw error;
  }

  try {
    new URL(url);
  } catch {
    const error = new Error('NEXT_PUBLIC_SUPABASE_URL is not a valid URL.');
    error.code = 'SUPABASE_CONFIG_ERROR';
    throw error;
  }

  return { url, anonKey };
}

export function createClient() {
  if (!client) {
    const { url, anonKey } = readConfig();
    client = createBrowserClient(url, anonKey);
  }
  return client;
}
