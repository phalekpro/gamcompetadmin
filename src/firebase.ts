import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyBHUiN5-dQF8sThwyLIbYH9RGprVf23quM",
  authDomain: "gamecompet-6f5e9.firebaseapp.com",
  projectId: "gamecompet-6f5e9",
  storageBucket: "gamecompet-6f5e9.firebasestorage.app",
  messagingSenderId: "276629248864",
  appId: "1:276629248864:web:af58612e4c951fde399c05",
  measurementId: "G-2VTVRDEGJS"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

export default app;
