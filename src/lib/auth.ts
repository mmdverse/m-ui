import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { connectDB, User } from './db';

const DEV_FALLBACK = 'dev-only-secret-change-me';

function secret(): string {
  const value = process.env.JWT_SECRET || '';
  if (value) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }
  // eslint-disable-next-line no-console
  console.warn('[m-ui] JWT_SECRET not set — using an insecure dev-only secret');
  return DEV_FALLBACK;
}

export function signToken(payload: { username: string; role: string }) {
  return jwt.sign(payload, secret(), { expiresIn: '7d' });
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, secret()) as { username: string; role: string };
  } catch {
    return null;
  }
}

/** Guards an API route: requires "Authorization: Bearer <jwt>". */
export function requireAuth(req: NextApiRequest, res: NextApiResponse, role?: string) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    res.status(401).json({ error: 'unauthorized' });
    return null;
  }
  if (role && payload.role !== role) {
    res.status(403).json({ error: 'forbidden' });
    return null;
  }
  return payload;
}

/** Creates the initial admin from env vars if no user exists yet. */
export async function seedAdmin() {
  await connectDB();
  const count = await User.countDocuments();
  if (count > 0) return;
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || '';
  if (!password) {
    throw new Error(
      'ADMIN_PASSWORD is not set and no user exists yet — set it before the first login'
    );
  }
  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters');
  }
  await User.create({ username, passwordHash: bcrypt.hashSync(password, 10), role: 'admin' });
  // eslint-disable-next-line no-console
  console.log(`[m-ui] seeded default admin "${username}"`);
}
