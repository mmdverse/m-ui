import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB, Tunnel } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { stopTunnel } from '@/lib/tunnel';
import { recordActivity } from '@/lib/activity';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await connectDB();
    const { id } = req.query;
    const tunnel = await Tunnel.findById(id).lean() as any;
    if (!tunnel) return res.status(404).json({ error: 'tunnel not found' });
    stopTunnel(String(id));
    await Tunnel.deleteOne({ _id: id });
    await recordActivity(`تانل «${tunnel.name}» حذف شد`, 'info', payload.username);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
