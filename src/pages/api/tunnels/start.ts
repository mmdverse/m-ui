import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB, Tunnel, Server } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { startTunnel, lastExit } from '@/lib/tunnel';
import { recordActivity } from '@/lib/activity';

/** Starts a real SSH reverse tunnel (only type 'ssh' is implemented). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let tunnel: any = null;
  try {
    await connectDB();
    const { id } = req.query || req.body || {};
    tunnel = await Tunnel.findById(id).lean() as any;
    if (!tunnel) return res.status(404).json({ error: 'tunnel not found' });
    if (tunnel.type !== 'ssh') {
      return res.status(400).json({
        error: `تایپ «${tunnel.type}» هنوز پیاده‌سازی نشده؛ فعلاً فقط تانل SSH مخالف (reverse) پشتیبانی می‌شود`,
      });
    }
    const remote = await Server.findById(tunnel.remoteServer).lean() as any;
    if (!remote) return res.status(404).json({ error: 'remote server not found' });

    const pid = await startTunnel(String(tunnel._id), {
      host: remote.host,
      port: remote.port,
      username: remote.username,
      authType: remote.authType,
      password: remote.password,
      sshKey: remote.sshKey,
      localPort: tunnel.localPort,
      remotePort: tunnel.remotePort,
    });
    await Tunnel.updateOne({ _id: tunnel._id }, { $set: { status: 'active', pid, lastError: '' } });
    await recordActivity(`تانل «${tunnel.name}» فعال شد (pid ${pid})`, 'success', payload.username);
    res.json({ success: true, pid });
  } catch (err: any) {
    if (tunnel && tunnel._id) {
      await Tunnel.updateOne({ _id: tunnel._id }, { $set: { status: 'error', lastError: err.message } }).catch(() => {});
    }
    res.status(500).json({ error: err.message });
  }
}

export function exitInfo(id: string) {
  return lastExit(id);
}
