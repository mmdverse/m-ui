import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB, Config, Server } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { generateLink } from '@/lib/links';

/** Returns the real share link for a stored config (UUID preserved server-side). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  try {
    await connectDB();
    const { id } = req.query;
    const config = await Config.findById(id).lean() as any;
    if (!config) return res.status(404).json({ error: 'config not found' });
    const server = await Server.findById(config.serverId).lean() as any;
    if (!server) return res.status(404).json({ error: 'server not found' });

    const result = generateLink(config as any, { host: server.host });
    if ('error' in result) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ link: result.link, protocol: config.protocol });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
