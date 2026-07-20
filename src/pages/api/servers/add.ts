import { connectDB } from '@/lib/db';
import db from '@/lib/db';

export default async function handler(req: any, res: any) {
  try {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  await connectDB();
  const server = await Server.create({ ...req.body, status: 'offline' });
  res.json({ success: true, server });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || "Internal error" });
  }
}