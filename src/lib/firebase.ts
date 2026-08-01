/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const getEnvVar = (key: string) => {
  return (import.meta as any).env?.[key] || (typeof process !== 'undefined' ? process.env?.[key] : undefined);
};

// Validate that we have a real Firebase configuration.
export const isFirebaseConfigured = !!(
  getEnvVar('VITE_FIREBASE_API_KEY') &&
  getEnvVar('VITE_FIREBASE_PROJECT_ID') &&
  getEnvVar('VITE_FIREBASE_API_KEY') !== 'YOUR_FIREBASE_API_KEY'
);

export const firebaseProjectId = getEnvVar('VITE_FIREBASE_PROJECT_ID') || 'local-demo';

// Determine database ID
const rawDatabaseId = getEnvVar('VITE_FIREBASE_DATABASE_ID') || getEnvVar('FIREBASE_DATABASE_ID');
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
    apiKey:            getEnvVar('VITE_FIREBASE_API_KEY'),
    authDomain:        getEnvVar('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId:         getEnvVar('VITE_FIREBASE_PROJECT_ID'),
    storageBucket:     getEnvVar('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId:             getEnvVar('VITE_FIREBASE_APP_ID'),
  };

  try {
    app = initializeApp(firebaseConfig);
    db = (firebaseDatabaseId && firebaseDatabaseId !== '(default)') 
      ? getFirestore(app, firebaseDatabaseId) 
      : getFirestore(app);
    auth = getAuth(app);
    if (typeof window !== 'undefined') {
      (window as any).__FIREBASE_CONFIG__ = firebaseConfig;
      console.log(`[Firebase] Initialized with Project ID: "${firebaseConfig.projectId}", Database ID: "${firebaseDatabaseId}"`);
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
