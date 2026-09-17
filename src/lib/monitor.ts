import cron from 'node-cron';
import { connectDB, Server, UsageSample } from './db';
import { testAndCollect } from './ssh';
import { recordActivity } from './activity';
import { openServer } from './credentials';

/**
 * Periodic collector. Refreshes each server's status/metrics over SSH and stores
 * one UsageSample per run (the dashboard history reads these samples).
 *
 * Three deliberate behaviours, all from audit findings:
 *  - limited parallelism (M2-11): the loop was strictly serial, so ten
 *    unreachable hosts at a 10 s ready-timeout made one run take 100 s+;
 *  - an overlap guard, because cron keeps firing while a slow run is still going
 *    and two concurrent runs write duplicate samples and wrong deltas;
 *  - activity is recorded only when a server *changes* state. Logging every
 *    failure on every tick buried real events under identical rows (M2-10).
 */

const PARALLEL = Number(process.env.MONITOR_PARALLEL || 4);
let running = false;

async function refreshOne(s: any): Promise<void> {
  const result = await testAndCollect(openServer({ ...s }) as any);
  const wasOnline = s.status === 'online';
  const patch: any = {
    status: result.status,
    lastPing: new Date(),
    lastError: result.error || '',
  };
  if (result.ok) {
    patch.cpuUsage = result.cpuUsage;
    patch.ramUsage = result.ramUsage;
    patch.load1 = result.load1;
    patch.uptimeSec = result.uptimeSec;
    patch.rxBytes = result.rxBytes;
    patch.txBytes = result.txBytes;
  }
  await Server.updateOne({ _id: s._id }, { $set: patch });

  if (result.ok) {
    const prev = await UsageSample.findOne({ serverId: s._id }).sort({ ts: -1 }).lean() as any;
    const rxBytes = result.rxBytes || 0;
    const txBytes = result.txBytes || 0;
    // delta is only meaningful when the counter is monotonic (no server restart)
    const rxDelta = prev && rxBytes >= (prev.rxBytes || 0) ? rxBytes - (prev.rxBytes || 0) : 0;
    const txDelta = prev && txBytes >= (prev.txBytes || 0) ? txBytes - (prev.txBytes || 0) : 0;
    await UsageSample.create({
      serverId: s._id,
      ts: new Date(),
      cpuUsage: result.cpuUsage,
      ramUsage: result.ramUsage,
      load1: result.load1,
      uptimeSec: result.uptimeSec,
      rxBytes,
      txBytes,
      rxDelta,
      txDelta,
    });
    if (!wasOnline) {
      await recordActivity(`سرور «${s.name}» دوباره آنلاین شد`, 'success', 'system', 'act.serverOnline', { name: s.name });
    }
  } else if (wasOnline || s.status === 'unknown') {
    // transition into failure only — steady-state failures are not re-logged
    await recordActivity(
      `مشکل در اتصال به سرور «${s.name}»: ${result.error}`,
      'error', 'system', 'act.serverConnError', { name: s.name, error: String(result.error || '') },
    );
  }
}

export async function refreshAllServers(): Promise<void> {
  if (running) return; // a previous tick is still working
  running = true;
  try {
    await connectDB();
    const servers = await Server.find().lean() as any[];
    for (let i = 0; i < servers.length; i += PARALLEL) {
      const batch = servers.slice(i, i + PARALLEL);
      await Promise.all(batch.map((s) => refreshOne(s).catch(() => {})));
    }
  } finally {
    running = false;
  }
}

let started = false;

export function startMonitor() {
  if (started) return;
  started = true;
  const interval = process.env.MONITOR_INTERVAL || '*/10 * * * *';
  cron.schedule(interval, () => {
    refreshAllServers().catch((e) => console.error('[m-ui] monitor error:', e.message));
  });
}
