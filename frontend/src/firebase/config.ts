import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

// Firebase configuration - Replace with your actual project values
const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    "AIzaSyD1UJ7ezP27TBWEiK3itjgMu1Sjb60Ln78",
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    "aigm-theendpoint.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "aigm-theendpoint",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    "aigm-theendpoint.firebasestorage.app",
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "248133304179",
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    "1:248133304179:web:a0a062608e56ab01968f06",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-43M2G4HWEQ",
};

// Validate configuration
const validateConfig = () => {
  const requiredFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'appId'];
  const missingFields = requiredFields.filter(field => 
    !firebaseConfig[field] || firebaseConfig[field].includes('your-')
  );
  
  if (missingFields.length > 0) {
    console.error('Missing Firebase configuration fields:', missingFields);
    console.error('Please update your Firebase configuration in src/firebase/config.ts');
    return false;
  }
  return true;
};

// Only initialize if config is valid
let app;
let auth;
let db;
let storage;
let functions;

if (validateConfig()) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  functions = getFunctions(app);
} else {
  console.error('Firebase not initialized due to missing configuration');
}

export { auth, db, storage, functions };
export default app;