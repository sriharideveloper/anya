import { createClient } from '@supabase/supabase-js';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_UNITS = 30;
const fallbackWindows = globalThis.__anyaAiRateWindows || (globalThis.__anyaAiRateWindows = new Map());

export class AiGuardError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function client(key) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isMissingQuotaFunction(error) {
  const text = [error?.message, error?.details, error?.hint].filter(Boolean).join(' ');
  return error?.code === 'PGRST202' || error?.code === '42883' || /function.+does not exist|schema cache/i.test(text);
}

function consumeFallback(userId, units) {
  const now = Date.now();
  const current = fallbackWindows.get(userId);
  const next = !current || now - current.startedAt >= WINDOW_MS
    ? { startedAt: now, units }
    : { ...current, units: current.units + units };
  fallbackWindows.set(userId, next);

  for (const [key, value] of fallbackWindows) {
    if (now - value.startedAt > WINDOW_MS * 2) fallbackWindows.delete(key);
  }
  return next.units <= MAX_UNITS;
}

export async function authorizeAiRequest(request, body, { units = 1 } = {}) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new AiGuardError('Seller authentication is not configured.', 503);
  }

  const authorization = request.headers.get('authorization');
  const accessToken =
    (typeof body?.accessToken === 'string' ? body.accessToken.trim() : '') ||
    (authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '');
  if (!accessToken) throw new AiGuardError('Sign in to use Anya AI.', 401);

  const { data, error } = await client(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).auth.getUser(accessToken);
  if (error || !data.user) throw new AiGuardError('Your session expired. Sign in and try again.', 401);

  const safeUnits = Math.max(1, Math.min(10, Math.ceil(Number(units) || 1)));
  let allowed = null;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { data: quotaResult, error: quotaError } = await client(process.env.SUPABASE_SERVICE_ROLE_KEY).rpc(
      'consume_seller_ai_quota',
      {
        target_user_id: data.user.id,
        requested_units: safeUnits,
        unit_limit: MAX_UNITS,
        window_seconds: Math.round(WINDOW_MS / 1000),
      },
    );
    if (!quotaError) allowed = Boolean(quotaResult);
    else if (!isMissingQuotaFunction(quotaError)) {
      console.error('Durable AI quota check failed:', quotaError);
      throw new AiGuardError('Anya AI usage could not be verified. Try again shortly.', 503);
    }
  }

  if (allowed === null) allowed = consumeFallback(data.user.id, safeUnits);
  if (!allowed) {
    throw new AiGuardError('AI generation limit reached. Wait a few minutes, then try again.', 429);
  }

  return data.user;
}
