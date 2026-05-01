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
export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // ── Auth gate (same as /api/chat) ─────────────────────────────
  const requireAuth = (process.env.REQUIRE_AUTH ?? 'true').toLowerCase() !== 'false';
  if (requireAuth) {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
    if (!token) {
      return new Response(JSON.stringify({ error: 'AUTH_REQUIRED' }), { status: 401 });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceKey) {
      const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
      const { data: userData, error: authErr } = await admin.auth.getUser(token);
      if (authErr || !userData?.user) {
        return new Response(JSON.stringify({ error: 'AUTH_INVALID' }), { status: 401 });
      }
    }
  }

  // ── ElevenLabs key ─────────────────────────────────────────────
  const elKey = process.env.ELEVENLABS_API_KEY;
  if (!elKey) {
    return new Response(
      JSON.stringify({ error: 'ELEVENLABS_API_KEY not configured in Vercel env vars' }),
      { status: 500 },
    );
  }

  // ── Parse request ──────────────────────────────────────────────
  let body: { text?: string; voice_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { text, voice_id = 'EXAVITQu4vr4xnSDxMaL' } = body; // default: Sarah
  if (!text?.trim()) {
    return new Response(JSON.stringify({ error: 'text is required' }), { status: 400 });
  }

  // ── Call ElevenLabs ───────────────────────────────────────────
  const elRes = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}/stream`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': elKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: text.trim(),
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
    const err = await elRes.text();
    return new Response(
      JSON.stringify({ error: `ElevenLabs ${elRes.status}`, detail: err }),
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
