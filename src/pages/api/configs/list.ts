import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB, Config } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// sensitive material stays server-side (only the link endpoint uses it)
const PUBLIC_FIELDS = '-password -wgClientPriv';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  try {
    await connectDB();
    const configs = await Config.find().select(PUBLIC_FIELDS).sort({ createdAt: -1 }).lean() as any[];
    res.json(configs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
