import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB, Server } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { recordActivity } from '@/lib/activity';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await connectDB();
    const { name, host, port, username, authType, password, sshKey, location } = req.body || {};
    if (!name || !host) return res.status(400).json({ error: 'name and host are required' });
    if (!['password', 'key'].includes(authType)) {
      return res.status(400).json({ error: 'authType must be password or key' });
    }
    const server = await Server.create({
      name: String(name),
      host: String(host),
      port: Number(port) || 22,
      username: username || 'root',
      authType,
      password: authType === 'password' ? String(password || '') : '',
      sshKey: authType === 'key' ? String(sshKey || '') : '',
      location: location || 'ایران',
      status: 'unknown',
    });
    await recordActivity(`سرور «${server.name}» اضافه شد`, 'info', payload.username);
    res.json({ success: true, server });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
