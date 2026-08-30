import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB, Server, Config, Tunnel } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { recordActivity } from '@/lib/activity';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await connectDB();
    const { id } = req.query;
    const server = await Server.findById(id).lean() as any;
    if (!server) return res.status(404).json({ error: 'server not found' });
    const configs = await Config.countDocuments({ serverId: id });
    const tunnels = await Tunnel.countDocuments({
      $or: [{ localServer: id }, { remoteServer: id }],
    });
    if (configs > 0 || tunnels > 0) {
      return res
        .status(400)
        .json({ error: `server has ${configs} config(s) and ${tunnels} tunnel(s); delete them first` });
    }
    await Server.deleteOne({ _id: id });
    await recordActivity(`سرور «${server.name}» حذف شد`, 'info', payload.username);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
