// Diagnostic endpoint — remove after debugging
export const config = { runtime: 'nodejs' };

export default async function handler(_req: Request) {
  const checks: Record<string, string> = {};

  try {
    const mod = await import('web-push');
    checks.module_keys = Object.keys(mod).join(', ');
    checks.has_default = String('default' in mod);
    checks.default_type = typeof mod.default;
    checks.has_setVapidDetails = typeof mod.setVapidDetails;
    checks.default_has_setVapidDetails = typeof mod.default?.setVapidDetails;

    // Try using it directly (not .default)
    const wp = mod.default || mod;
    checks.resolved_type = typeof wp.setVapidDetails;
  } catch (err: unknown) {
    checks.error = (err as Error).message?.slice(0, 300);
  }

  return new Response(JSON.stringify(checks, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}
