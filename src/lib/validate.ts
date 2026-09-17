import type { NextApiResponse } from 'next';
import { PublicError } from './errors';

/**
 * Every user-facing error carries a stable `code` next to the (Persian) message
 * plus optional `vars`. The front-end renders `t(code, vars)` in the selected
 * language and falls back to `error` verbatim for anything it does not know —
 * so the API stays usable with curl and nothing regresses.
 */
export function apiError(
  res: NextApiResponse,
  status: number,
  code: string,
  message: string,
  vars?: Record<string, string | number>,
) {
  return res.status(status).json(vars ? { error: message, code, vars } : { error: message, code });
}

/** Fail-closed input validation helpers shared by the API routes. */

export function isObjectId(value: unknown): boolean {
  return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
}

export function parsePort(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value.trim()) : Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 65535) return null;
  return n;
}

export function clampText(value: unknown, max: number): string {
  return String(value ?? '').slice(0, max);
}

/**
 * One error shape for every route: invalid input is the caller's problem (400),
 * everything else is ours (500, generic message). Internal messages were being
 * returned verbatim, which leaked Mongoose/schema internals (audit P1-6).
 */
export function fail(res: NextApiResponse, err: any) {
  if (err instanceof PublicError) {
    return apiError(res, err.status, err.code || 'api.invalidRequest', err.message, err.vars);
  }
  const name = err?.name || '';
  const msg = String(err?.message || '');
  if (name === 'CastError' || name === 'ValidationError' || /Cast to ObjectId failed/.test(msg)) {
    return apiError(res, 400, 'api.invalidRequest', 'درخواست نامعتبر است (شناسه یا مقدار ورودی)');
  }
  // eslint-disable-next-line no-console
  console.error('[m-ui] route error:', msg);
  return apiError(res, 500, 'api.internal', 'خطای داخلی سرور');
}
