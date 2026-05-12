import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

/**
 * Vercel env vars required:
 *   ELEVENLABS_API_KEY  — ElevenLabs secret key (never exposed to client)
 *   REQUIRE_AUTH        — "true" (default) / "false"
 *   VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY — for auth gate
 *
 * POST /api/tts
 * Body: { text: string, voice_id?: string }
 * Response: audio/mpeg stream from ElevenLabs
 */

// ── Abuse prevention ─────────────────────────────────────────────────────
// ElevenLabs charges per character. Without a length cap a single user can
// submit megabytes and drain the budget in one request.
const MAX_TEXT_LEN = 1000;

// ElevenLabs voice IDs are 20-char base62 strings. Anything else (including
// `..` / `/` path-traversal segments) is rejected — without this allowlist
// `voice_id` interpolates straight into the upstream URL and a crafted
// value would pivot to other ElevenLabs endpoints under the server's key.
const VOICE_ID_RE = /^[A-Za-z0-9]{15,30}$/;
const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Sarah

// Simple in-memory per-user rate limit (same pattern as /api/chat). Edge
// instances share warm memory for short bursts; for global throttling use KV.
const rateBucket = new Map<string, { count: number; windowStart: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_PER_WINDOW = 20;
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

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // ── Auth gate (same as /api/chat) ─────────────────────────────
  const requireAuth = (process.env.REQUIRE_AUTH ?? 'true').toLowerCase() !== 'false';
  let userKey = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
  if (requireAuth) {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
    if (!token) {
      return new Response(JSON.stringify({ error: 'AUTH_REQUIRED' }), { status: 401 });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      // Fail CLOSED — never silently bypass token validation.
      console.error('[tts] REQUIRE_AUTH=true but Supabase service key not configured.');
      return new Response(JSON.stringify({ error: 'SERVER_MISCONFIGURED' }), { status: 503 });
    }
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: userData, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'AUTH_INVALID' }), { status: 401 });
    }
    userKey = userData.user.id;
  }

  // ── Rate limit ─────────────────────────────────────────────────
  if (!checkRate(userKey)) {
    return new Response(
      JSON.stringify({ error: 'RATE_LIMITED', message: `Too many TTS requests — wait a minute. (Cap: ${RATE_MAX_PER_WINDOW}/min)` }),
      { status: 429 },
    );
  }

  // ── ElevenLabs key ─────────────────────────────────────────────
  const elKey = process.env.ELEVENLABS_API_KEY;
  if (!elKey) {
    return new Response(
      JSON.stringify({ error: 'ELEVENLABS_API_KEY not configured in Vercel env vars' }),
      { status: 500 },
    );
  }

  // ── Parse + validate request ──────────────────────────────────
  let body: { text?: string; voice_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) {
    return new Response(JSON.stringify({ error: 'text is required' }), { status: 400 });
  }
  if (text.length > MAX_TEXT_LEN) {
    return new Response(
      JSON.stringify({ error: 'PAYLOAD_TOO_LARGE', message: `text exceeds ${MAX_TEXT_LEN} chars` }),
      { status: 413 },
    );
  }

  const requestedVoice = body.voice_id ?? DEFAULT_VOICE_ID;
  if (!VOICE_ID_RE.test(requestedVoice)) {
    return new Response(
      JSON.stringify({ error: 'BAD_VOICE_ID', message: 'voice_id must be 15-30 base62 chars' }),
      { status: 400 },
    );
  }

  // ── Call ElevenLabs ───────────────────────────────────────────
  const elRes = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(requestedVoice)}/stream`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': elKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.80,
          style: 0.20,
          use_speaker_boost: true,
        },
      }),
    },
  );

  if (!elRes.ok) {
    // Log full detail server-side, return a generic message to the client so
    // we don't leak ElevenLabs internals (token counts, account info, etc).
    const err = await elRes.text();
    console.error('[tts] upstream error', elRes.status, err.slice(0, 500));
    return new Response(
      JSON.stringify({ error: `TTS_UPSTREAM_${elRes.status}`, message: 'TTS provider error' }),
      { status: 502 },
    );
  }

  // Stream audio back to client
  return new Response(elRes.body, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
    },
  });
}
