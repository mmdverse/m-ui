/**
 * Server startup hook (Next.js instrumentation).
 *
 * 1. Fail loudly on a misconfigured production deployment. The app used to boot
 *    fine without JWT_SECRET and only fail on the first login attempt, which
 *    contradicted .env.example (audit P1-7).
 * 2. Start the periodic SSH monitor (node-cron) once per server process.
 *    Tunnels keep an in-memory registry: after a restart they are reported as
 *    inactive and must be restarted from the UI.
 */
export async function register() {
  // Keep the exact `=== 'nodejs'` shape: Next compiles this file for the edge
  // runtime too and relies on dead-code elimination of the guarded dynamic
  // import below to keep Node built-ins out of that bundle.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    checkEnv();
    const { startMonitor } = await import('./lib/monitor');
    startMonitor();
  }
}

function checkEnv() {
  if (process.env.NODE_ENV === 'production') {
    const missing: string[] = [];
    if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');
    if (!process.env.MONGODB_URI) missing.push('MONGODB_URI');
    if (missing.length) {
      throw new Error(
        `[m-ui] refusing to start: ${missing.join(', ')} not set (see .env.example)`
      );
    }
    if (!process.env.M_UI_ENCRYPTION_KEY) {
      // eslint-disable-next-line no-console
      console.warn('[m-ui] M_UI_ENCRYPTION_KEY not set — deriving it from JWT_SECRET');
    }
  }
}
