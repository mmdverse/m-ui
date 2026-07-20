import { connectDB } from '@/lib/db';
import db from '@/lib/db';
export default async function handler(req: any, res: any) {
  await connectDB();
  const users = await db.User.find().lean();
  res.json(users);
}
