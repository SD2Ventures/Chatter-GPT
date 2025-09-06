import crypto from 'crypto';

export const nowIso = () => new Date().toISOString();

export function hashAuthor(name?: string) {
  return crypto.createHash('sha1').update(name || '').digest('hex');
}

export function dedupeKey(...parts: string[]) {
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}
