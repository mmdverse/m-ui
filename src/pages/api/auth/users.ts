import { connectDB } from '@/lib/db';
import { User } from '@/lib/db';

export default async function handler(req: any, res: any) {
  try {
    await connectDB();
    const users = await User.find().lean();
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
