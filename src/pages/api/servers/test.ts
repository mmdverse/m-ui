import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB, Server } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { testAndCollect } from '@/lib/ssh';
import { recordActivity } from '@/lib/activity';

/** Real SSH connectivity test: connects, reads /proc metrics, stores them. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  try {
    await connectDB();
    const { id } = req.query;
    const server = await Server.findById(id).lean() as any;
    if (!server) return res.status(404).json({ error: 'server not found' });

    const result = await testAndCollect(server as any);
    const patch: any = { status: result.status, lastPing: new Date(), lastError: result.error || '' };
    if (result.ok) {
      patch.cpuUsage = result.cpuUsage;
      patch.ramUsage = result.ramUsage;
      patch.load1 = result.load1;
      patch.uptimeSec = result.uptimeSec;
      patch.rxBytes = result.rxBytes;
      patch.txBytes = result.txBytes;
    }
    await Server.updateOne({ _id: id }, { $set: patch });
    await recordActivity(
      result.ok
        ? `تست اتصال سرور «${server.name}» موفق (CPU %${result.cpuUsage})`
        : `تست اتصال سرور «${server.name}» ناموفق: ${result.error}`,
      result.ok ? 'success' : 'error',
      payload.username
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
