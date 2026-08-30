import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB, Tunnel } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { tunnelRunning, lastExit } from '@/lib/tunnel';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  try {
    await connectDB();
    const tunnels = await Tunnel.find().sort({ createdAt: -1 }).lean() as any[];
    const now = Date.now();
    // reflect real process state (in-memory registry) on top of the stored status:
    // a tunnel marked active in the DB but with no live process (e.g. after a
    // restart) is reported as inactive rather than pretending to be up
    const result = tunnels.map((t) => {
      const running = t.type === 'ssh' && tunnelRunning(String(t._id));
      const exit = lastExit(String(t._id));
      const dbActive = t.status === 'active';
      return {
        ...t,
        status: running ? 'active' : dbActive && t.type === 'ssh' ? 'inactive' : t.status,
        needsRestart: dbActive && !running && t.type === 'ssh',
        lastExit: exit && now - exit.at < 5 * 60_000 ? exit : undefined,
      };
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
