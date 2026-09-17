import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB, Tunnel } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { stopTunnel } from '@/lib/tunnel';
import { recordActivity } from '@/lib/activity';
import { isObjectId, fail, apiError } from '@/lib/validate';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const payload = requireAuth(req, res, 'admin');
  if (!payload) return;
  if (req.method !== 'POST') return apiError(res, 405, 'api.methodNotAllowed', 'Method not allowed');
  try {
    await connectDB();
    const { id } = req.query || req.body || {};
    if (!isObjectId(id)) return apiError(res, 400, 'api.idInvalid', 'invalid id');
    const tunnel = await Tunnel.findById(id).lean() as any;
    if (!tunnel) return apiError(res, 404, 'api.tunnelNotFound', 'tunnel not found');
    const stopped = stopTunnel(String(id));
    if (!stopped) {
      // nothing running locally (e.g. after restart) — just mark it inactive
      await Tunnel.updateOne({ _id: id }, { $set: { status: 'inactive', pid: null } });
      return res.json({ success: true, wasRunning: false });
    }
    await Tunnel.updateOne({ _id: id }, { $set: { status: 'inactive', pid: null } });
    await recordActivity(`تانل «${tunnel.name}» متوقف شد`, 'info', payload.username, 'act.tunnelStopped', { name: tunnel.name });
    res.json({ success: true, wasRunning: true });
  } catch (err: any) {
    fail(res, err);
  }
}
