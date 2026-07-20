import { connectDB } from '@/lib/db';
import { Server } from '@/lib/db';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await connectDB();
    const server = await Server.create({ ...req.body, status: 'offline' });
    res.json({ success: true, server });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
