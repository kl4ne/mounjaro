/**
 * GLP-1 Companion v5.0 Firebase platform.
 *
 * Firebase Auth, Firestore and App Check use the modern modular SDK.
 * The rest of the Phase 3 compatibility runtime calls this narrow bridge while
 * the application continues its staged migration without changing data shape.
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  signInWithPopup,
  signInWithRedirect
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  getFirestore,
  doc,
  collection,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app-check.js';

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

function trackerRef(uid) {
  return doc(firestore, 'trackers', String(uid));
}

function safetyCollectionRef(uid) {
  return collection(firestore, 'trackers', String(uid), 'safety');
}

function safetyRef(uid, slotId) {
  return doc(firestore, 'trackers', String(uid), 'safety', String(slotId));
}

export const firebasePlatform = Object.freeze({
  auth,
  firestore,
  googleProvider,
  trackerRef,
  safetyRef,
  onAuthStateChanged(callback) {
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
  getTracker(uid) {
    return getDoc(trackerRef(uid));
  },
  listenTracker(uid, next, error) {
    return onSnapshot(
      trackerRef(uid),
      { includeMetadataChanges: true },
      next,
      error
    );
  },
  getSafetyDocs(uid) {
    return getDocs(safetyCollectionRef(uid));
  },
  runTransaction(updateFunction) {
    return runTransaction(firestore, updateFunction);
  },
  serverTimestamp
});

// Transitional global bridge for the ordered classic runtime chunks. This is
// intentionally NOT the old Firebase compat namespace; it exposes only the
// modular operations the existing runtime needs during the v5 migration.
window.firebasePlatform = firebasePlatform;
