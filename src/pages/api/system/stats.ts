import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB, Server, Config, Tunnel, User, UsageSample } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/** Real dashboard numbers: DB counts + 7-day traffic history from UsageSample. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  try {
    await connectDB();
    const [servers, configs, tunnels, users] = await Promise.all([
      Server.find().select('name status cpuUsage ramUsage load1 uptimeSec lastPing lastError').lean() as any,
      Config.find().select('protocol isActive').lean() as any,
      Tunnel.find().select('type status').lean() as any,
      User.countDocuments(),
    ]);
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const samples = (await UsageSample.find({ ts: { $gte: since } })
      .select('serverId ts rxDelta txDelta cpuUsage')
      .sort({ ts: 1 })
      .lean()) as any[];

    // per-day buckets: total rx/tx deltas per server, then summed
    const byDay = new Map<string, { rx: number; tx: number }>();
    for (const s of samples) {
      const day = s.ts.toISOString().slice(0, 10);
      const bucket = byDay.get(day) || { rx: 0, tx: 0 };
      bucket.rx += s.rxDelta || 0;
      bucket.tx += s.txDelta || 0;
      byDay.set(day, bucket);
    }
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) days.push(new Date(Date.now() - i * 24 * 3600 * 1000).toISOString().slice(0, 10));
    const trafficHistory = days.map((day) => ({
      day: day.slice(5),
      rx: byDay.get(day)?.rx || 0,
      tx: byDay.get(day)?.tx || 0,
    }));

    const monthlyTraffic = samples.reduce((sum: number, s: any) => sum + (s.rxDelta || 0) + (s.txDelta || 0), 0);

    res.json({
      servers: servers.length,
      onlineServers: servers.filter((s: any) => s.status === 'online').length,
      activeConfigs: configs.filter((c: any) => c.isActive).length,
      tunnels: tunnels.length,
      users,
      monthlyTraffic,
      serverStatus: Object.fromEntries(servers.map((s: any) => [s.name, s.status])),
      serverMetrics: servers.map((s: any) => ({
        name: s.name,
        status: s.status,
        cpuUsage: s.cpuUsage,
        ramUsage: s.ramUsage,
        load1: s.load1,
        lastPing: s.lastPing,
        lastError: s.lastError,
      })),
      trafficHistory,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
