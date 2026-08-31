import crypto from 'crypto';

/**
 * Computes a deterministic SHA-256 hash of a request payload
 */
export function hashPayload(payload: unknown): string {
  if (!payload) return '';
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto.createHash('sha256').update(serialized).digest('hex');
}
