import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/lib/db';
import db from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await connectDB();
  const servers = await db.Server.find().sort({ createdAt: -1 }).lean();
  res.json(servers);
}
