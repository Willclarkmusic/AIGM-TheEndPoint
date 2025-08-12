#!/bin/bash

# AIGM-TheEndPoint Security Rules Deployment Script
# This script deploys Firebase Security Rules for both Firestore and Cloud Storage

echo "🔐 Deploying Firebase Security Rules..."
echo "================================="

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI is not installed. Please install it first:"
    echo "   npm install -g firebase-tools"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2)
REQUIRED_VERSION="20.0.0"
if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "❌ Node.js version $NODE_VERSION is not supported."
    echo "   Please upgrade to Node.js >=20.0.0"
    exit 1
fi

echo "✅ Node.js version: $NODE_VERSION (supported)"

# Verify Firebase project is configured
if [ ! -f ".firebaserc" ]; then
    echo "❌ Firebase project not configured. Please run 'firebase init' first."
    exit 1
fi

PROJECT_ID=$(grep -o '"default": "[^"]*' .firebaserc | cut -d'"' -f4)
echo "🎯 Target Firebase project: $PROJECT_ID"

# Validate Firestore rules syntax
echo "🔍 Validating Firestore rules syntax..."
if ! firebase firestore:rules:validate firestore.rules; then
    echo "❌ Firestore rules validation failed!"
    exit 1
fi
echo "✅ Firestore rules syntax is valid"

# Validate Storage rules syntax
echo "🔍 Validating Storage rules syntax..."
if ! firebase storage:rules:validate storage.rules; then
    echo "❌ Storage rules validation failed!"
    exit 1
fi
echo "✅ Storage rules syntax is valid"

# Ask for confirmation
echo ""
echo "📋 Deployment Summary:"
echo "   - Project: $PROJECT_ID"
echo "   - Firestore Rules: firestore.rules"
echo "   - Storage Rules: storage.rules"
echo ""
read -p "Do you want to proceed with deployment? (y/N): " confirm

if [[ $confirm != [yY] && $confirm != [yY][eE][sS] ]]; then
    echo "❌ Deployment cancelled by user"
    exit 1
fi

# Deploy security rules
echo ""
echo "🚀 Deploying security rules..."

if firebase deploy --only firestore:rules,storage; then
    echo ""
    echo "✅ Security rules deployed successfully!"
    echo ""
    echo "🔐 Security Features Enabled:"
    echo "   ✅ Role-based access control"
    echo "   ✅ User data protection"
    echo "   ✅ Server membership validation"
    echo "   ✅ Message security"
    echo "   ✅ File upload restrictions (2MB, images only)"
    echo "   ✅ Private message privacy"
    echo "   ✅ AI agent creation control"
    echo "   ✅ Social feed post management"
    echo ""
    echo "📊 Monitor your rules at:"
    echo "   https://console.firebase.google.com/project/$PROJECT_ID/firestore/rules"
    echo "   https://console.firebase.google.com/project/$PROJECT_ID/storage/rules"
else
    echo "❌ Deployment failed!"
    exit 1
fi

echo ""
echo "🎉 Security rules deployment completed!"