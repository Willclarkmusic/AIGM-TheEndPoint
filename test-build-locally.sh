#!/bin/bash

# Test the Docker build locally with the same arguments Cloud Build should use

echo "🧪 Testing Docker build locally with Firebase configuration..."
echo "=============================================================="

# Your Firebase configuration
FIREBASE_API_KEY="AIzaSyD9CqF615NS_xNI2h9JmPaMzFbk0IjNMew"
FIREBASE_AUTH_DOMAIN="aigm-theendpoint.firebaseapp.com"
FIREBASE_PROJECT_ID="aigm-theendpoint"
FIREBASE_STORAGE_BUCKET="aigm-theendpoint.firebasestorage.app"
FIREBASE_MESSAGING_SENDER_ID="248133304179"
FIREBASE_APP_ID="1:248133304179:web:a0a062608e56ab01968f06"
FIREBASE_MEASUREMENT_ID="G-43M2G4HWEQ"

echo "Building Docker image with Firebase configuration..."
echo ""

cd frontend

docker build \
  --build-arg VITE_FIREBASE_API_KEY="${FIREBASE_API_KEY}" \
  --build-arg VITE_FIREBASE_AUTH_DOMAIN="${FIREBASE_AUTH_DOMAIN}" \
  --build-arg VITE_FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID}" \
  --build-arg VITE_FIREBASE_STORAGE_BUCKET="${FIREBASE_STORAGE_BUCKET}" \
  --build-arg VITE_FIREBASE_MESSAGING_SENDER_ID="${FIREBASE_MESSAGING_SENDER_ID}" \
  --build-arg VITE_FIREBASE_APP_ID="${FIREBASE_APP_ID}" \
  --build-arg VITE_FIREBASE_MEASUREMENT_ID="${FIREBASE_MEASUREMENT_ID}" \
  -t test-aigm-frontend .

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build successful! The issue is likely with Cloud Build substitution variables."
    echo "   Check that all _FIREBASE_* variables are set in your Cloud Build trigger."
else
    echo ""
    echo "❌ Build failed! Check the error messages above."
fi

cd ..

echo ""
echo "To test the built image locally:"
echo "docker run -p 8080:8080 test-aigm-frontend"