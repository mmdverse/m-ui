import { connectDB, Activity } from './db';

export async function recordActivity(
  event: string,
  type: 'info' | 'success' | 'error' = 'info',
  actor = 'system',
  /** Translation key (act.*) + values; the UI prefers it over `event`. */
  code?: string,
  vars?: Record<string, string | number>,
) {
  try {
    await connectDB();
    await Activity.create({ event, type, actor, ts: new Date(), code: code || '', vars: vars || null });
  } catch {
    // activity recording must never break the main action
  }
}
