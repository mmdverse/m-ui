import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB, Tunnel, Server } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { startTunnel, lastExit } from '@/lib/tunnel';
import { serverCredentials } from '@/lib/credentials';
import { isObjectId, fail, apiError } from '@/lib/validate';
import { recordActivity } from '@/lib/activity';

/** Starts a real SSH reverse tunnel (only type 'ssh' is implemented). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const payload = requireAuth(req, res, 'admin');
  if (!payload) return;
  if (req.method !== 'POST') return apiError(res, 405, 'api.methodNotAllowed', 'Method not allowed');
  let tunnel: any = null;
  try {
    await connectDB();
    const { id } = req.query || req.body || {};
    if (!isObjectId(id)) return apiError(res, 400, 'api.idInvalid', 'invalid id');
    tunnel = await Tunnel.findById(id).lean() as any;
    if (!tunnel) return apiError(res, 404, 'api.tunnelNotFound', 'tunnel not found');
    if (tunnel.type !== 'ssh') {
      return apiError(
        res, 400, 'api.tunnelTypeNotImplemented',
        `تایپ «${tunnel.type}» هنوز پیاده‌سازی نشده؛ فعلاً فقط تانل SSH مخالف (reverse) پشتیبانی می‌شود`,
        { type: tunnel.type },
      );
    }
    const remote = await serverCredentials(tunnel.remoteServer);
    if (!remote) return apiError(res, 404, 'api.serverNotFound', 'remote server not found');

    if (!tunnel.localPort || !tunnel.remotePort) {
      return apiError(res, 400, 'api.tunnelPortsRequired', 'تانل بدون پورت محلی/راه‌دور قابل اجرا نیست');
    }
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
    await recordActivity(
      `تانل «${tunnel.name}» فعال شد (pid ${pid})`,
      'success', payload.username, 'act.tunnelStarted', { name: tunnel.name, pid },
    );
    res.json({ success: true, pid });
  } catch (err: any) {
    if (tunnel && tunnel._id) {
      await Tunnel.updateOne({ _id: tunnel._id }, { $set: { status: 'error', lastError: err.message } }).catch(() => {});
    }
    fail(res, err);
  }
}

export function exitInfo(id: string) {
  return lastExit(id);
}
