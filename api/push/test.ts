// Diagnostic endpoint — remove after debugging
export const config = { runtime: 'nodejs' };

export default async function handler(_req: Request) {
  const out: Record<string, string> = {};
  out.start = new Date().toISOString();
  out.node = process.version;

  // Try require() — works in Node.js runtime even with "type": "module"
  // because Vercel bundles api/ separately
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const webpush = require('web-push');
    out.require_wp = typeof webpush.setVapidDetails;
  } catch (e: unknown) {
    out.require_wp_err = String((e as Error).message).slice(0, 200);
  }

  // Try createRequire
  try {
    const { createRequire } = await import('node:module');
    const require2 = createRequire(import.meta.url);
    const webpush = require2('web-push');
    out.createRequire_wp = typeof webpush.setVapidDetails;
  } catch (e: unknown) {
    out.createRequire_err = String((e as Error).message).slice(0, 200);
  }

  // Try dynamic import with timeout
  try {
    const result = await Promise.race([
      import('web-push'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT 5s')), 5000))
    ]);
    out.dynamic_import = typeof result;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    out.dynamic_keys = Object.keys(result as any).slice(0, 5).join(',');
  } catch (e: unknown) {
    out.dynamic_import_err = String((e as Error).message).slice(0, 200);
  }

  return new Response(JSON.stringify(out, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}
