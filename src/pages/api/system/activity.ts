import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB, Activity } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  try {
    await connectDB();
    const items = await Activity.find().sort({ ts: -1 }).limit(50).lean() as any;
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
