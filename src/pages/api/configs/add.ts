import { connectDB } from '@/lib/db';
import { Config } from '@/lib/db';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await connectDB();
    const config = await Config.create({ ...req.body, isActive: true });
    res.json({ success: true, config });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
