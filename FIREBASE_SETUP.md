# Firebase Setup Guide

This guide will help you set up your own Firebase project to run this application.

## Prerequisites

- Google Cloud Account
- Firebase Project
- Node.js 18+ installed
- Git

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
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   VITE_FIREBASE_APP_ID=your-app-id
   VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id
   ```

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

4. Add Substitution Variables:
   - `_FIREBASE_API_KEY`: Your API key
   - `_FIREBASE_AUTH_DOMAIN`: Your auth domain
   - `_FIREBASE_PROJECT_ID`: Your project ID
   - `_FIREBASE_STORAGE_BUCKET`: Your storage bucket
   - `_FIREBASE_MESSAGING_SENDER_ID`: Your sender ID
   - `_FIREBASE_APP_ID`: Your app ID
   - `_FIREBASE_MEASUREMENT_ID`: Your measurement ID

5. Click "Create"

### Option B: Using Secret Manager (More Secure)

1. Create secrets in Secret Manager:
   ```bash
   echo -n "your-api-key" | gcloud secrets create firebase-api-key --data-file=-
   echo -n "your-auth-domain" | gcloud secrets create firebase-auth-domain --data-file=-
   # ... repeat for all config values
   ```

2. Grant Cloud Build access to secrets:
   ```bash
   gcloud secrets add-iam-policy-binding firebase-api-key \
     --member="serviceAccount:YOUR-PROJECT-NUMBER@cloudbuild.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"
   ```

3. Update `cloudbuild.yaml` to use secrets (already configured in this repo)

4. Deploy using Cloud Build:
   ```bash
   gcloud builds submit --config=cloudbuild.yaml
   ```

## Step 6: Configure Firebase Security

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
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage bucket | `your-app.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | FCM Sender ID | `123456789` |
| `VITE_FIREBASE_APP_ID` | Firebase App ID | `1:123:web:abc` |
| `VITE_FIREBASE_MEASUREMENT_ID` | Analytics ID | `G-XXXXXXX` |

## Troubleshooting

### "Missing Firebase configuration" Error
- Ensure all required environment variables are set in `.env.local`
- Check that `.env.local` file is in the `frontend` directory
- Restart the development server after changing environment variables

### Authentication Not Working
- Check Authorized domains in Firebase Console
- Ensure sign-in methods are enabled
- Verify Firebase configuration is correct

### Production Deployment Issues
- Check Cloud Build logs for errors
- Ensure all substitution variables are set in Cloud Build Trigger
- Verify Docker build args are passed correctly

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