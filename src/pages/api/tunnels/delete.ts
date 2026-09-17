import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB, Tunnel } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { stopTunnel } from '@/lib/tunnel';
import { recordActivity } from '@/lib/activity';
import { isObjectId, fail, apiError } from '@/lib/validate';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const payload = requireAuth(req, res, 'admin');
  if (!payload) return;
  if (req.method !== 'DELETE') return apiError(res, 405, 'api.methodNotAllowed', 'Method not allowed');
  try {
    await connectDB();
    const { id } = req.query;
    if (!isObjectId(id)) return apiError(res, 400, 'api.idInvalid', 'invalid id');
    const tunnel = await Tunnel.findById(id).lean() as any;
    if (!tunnel) return apiError(res, 404, 'api.tunnelNotFound', 'tunnel not found');
    stopTunnel(String(id));
    await Tunnel.deleteOne({ _id: id });
    await recordActivity(`تانل «${tunnel.name}» حذف شد`, 'info', payload.username, 'act.tunnelDeleted', { name: tunnel.name });
    res.json({ success: true });
  } catch (err: any) {
    fail(res, err);
  }
}
