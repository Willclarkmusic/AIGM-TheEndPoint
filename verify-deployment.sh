#!/bin/bash

# Deployment Verification Script for AIGM Stack
# This script verifies that all components are deployed and working correctly

PROJECT_ID="aigm-theendpoint"
REGION="us-central1"

echo "🔍 Verifying AIGM deployment..."
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# Check if gcloud is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ Please run 'gcloud auth login' first"
    exit 1
fi

# Set project
gcloud config set project $PROJECT_ID

echo "📋 Checking Cloud Run services..."

# Check frontend service
FRONTEND_URL=$(gcloud run services describe aigm-frontend --region=$REGION --format='value(status.url)' 2>/dev/null)
if [ -n "$FRONTEND_URL" ]; then
    echo "✅ Frontend service found: $FRONTEND_URL"
    
    # Test frontend health
    if curl -s -f "$FRONTEND_URL" > /dev/null; then
        echo "   ✅ Frontend responding"
    else
        echo "   ⚠️ Frontend not responding"
    fi
else
    echo "❌ Frontend service not found"
fi

# Check AI service
AI_SERVICE_URL=$(gcloud run services describe aigm-ai-service --region=$REGION --format='value(status.url)' 2>/dev/null)
if [ -n "$AI_SERVICE_URL" ]; then
    echo "✅ AI Service found: $AI_SERVICE_URL"
    
    # Test AI service health
    if curl -s -f "$AI_SERVICE_URL/health" > /dev/null; then
        echo "   ✅ AI Service health endpoint responding"
    else
        echo "   ⚠️ AI Service health endpoint not responding (may require authentication)"
    fi
else
    echo "❌ AI Service not found"
fi

echo ""
echo "🔥 Checking Firebase Functions..."

# List Firebase functions
if firebase functions:list 2>/dev/null | grep -q "deleteServer\|cascadeServerDelete"; then
    echo "✅ Firebase Functions deployed"
else
    echo "❌ Firebase Functions not found or not accessible"
fi

echo ""
echo "🔐 Checking Secret Manager..."

# Check for required secrets
if gcloud secrets describe gemini_api_key >/dev/null 2>&1; then
    echo "✅ Gemini API key secret exists"
else
    echo "❌ Gemini API key secret missing"
fi

if gcloud secrets describe stability_api_key >/dev/null 2>&1; then
    echo "✅ Stability API key secret exists"
else
    echo "❌ Stability API key secret missing"
fi

echo ""
echo "🪣 Checking Cloud Storage..."

# Check Firebase Storage bucket
if gsutil ls gs://aigm-theendpoint.firebasestorage.app >/dev/null 2>&1; then
    echo "✅ Firebase Storage bucket exists"
else
    echo "❌ Firebase Storage bucket missing"
fi

echo ""
echo "🔧 Checking IAM Configuration..."

# Check service account
if gcloud iam service-accounts describe ai-service@${PROJECT_ID}.iam.gserviceaccount.com >/dev/null 2>&1; then
    echo "✅ AI service account exists"
else
    echo "❌ AI service account missing"
fi

echo ""
echo "🏗️ Checking Cloud Build..."

# Check recent builds
RECENT_BUILDS=$(gcloud builds list --limit=5 --format="value(id,status)" | head -1)
if [ -n "$RECENT_BUILDS" ]; then
    echo "✅ Recent Cloud Build found: $RECENT_BUILDS"
else
    echo "⚠️ No recent Cloud Builds found"
fi

echo ""
echo "📊 Summary:"
echo "==========="

# Count successful checks
SUCCESS_COUNT=0
TOTAL_CHECKS=8

[ -n "$FRONTEND_URL" ] && ((SUCCESS_COUNT++))
[ -n "$AI_SERVICE_URL" ] && ((SUCCESS_COUNT++))
gcloud secrets describe gemini_api_key >/dev/null 2>&1 && ((SUCCESS_COUNT++))
gcloud secrets describe stability_api_key >/dev/null 2>&1 && ((SUCCESS_COUNT++))
gsutil ls gs://aigm-theendpoint.firebasestorage.app >/dev/null 2>&1 && ((SUCCESS_COUNT++))
gcloud iam service-accounts describe ai-service@${PROJECT_ID}.iam.gserviceaccount.com >/dev/null 2>&1 && ((SUCCESS_COUNT++))
firebase functions:list 2>/dev/null | grep -q "deleteServer" && ((SUCCESS_COUNT++))
[ -n "$RECENT_BUILDS" ] && ((SUCCESS_COUNT++))

echo "✅ $SUCCESS_COUNT/$TOTAL_CHECKS components verified successfully"

if [ $SUCCESS_COUNT -eq $TOTAL_CHECKS ]; then
    echo ""
    echo "🎉 Deployment verification PASSED!"
    echo ""
    echo "🌐 Your services are available at:"
    echo "   Frontend: $FRONTEND_URL"
    echo "   AI Service: $AI_SERVICE_URL"
    echo ""
    echo "🚀 Ready for testing!"
else
    echo ""
    echo "⚠️ Some components need attention. Check the output above."
    echo ""
    echo "🔧 Common fixes:"
    echo "   - Run ./setup-deployment.sh for missing infrastructure"
    echo "   - Create missing secrets in Secret Manager"
    echo "   - Deploy missing services manually"
    echo "   - Check Cloud Build trigger configuration"
fi

echo ""
echo "🔍 Additional verification commands:"
echo "   gcloud builds list --limit=5"
echo "   gcloud run services list --region=$REGION"
echo "   firebase functions:list"
echo "   gsutil ls gs://aigm-theendpoint.firebasestorage.app"