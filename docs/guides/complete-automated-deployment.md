# Complete Automated Deployment Guide

This guide explains how to deploy your entire AIGM stack (Frontend + AI Service + Firebase Functions + Firestore Rules) with a single git push to main.

## What Gets Deployed Automatically

When you push to the `main` branch, the following components are deployed in parallel:

✅ **Frontend (React + Vite)** → Google Cloud Run  
✅ **AI Service (FastAPI + Python)** → Google Cloud Run  
✅ **Firebase Functions** → Firebase Cloud Functions  
✅ **Firestore Rules & Indexes** → Firebase Firestore  
✅ **Storage Rules** → Firebase Storage  

## Prerequisites Setup

### 1. Run the Setup Script

First, make the setup script executable and run it:

```bash
chmod +x setup-deployment.sh
./setup-deployment.sh
```

This script will:
- Enable required Google Cloud APIs
- Create service accounts and permissions
- Set up Cloud Storage bucket for AI-generated content
- Configure IAM roles and policies

### 2. Create API Key Secrets

Create secrets in Google Cloud Secret Manager for your API keys:

```bash
# Create Gemini API Key secret
gcloud secrets create gemini_api_key --replication-policy='automatic'
echo -n 'YOUR_ACTUAL_GEMINI_API_KEY' | gcloud secrets versions add gemini_api_key --data-file=-

# Create Stability AI API Key secret  
gcloud secrets create stability_api_key --replication-policy='automatic'
echo -n 'YOUR_ACTUAL_STABILITY_API_KEY' | gcloud secrets versions add stability_api_key --data-file=-
```

### 3. Get Firebase CI Token

```bash
firebase login:ci --no-localhost
```

Save this token - you'll need it for the Cloud Build trigger.

### 4. Set Up Cloud Build Trigger

#### Option A: Using Google Cloud Console (Recommended)
1. Go to [Cloud Build Triggers](https://console.cloud.google.com/cloud-build/triggers)
2. Click "Create Trigger"
3. Configure:
   - **Name**: `aigm-main-deployment`
   - **Event**: Push to branch
   - **Source**: Connect your GitHub repository
   - **Branch**: `^main$`
   - **Configuration**: Cloud Build configuration file
   - **Location**: `cloudbuild.yaml`

4. Add substitution variables:
   - `_FIREBASE_TOKEN`: [Your Firebase CI token]
   - `_AI_SERVICE_URL`: `https://aigm-ai-service-[HASH]-uc.a.run.app`

#### Option B: Using Command Line
```bash
gcloud builds triggers create github \
    --repo-name="AIGM-TheEndPoint" \
    --repo-owner="YOUR_GITHUB_USERNAME" \
    --branch-pattern="^main$" \
    --build-config="cloudbuild.yaml" \
    --substitutions="_FIREBASE_TOKEN=YOUR_FIREBASE_TOKEN,_AI_SERVICE_URL=https://aigm-ai-service-[HASH]-uc.a.run.app"
```

### 5. Configure Service Networking

Run the networking setup script:

```bash
chmod +x configure-service-networking.sh
./configure-service-networking.sh
```

This will:
- Grant frontend permission to invoke AI service
- Set up proper service-to-service authentication
- Display service URLs for configuration

## Deployment Architecture

### Build Process Flow
```
Git Push to Main
       ↓
   Cloud Build Trigger
       ↓
┌──────────────────────────┐
│   Parallel Builds        │
├─────────┬─────────┬──────┤
│Frontend │AI Service│Firebase│
│  Build  │  Build   │  Prep  │
└─────────┴─────────┴──────┘
       ↓
┌──────────────────────────┐
│   Parallel Deployments   │
├─────────┬─────────┬──────┤
│Frontend │AI Service│Firebase│
│ Deploy  │ Deploy   │Deploy  │
└─────────┴─────────┴──────┘
       ↓
   Health Checks & Verification
```

### Service Configuration

#### Frontend (Cloud Run)
- **Service Name**: `aigm-frontend`
- **Memory**: 1GB
- **CPU**: 1 vCPU
- **Min Instances**: 0
- **Max Instances**: 100
- **Port**: 8080
- **Authentication**: Public (unauthenticated access)

#### AI Service (Cloud Run)
- **Service Name**: `aigm-ai-service`
- **Memory**: 2GB
- **CPU**: 2 vCPU
- **Min Instances**: 1 (always warm)
- **Max Instances**: 10
- **Port**: 8080
- **Authentication**: Authenticated (service-to-service)
- **Secrets**: Mounted from Secret Manager
- **Service Account**: Custom AI service account

#### Firebase Functions
- **Runtime**: Node.js 22
- **Build**: Automatic TypeScript compilation
- **Deployed Functions**:
  - `deleteServer` - Server deletion with cascading
  - `cascadeServerDelete` - Backup deletion trigger
  - `updateUserPresence` - User presence management
  - `dailyCleanup` - Maintenance tasks

## Environment Variables & Configuration

### Frontend Build Arguments
- `VITE_FIREBASE_API_KEY` - Firebase API key
- `VITE_FIREBASE_AUTH_DOMAIN` - Firebase auth domain
- `VITE_FIREBASE_PROJECT_ID` - Firebase project ID
- `VITE_FIREBASE_STORAGE_BUCKET` - Firebase storage bucket
- `VITE_FIREBASE_MESSAGING_SENDER_ID` - Firebase messaging sender ID
- `VITE_FIREBASE_APP_ID` - Firebase app ID
- `VITE_FIREBASE_MEASUREMENT_ID` - Firebase analytics measurement ID
- `VITE_AI_SERVICE_URL` - AI service endpoint URL

### AI Service Environment Variables
- `ENVIRONMENT=production`
- `GCP_PROJECT_ID` - Google Cloud project ID
- `GCS_BUCKET_NAME` - Cloud Storage bucket for generated content

### AI Service Secrets (from Secret Manager)
- `/secrets/gemini-api-key` - Google Gemini API key
- `/secrets/stability-api-key` - Stability AI API key

## Deployment Process

### Automatic Deployment
Simply push to main:
```bash
git add .
git commit -m "Your changes"
git push origin main
```

### Monitor Deployment
1. **Cloud Build Console**: https://console.cloud.google.com/cloud-build/builds
2. **Cloud Run Console**: https://console.cloud.google.com/run
3. **Firebase Console**: https://console.firebase.google.com/project/aigm-theendpoint/functions

### Deployment Logs
```bash
# View latest build
gcloud builds list --limit=1

# View build details
gcloud builds log [BUILD_ID]

# View service logs
gcloud run services logs read aigm-frontend --region=us-central1
gcloud run services logs read aigm-ai-service --region=us-central1
```

## Service URLs

After successful deployment, your services will be available at:

- **Frontend**: `https://aigm-frontend-[HASH]-uc.a.run.app`
- **AI Service**: `https://aigm-ai-service-[HASH]-uc.a.run.app`
- **Firebase Functions**: `https://us-central1-aigm-theendpoint.cloudfunctions.net/[FUNCTION_NAME]`

## Testing Deployment

### Health Checks
```bash
# Test frontend
curl https://aigm-frontend-[HASH]-uc.a.run.app

# Test AI service (requires authentication)
curl https://aigm-ai-service-[HASH]-uc.a.run.app/health

# Test Firebase functions
firebase functions:shell
```

### End-to-End Testing
1. Open your frontend URL
2. Test user authentication
3. Test AI chat functionality
4. Test content generation
5. Verify Firebase Functions work

## Troubleshooting

### Common Issues

#### 1. Build Failures
```bash
# Check build logs
gcloud builds list --limit=5
gcloud builds log [BUILD_ID]
```

**Common causes**:
- Missing secrets in Secret Manager
- Incorrect service account permissions
- Invalid Firebase token
- Docker build errors

#### 2. AI Service Won't Start
```bash
# Check service logs
gcloud run services logs read aigm-ai-service --region=us-central1
```

**Common causes**:
- Missing API keys in Secret Manager
- Insufficient service account permissions
- Resource limits too low
- Firestore connection issues

#### 3. Firebase Functions Deployment Fails
```bash
# Check function logs
firebase functions:log
```

**Common causes**:
- Invalid Firebase token
- TypeScript compilation errors
- Node.js version mismatch
- Missing dependencies

#### 4. Service-to-Service Communication Issues
```bash
# Check IAM policies
gcloud run services get-iam-policy aigm-ai-service --region=us-central1
```

**Common causes**:
- Missing Cloud Run invoker role
- Incorrect service account configuration
- Network connectivity issues
- Authentication token problems

### Debug Mode
Enable debug logging in Cloud Build:
```yaml
# Add to cloudbuild.yaml options
options:
  logging: CLOUD_LOGGING_ONLY
  logStreamingOption: STREAM_ON
```

### Manual Deployment (Fallback)
If automated deployment fails, you can deploy components manually:

```bash
# Deploy frontend only
gcloud builds submit --config=cloudbuild.yaml --substitutions=_DEPLOY_FRONTEND_ONLY=true

# Deploy AI service only
cd ai-service && gcloud run deploy aigm-ai-service --source .

# Deploy Firebase components
firebase deploy --only functions,firestore:rules,storage
```

## Rollback Procedures

### Rollback Cloud Run Services
```bash
# List revisions
gcloud run revisions list --service=aigm-frontend --region=us-central1

# Rollback to previous revision
gcloud run services update-traffic aigm-frontend \
    --to-revisions=[PREVIOUS_REVISION]=100 \
    --region=us-central1
```

### Rollback Firebase Functions
```bash
# Firebase functions don't have built-in rollback
# Redeploy from a previous git commit:
git checkout [PREVIOUS_COMMIT]
firebase deploy --only functions
git checkout main
```

## Cost Optimization

### Cloud Run Cost Management
- **Min instances**: Set to 0 for frontend, 1 for AI service
- **Memory allocation**: Right-size based on actual usage
- **CPU allocation**: Monitor and adjust based on performance

### Cloud Build Cost Management
- Build triggers only on main branch
- Parallel builds for efficiency
- Use efficient Docker layer caching

### Monitoring & Alerts
Set up budget alerts in Google Cloud Console:
1. Go to Billing → Budgets & Alerts
2. Create budget for Cloud Run, Cloud Build, and Firebase
3. Set up email notifications for cost thresholds

## Security Considerations

### Service Authentication
- AI service requires authentication (no public access)
- Frontend has public access but implements Firebase Auth
- Service-to-service calls use Google Cloud IAM

### Secret Management
- All API keys stored in Secret Manager
- No secrets in code or environment variables
- Regular secret rotation recommended

### Network Security
- Services communicate over HTTPS only
- Proper CORS configuration
- Rate limiting and request validation

## Maintenance

### Regular Tasks
1. **Monitor service health** weekly
2. **Review logs** for errors or performance issues
3. **Update dependencies** monthly
4. **Rotate API keys** quarterly
5. **Review and optimize costs** monthly

### Updates & Patches
- Docker base image updates handled by Cloud Build
- Node.js runtime updates managed by Firebase
- Python dependencies updated in requirements.txt

## Support Resources

- **Cloud Build Documentation**: https://cloud.google.com/build/docs
- **Cloud Run Documentation**: https://cloud.google.com/run/docs
- **Firebase Documentation**: https://firebase.google.com/docs
- **Secret Manager Documentation**: https://cloud.google.com/secret-manager/docs

Your complete AIGM stack is now fully automated! Every push to main will deploy your entire application with zero manual intervention required.