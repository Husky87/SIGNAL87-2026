import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireFirebaseUser } from '../../src/lib/firebaseAuth.js';

const STORAGE_HOST = 'firebasestorage.googleapis.com';

function getAuthorizationHeader(req: VercelRequest): string | undefined {
  const value = req.headers.authorization;
  return Array.isArray(value) ? value[0] : value;
}

function getStorageObjectPath(url: URL): string | null {
  const marker = '/o/';
  const markerIndex = url.pathname.indexOf(marker);
  if (markerIndex < 0) return null;

  const encodedPath = url.pathname.slice(markerIndex + marker.length);
  if (!encodedPath) return null;

  try {
    return decodeURIComponent(encodedPath);
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const authorization = getAuthorizationHeader(req);
  let userId: string;
  try {
    userId = await requireFirebaseUser(authorization);
  } catch (error: any) {
    return res.status(401).json({
      error: 'Unauthorized',
      details: error?.message || 'Valid Firebase ID token required'
    });
  }

  const rawUrl = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url;
  if (typeof rawUrl !== 'string' || !rawUrl) {
    return res.status(400).json({ error: 'Document URL is required' });
  }

  let sourceUrl: URL;
  try {
    sourceUrl = new URL(rawUrl);
  } catch {
    return res.status(400).json({ error: 'Document URL is invalid' });
  }

  if (sourceUrl.protocol !== 'https:' || sourceUrl.hostname !== STORAGE_HOST) {
    return res.status(400).json({ error: 'Only Firebase Storage document URLs are supported' });
  }

  const objectPath = getStorageObjectPath(sourceUrl);
  const expectedPrefix = `users/${userId}/documents/`;
  if (!objectPath || !objectPath.startsWith(expectedPrefix)) {
    return res.status(403).json({ error: 'Document does not belong to the authenticated user' });
  }

  try {
    // The signed Firebase download URL is fetched server-side so the browser
    // never has to give PDF.js direct cross-origin access to the Storage object.
    // This removes the Firefox NetworkError caused by PDF.js requesting the
    // Firebase Storage URL directly while preserving the existing storage model.
    const upstream = await fetch(sourceUrl.toString(), {
      headers: { Accept: 'application/pdf,*/*' }
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: 'Document preview could not be fetched',
        details: `Firebase Storage returned HTTP ${upstream.status}`
      });
    }

    const contentType = upstream.headers.get('content-type') || 'application/pdf';
    const contentLength = upstream.headers.get('content-length');
    const body = await upstream.arrayBuffer();

    res.setHeader('Content-Type', contentType.includes('pdf') ? 'application/pdf' : contentType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, max-age=300');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    res.status(200).send(Buffer.from(body));
  } catch (error: any) {
    console.error('Error proxying Firebase Storage document preview:', error?.message || error);
    return res.status(502).json({
      error: 'Document preview failed',
      details: error?.message || 'Unable to retrieve document from Firebase Storage'
    });
  }
}
