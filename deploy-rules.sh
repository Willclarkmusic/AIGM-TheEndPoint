#!/bin/bash

# Server Management Fix - Firestore Rules Deployment Script
# This script deploys the updated Firestore security rules to fix server creation permissions

echo "🔥 Deploying Firestore Security Rules..."
echo "========================================"

# Check if firebase CLI is available
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Please install it first:"
    echo "   npm install -g firebase-tools"
    exit 1
fi

# Check if user is logged in
if ! firebase projects:list &> /dev/null; then
    echo "🔐 Please log in to Firebase:"
    firebase login
fi

# Deploy the rules
echo "📋 Deploying Firestore security rules..."
firebase deploy --only firestore:rules

if [ $? -eq 0 ]; then
    echo "✅ Firestore rules deployed successfully!"
    echo ""
    echo "🧪 Next steps:"
    echo "1. Open your app and go to: http://localhost:5173/test"
    echo "2. Click 'Run All Tests' to validate server functionality"
    echo "3. If tests pass, try creating servers in the main app"
    echo ""
    echo "🔧 If tests still fail, check:"
    echo "- Firebase project permissions"
    echo "- Firestore database is initialized"
    echo "- Browser console for detailed errors"
else
    echo "❌ Failed to deploy Firestore rules"
    echo "Please check your Firebase configuration and try again"
    exit 1
fi