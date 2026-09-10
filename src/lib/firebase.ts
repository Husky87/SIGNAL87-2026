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
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, onSnapshot, query, orderBy, limit, addDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

// Keep Firebase's helper domain configuration stable. Redirect auth requires
// additional same-origin setup when the app is hosted outside Firebase.
const app = !getApps().length
  ? initializeApp(firebaseConfig)
  : getApp();

/**
 * Use a persistence fallback chain so private/hardened browser profiles can
 * still start the application when IndexedDB is unavailable. The popup/redirect
 * resolver is intentionally NOT initialized here: Firebase documents that the
 * resolver can create an auth iframe during app startup, which is unnecessary
 * until a user actually signs in and is especially fragile with Firefox's
 * third-party-storage protections.
 */
function createAuth() {
  try {
    return initializeAuth(app, {
      persistence: [
        indexedDBLocalPersistence,
        browserLocalPersistence,
        browserSessionPersistence,
        inMemoryPersistence
      ]
    });
  } catch {
    return getAuth(app);
  }
}

export const auth = createAuth();

// Identity only. Do not add Google API scopes here.
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
  const isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Android/i.test(ua);
  return isIOS || isSafari;
}

function isPopupFailure(error: unknown) {
  const code = (error as { code?: string } | null)?.code || '';
  return (
    code === 'auth/popup-blocked' ||
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request'
  );
}

/**
 * Safari/iOS uses the full-page redirect flow. The production custom domain
 * proxies Firebase's /__/auth and /__/firebase helpers to the Firebase project,
 * so the redirect can complete without relying on third-party storage.
 * Desktop browsers use popup auth for the fastest in-place sign-in, with a
 * redirect fallback if the browser blocks the popup.
 */
export const signInWithGoogleRedirect = async () => {
  markRedirectPending();
  return signInWithRedirect(auth, googleProvider, browserPopupRedirectResolver);
};

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

/**
 * Complete a redirect-based OAuth flow with the same resolver that started it.
 * Auth is initialized without a popup/redirect resolver on purpose, so every
 * redirect operation must pass browserPopupRedirectResolver explicitly.
 */
export const getRedirectResult = (authInstance = auth) =>
  firebaseGetRedirectResult(authInstance, browserPopupRedirectResolver);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);
export const storage = getStorage(app);

export async function uploadDocumentFile(file: File, docId: string): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  const storageRef = ref(storage, `users/${uid}/documents/${docId}/${file.name}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

/**
 * Attach Firebase ID tokens to authenticated same-origin API calls centrally.
 * Third-party requests and explicitly supplied Authorization headers are left
 * untouched.
 */
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let url = '';
    try {
      url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
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

    const headers = new Headers(
      init?.headers || (input instanceof Request ? input.headers : undefined)
    );
    if (!headers.has('Authorization')) {
      const user = auth.currentUser;
      if (user) {
        try {
          const token = await user.getIdToken();
          headers.set('Authorization', `Bearer ${token}`);
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