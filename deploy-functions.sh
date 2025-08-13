#!/bin/bash

echo "🚀 Deploying Cloud Functions for Server Deletion Fix..."

# Build the functions first
echo "📦 Building functions..."
cd functions
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed! Please check the TypeScript compilation errors."
    exit 1
fi

echo "✅ Build successful!"

# Deploy to Firebase
echo "🌐 Deploying to Firebase..."
cd ..
firebase deploy --only functions

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
    echo ""
    echo "🎉 Server deletion with cascading functionality is now deployed!"
    echo ""
    echo "The following functions are now available:"
    echo "  - deleteServer (callable function for safe server deletion)"
    echo "  - cascadeServerDelete (backup trigger for document deletion)"
    echo "  - updateUserPresence (scheduled presence updates)"
    echo "  - dailyCleanup (maintenance tasks)"
    echo ""
    echo "You can now test server deletion from your app."
else
    echo "❌ Deployment failed! Please check the error messages above."
    echo ""
    echo "Common issues:"
    echo "  - Firebase CLI not authenticated (run: firebase login)"
    echo "  - Wrong Firebase project (run: firebase use --add)"
    echo "  - Node.js version incompatibility (upgrade to Node.js 20+)"
fi