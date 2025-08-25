# Secret Manager Setup Instructions

## Overview

This project uses Google Secret Manager to securely store Firebase configuration for production deployments. Your Firebase configuration is never stored in the source code.

## Prerequisites

- Google Cloud SDK installed and authenticated
- `gcloud` command available in PowerShell
- Admin access to your Google Cloud project

## Setup Steps

### 1. Update the PowerShell Script

1. Open `create-secrets.ps1` (this file is git-ignored for security)
2. Replace the placeholder values with your actual Firebase configuration:

```powershell
# Replace these values with your actual Firebase configuration
$FIREBASE_API_KEY = "your-actual-api-key"
$FIREBASE_AUTH_DOMAIN = "your-project.firebaseapp.com"  
$FIREBASE_PROJECT_ID = "your-actual-project-id"
$FIREBASE_STORAGE_BUCKET = "your-project.firebasestorage.app"  # NO gs:// prefix!
$FIREBASE_MESSAGING_SENDER_ID = "your-sender-id"
$FIREBASE_APP_ID = "your-app-id" 
$FIREBASE_MEASUREMENT_ID = "your-measurement-id"
```

### 2. Run the Script

Open PowerShell as Administrator and run:

```powershell
cd path\to\your\project
.\create-secrets.ps1
```

The script will:
- Create all required secrets in Google Secret Manager
- Grant Cloud Build permission to access the secrets
- Verify the setup was successful

### 3. Remove Cloud Build Trigger Substitution Variables

1. Go to [Cloud Build Triggers](https://console.cloud.google.com/cloud-build/triggers)
2. Edit your existing trigger
3. **Remove all `_FIREBASE_*` substitution variables** (they're no longer needed)
4. Save the trigger

### 4. Deploy

Push your code to trigger a new build. The build will now use Secret Manager to get Firebase configuration.

## Security Benefits

- ✅ No Firebase configuration in source code
- ✅ Secrets encrypted at rest in Google Cloud
- ✅ Access controlled via IAM permissions
- ✅ Safe to make repository public
- ✅ Audit trail for secret access

## Troubleshooting

### Script Fails with "Secret already exists"

If you need to update a secret:

```powershell
# Delete existing secret
gcloud secrets delete firebase-api-key --quiet

# Then run the script again
.\create-secrets.ps1
```

### Build Fails with "Secret not found"

Verify secrets were created:

```powershell
gcloud secrets list --filter="name ~ firebase"
```

### Permission Errors

Ensure Cloud Build has access:

```powershell
$PROJECT_NUMBER = gcloud projects describe YOUR-PROJECT-ID --format="value(projectNumber)"
gcloud secrets add-iam-policy-binding firebase-api-key \
    --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

## What the Build Process Does

1. Cloud Build starts the build
2. Secret Manager provides Firebase config to build environment
3. Docker build receives config as build arguments
4. Vite embeds config into the production bundle
5. App deploys to Cloud Run with Firebase config

Your secrets are never logged or exposed in the build process.