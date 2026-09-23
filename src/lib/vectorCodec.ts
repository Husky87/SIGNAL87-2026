/**
 * Compact storage for embedding vectors.
 *
 * Each vector is stored as signed 8-bit integers plus one scale factor, base64
 * encoded: 512 numbers take ~684 characters instead of ~6 KB of JSON, so a whole
 * document's index fits in one Firestore record. Ranking by dot product is
 * unaffected in practice.
 */

export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMS = 512;

export interface PackedVector {
  b64: string;
  scale: number;
}

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(b64, 'base64'));
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Floats → int8 + scale. */
export function packVector(values: number[]): PackedVector {
  let maxAbs = 0;
  for (const v of values) maxAbs = Math.max(maxAbs, Math.abs(v));
  const scale = maxAbs > 0 ? maxAbs / 127 : 1;
  const q = new Int8Array(values.length);
  for (let i = 0; i < values.length; i++) q[i] = Math.max(-127, Math.min(127, Math.round(values[i] / scale)));
  return { b64: toBase64(new Uint8Array(q.buffer)), scale };
}

export function unpackVector(packed: PackedVector): { q: Int8Array; scale: number } {
  const bytes = fromBase64(packed.b64);
  return { q: new Int8Array(bytes.buffer, bytes.byteOffset, bytes.length), scale: packed.scale };
}

/** Cosine similarity of two packed unit-length vectors (OpenAI embeddings are unit length). */
export function packedDot(a: { q: Int8Array; scale: number }, b: { q: Int8Array; scale: number }): number {
  const n = Math.min(a.q.length, b.q.length);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += a.q[i] * b.q[i];
  return sum * a.scale * b.scale;
}

/** Short, stable fingerprint of a document's text, to know when its index is stale. */
export function textFingerprint(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995);
  }
  return `${text.length.toString(36)}-${(h1 >>> 0).toString(36)}-${(h2 >>> 0).toString(36)}`;
}
