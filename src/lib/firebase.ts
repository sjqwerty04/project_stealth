import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
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

// Analytics - only initialize in browser and if supported
export const analyticsPromise = isSupported().then((supported) =>
  supported ? getAnalytics(app) : null
);

