import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB, Tunnel } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { recordActivity } from '@/lib/activity';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await connectDB();
    const { name, type, localServer, remoteServer, localPort, remotePort } = req.body || {};
    if (!name || !localServer || !remoteServer || !localPort || !remotePort) {
      return res.status(400).json({ error: 'name, servers and ports are required' });
    }
    const tunnel = await Tunnel.create({
      name: String(name),
      type: ['ssh', 'direct', 'frp', 'wireguard'].includes(type) ? type : 'ssh',
      localServer,
      remoteServer,
      localPort: Number(localPort),
      remotePort: Number(remotePort),
      status: 'inactive',
    });
    await recordActivity(`تانل «${tunnel.name}» ثبت شد`, 'info', payload.username);
    res.status(201).json({ success: true, tunnel });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
