import cron from 'node-cron';
import { connectDB, Server, UsageSample } from './db';
import { testAndCollect } from './ssh';
import { recordActivity } from './activity';

/**
 * Periodic collector. Refreshes each server's status/metrics over SSH and stores
 * one UsageSample per run (the dashboard history reads these samples).
 */
export async function refreshAllServers(): Promise<void> {
  await connectDB();
  const servers = await Server.find().lean() as any;
  for (const s of servers) {
    const result = await testAndCollect(s as any);
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
    } else {
      await recordActivity(`مشکل در اتصال به سرور «${s.name}»: ${result.error}`, 'error');
    }
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
