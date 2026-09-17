import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB, Server, Config, Tunnel } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
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
    const server = await Server.findById(id).lean() as any;
    if (!server) return apiError(res, 404, 'api.serverNotFound', 'server not found');
    const configs = await Config.countDocuments({ serverId: id });
    const tunnels = await Tunnel.countDocuments({
      $or: [{ localServer: id }, { remoteServer: id }],
    });
    if (configs > 0 || tunnels > 0) {
      return res
        .status(400)
        .json({
          error: `server has ${configs} config(s) and ${tunnels} tunnel(s); delete them first`,
          code: 'api.serverHasDependents',
          vars: { configs, tunnels },
        });
    }
    await Server.deleteOne({ _id: id });
    await recordActivity(`سرور «${server.name}» حذف شد`, 'info', payload.username, 'act.serverDeleted', { name: server.name });
    res.json({ success: true });
  } catch (err: any) {
    fail(res, err);
  }
}
