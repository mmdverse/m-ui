import { connectDB } from '@/lib/db';
import { Config } from '@/lib/db';

export default async function handler(req: any, res: any) {
  try {
    await connectDB();
    const configs = await Config.find().sort({ createdAt: -1 }).lean();
    res.json(configs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
