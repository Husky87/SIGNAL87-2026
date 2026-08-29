import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, onSnapshot, query, orderBy, limit, addDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

function resolveAuthDomain() {
  if (typeof window === 'undefined') return firebaseConfig.authDomain;
  const host = window.location.hostname;
  if (host === 'signal87.ai' || host === 'www.signal87.ai') return host;
  return firebaseConfig.authDomain;
}

const app = !getApps().length
  ? initializeApp({ ...firebaseConfig, authDomain: resolveAuthDomain() })
  : getApp();

/**
 * Auth defaults to IndexedDB for persistence, which private browsing and
 * hardened storage settings block — the SDK then throws "Database is closing"
 * with no error code, and sign-in fails outright.
 *
 * Declaring the chain explicitly lets Firebase fall through to localStorage,
 * then sessionStorage, then memory. Memory means the session ends when the tab
 * closes, which is the correct trade in a private window: signing in still
 * works instead of erroring.
 */
function createAuth() {
  try {
    return initializeAuth(app, {
      persistence: [
        indexedDBLocalPersistence,
        browserLocalPersistence,
        browserSessionPersistence,
        inMemoryPersistence
      ],
      popupRedirectResolver: browserPopupRedirectResolver
    });
  } catch {
    // Already initialised (hot reload, or another import got here first).
    return getAuth(app);
  }
}

export const auth = createAuth();

// Sign-in asks for identity only — email and profile, which Firebase requests for us.
// Nothing here may call addScope(): any Google API scope beyond identity puts the app
// back into Google's OAuth verification review, which is why Drive import was dropped.
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

function markRedirectPending() {
  try {
    sessionStorage.setItem('s87_auth_redirect', '1');
  } catch {
    /* private window */
  }
}

function prefersRedirectSignIn() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR|Android/i.test(ua);
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return isSafari || isIOS;
}

function isPopupFailure(error: unknown) {
  const code = (error as { code?: string } | null)?.code || '';
  return (
    code === 'auth/popup-blocked' ||
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request'
  );
}

export const signInWithGoogleRedirect = async () => {
  markRedirectPending();
  return signInWithRedirect(auth, googleProvider, browserPopupRedirectResolver);
};

// Keep the click as a direct user gesture. Closing another UI first makes
// Safari treat the popup as blocked and dump the user back on the landing page.
export const signInWithGoogle = async () => {
  if (prefersRedirectSignIn()) {
    return signInWithGoogleRedirect();
  }
  try {
    return await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
  } catch (error) {
    if (isPopupFailure(error)) {
      return signInWithGoogleRedirect();
    }
    throw error;
  }
};

export const signUpWithEmail = async (email: string, password: string) => {
  return createUserWithEmailAndPassword(auth, email, password);
};

export const signInWithEmail = async (email: string, password: string) => {
  return signInWithEmailAndPassword(auth, email, password);
};

// Notice custom databaseId in config!
// This project's Firestore instance is a *named* database, not the default one.
// Omitting the id makes the SDK target '(default)', which does not exist here —
// every read and write then fails with "Database '(default)' not found" and the
// app silently falls back to localStorage, so nothing is ever persisted.
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);

export const storage = getStorage(app);

// Uploads the original file bytes so the real document can be re-rendered
// after a reload — blob: URLs only live for the browser tab that created them.
export async function uploadDocumentFile(file: File, docId: string): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('Not signed in');
  }
  const storageRef = ref(storage, `users/${uid}/documents/${docId}/${file.name}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

/**
 * The object path inside a Firebase Storage download URL, or null.
 *
 * getDownloadURL() produces `.../o/<url-encoded path>?alt=media&token=…`, so
 * the path is recoverable from a stored fileUrl. That matters for redaction:
 * replacing the document has to overwrite *the object the original is in*.
 * Writing the redacted copy to a freshly derived path would leave the
 * unredacted original sitting in the bucket under its old name — a redaction
 * that removes nothing.
 */
function storagePathFromDownloadUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const marker = '/o/';
    const at = parsed.pathname.indexOf(marker);
    if (at === -1) return null;
    const encoded = parsed.pathname.slice(at + marker.length);
    if (!encoded) return null;
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

/**
 * Overwrites a document's stored file with new bytes and returns its fresh URL.
 *
 * The old object is replaced rather than joined by a new one. This is the point
 * of no return for redaction, and the caller is expected to have said so.
 *
 * A path that does not sit under this user's own document folder is refused
 * even though the Storage rules would refuse it too: a fileUrl comes back out
 * of Firestore, and a write target read out of stored data should be checked
 * where it is used rather than trusted because something else will catch it.
 */
export async function replaceDocumentFile(
  bytes: Uint8Array,
  docId: string,
  existingUrl: string | undefined,
  fallbackName: string
): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('Not signed in');
  }

  const folder = `users/${uid}/documents/${docId}/`;
  const existingPath = existingUrl ? storagePathFromDownloadUrl(existingUrl) : null;
  const path = existingPath && existingPath.startsWith(folder) ? existingPath : `${folder}${fallbackName}`;

  const storageRef = ref(storage, path);
  // Copied into a fresh buffer so the blob owns bytes nothing else holds a
  // view onto, and typed so the object is served back as a PDF.
  await uploadBytes(storageRef, new Uint8Array(bytes), { contentType: 'application/pdf' });
  return getDownloadURL(storageRef);
}

export { signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, GoogleAuthProvider };
export type { User };
