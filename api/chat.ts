import { createClient } from '@supabase/supabase-js';

const URLS: Record<string, string> = {
  anthropic: 'https://api.anthropic.com/v1/messages',
  openai: 'https://api.openai.com/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
};

/**
 * Vercel env vars:
 *   At least one of: ANTHROPIC_API_KEY / OPENAI_API_KEY / OPENROUTER_API_KEY / GROQ_API_KEY
 *   REQUIRE_AUTH = "true" | "false"  (default: "true" in production)
 *   When REQUIRE_AUTH is true, also set:
 *     VITE_SUPABASE_URL (or SUPABASE_URL)
 *     SUPABASE_SERVICE_ROLE_KEY  ← server-only, NEVER use VITE_ prefix
 *
 * Set REQUIRE_AUTH=false ONLY for local testing or if you have other rate-limiting in place.
 * With auth disabled, anyone who finds /api/chat can drain your budget.
 */
export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // ---------- AUTH GATE (optional) ----------
  const requireAuth = (process.env.REQUIRE_AUTH ?? 'true').toLowerCase() !== 'false';
  if (requireAuth) {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
    if (!token) {
      return json({ error: 'AUTH_REQUIRED', message: 'Sign in with email to use the default AI key, or switch to Custom and provide your own.' }, 401);
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return json({ error: 'SERVER_MISCONFIGURED', message: 'Auth is required but Supabase env vars are not set on the server. Add VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel, or set REQUIRE_AUTH=false.' }, 500);
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: userData, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !userData?.user) {
      return json({ error: 'AUTH_INVALID', message: 'Session expired. Sign in again.' }, 401);
    }
  }

  // ---------- REQUEST FORWARDING ----------
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'BAD_REQUEST', message: 'Invalid JSON body' }, 400);
  }

  const { provider, model, system, messages, max_tokens = 2000 } = body || {};
  if (!provider || !messages) {
    return json({ error: 'BAD_REQUEST', message: 'Missing provider or messages' }, 400);
  }

  const keys: Record<string, string | undefined> = {
    anthropic:  process.env.ANTHROPIC_API_KEY,
    openai:     process.env.OPENAI_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
    groq:       process.env.GROQ_API_KEY,
  };

  const apiKey = keys[provider];
  const url    = URLS[provider];
  if (!url) {
    return json({ error: 'BAD_PROVIDER', message: `Unknown provider: ${provider}` }, 400);
  }
  if (!apiKey) {
    return json({
      error: 'KEY_NOT_CONFIGURED',
      message: `${provider.toUpperCase()}_API_KEY is not set in Vercel env vars. Add it in Vercel → Settings → Environment Variables and redeploy.`,
    }, 500);
  }

  let upstream: Response;

  try {
    if (provider === 'anthropic') {
      upstream = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ model, system, messages, max_tokens }),
      });
    } else {
      const fullMessages = system
        ? [{ role: 'system', content: system }, ...messages]
        : messages;

      const headers: Record<string, string> = {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      };
      if (provider === 'openrouter') {
        headers['HTTP-Referer'] = 'https://upx-app.vercel.app';
        headers['X-Title'] = 'UpX Planner';
      }

      upstream = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, max_tokens, messages: fullMessages }),
      });
    }
  } catch (e: any) {
    return json({ error: 'UPSTREAM_FETCH_FAILED', message: e?.message || 'Network error' }, 502);
  }

  // Pass through upstream response — but if it's an error, wrap it so the client sees a clear message.
  const text = await upstream.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!upstream.ok) {
    // Surface upstream error context to the client for debugging
    return json({
      error: 'UPSTREAM_ERROR',
      status: upstream.status,
      provider,
      message: data?.error?.message || data?.message || data?.raw || 'Upstream returned an error',
    }, upstream.status);
  }

  return new Response(JSON.stringify(data), {
    status: upstream.status,
    headers: { 'content-type': 'application/json' },
  });
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
