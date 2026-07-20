import { connectDB } from '@/lib/db';
import db from '@/lib/db';
export default async function handler(req: any, res: any) {
  await connectDB();
  const tunnels = await db.Tunnel.find().sort({ createdAt: -1 }).lean();
  res.json(tunnels);
}
