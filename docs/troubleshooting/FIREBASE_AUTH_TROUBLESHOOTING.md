# Firebase Authentication Troubleshooting Guide

## Cross-Origin-Opener-Policy (COOP) Errors

### Problem
You're seeing these errors in the console:
```
Cross-Origin-Opener-Policy policy would block the window.closed call.
Cross-Origin-Opener-Policy policy would block the window.close call.
```

### Root Cause
These errors occur when using Firebase Authentication's popup-based social login (Google, GitHub) with modern browsers that enforce stricter Cross-Origin-Opener-Policy (COOP) headers. This is especially common during local development with Vite.

### Solutions Applied

#### 1. Vite Configuration Update ✅
Updated `vite.config.ts` to set appropriate COOP headers:

```typescript
server: {
  headers: {
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    'Cross-Origin-Embedder-Policy': 'unsafe-none',
  },
}
```

#### 2. Popup + Redirect Fallback ✅
Enhanced social login methods to use redirect as fallback:

```typescript
// Try popup first, fallback to redirect if popup fails
try {
  const result = await signInWithPopup(auth, authProvider);
  // Handle success...
} catch (popupError) {
  if (popupError.code === 'auth/popup-blocked' || 
      popupError.message?.includes('Cross-Origin-Opener-Policy')) {
    // Fallback to redirect method
    await signInWithRedirect(auth, authProvider);
  }
}
```

#### 3. Redirect Result Handling ✅
Added proper handling of redirect results in the Dashboard component:

```typescript
useEffect(() => {
  const handleRedirectResult = async () => {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      await createUserDocument(result.user);
    }
  };
  handleRedirectResult();
}, []);
```

## Testing the Fixes

### Steps to Test:

1. **Restart the Development Server**:
   ```bash
   cd frontend
   npm run dev
   ```

2. **Clear Browser Cache**:
   - Open DevTools (F12)
   - Right-click refresh button → "Empty Cache and Hard Reload"
   - Or use Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)

3. **Test Social Login Flow**:
   - Try Google login first
   - Try GitHub login
   - Monitor console for COOP errors (they should be gone or significantly reduced)

4. **Test Both Flows**:
   - **Popup Flow**: Should work in most cases now
   - **Redirect Flow**: Should kick in automatically if popup fails

### Expected Behavior

✅ **Success Indicators**:
- No COOP errors in console
- Social login completes successfully
- User is redirected to dashboard
- User profile is created in Firestore

❌ **If Issues Persist**:
- Check Firebase Console for authentication configuration
- Verify authorized redirect URIs include your local development URL
- Try clearing all browser data for localhost

## Alternative Solutions (if issues persist)

### Option 1: Use HTTPS Locally
```bash
# Install mkcert for local SSL certificates
npm install -g mkcert
mkcert -install
mkcert localhost 127.0.0.1

# Update vite.config.ts
server: {
  https: {
    key: './localhost-key.pem',
    cert: './localhost.pem'
  }
}
```

### Option 2: Redirect-Only Authentication
If popup continues to fail, you can force redirect-only mode:

```typescript
// In your social login handlers, skip popup entirely:
const handleSocialLogin = async (provider: "google" | "github") => {
  const authProvider = provider === "google" ? googleProvider : githubProvider;
  sessionStorage.setItem('authRedirectPath', window.location.pathname);
  await signInWithRedirect(auth, authProvider);
};
```

### Option 3: Use Firebase Auth Emulator
For development, you can use the Firebase Auth Emulator:

```bash
firebase emulators:start --only auth
```

Update your Firebase config to use the emulator:
```typescript
if (process.env.NODE_ENV === 'development') {
  connectAuthEmulator(auth, 'http://localhost:9099');
}
```

## Firebase Console Configuration

### Required Settings:

1. **Authentication > Sign-in method**:
   - Enable Google provider
   - Enable GitHub provider
   - Add authorized domains (including localhost:3000)

2. **Authentication > Settings > Authorized domains**:
   - Add `localhost` for local development
   - Add your production domain

3. **Project Settings > General**:
   - Verify your Firebase config values match your `.env.local`

## Browser-Specific Issues

### Chrome/Chromium
- Most compatible with the implemented solution
- COOP errors should be resolved

### Firefox
- May still show COOP warnings but functionality should work
- Consider using redirect-only mode if issues persist

### Safari
- Generally more restrictive with popups
- Redirect fallback is especially important

### Edge
- Similar behavior to Chrome
- Should work with the implemented solution

## Production Considerations

### For Production Deployment:

1. **Update Authorized Domains**:
   - Add your production domain to Firebase Console
   - Remove localhost from production environment

2. **HTTPS Required**:
   - Firebase Auth requires HTTPS in production
   - Ensure SSL certificates are properly configured

3. **Domain Verification**:
   - Verify your domain with Google for OAuth
   - Configure proper redirect URIs

## Monitoring and Debugging

### Console Logging
The updated code includes comprehensive error logging:
- Check browser console for detailed error messages
- Look for "Social login error" or "Redirect result error" messages

### Firebase Console
- Monitor Authentication > Users for successful sign-ins
- Check Authentication > Usage for error rates
- Review Firestore > Data for user document creation

### Network Tab
- Monitor network requests during authentication
- Look for failed requests to Firebase APIs
- Check for CORS-related issues

## Summary of Changes Made

1. ✅ **Vite Config**: Added COOP headers to allow popups
2. ✅ **Popup Fallback**: Implemented redirect fallback for failed popups  
3. ✅ **Redirect Handling**: Added proper redirect result processing
4. ✅ **Error Handling**: Enhanced error messages and logging
5. ✅ **Loading States**: Added loading indicators for redirect flow
6. ✅ **Session Storage**: Preserved navigation state during redirects

The authentication system should now work reliably across different browsers and handle COOP restrictions gracefully!