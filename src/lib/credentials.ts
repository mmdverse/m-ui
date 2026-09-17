import { Server, Config } from './db';
import { open } from './secrets';

/**
 * Every place that actually *uses* a stored credential goes through here.
 * Documents are fetched with `lean()` (setters/getters don't apply), so
 * decryption is explicit and easy to audit — see lib/secrets.ts.
 */

const SERVER_SECRETS = ['password', 'sshKey'];
const CONFIG_SECRETS = ['password', 'socksPass', 'wgClientPriv'];

function openInPlace<T extends Record<string, any>>(doc: T | null, fields: string[]): T | null {
  if (!doc) return doc;
  const d = doc as Record<string, any>;
  for (const f of fields) if (d[f]) d[f] = open(d[f]);
  return doc;
}

export function openServer<T extends Record<string, any>>(doc: T | null): T | null {
  return openInPlace(doc, SERVER_SECRETS);
}

export function openConfig<T extends Record<string, any>>(doc: T | null): T | null {
  return openInPlace(doc, CONFIG_SECRETS);
}

/** Credentials of a server, ready to be handed to ssh.ts / tunnel.ts. */
export async function serverCredentials(id: unknown) {
  return openServer(await Server.findById(id).lean() as any);
}

/** A config with its secret fields decrypted. */
export async function configWithSecrets(id: unknown) {
  return openConfig(await Config.findById(id).lean() as any);
}
