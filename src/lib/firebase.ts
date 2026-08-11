import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, onSnapshot, query, orderBy, limit, addDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
googleProvider.addScope('https://www.googleapis.com/auth/drive');
googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets');

export const signInWithGoogle = async () => {
  return signInWithPopup(auth, googleProvider);
};

export const signUpWithEmail = async (email: string, password: string) => {
  return createUserWithEmailAndPassword(auth, email, password);
};

export const signInWithEmail = async (email: string, password: string) => {
  return signInWithEmailAndPassword(auth, email, password);
};

// Notice custom databaseId in config!
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId || undefined);

export const storage = getStorage(app);

// Uploads the original file bytes so the real document can be re-rendered
// after a reload — blob: URLs only live for the browser tab that created them.
export async function uploadDocumentFile(file: File, docId: string): Promise<string> {
  const storageRef = ref(storage, `documents/${docId}/${file.name}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export { signInWithPopup, signOut, onAuthStateChanged, GoogleAuthProvider };
export type { User };
