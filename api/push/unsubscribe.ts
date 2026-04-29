import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let body: { endpoint: string; userId: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { endpoint, userId } = body;
  if (!endpoint || !userId) return new Response('Missing fields', { status: 400 });

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return new Response('Server not configured', { status: 500 });

  const supabase = createClient(supabaseUrl, serviceKey);
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', userId);

  return new Response('ok');
}
