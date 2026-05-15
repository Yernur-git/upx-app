// Test: does Edge runtime work for push endpoints?
export const config = { runtime: 'edge' };

export default async function handler(_req: Request) {
  return new Response(JSON.stringify({
    ok: true,
    runtime: 'edge',
    time: new Date().toISOString(),
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
