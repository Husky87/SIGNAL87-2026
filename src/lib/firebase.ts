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
    /* private browsing may block sessionStorage */
  }
}

export const signInWithGoogleRedirect = () => {
  markRedirectPending();
  return signInWithRedirect(auth, googleProvider, browserPopupRedirectResolver);
};

// Keep the Firebase call synchronous from the button event. Firefox can treat
// an authentication popup differently when it is opened after an async hop.
// Explicitly supplying the resolver also makes this independent of how Auth
// was initialized by a previous module instance.
export const signInWithGoogle = () =>
  signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);

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
