// Minimal diagnostic — no external imports
export const config = { runtime: 'nodejs' };

export default async function handler(_req: Request) {
  const out: Record<string, string> = {};
  out.ok = 'yes';
  out.time = new Date().toISOString();
  out.node = process.version;
  out.cwd = process.cwd();

  // Check if web-push exists in node_modules
  try {
    const fs = require('fs');
    const path = require('path');
    // Check common locations
    const locations = [
      path.join(process.cwd(), 'node_modules', 'web-push'),
      path.join(__dirname, '..', '..', 'node_modules', 'web-push'),
      path.join(__dirname, 'node_modules', 'web-push'),
    ];
    for (const loc of locations) {
      out[`exists_${loc.slice(-40)}`] = String(fs.existsSync(loc));
    }

    // List what's in node_modules if it exists
    const nmPath = path.join(process.cwd(), 'node_modules');
    if (fs.existsSync(nmPath)) {
      const dirs = fs.readdirSync(nmPath).filter((d: string) => d.startsWith('web'));
      out.web_modules = dirs.join(',') || 'none';
    } else {
      out.node_modules = 'NOT FOUND';
    }
  } catch (e: unknown) {
    out.fs_error = String((e as Error).message).slice(0, 200);
  }

  return new Response(JSON.stringify(out, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}
