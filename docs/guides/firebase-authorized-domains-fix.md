# Firebase Authorized Domains Fix for Cloud Run

## 🚨 Current Issue
You're getting `auth/unauthorized-domain` error when trying to log in on your Cloud Run deployment. This happens because Firebase doesn't recognize your Cloud Run domain as an authorized domain for authentication.

## 🎯 Quick Fix Steps

### Step 1: Get Your Cloud Run URL
1. Go to [Google Cloud Console](https://console.cloud.google.com/run)
2. Find your `aigm-frontend` service
3. Copy the URL (it looks like: `https://aigm-frontend-xxxxx-uc.a.run.app`)

### Step 2: Add Domain to Firebase
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `aigm-theendpoint`
3. Go to **Authentication** → **Settings** → **Authorized domains**
4. Click **Add domain**
5. Paste your Cloud Run URL **without** `https://`
   - Example: `aigm-frontend-xxxxx-uc.a.run.app`
6. Click **Add**

### Step 3: Test Authentication
- Try logging in again on your Cloud Run deployment
- Authentication should now work properly

## 🔗 For Custom Domains
If you're using a custom domain (like `app.yourdomain.com`), also add:
1. Your custom domain: `app.yourdomain.com`
2. Your root domain: `yourdomain.com`

## 🛠️ Additional Firebase Setup Checklist

### Authentication Providers
Ensure these are enabled in Firebase Console → Authentication → Sign-in method:
- ✅ **Email/Password** (if using email login)
- ✅ **Google** (if using Google social login)
- ✅ **GitHub** (if using GitHub social login)

### Firestore Security Rules
Update your Firestore rules to allow authenticated users:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Allow authenticated users to access servers they're members of
    match /servers/{serverId} {
      allow read, write: if request.auth != null;
      
      match /members/{memberId} {
        allow read, write: if request.auth != null;
      }
      
      match /chat_rooms/{roomId} {
        allow read, write: if request.auth != null;
        
        match /messages/{messageId} {
          allow read, write: if request.auth != null;
        }
      }
    }
    
    // Allow authenticated users to access private messages
    match /private_messages/{messageId} {
      allow read, write: if request.auth != null && 
        request.auth.uid in resource.data.participants;
    }
    
    // Allow authenticated users to access AI agents
    match /ai_agents/{agentId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    
    // Allow authenticated users to access social feed
    match /social_feed/{postId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

### Cloud Storage Security Rules
Update your Storage rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 🔍 Debugging Tips

### Check Console Logs
After the fix, your browser console should show:
- ✅ No "auth/unauthorized-domain" errors
- ✅ Successful authentication flows
- ✅ User data loading properly

### Verify Firebase Connection
Add this debug code temporarily to check Firebase status:

```javascript
// Add to your main App component temporarily
useEffect(() => {
  console.log('Firebase Config:', {
    apiKey: firebaseConfig.apiKey.slice(0, 10) + '...',
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId
  });
  
  auth.onAuthStateChanged((user) => {
    console.log('Auth State Changed:', user ? 'Logged in' : 'Logged out');
  });
}, []);
```

## 🌐 Domain Configuration Summary

For a complete setup, you should have these domains authorized:

### Development
- `localhost:3000` (already included by default)
- `127.0.0.1:3000` (already included by default)

### Production
- `your-cloud-run-url.run.app` (your Cloud Run domain)
- `app.yourdomain.com` (if using custom domain)
- `yourdomain.com` (root domain if needed)

## 🚀 After the Fix

Once you've added your Cloud Run domain to Firebase authorized domains:

1. **Authentication will work** on your Cloud Run deployment
2. **Users can sign up and log in** properly
3. **Social login providers** (Google, GitHub) will function
4. **All Firebase services** (Firestore, Storage) will be accessible

## 🔧 If Still Having Issues

1. **Clear browser cache** and try again
2. **Check Firebase quota** in the console
3. **Verify project billing** is enabled
4. **Check browser network tab** for specific error messages
5. **Test with incognito mode** to rule out cached issues

---

This should completely resolve your authentication issues on Cloud Run!