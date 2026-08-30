import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB, Tunnel } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { stopTunnel } from '@/lib/tunnel';
import { recordActivity } from '@/lib/activity';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await connectDB();
    const { id } = req.query || req.body || {};
    const tunnel = await Tunnel.findById(id).lean() as any;
    if (!tunnel) return res.status(404).json({ error: 'tunnel not found' });
    const stopped = stopTunnel(String(id));
    if (!stopped) {
      // nothing running locally (e.g. after restart) — just mark it inactive
      await Tunnel.updateOne({ _id: id }, { $set: { status: 'inactive', pid: null } });
      return res.json({ success: true, wasRunning: false });
    }
    await Tunnel.updateOne({ _id: id }, { $set: { status: 'inactive', pid: null } });
    await recordActivity(`تانل «${tunnel.name}» متوقف شد`, 'info', payload.username);
    res.json({ success: true, wasRunning: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
