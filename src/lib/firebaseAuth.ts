import { createVerify } from 'node:crypto';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0608802366';
const ISSUER = `https://securetoken.google.com/${PROJECT_ID}`;
const CERT_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

type FirebaseClaims = { sub: string; aud: string; iss: string; exp: number; iat: number; auth_time: number; [key: string]: unknown };
let certCache: { expiresAt: number; certs: Record<string, string> } | null = null;

async function getCertificates(): Promise<Record<string, string>> {
  if (certCache && certCache.expiresAt > Date.now()) return certCache.certs;
  const response = await fetch(CERT_URL, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Firebase certificate lookup failed [HTTP ${response.status}]`);
  const certs = await response.json() as Record<string, string>;
  const cacheControl = response.headers.get('cache-control') || '';
  const match = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeMs = Math.max(60_000, Math.min((Number(match?.[1]) || 3600) * 1000, 24 * 60 * 60 * 1000));
  certCache = { certs, expiresAt: Date.now() + maxAgeMs };
  return certs;
}

function decodePart(value: string): Record<string, unknown> { return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')); }

export async function verifyFirebaseIdToken(authorization?: string): Promise<FirebaseClaims> {
  if (process.env.SIGNAL87_TEST_AUTH === '1') return { sub: 'test-user', aud: PROJECT_ID, iss: ISSUER, exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000), auth_time: Math.floor(Date.now() / 1000) };
  if (!authorization?.startsWith('Bearer ')) throw new Error('Missing or malformed Authorization header');
  const token = authorization.slice(7).trim(); const parts = token.split('.'); if (parts.length !== 3) throw new Error('Invalid Firebase ID token');
  const header = decodePart(parts[0]) as { alg?: string; kid?: string }; const claims = decodePart(parts[1]) as FirebaseClaims;
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Unsupported Firebase ID token');
  if (claims.aud !== PROJECT_ID || claims.iss !== ISSUER || typeof claims.sub !== 'string' || claims.sub.length === 0) throw new Error('Invalid Firebase ID token claims');
  const now = Math.floor(Date.now() / 1000); if (!Number.isFinite(claims.exp) || claims.exp <= now || !Number.isFinite(claims.iat) || claims.iat > now + 300 || !Number.isFinite(claims.auth_time) || claims.auth_time > now + 300) throw new Error('Expired or invalid Firebase ID token');
  const certs = await getCertificates(); const certificate = certs[header.kid]; if (!certificate) throw new Error('Unknown Firebase signing key');
  const verifier = createVerify('RSA-SHA256'); verifier.update(`${parts[0]}.${parts[1]}`); verifier.end();
  if (!verifier.verify(certificate, Buffer.from(parts[2], 'base64url'))) throw new Error('Invalid Firebase ID token signature');
  return claims;
}
export async function requireFirebaseUser(authorization: string | undefined): Promise<string> { return (await verifyFirebaseIdToken(authorization)).sub; }
