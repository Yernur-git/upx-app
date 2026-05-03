import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

const URLS: Record<string, string> = {
  anthropic: 'https://api.anthropic.com/v1/messages',
  openai: 'https://api.openai.com/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
};

// ── Server-side caps & abuse prevention ──────────────────────────────────
const MAX_TOKENS_HARD_CAP = 4000;        // refuse anything bigger from client
const MAX_SYSTEM_PROMPT_LEN = 32000;     // ~8k tokens — generous but bounded
const MAX_USER_MESSAGE_LEN  = 8000;
const MAX_HISTORY_MESSAGES  = 30;

// Naive in-memory rate limit. Edge functions have warm instances so this works
// for short bursts; for global throttling use Upstash KV.
//   key = userId-or-ip → { count, windowStart }
const rateBucket = new Map<string, { count: number; windowStart: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_PER_WINDOW = 30;

function checkRate(key: string): boolean {
  const now = Date.now();
  const cur = rateBucket.get(key);
  if (!cur || now - cur.windowStart > RATE_WINDOW_MS) {
    rateBucket.set(key, { count: 1, windowStart: now });
    return true;
  }
  cur.count++;
  return cur.count <= RATE_MAX_PER_WINDOW;
}

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

  // ---------- AUTH GATE ----------
  const requireAuth = (process.env.REQUIRE_AUTH ?? 'true').toLowerCase() !== 'false';
  let userKey = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
  if (requireAuth) {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
    if (!token) {
      return json({ error: 'AUTH_REQUIRED', message: 'Sign in with email to use the default AI key, or switch to Custom and provide your own.' }, 401);
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      // Fail CLOSED — never silently bypass token validation. Otherwise the proxy
      // is wide open: any random Bearer string passes the header check above.
      console.error('[chat] REQUIRE_AUTH=true but Supabase service key not configured. Refusing request.');
      return json({
        error: 'SERVER_MISCONFIGURED',
        message: 'AI proxy requires Supabase service-role key to validate sessions. Contact the admin.',
      }, 503);
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: userData, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !userData?.user) {
      return json({ error: 'AUTH_INVALID', message: 'Session expired. Sign in again.' }, 401);
    }
    userKey = userData.user.id;
  }

  // ---------- RATE LIMIT ----------
  if (!checkRate(userKey)) {
    return json({
      error: 'RATE_LIMITED',
      message: `Too many AI requests — please wait a minute. (Cap: ${RATE_MAX_PER_WINDOW}/min)`,
    }, 429);
  }

  // ---------- PARSE & VALIDATE ----------
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'BAD_REQUEST', message: 'Invalid JSON body' }, 400);
  }

  const { provider, model, system, messages } = body || {};
  let { max_tokens } = body || {};
  max_tokens = Math.min(Math.max(parseInt(String(max_tokens ?? 2000), 10) || 2000, 100), MAX_TOKENS_HARD_CAP);

  if (!provider || !messages) {
    return json({ error: 'BAD_REQUEST', message: 'Missing provider or messages' }, 400);
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: 'BAD_REQUEST', message: 'messages must be a non-empty array' }, 400);
  }
  if (messages.length > MAX_HISTORY_MESSAGES) {
    return json({ error: 'PAYLOAD_TOO_LARGE', message: `Too many history messages (max ${MAX_HISTORY_MESSAGES}).` }, 413);
  }
  if (typeof system === 'string' && system.length > MAX_SYSTEM_PROMPT_LEN) {
    return json({ error: 'PAYLOAD_TOO_LARGE', message: 'System prompt too large.' }, 413);
  }
  for (const m of messages) {
    if (typeof m?.content !== 'string') {
      return json({ error: 'BAD_REQUEST', message: 'message.content must be a string' }, 400);
    }
    if (m.content.length > MAX_USER_MESSAGE_LEN) {
      return json({ error: 'PAYLOAD_TOO_LARGE', message: 'A message is too long.' }, 413);
    }
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
    // Log raw upstream error server-side, return a generic message to the client
    // so we don't leak provider-internal details (token counts, key prefixes, etc).
    console.error('[chat] upstream error', provider, upstream.status, JSON.stringify(data).slice(0, 500));
    const safeMessage = upstream.status === 429
      ? 'AI provider rate limit hit — try again in a minute.'
      : upstream.status === 401 || upstream.status === 403
        ? 'AI provider rejected the request (auth issue on the server). Admin should check API key.'
        : 'AI provider returned an error. Please try again.';
    return json({
      error: 'UPSTREAM_ERROR',
      status: upstream.status,
      provider,
      message: safeMessage,
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
