/**
 * Id generation, in its own module so that the pure editing rules and the
 * redaction rules can both use it without importing each other.
 */

/**
 * crypto.randomUUID() needs a secure context; it is absent on plain http and
 * in some embedded webviews. Ids only have to be unique within one overlay, so
 * the fallback is good enough and keeps the editor working there too.
 */
export function newId(prefix: string): string {
  const globalCrypto = typeof crypto !== 'undefined' ? crypto : undefined;
  if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
    return `${prefix}_${globalCrypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
