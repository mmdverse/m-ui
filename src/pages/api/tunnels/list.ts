import { connectDB } from '@/lib/db';
import { Tunnel } from '@/lib/db';

export default async function handler(req: any, res: any) {
  try {
    await connectDB();
    const tunnels = await Tunnel.find().sort({ createdAt: -1 }).lean();
    res.json(tunnels);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
