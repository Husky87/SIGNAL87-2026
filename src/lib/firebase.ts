import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, onSnapshot, query, orderBy, limit, addDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

// Sign-in asks for identity only — email and profile, which Firebase requests for us.
// Nothing here may call addScope(): any Google API scope beyond identity puts the app
// back into Google's OAuth verification review, which is why Drive import was dropped.
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const signInWithGoogle = async () => {
  return signInWithPopup(auth, googleProvider);
};

export const signInWithGoogleRedirect = async () => {
  return signInWithRedirect(auth, googleProvider);
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
  const storageRef = ref(storage, `documents/${docId}/${file.name}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export { signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, GoogleAuthProvider };
export type { User };
