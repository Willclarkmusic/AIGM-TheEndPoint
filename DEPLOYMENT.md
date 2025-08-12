# Deployment Guide

## Firebase Functions Deployment

To deploy the presence management Cloud Functions:

```bash
# Navigate to functions directory
cd functions

# Install dependencies
npm install

# Deploy functions
npm run deploy
```

## Frontend Deployment

To deploy the React frontend:

```bash
# Navigate to frontend directory
cd frontend

# Build the application
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

## Full Deployment

To deploy everything at once:

```bash
# From root directory
firebase deploy
```

## Cloud Function Details

### updateUserPresence
- **Schedule**: Runs every 5 minutes
- **Purpose**: Updates user status based on lastSeen timestamp
- **Memory**: 256MiB
- **Timeout**: 5 minutes

### dailyCleanup
- **Schedule**: Daily at 2 AM UTC
- **Purpose**: Cleanup old user data and maintain database hygiene
- **Memory**: 512MiB
- **Timeout**: 9 minutes

## Environment Setup

Ensure your `.env.local` file in the frontend directory contains valid Firebase configuration values:

```
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-storage-bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id
```