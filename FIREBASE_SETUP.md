# Firebase Setup Guide

This guide will help you set up your own Firebase project to run this application.

## Prerequisites

- Google Cloud Account
- Firebase Project
- Node.js 18+ installed
- Git
- Google Cloud SDK installed

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter a project name
4. Enable Google Analytics (optional)
5. Click "Create project"

## Step 2: Enable Firebase Services

In your Firebase project, enable the following services:

### Authentication
1. Go to Authentication → Get started
2. Enable the following sign-in providers:
   - Email/Password
   - Google
3. Add your domain to Authorized domains (for production)

### Firestore Database
1. Go to Firestore Database → Create database
2. Start in **production mode**
3. Choose your preferred location
4. Update security rules (see `firestore.rules` in this repo)

### Storage
1. Go to Storage → Get started
2. Start in **production mode**
3. Choose your storage location
4. Update security rules for your needs

### Functions (if using AI features)
1. Upgrade to Blaze plan (pay-as-you-go)
2. Go to Functions → Get started
3. Follow the setup instructions

## Step 3: Get Your Firebase Configuration

1. Go to Project Settings (gear icon)
2. Scroll down to "Your apps"
3. Click "Add app" → Web app
4. Register your app with a nickname
5. Copy the Firebase configuration object

## Step 4: Set Up Local Development

1. Clone this repository
2. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

3. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

4. Edit `.env.local` and add your Firebase configuration:
   ```env
   VITE_FIREBASE_API_KEY=your-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   VITE_FIREBASE_APP_ID=your-app-id
   VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id
   ```

   **Important**: Make sure the storage bucket does NOT include `gs://` prefix.

5. Install dependencies:
   ```bash
   npm install
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```

## Step 5: Deploy to Production (Google Cloud Run)

### Option A: Using Cloud Build Triggers (Recommended)

1. Go to [Cloud Build Triggers](https://console.cloud.google.com/cloud-build/triggers)
2. Click "Create Trigger"
3. Configure:
   - Name: `aigm-frontend-deploy`
   - Event: Push to branch
   - Branch: `^main$`
   - Configuration: Cloud Build configuration file
   - Location: `/cloudbuild.yaml`

4. **IMPORTANT**: Add Substitution Variables in the trigger:
   - Click "Show included files, ignored files and substitution variables"
   - Add these substitution variables with your actual Firebase values:
   
   | Variable | Value |
   |----------|-------|
   | `_FIREBASE_API_KEY` | `your-actual-api-key` |
   | `_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
   | `_FIREBASE_PROJECT_ID` | `your-project-id` |
   | `_FIREBASE_STORAGE_BUCKET` | `your-project.firebasestorage.app` |
   | `_FIREBASE_MESSAGING_SENDER_ID` | `your-sender-id` |
   | `_FIREBASE_APP_ID` | `your-app-id` |
   | `_FIREBASE_MEASUREMENT_ID` | `your-measurement-id` |

5. Click "Create"

### Option B: Using Secret Manager (More Secure)

#### On Linux/Mac:
1. Create secrets in Secret Manager:
   ```bash
   echo -n "your-api-key" | gcloud secrets create firebase-api-key --data-file=-
   echo -n "your-auth-domain" | gcloud secrets create firebase-auth-domain --data-file=-
   echo -n "your-project-id" | gcloud secrets create firebase-project-id --data-file=-
   echo -n "your-storage-bucket" | gcloud secrets create firebase-storage-bucket --data-file=-
   echo -n "your-messaging-sender-id" | gcloud secrets create firebase-messaging-sender-id --data-file=-
   echo -n "your-app-id" | gcloud secrets create firebase-app-id --data-file=-
   echo -n "your-measurement-id" | gcloud secrets create firebase-measurement-id --data-file=-
   ```

#### On Windows PowerShell:
1. Create secrets in Secret Manager:
   ```powershell
   # Method 1: Direct piping (may not work on all PowerShell versions)
   "your-api-key" | gcloud secrets create firebase-api-key --data-file=-
   
   # Method 2: Using temporary files (more reliable)
   Set-Content -Path "temp-api-key.txt" -Value "your-api-key" -NoNewline
   gcloud secrets create firebase-api-key --data-file="temp-api-key.txt"
   Remove-Item "temp-api-key.txt"
   
   Set-Content -Path "temp-auth-domain.txt" -Value "your-auth-domain" -NoNewline
   gcloud secrets create firebase-auth-domain --data-file="temp-auth-domain.txt"
   Remove-Item "temp-auth-domain.txt"
   
   Set-Content -Path "temp-project-id.txt" -Value "your-project-id" -NoNewline
   gcloud secrets create firebase-project-id --data-file="temp-project-id.txt"
   Remove-Item "temp-project-id.txt"
   
   Set-Content -Path "temp-storage-bucket.txt" -Value "your-storage-bucket" -NoNewline
   gcloud secrets create firebase-storage-bucket --data-file="temp-storage-bucket.txt"
   Remove-Item "temp-storage-bucket.txt"
   
   Set-Content -Path "temp-messaging-sender.txt" -Value "your-messaging-sender-id" -NoNewline
   gcloud secrets create firebase-messaging-sender-id --data-file="temp-messaging-sender.txt"
   Remove-Item "temp-messaging-sender.txt"
   
   Set-Content -Path "temp-app-id.txt" -Value "your-app-id" -NoNewline
   gcloud secrets create firebase-app-id --data-file="temp-app-id.txt"
   Remove-Item "temp-app-id.txt"
   
   Set-Content -Path "temp-measurement-id.txt" -Value "your-measurement-id" -NoNewline
   gcloud secrets create firebase-measurement-id --data-file="temp-measurement-id.txt"
   Remove-Item "temp-measurement-id.txt"
   ```

2. Grant Cloud Build access to secrets:
   ```bash
   # Get your project number first
   PROJECT_NUMBER=$(gcloud projects describe YOUR-PROJECT-ID --format="value(projectNumber)")
   
   # Grant access to each secret
   gcloud secrets add-iam-policy-binding firebase-api-key \
     --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"
     
   gcloud secrets add-iam-policy-binding firebase-auth-domain \
     --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"
   
   # Repeat for all secrets...
   ```

## Step 6: Troubleshooting Cloud Build Issues

If you're getting "Missing Firebase configuration fields" errors after deployment:

### 1. Verify Substitution Variables
Check that all substitution variables are set in your Cloud Build trigger:
```bash
gcloud builds triggers describe YOUR-TRIGGER-NAME --format="value(substitutions)"
```

### 2. Check Build Logs
Look at your Cloud Build logs to see if the environment variables are being passed:
```bash
gcloud builds list --limit=1
gcloud builds log BUILD-ID
```

### 3. Test Manual Build
Try a manual build with explicit substitutions:
```bash
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions="_FIREBASE_API_KEY=your-key,_FIREBASE_AUTH_DOMAIN=your-domain,_FIREBASE_PROJECT_ID=your-project,_FIREBASE_STORAGE_BUCKET=your-bucket,_FIREBASE_MESSAGING_SENDER_ID=your-sender,_FIREBASE_APP_ID=your-app-id,_FIREBASE_MEASUREMENT_ID=your-measurement"
```

### 4. Common Issues:
- **Storage bucket format**: Use `project.firebasestorage.app` NOT `gs://project.firebasestorage.app`
- **Missing quotes**: Ensure values with special characters are properly quoted
- **Trigger configuration**: Double-check all substitution variables are spelled correctly

## Step 7: Configure Firebase Security

### Authorized Domains
1. Go to Firebase Console → Authentication → Settings
2. Add your production domain to Authorized domains
3. This prevents your API key from being used on unauthorized sites

### Security Rules
1. Update Firestore rules in Firebase Console
2. Update Storage rules as needed
3. See `firestore.rules` for recommended rules

### App Check (Optional but Recommended)
1. Go to Firebase Console → App Check
2. Register your app
3. Choose reCAPTCHA v3 for web
4. Add App Check enforcement to Firebase services

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_FIREBASE_API_KEY` | Firebase API Key | `AIzaSy...` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Auth domain | `your-app.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Project ID | `your-app-id` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage bucket | `your-app.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | FCM Sender ID | `123456789` |
| `VITE_FIREBASE_APP_ID` | Firebase App ID | `1:123:web:abc` |
| `VITE_FIREBASE_MEASUREMENT_ID` | Analytics ID | `G-XXXXXXX` |

## Troubleshooting

### "Missing Firebase configuration" Error
- Ensure all required environment variables are set in `.env.local`
- Check that `.env.local` file is in the `frontend` directory
- Restart the development server after changing environment variables
- **For production**: Verify substitution variables in Cloud Build trigger

### Authentication Not Working
- Check Authorized domains in Firebase Console
- Ensure sign-in methods are enabled
- Verify Firebase configuration is correct

### Production Deployment Issues
- Check Cloud Build logs for errors
- Ensure all substitution variables are set in Cloud Build Trigger
- Verify Docker build args are passed correctly
- Check that storage bucket doesn't have `gs://` prefix

## Security Best Practices

1. **Never commit `.env` files** to version control
2. **Use Secret Manager** for production deployments
3. **Enable App Check** for additional security
4. **Restrict API key usage** to your domains only
5. **Implement proper security rules** for Firestore and Storage
6. **Monitor usage** in Firebase Console to detect abuse

## Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud Build Documentation](https://cloud.google.com/build/docs)
- [Secret Manager Documentation](https://cloud.google.com/secret-manager/docs)