import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { logUserSignedIn, logUserSignedUp } from '../lib/analytics';
import { logActivity, setupGlobalErrorLogging } from '../lib/activityLogger';

type AuthState = {
  user: User | null;
  loading: boolean;
};

type AuthContextType = AuthState & {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setState({ user, loading: false });
        if (user.email) {
          logActivity(user.uid, user.email, 'session_started', {});
          setupGlobalErrorLogging(user.uid, user.email);
        }
      } else {
        setState({ user: null, loading: false });
      }
    });

    return unsubscribe;
  }, []);

  const createUserProfile = async (user: User) => {
    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      await setDoc(userRef, {
        profile: {
          displayName: user.displayName || user.email?.split('@')[0] || 'User',
          email: user.email,
          joinDate: serverTimestamp(),
          profileImage: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
          handle: null,
          handleLower: null,
        },
      });
    }
  };

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
    await logUserSignedIn('email');
  };

  const signUp = async (email: string, password: string) => {
    sessionStorage.setItem('isNewUser', '1');
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await createUserProfile(result.user);
    await logUserSignedUp('email');
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    await createUserProfile(result.user);
    await logUserSignedIn('google');
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setState({ user: null, loading: false });
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
