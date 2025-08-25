#!/bin/bash

# AIGM Complete Deployment Setup Script
# This script sets up all prerequisites for automated deployment

set -e

PROJECT_ID="aigm-theendpoint"
REGION="us-central1"
AI_SERVICE_ACCOUNT="ai-service"
AI_BUCKET_NAME="aigm-theendpoint.firebasestorage.app"

echo "🚀 Setting up AIGM Complete Deployment Pipeline..."
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking prerequisites..."
if ! command_exists gcloud; then
    echo "❌ Google Cloud SDK not found. Please install: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

if ! command_exists firebase; then
    echo "❌ Firebase CLI not found. Installing..."
    npm install -g firebase-tools
fi

# Set project
echo "🔧 Setting up Google Cloud project..."
gcloud config set project $PROJECT_ID
gcloud auth application-default login

# Enable required APIs
echo "🔌 Enabling required APIs..."
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    secretmanager.googleapis.com \
    firestore.googleapis.com \
    storage.googleapis.com \
    iam.googleapis.com

# Create service account for AI service
echo "👤 Creating AI service service account..."
gcloud iam service-accounts create $AI_SERVICE_ACCOUNT \
    --display-name="AI Service Account" \
    --description="Service account for AIGM AI Service" || echo "Service account may already exist"

# Grant necessary permissions to AI service account
echo "🔐 Granting permissions to AI service account..."
SERVICE_ACCOUNT_EMAIL="${AI_SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com"

# Firestore permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/datastore.user"

# Secret Manager permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/secretmanager.secretAccessor"

# Cloud Storage permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/storage.objectAdmin"

# Note: Using existing Firebase Storage bucket
echo "🪣 Using existing Firebase Storage bucket..."
echo "Bucket: gs://$AI_BUCKET_NAME"
echo "The AI service will store generated content in the existing Firebase Storage bucket"

# Create secrets for API keys (if they don't exist)
echo "🔑 Setting up secrets in Secret Manager..."
echo "You need to create these secrets manually with your API keys:"
echo ""
echo "1. Gemini API Key:"
echo "   gcloud secrets create gemini_api_key --replication-policy='automatic'"
echo "   echo -n 'YOUR_GEMINI_API_KEY' | gcloud secrets versions add gemini_api_key --data-file=-"
echo ""
echo "2. Stability AI API Key:"
echo "   gcloud secrets create stability_api_key --replication-policy='automatic'"
echo "   echo -n 'YOUR_STABILITY_API_KEY' | gcloud secrets versions add stability_api_key --data-file=-"
echo ""

# Set up Firebase deployment token
echo "🔥 Setting up Firebase deployment..."
echo "Getting Firebase CI token..."
FIREBASE_TOKEN=$(firebase login:ci --no-localhost)

if [ -z "$FIREBASE_TOKEN" ]; then
    echo "⚠️ Firebase token not obtained. You may need to run 'firebase login:ci' manually"
else
    echo "✅ Firebase token obtained"
fi

# Grant Cloud Build access to secrets
echo "🏗️ Granting Cloud Build access to secrets..."
CLOUD_BUILD_SERVICE_ACCOUNT=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")@cloudbuild.gserviceaccount.com

gcloud secrets add-iam-policy-binding gemini_api_key \
    --member="serviceAccount:$CLOUD_BUILD_SERVICE_ACCOUNT" \
    --role="roles/secretmanager.secretAccessor" || echo "May need to create secret first"

gcloud secrets add-iam-policy-binding stability_api_key \
    --member="serviceAccount:$CLOUD_BUILD_SERVICE_ACCOUNT" \
    --role="roles/secretmanager.secretAccessor" || echo "May need to create secret first"

# Grant Cloud Build permission to deploy Cloud Run services
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$CLOUD_BUILD_SERVICE_ACCOUNT" \
    --role="roles/run.developer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$CLOUD_BUILD_SERVICE_ACCOUNT" \
    --role="roles/iam.serviceAccountUser"

# Set up Cloud Build trigger (optional - can be done via console)
echo "🔄 Setting up Cloud Build trigger..."
gcloud builds triggers create github \
    --repo-name="AIGM-TheEndPoint" \
    --repo-owner="YOUR_GITHUB_USERNAME" \
    --branch-pattern="^main$" \
    --build-config="cloudbuild.yaml" \
    --substitutions="_FIREBASE_TOKEN=$FIREBASE_TOKEN" || echo "Trigger may already exist or need manual setup"

echo ""
echo "✅ Setup completed!"
echo ""
echo "📝 Next steps:"
echo "1. Create API key secrets using the commands shown above"
echo "2. Update the GitHub trigger with your actual repository details"
echo "3. Test deployment by pushing to main branch"
echo ""
echo "🔗 Useful commands:"
echo "  Test build locally: gcloud builds submit"
echo "  View build history: gcloud builds list"
echo "  Check service status: gcloud run services list"
echo ""
echo "🌐 Your services will be available at:"
echo "  Frontend: https://aigm-frontend-[hash]-uc.a.run.app"
echo "  AI Service: https://aigm-ai-service-[hash]-uc.a.run.app"