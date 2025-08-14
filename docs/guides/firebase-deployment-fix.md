# Firebase Configuration Fix for Cloud Run

## 🚨 Issue
Your Cloud Run deployment is failing because Firebase configuration is using placeholder values instead of your actual Firebase project configuration.

## 🚀 Quick Fix (Solution 1 - Recommended)

### Step 1: Get Your Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click the gear icon ⚙️ → **Project settings**
4. Scroll down to **"Your apps"** section
5. Find your web app or click **"Add app"** → **Web**
6. Copy the configuration object - it looks like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyC-your-actual-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456",
  measurementId: "G-XXXXXXXXXX"
};
```

### Step 2: Update Your Config File

Replace the placeholder values in `/frontend/src/firebase/config.ts` lines 9-15:

```typescript
// Replace these lines with your actual values:
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC-your-actual-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "your-project.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "your-project-id",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "your-project.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789012",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789012:web:abcdef123456",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-XXXXXXXXXX",
};
```

### Step 3: Deploy

```bash
git add .
git commit -m "Fix Firebase configuration for production deployment"
git push origin main
```

Your Cloud Run deployment will automatically trigger and should work now!

## 🔐 Security Note

The Firebase API key is **safe to expose** in client-side code. It's designed to be public and is protected by Firebase security rules. However, make sure your Firestore security rules are properly configured.

## 🧪 Testing

After deployment, check the browser console:
- ✅ No "Missing Firebase configuration fields" errors
- ✅ No "auth/invalid-api-key" errors
- ✅ Authentication should work properly

## 🔧 Advanced Solution (Optional)

If you want to use environment variables (more secure for CI/CD), the Dockerfile and cloudbuild.yaml have been updated to support build arguments. You would need to:

1. Set the Firebase configuration values in Cloud Build trigger substitutions
2. Update the `_FIREBASE_*` values in `cloudbuild.yaml`
3. The build process will inject these values during container build

## 🆘 Still Having Issues?

1. **Check Firebase Console**: Ensure your web app is properly configured
2. **Verify Domain**: Make sure your Cloud Run domain is added to Firebase authorized domains
3. **Check Security Rules**: Ensure Firestore rules allow read/write for authenticated users
4. **Browser Console**: Look for specific Firebase error messages

## 📋 Firebase Settings Checklist

1. ✅ Web app created in Firebase Console
2. ✅ Authentication enabled (Email/Password, Google, etc.)
3. ✅ Firestore database created
4. ✅ Security rules configured
5. ✅ Cloud Run domain added to authorized domains
6. ✅ Firebase configuration copied to config.ts

---

After completing these steps, your messaging platform should be fully functional on Cloud Run!