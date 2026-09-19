import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyADZLBw2WEMYKpr9d_NKO1aEncT-tGX8PU",
  authDomain: "mvplockedin.firebaseapp.com",
  projectId: "mvplockedin",
  storageBucket: "mvplockedin.firebasestorage.app",
  messagingSenderId: "977586022473",
  appId: "1:977586022473:web:7286a559d8e8c138ed7798",
  measurementId: "G-H6VRBCV7MD"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Local verification against `firebase emulators:start` so rule changes can be
// exercised before they are deployed. Never set in production builds.
if (import.meta.env.VITE_FIREBASE_EMULATOR === '1') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

// Analytics - only initialize in browser and if supported
export const analyticsPromise = isSupported().then((supported) =>
  supported ? getAnalytics(app) : null
);

