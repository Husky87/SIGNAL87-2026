import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult as firebaseGetRedirectResult,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

// The production app serves Firebase's /__/auth helper through a transparent
// Vercel rewrite. Keep the helper on the same origin as the workspace so
// redirect sign-in can recover its state in browsers blocking third-party
// storage (notably Firefox and Safari). Preview/local hosts retain the
// Firebase default until they have their own authorized OAuth callback.
const authDomain = typeof window !== 'undefined' && window.location.hostname === 'www.signal87.ai'
  ? 'www.signal87.ai'
  : firebaseConfig.authDomain;
const app = !getApps().length ? initializeApp({ ...firebaseConfig, authDomain }) : getApp();

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
    return getAuth(app);
  }
}

export const auth = createAuth();
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

function markRedirectPending() {
  try {
    sessionStorage.setItem('s87_auth_redirect', '1');
  } catch {
    // Some private-browsing contexts block sessionStorage.
  }
}

export const signInWithGoogleRedirect = async () => {
  markRedirectPending();
  try {
    return await signInWithRedirect(auth, googleProvider);
  } catch (error) {
    try { sessionStorage.removeItem('s87_auth_redirect'); } catch { /* Storage may be unavailable. */ }
    throw error;
  }
};

export const signInWithGoogle = async () =>
  signInWithPopup(auth, googleProvider);

export const signUpWithEmail = async (email: string, password: string) =>
  createUserWithEmailAndPassword(auth, email, password);

export const signInWithEmail = async (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

export const requestPasswordReset = async (email: string) =>
  sendPasswordResetEmail(auth, email);

export const getRedirectResult = (authInstance = auth) =>
  firebaseGetRedirectResult(authInstance);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);
export const storage = getStorage(app);

export async function uploadDocumentFile(file: File, docId: string): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  const storageRef = ref(storage, `users/${uid}/documents/${docId}/${file.name}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function uploadDocumentThumbnail(blob: Blob, docId: string): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  const thumbnailRef = ref(storage, `users/${uid}/documents/${docId}/thumbnail.jpg`);
  await uploadBytes(thumbnailRef, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(thumbnailRef);
}

if (typeof window !== 'undefined') {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let url = '';
    try {
      url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    } catch {
      url = '';
    }

    const sameOriginApi = (() => {
      try {
        const parsed = new URL(url, window.location.origin);
        return parsed.origin === window.location.origin && parsed.pathname.startsWith('/api/');
      } catch {
        return false;
      }
    })();

    if (!sameOriginApi) return originalFetch(input, init);

    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    if (!headers.has('Authorization')) {
      const user = auth.currentUser;
      if (user) {
        try {
          headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
        } catch (error) {
          console.warn('Unable to attach Firebase auth token to API request:', error);
        }
      }
    }
    return originalFetch(input, { ...init, headers });
  };
}

export { signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged, GoogleAuthProvider };
export type { User };
