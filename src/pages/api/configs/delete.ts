import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB, Config } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { recordActivity } from '@/lib/activity';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await connectDB();
    const { id } = req.query;
    const config = await Config.findById(id).lean() as any;
    if (!config) return res.status(404).json({ error: 'config not found' });
    await Config.deleteOne({ _id: id });
    await recordActivity(`کانفیگ «${config.name}» حذف شد`, 'info', payload.username);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
