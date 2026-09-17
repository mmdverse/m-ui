import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB, Config } from '@/lib/db';
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
    const config = await Config.findById(id).lean() as any;
    if (!config) return apiError(res, 404, 'api.configNotFound', 'config not found');
    await Config.deleteOne({ _id: id });
    await recordActivity(`کانفیگ «${config.name}» حذف شد`, 'info', payload.username, 'act.configDeleted', { name: config.name });
    res.json({ success: true });
  } catch (err: any) {
    fail(res, err);
  }
}
