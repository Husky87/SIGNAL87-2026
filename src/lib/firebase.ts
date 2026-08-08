import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, onSnapshot, query, orderBy, limit, addDoc, deleteDoc } from 'firebase/firestore';
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

// Notice custom databaseId in config!
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId || undefined);

export { signInWithPopup, signOut, onAuthStateChanged, GoogleAuthProvider };
export type { User };
