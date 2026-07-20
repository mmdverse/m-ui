import { connectDB } from '@/lib/db';
import db from '@/lib/db';
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  await connectDB();
  const tunnel = await db.Tunnel.create({ ...req.body, status: 'inactive' });
  res.json({ success: true, tunnel });
}
