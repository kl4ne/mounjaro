/**
 * GLP-1 Companion Firebase platform bridge.
 * Firebase Auth, Firestore and App Check use the modern modular SDK.
 */
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  signInWithPopup,
  signInWithRedirect,
  type User
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  collection,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type DocumentSnapshot,
  type Transaction
} from 'firebase/firestore';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider
} from 'firebase/app-check';

export const firebaseConfig = Object.freeze({
  apiKey: 'AIzaSyAUh3I2MnmteoyMXc_qgMKJodcgZPiYEIM',
  authDomain: 'mounjaro-tracker-5c1c5.firebaseapp.com',
  projectId: 'mounjaro-tracker-5c1c5',
  storageBucket: 'mounjaro-tracker-5c1c5.firebasestorage.app',
  messagingSenderId: '300857507450',
  appId: '1:300857507450:web:9e397cda0d918b565e85c3'
});

export const RECAPTCHA_ENTERPRISE_KEY = '6LeQrL0tAAAAALBR_STR9PjlVp2M0LnPDlTLfx6r';
export const firebaseApp = initializeApp(firebaseConfig);
export const appCheck = initializeAppCheck(firebaseApp, {
  provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_ENTERPRISE_KEY),
  isTokenAutoRefreshEnabled: true
});

export const auth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);
export const googleProvider = new GoogleAuthProvider();

function trackerRef(uid: string) {
  return doc(firestore, 'trackers', String(uid));
}

function safetyCollectionRef(uid: string) {
  return collection(firestore, 'trackers', String(uid), 'safety');
}

function safetyRef(uid: string, slotId: string) {
  return doc(firestore, 'trackers', String(uid), 'safety', String(slotId));
}

export const firebasePlatform = Object.freeze({
  auth,
  firestore,
  googleProvider,
  trackerRef,
  safetyRef,
  onAuthStateChanged(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, callback);
  },
  signOut() {
    return signOut(auth);
  },
  signInWithPopup() {
    return signInWithPopup(auth, googleProvider);
  },
  signInWithRedirect() {
    return signInWithRedirect(auth, googleProvider);
  },
  getTracker(uid: string) {
    return getDoc(trackerRef(uid));
  },
  listenTracker(
    uid: string,
    next: (snapshot: DocumentSnapshot<Record<string, unknown>>) => void,
    error?: (error: unknown) => void
  ) {
    return onSnapshot(
      trackerRef(uid),
      { includeMetadataChanges: true },
      next,
      error
    );
  },
  getSafetyDocs(uid: string) {
    return getDocs(safetyCollectionRef(uid));
  },
  runTransaction<T>(updateFunction: (transaction: Transaction) => Promise<T>) {
    return runTransaction(firestore, updateFunction);
  },
  serverTimestamp
});

window.firebasePlatform = firebasePlatform as unknown as FirebasePlatformBridge;
