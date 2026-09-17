/**
 * An error the caller is expected to see: actionable, non-sensitive, and raised
 * deliberately (missing sshpass, tunnel already running, ...). Anything else
 * stays a generic 500 so internals never leak (audit P1-6).
 */
export class PublicError extends Error {
  status: number;
  /** Stable machine code the front-end translates (see src/i18n/fa.ts). */
  code?: string;
  vars?: Record<string, string | number>;
  constructor(message: string, status = 400, code?: string, vars?: Record<string, string | number>) {
    super(message);
    this.name = 'PublicError';
    this.status = status;
    this.code = code;
    this.vars = vars;
  }
}
