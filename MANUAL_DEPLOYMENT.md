# Manual Deployment Guide for Server Deletion Fix

## 🐛 Issue Fixed
The server deletion was not properly cascading to delete members and rooms. I've created a new callable Cloud Function that handles this correctly.

## ✅ ESLint Issues Resolved
All code style issues have been fixed. The functions are now ready for deployment.

## 🚀 Deployment Instructions

### Option 1: Upgrade Node.js (Recommended)
1. **Download Node.js 20+ from https://nodejs.org/**
2. **Install the newer version**
3. **Verify the installation:**
   ```bash
   node --version  # Should be 20.x or higher
   ```
4. **Deploy the functions:**
   ```bash
   cd /path/to/your/project
   firebase deploy --only functions
   ```

### Option 2: Use Node Version Manager (nvm)
If you have `nvm` installed:
```bash
nvm install 20
nvm use 20
firebase deploy --only functions
```

### Option 3: Use CI/CD or Another Environment
Deploy from a system with Node.js 20+, such as:
- GitHub Actions
- Google Cloud Build
- Another development machine

## 📝 What's Been Fixed

### 1. **New Callable Function: `deleteServer`**
- Verifies user permissions (only owners can delete)
- Safely deletes all members and updates user profiles
- Deletes all chat rooms and their messages
- Finally deletes the server document
- Provides detailed logging and success/error responses

### 2. **Client-Side Updates**
- Updated `ServerSettings.tsx` to use the callable function
- Added proper error handling with user feedback
- Imports Firebase Functions service

### 3. **Backup Function: `cascadeServerDelete`**
- Fallback trigger for document deletion events
- Ensures cleanup even if callable function fails

## 🧪 Testing the Fix

After deployment, test server deletion:

1. **Create a test server** (if you don't have one)
2. **Add some members and rooms**
3. **Delete the server** using the delete button in server settings
4. **Check Firestore console** - everything should be completely removed:
   - ✅ Server document deleted
   - ✅ All members subcollection deleted
   - ✅ All chat_rooms subcollection deleted
   - ✅ All messages in all rooms deleted

## 🔍 Debugging

If the deletion still doesn't work after deployment:

1. **Check Cloud Functions logs:**
   ```bash
   firebase functions:log
   ```

2. **Verify function deployment:**
   ```bash
   firebase functions:list
   ```
   You should see `deleteServer` in the list.

3. **Test the callable function directly:**
   Use the `ServerDeletionTest.tsx` component I created for debugging.

## 📦 Files Modified

- `functions/src/index.ts` - Fixed ESLint errors, added callable function
- `frontend/src/firebase/config.ts` - Added Firebase Functions service
- `frontend/src/components/ServerSettings.tsx` - Updated to use callable function
- `frontend/src/components/ServerDeletionTest.tsx` - Created for testing

## 🎯 Expected Result

After successful deployment and testing:
- Server deletion will completely remove all data
- No orphaned members or rooms will remain in Firestore
- User profiles will be updated to remove deleted server references
- The server will disappear from the sidebar immediately
- Cloud Functions logs will show successful deletion details

## ⚠️ Important Notes

- **Backup your data** before testing server deletion
- **Test with a non-critical server** first
- The deletion is **irreversible** once the function runs
- Monitor Cloud Functions logs during initial testing

Contact me if you encounter any issues after deployment!