import { connectDB } from '@/lib/db';
import { Server } from '@/lib/db';

export default async function handler(req: any, res: any) {
  try {
    await connectDB();
    const servers = await Server.find().sort({ createdAt: -1 }).lean();
    res.json(servers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
