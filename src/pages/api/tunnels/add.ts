import { connectDB } from '@/lib/db';
import { Tunnel } from '@/lib/db';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await connectDB();
    const tunnel = await Tunnel.create({ ...req.body, status: 'inactive' });
    res.json({ success: true, tunnel });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
