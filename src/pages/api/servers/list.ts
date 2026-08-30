import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB, Server } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

const SAFE_FIELDS =
  'name host port username authType location geoSource status isTunnel cpuUsage ramUsage load1 uptimeSec rxBytes txBytes lastPing lastError createdAt';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  try {
    await connectDB();
    const servers = await Server.find()
      .select(SAFE_FIELDS)
      .sort({ createdAt: -1 })
      .lean() as any;
    res.json(servers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
