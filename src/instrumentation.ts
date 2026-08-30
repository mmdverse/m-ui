/**
 * Server startup hook (Next.js instrumentation).
 * Starts the periodic SSH monitor (node-cron) once per server process.
 * Tunnels keep an in-memory process registry: after a restart they are
 * reported as inactive and must be restarted from the UI.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startMonitor } = await import('./lib/monitor');
    startMonitor();
  }
}
