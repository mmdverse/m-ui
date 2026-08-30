import { connectDB, Activity } from './db';

export async function recordActivity(
  event: string,
  type: 'info' | 'success' | 'error' = 'info',
  actor = 'system'
) {
  try {
    await connectDB();
    await Activity.create({ event, type, actor, ts: new Date() });
  } catch {
    // activity recording must never break the main action
  }
}
