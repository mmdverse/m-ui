import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB, Tunnel } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { recordActivity } from '@/lib/activity';
import { parsePort, clampText, fail, apiError } from '@/lib/validate';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const payload = requireAuth(req, res, 'admin');
  if (!payload) return;
  if (req.method !== 'POST') return apiError(res, 405, 'api.methodNotAllowed', 'Method not allowed');
  try {
    await connectDB();
    const { name, type, localServer, remoteServer, localPort, remotePort } = req.body || {};
    if (!name || !localServer || !remoteServer) {
      return apiError(res, 400, 'api.tunnelFieldsRequired', 'name, servers and ports are required');
    }
    const lPort = parsePort(localPort);
    const rPort = parsePort(remotePort);
    if (lPort === null || rPort === null) {
      return apiError(res, 400, 'api.tunnelPortsRange', 'پورت‌ها باید عددی بین ۱ تا ۶۵۵۳۵ باشند');
    }
    const tunnel = await Tunnel.create({
      name: clampText(name, 120),
      type: ['ssh', 'direct', 'frp', 'wireguard'].includes(type) ? type : 'ssh',
      localServer,
      remoteServer,
      localPort: lPort,
      remotePort: rPort,
      status: 'inactive',
    });
    await recordActivity(`تانل «${tunnel.name}» ثبت شد`, 'info', payload.username, 'act.tunnelCreated', { name: tunnel.name });
    res.status(201).json({ success: true, tunnel });
  } catch (err: any) {
    fail(res, err);
  }
}
