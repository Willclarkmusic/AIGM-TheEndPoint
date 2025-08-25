# AI Service Setup & Testing Guide for Windows

This guide will walk you through setting up and manually testing the AI & GenAI Backend Service on Windows using PowerShell. This service is now integrated into the complete automated deployment pipeline.

## Overview

The AI service is part of the complete AIGM stack that includes:
- **Frontend (React)** - User interface deployed to Cloud Run
- **AI Service (FastAPI)** - This service for AI functionality deployed to Cloud Run  
- **Firebase Functions** - Server-side logic deployed to Cloud Functions
- **Firestore** - Database and rules deployed automatically

**🚀 Production Deployment:** Everything deploys automatically with `git push origin main`  
**🛠️ Local Development:** This guide covers local development and testing

## Prerequisites

### Required Software
1. **Python 3.11+** - Download from [python.org](https://www.python.org/downloads/)
2. **Git** - Download from [git-scm.com](https://git-scm.com/download/win)
3. **Google Cloud SDK** - Required for authentication and deployment
4. **Firebase CLI** - For Firebase integration (`npm install -g firebase-tools`)
5. **Docker Desktop** (optional) - For containerized testing

### Required Accounts & API Keys
1. **Google Cloud Account** with billing enabled
2. **Firebase Project** (aigm-theendpoint)
3. **Google Gemini API Key** - Stored in Google Cloud Secret Manager for production
4. **Stability AI API Key** - Stored in Google Cloud Secret Manager for production

## Step 1: Project Setup

### Clone and Navigate to Project
```powershell
# Navigate to your project directory
cd "C:\path\to\your\AIGM-TheEndPoint"

# Verify the ai-service directory exists
ls ai-service
```

### Create Python Virtual Environment
```powershell
# Navigate to ai-service directory
cd ai-service

# Create virtual environment
python -m venv venv

# Activate virtual environment
.\venv\Scripts\Activate.ps1

# If you get execution policy error, run:
# Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Verify activation (should show (venv) in prompt)
python --version
```

### Install Dependencies
```powershell
# Upgrade pip
python -m pip install --upgrade pip

# Install requirements
pip install -r requirements.txt

# Verify installation
pip list | Select-String "fastapi|langchain|google"
```

## Step 2: Google Cloud Setup

### Authenticate with Google Cloud
```powershell
# Install and authenticate with Google Cloud SDK
gcloud auth login
gcloud config set project aigm-theendpoint

# Authenticate for local development
gcloud auth application-default login
```

### Use Existing Firebase Project
The project uses the existing Firebase project `aigm-theendpoint`. No additional setup needed for local development.

### Get API Keys for Local Development
For local development, you'll need API keys in your `.env` file:

1. **Google Gemini API Key**:
   - Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create API key
   - Copy for local `.env` file

2. **Stability AI API Key**:
   - Go to [Stability AI Platform](https://platform.stability.ai/account/keys)
   - Create account and get API key
   - Copy for local `.env` file

### Production Secret Management
In production, API keys are managed automatically via Google Cloud Secret Manager. The deployment pipeline handles this automatically.

### Cloud Storage Access
The AI service uses the existing Firebase Storage bucket (`aigm-theendpoint.firebasestorage.app`) for all generated content storage. This ensures all media is managed in one place.

## Step 3: Environment Configuration

### Create Environment File
```powershell
# Copy example environment file
Copy-Item .env.example .env

# Edit .env file (use notepad, VS Code, or your preferred editor)
notepad .env
```

### Configure .env File
Replace the placeholder values in `.env`:

```env
# Application Settings
APP_NAME="AI Service"
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=INFO

# Google Cloud Settings (Production values)
GCP_PROJECT_ID=aigm-theendpoint
GCP_REGION=us-central1

# Firebase Settings (uses Application Default Credentials)
# FIREBASE_CREDENTIALS_PATH not needed for local development with ADC

# API Keys (REPLACE WITH YOUR ACTUAL KEYS - LOCAL DEVELOPMENT ONLY)
GEMINI_API_KEY=your-gemini-api-key-here
STABILITY_API_KEY=your-stability-api-key-here

# Cloud Storage (Firebase Storage bucket)
GCS_BUCKET_NAME=aigm-theendpoint.firebasestorage.app

# Rate Limiting
RATE_LIMIT_PER_MINUTE=5
RATE_LIMIT_BURST=10

# Credit Costs
CHAT_CREDIT_COST=1
IMAGE_GENERATION_COST=1
MUSIC_GENERATION_COST=2

# Free Tier Limits
FREE_CHAT_CREDITS_MONTHLY=25
FREE_GEN_AI_CREDITS_MONTHLY=10

# AI Model Settings
GEMINI_MODEL=gemini-pro
TEMPERATURE=0.7
MAX_CONTEXT_LENGTH=4096

# Stability AI Settings
STABILITY_ENGINE=stable-diffusion-xl-1024-v1-0
STABILITY_MUSIC_ENGINE=stable-audio-open-1.0
```

## Step 4: Database Setup

### Use Existing Production Database
The AI service connects to the existing production Firestore database (`aigm-theendpoint`) which already contains:
- User accounts and authentication
- Server and chat room data
- Social feed posts
- User credits and subscription data

### Create Test Data (Optional)
For local testing, you can create test documents in the existing database:

#### Option 1: Use Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com/project/aigm-theendpoint/firestore)
2. Navigate to existing collections or create test data

#### Option 2: Create Test Documents Script
```powershell
# Create a test user document for AI service testing
# Note: This is optional - you can use existing user data
@"
Instructions for creating test AI service data:

1. In Firebase Console, go to 'users' collection
2. Create or use existing user document with structure:
{
  "email": "your-test-email@example.com",
  "displayName": "Test User", 
  "chatCredits": 25,
  "genAICredits": 10,
  "subscriptionTier": "free",
  "lastCreditReset": "2024-01-01T00:00:00.000Z",
  "aiAgentTeam": ["agent-001"]
}

3. Create 'ai_agents' collection with document ID 'agent-001':
{
  "name": "Assistant Bot",
  "personalityRules": [
    "You are a helpful AI assistant",
    "Always be polite and professional", 
    "Provide clear and concise answers"
  ],
  "genRules": [],
  "isPublic": true,
  "ownerId": "your-user-id",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
"@ | Out-File -FilePath firestore-test-setup.txt

Write-Host "Created firestore-test-setup.txt with instructions"
Write-Host "Database URL: https://console.firebase.google.com/project/aigm-theendpoint/firestore"
```

### Database Permissions
Your authenticated Google Cloud account should have access to the production database for local development.

## Step 5: Start the Service

### Run the AI Service
```powershell
# Make sure virtual environment is activated
# Should see (venv) in your prompt

# Start the service
python main.py

# You should see output like:
# INFO:     Started server process [XXXX]
# INFO:     Waiting for application startup.
# INFO:     Application startup complete.
# INFO:     Uvicorn running on http://0.0.0.0:8080
```

### Verify Service is Running
Open a new PowerShell window:
```powershell
# Test health endpoint
Invoke-RestMethod -Uri "http://localhost:8080/health" -Method GET

# Should return something like:
# status    : healthy
# timestamp : 2024-01-01T12:00:00.000000
# version   : 1.0.0
# services  : @{firestore=True; secret_manager=True; gemini=True; stability=True}
```

## Step 6: Manual API Testing

### Test Chat Endpoint

Create a test script:
```powershell
# Create test-chat.ps1
@"
# Test Chat API
`$headers = @{
    "Content-Type" = "application/json"
    "X-User-ID" = "test-user-123"
}

`$body = @{
    user_id = "test-user-123"
    agent_id = "agent-001"
    message = "Hello! Can you help me understand what you do?"
    context = @()
} | ConvertTo-Json

`$response = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/chat-call" -Method POST -Headers `$headers -Body `$body -ContentType "application/json"

Write-Host "Chat Response:"
`$response | ConvertTo-Json -Depth 3
"@ | Out-File -FilePath test-chat.ps1

# Run the test
.\test-chat.ps1
```

Expected response:
```json
{
  "message": "Hello! I'm Assistant Bot, a helpful AI assistant...",
  "agent_id": "agent-001",
  "tokens_used": 25,
  "credits_remaining": 24,
  "timestamp": "2024-01-01T12:00:00.000000"
}
```

### Test Generation Endpoint

```powershell
# Create test-generate.ps1
@"
# Test Image Generation
`$headers = @{
    "Content-Type" = "application/json"
    "X-User-ID" = "test-user-123"
}

`$body = @{
    user_id = "test-user-123"
    prompt = "A beautiful sunset over mountains"
    media_type = "image"
    style = "photographic"
} | ConvertTo-Json

`$response = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/gen-call" -Method POST -Headers `$headers -Body `$body -ContentType "application/json"

Write-Host "Generation Response:"
`$response | ConvertTo-Json -Depth 3
"@ | Out-File -FilePath test-generate.ps1

# Run the test
.\test-generate.ps1
```

### Test Credit Balance

```powershell
# Test credit balance endpoint
$headers = @{
    "Authorization" = "Bearer test-user-123-token"
}

$response = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/generate/credits/balance" -Method GET -Headers $headers

Write-Host "Credit Balance:"
$response | ConvertTo-Json
```

## Step 7: Using API Documentation

### Access Swagger UI
1. Open browser to: `http://localhost:8080/docs`
2. Explore the interactive API documentation
3. Test endpoints directly in the browser

### Access ReDoc
1. Open browser to: `http://localhost:8080/redoc`  
2. View detailed API documentation

## Step 8: Troubleshooting

### Common Issues and Solutions

#### 1. Virtual Environment Issues
```powershell
# If activation fails:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# If Python not found:
# Make sure Python is in your PATH, or use full path:
C:\Python311\python.exe -m venv venv
```

#### 2. Import Errors
```powershell
# If modules not found:
pip install -r requirements.txt --force-reinstall

# Check installed packages:
pip list
```

#### 3. Firebase Connection Issues
```powershell
# Verify credentials file exists:
Test-Path firebase-credentials.json

# Check environment variable:
$env:FIREBASE_CREDENTIALS_PATH
```

#### 4. API Key Issues
```powershell
# Check if API keys are loaded:
# Look for logs in the console when starting the service
# Should see: "Retrieved secret gemini_api_key from environment"
```

#### 5. Port Already in Use
```powershell
# Find what's using port 8080:
netstat -ano | findstr :8080

# Kill the process (replace XXXX with PID):
taskkill /PID XXXX /F

# Or use a different port:
# Edit main.py and change port=8080 to port=8081
```

### Debug Mode
```powershell
# Run with debug logging:
$env:DEBUG = "true"
$env:LOG_LEVEL = "DEBUG"
python main.py
```

### View Logs
The service outputs structured JSON logs. For better readability:
```powershell
# Pipe logs to a file:
python main.py 2>&1 | Tee-Object -FilePath service.log

# View logs in real-time:
Get-Content service.log -Wait
```

## Step 9: Advanced Testing

### Load Testing with Multiple Requests
```powershell
# Create load-test.ps1
@"
for (`$i = 1; `$i -le 10; `$i++) {
    `$headers = @{
        "Content-Type" = "application/json"
        "X-User-ID" = "test-user-123"
    }
    
    `$body = @{
        user_id = "test-user-123"
        agent_id = "agent-001"
        message = "Test message `$i"
        context = @()
    } | ConvertTo-Json
    
    try {
        `$response = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/chat-call" -Method POST -Headers `$headers -Body `$body -ContentType "application/json"
        Write-Host "Request `$i succeeded: `$(`$response.message.Substring(0, 50))..."
    }
    catch {
        Write-Host "Request `$i failed: `$(`$_.Exception.Message)"
    }
    
    Start-Sleep -Seconds 1
}
"@ | Out-File -FilePath load-test.ps1

.\load-test.ps1
```

### Test Rate Limiting
```powershell
# Send requests quickly to trigger rate limiting
for ($i = 1; $i -le 8; $i++) {
    Write-Host "Request $i"
    try {
        # Your chat request here (same as above but without sleep)
        # Should get 429 error after 5 requests
    }
    catch {
        Write-Host "Rate limited: $($_.Exception.Message)"
    }
}
```

## Step 10: Cleanup

### Stop the Service
- Press `Ctrl+C` in the PowerShell window running the service

### Deactivate Virtual Environment
```powershell
deactivate
```

### Clean Up Test Files
```powershell
Remove-Item test-chat.ps1, test-generate.ps1, load-test.ps1, setup-firestore.txt -ErrorAction SilentlyContinue
```

## Production Deployment

### Automated Deployment
The AI service is now integrated into the complete automated deployment pipeline. 

**To deploy to production:**
```powershell
# From the project root directory
git add .
git commit -m "Your changes"
git push origin main
```

This automatically deploys:
- ✅ Frontend to Cloud Run
- ✅ AI Service to Cloud Run  
- ✅ Firebase Functions
- ✅ Firestore rules
- ✅ All with proper networking and secrets

### View Production Services
After deployment, view your services:
```powershell
# View Cloud Run services
gcloud run services list --region=us-central1

# View service URLs
gcloud run services describe aigm-ai-service --region=us-central1 --format='value(status.url)'

# Check deployment status
gcloud builds list --limit=5
```

### Deployment Setup (One-time)
If not already set up, run the deployment setup scripts from the project root:
```powershell
# From /mnt/h/React_Dev/AIGM-TheEndPoint/
.\setup-deployment.sh
.\configure-service-networking.sh
```

For detailed deployment setup instructions, see: `/docs/guides/complete-automated-deployment.md`

## Next Steps

1. **Local Development**: Use this guide for local testing and development
2. **Production Changes**: Push to main branch for automatic deployment
3. **Monitoring**: View logs in Google Cloud Console
4. **Service Integration**: The AI service automatically integrates with your existing frontend

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review service logs for error messages
3. Verify all environment variables are set correctly
4. Ensure API keys are valid and have proper permissions

The service should now be running and ready for testing! The API documentation at `http://localhost:8080/docs` provides an interactive interface for testing all endpoints.