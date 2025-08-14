import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

// Production Firebase configuration
// Replace these values with your actual Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyD1UJ7ezP27TBWEiK3itjgMu1Sjb60Ln78",
  authDomain: "aigm-theendpoint.firebaseapp.com",
  projectId: "aigm-theendpoint",
  storageBucket: "aigm-theendpoint.firebasestorage.app",
  messagingSenderId: "248133304179",
  appId: "1:248133304179:web:a0a062608e56ab01968f06",
  measurementId: "G-43M2G4HWEQ",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

export default app;