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
  getRedirectResult as firebaseGetRedirectResult,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

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
    // Some private-browsing modes block sessionStorage. Firebase can still
    // complete the redirect, and the auth-state observer remains authoritative.
  }
}

export const signInWithGoogleRedirect = () => {
  markRedirectPending();
  return signInWithRedirect(auth, googleProvider, browserPopupRedirectResolver);
};

/**
 * Use a popup when possible, then fall back to a full-page redirect only when
 * the browser blocks or cannot support the popup. This preserves the best UX
 * on desktop while keeping Safari, Firefox, and mobile browsers usable.
 */
export const signInWithGoogle = async () => {
  try {
    return await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
  } catch (error: any) {
    const code = error?.code;
    const shouldRedirect =
      code === 'auth/popup-blocked' ||
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/operation-not-supported-in-this-environment' ||
      code === 'auth/unauthorized-domain';

    if (!shouldRedirect) throw error;
    return signInWithGoogleRedirect();
  }
};

export const signUpWithEmail = async (email: string, password: string) =>
  createUserWithEmailAndPassword(auth, email, password);

export const signInWithEmail = async (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

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
