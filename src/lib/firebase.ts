/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Validate that we have a real Firebase configuration.
export const isFirebaseConfigured = !!(
  (import.meta as any).env.VITE_FIREBASE_API_KEY &&
  (import.meta as any).env.VITE_FIREBASE_PROJECT_ID &&
  (import.meta as any).env.VITE_FIREBASE_API_KEY !== 'YOUR_FIREBASE_API_KEY'
);

export const firebaseProjectId = (import.meta as any).env.VITE_FIREBASE_PROJECT_ID || 'local-demo';

// Determine if the database ID is valid (not a Google Analytics ID starting with G-, and not a placeholder)
const rawDatabaseId = (import.meta as any).env.VITE_FIREBASE_DATABASE_ID;
const isValidDatabaseId = !!(
  rawDatabaseId && 
  rawDatabaseId !== 'YOUR_FIRESTORE_DATABASE_ID' && 
  !rawDatabaseId.startsWith('G-')
);

export const firebaseDatabaseId = isValidDatabaseId ? rawDatabaseId : '(default)';

let app: any = null;
let db: any = null;
let auth: any = null;
const googleProvider = new GoogleAuthProvider();

if (isFirebaseConfigured) {
  const firebaseConfig = {
    apiKey:            (import.meta as any).env.VITE_FIREBASE_API_KEY,
    authDomain:        (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId:         (import.meta as any).env.VITE_FIREBASE_PROJECT_ID,
    storageBucket:     (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId:             (import.meta as any).env.VITE_FIREBASE_APP_ID,
  };

  try {
    app = initializeApp(firebaseConfig);
    db = isValidDatabaseId ? getFirestore(app, rawDatabaseId) : getFirestore(app);
    auth = getAuth(app);
    if (typeof window !== 'undefined') {
      (window as any).__FIREBASE_CONFIG__ = firebaseConfig;
      console.log(`[Firebase] Initialized with Project ID: "${firebaseConfig.projectId}"`);
    }
  } catch (error) {
    console.error('Failed to initialize Firebase SDK:', error);
  }
} else {
  console.warn(
    'Firebase environment variables are missing or unconfigured. Falling back to local offline mode. ' +
    'Please set VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID, etc. to connect a live Firestore database.'
  );
}

export { app, db, auth, googleProvider };
