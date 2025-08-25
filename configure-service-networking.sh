#!/bin/bash

# Service-to-Service Networking Configuration for AIGM
# This script configures proper networking and authentication between services

PROJECT_ID="aigm-theendpoint"
REGION="us-central1"
FRONTEND_SERVICE="aigm-frontend"
AI_SERVICE="aigm-ai-service"

echo "🔗 Configuring service-to-service networking..."

# Get Cloud Run service account (default compute service account)
COMPUTE_SA=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")-compute@developer.gserviceaccount.com

# Grant frontend permission to invoke AI service
echo "🔐 Granting frontend permission to invoke AI service..."
gcloud run services add-iam-policy-binding $AI_SERVICE \
    --member="serviceAccount:$COMPUTE_SA" \
    --role="roles/run.invoker" \
    --region=$REGION

# Get AI service URL for frontend configuration
AI_SERVICE_URL=$(gcloud run services describe $AI_SERVICE --region=$REGION --format='value(status.url)')

echo "✅ Service networking configured!"
echo ""
echo "📋 Service URLs:"
echo "  AI Service: $AI_SERVICE_URL"
echo ""
echo "🔧 Frontend environment variables to set:"
echo "  VITE_AI_SERVICE_URL: $AI_SERVICE_URL"
echo ""
echo "💡 Next steps:"
echo "1. Update frontend to use AI_SERVICE_URL for AI calls"
echo "2. Implement service-to-service authentication in frontend"
echo "3. Test connectivity between services"