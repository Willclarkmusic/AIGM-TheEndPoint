# AI & GenAI Backend Service

This is the central Python backend service for all AI and generative AI functionality. It runs in a Docker container on Google Cloud Run and provides secure endpoints for conversational AI and content generation.

## Features

- **Conversational AI**: Chat with AI agents using Google's Gemini API
- **Content Generation**: Generate images and music using Stability AI
- **Personality System**: AI agents with customizable personalities using LangGraph
- **Credit Management**: Built-in credit system for usage control
- **Rate Limiting**: Per-user rate limiting for API protection
- **Secure**: API keys stored in Google Cloud Secret Manager
- **Scalable**: Designed for Google Cloud Run auto-scaling

## API Endpoints

### Chat Endpoints
- `POST /api/v1/chat-call` - Process a chat message through an AI agent
- `GET /api/v1/chat/agents/{agent_id}` - Get information about an AI agent

### Generation Endpoints
- `POST /api/v1/gen-call` - Generate images, music, or album art
- `GET /api/v1/generate/{request_id}` - Check generation status
- `GET /api/v1/generate/credits/balance` - Get user's credit balance

### Health & Monitoring
- `GET /health` - Health check endpoint
- `GET /` - Service information

## Local Development

### Prerequisites
- Python 3.11+
- Docker (optional)
- Google Cloud SDK
- Firebase service account credentials

### Setup

1. Clone the repository and navigate to the ai-service directory:
```bash
cd ai-service
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

5. Run the service:
```bash
python main.py
```

The service will be available at http://localhost:8080

### API Documentation
Once running, visit:
- Swagger UI: http://localhost:8080/docs
- ReDoc: http://localhost:8080/redoc

## Docker Development

Build the Docker image:
```bash
docker build -t ai-service .
```

Run the container:
```bash
docker run -p 8080:8080 --env-file .env ai-service
```

## Testing

Run tests:
```bash
pytest
```

Run with coverage:
```bash
pytest --cov=.
```

## Deployment to Google Cloud Run

### Prerequisites
- Google Cloud project with billing enabled
- Cloud Run API enabled
- Secret Manager API enabled
- Firestore database created
- Cloud Storage bucket created

### Setup Secrets

1. Create secrets in Secret Manager:
```bash
# Create Gemini API key secret
echo -n "your-gemini-api-key" | gcloud secrets create gemini_api_key --data-file=-

# Create Stability API key secret
echo -n "your-stability-api-key" | gcloud secrets create stability_api_key --data-file=-
```

2. Grant Cloud Run service account access to secrets:
```bash
PROJECT_ID=your-project-id
SERVICE_ACCOUNT=your-service-account@${PROJECT_ID}.iam.gserviceaccount.com

gcloud secrets add-iam-policy-binding gemini_api_key \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding stability_api_key \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/secretmanager.secretAccessor"
```

### Deploy to Cloud Run

1. Build and push to Container Registry:
```bash
PROJECT_ID=your-project-id
IMAGE_NAME=ai-service

# Configure Docker for GCR
gcloud auth configure-docker

# Build and push
docker build -t gcr.io/${PROJECT_ID}/${IMAGE_NAME} .
docker push gcr.io/${PROJECT_ID}/${IMAGE_NAME}
```

2. Deploy to Cloud Run:
```bash
gcloud run deploy ai-service \
    --image gcr.io/${PROJECT_ID}/${IMAGE_NAME} \
    --platform managed \
    --region us-central1 \
    --memory 2Gi \
    --cpu 2 \
    --timeout 300 \
    --concurrency 80 \
    --min-instances 1 \
    --max-instances 10 \
    --set-env-vars "GCP_PROJECT_ID=${PROJECT_ID}" \
    --set-env-vars "ENVIRONMENT=production" \
    --set-env-vars "GCS_BUCKET_NAME=your-bucket-name" \
    --service-account ${SERVICE_ACCOUNT}
```

3. Configure Cloud Run service:
```bash
# Allow unauthenticated access (auth handled by service)
gcloud run services add-iam-policy-binding ai-service \
    --member="allUsers" \
    --role="roles/run.invoker" \
    --region us-central1
```

### Using Cloud Build (Recommended)

Create a `cloudbuild.yaml` in the project root:
```yaml
steps:
  # Build the container image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/ai-service', './ai-service']
  
  # Push the container image to Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/ai-service']
  
  # Deploy container image to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
    - 'run'
    - 'deploy'
    - 'ai-service'
    - '--image'
    - 'gcr.io/$PROJECT_ID/ai-service'
    - '--region'
    - 'us-central1'
    - '--platform'
    - 'managed'
    - '--memory'
    - '2Gi'
    - '--cpu'
    - '2'
    - '--timeout'
    - '300'
    - '--concurrency'
    - '80'
    - '--min-instances'
    - '1'
    - '--max-instances'
    - '10'

images:
- 'gcr.io/$PROJECT_ID/ai-service'
```

Then deploy using:
```bash
gcloud builds submit --config cloudbuild.yaml
```

## Environment Variables

See `.env.example` for all available configuration options.

### Required in Production:
- `GCP_PROJECT_ID` - Your Google Cloud project ID
- `GCS_BUCKET_NAME` - Cloud Storage bucket for generated content
- `ENVIRONMENT` - Set to "production"

### Optional (defaults provided):
- `RATE_LIMIT_PER_MINUTE` - Chat requests per minute (default: 5)
- `CHAT_CREDIT_COST` - Credits per chat request (default: 1)
- `IMAGE_GENERATION_COST` - Credits per image (default: 1)
- `MUSIC_GENERATION_COST` - Credits per music track (default: 2)

## Security Considerations

1. **API Keys**: Never commit API keys. Use Secret Manager in production.
2. **Authentication**: The service validates user tokens from Firebase Auth.
3. **Rate Limiting**: Prevents abuse with per-user limits.
4. **Credit System**: All credit operations are server-side only.
5. **CORS**: Configure allowed origins for your frontend domains.

## Monitoring

Monitor your service in the Google Cloud Console:
- Cloud Run metrics: CPU, memory, request count
- Cloud Logging: Application logs
- Error Reporting: Automatic error tracking
- Uptime Checks: Health endpoint monitoring

## Troubleshooting

### Common Issues

1. **"API key not found" error**
   - Ensure secrets are created in Secret Manager
   - Verify service account has access to secrets

2. **"Firestore not initialized" error**
   - Check Firebase credentials path
   - Ensure Firestore database exists

3. **Rate limit errors**
   - Adjust RATE_LIMIT_PER_MINUTE in environment
   - Implement queue system for high volume

4. **Generation timeouts**
   - Increase Cloud Run timeout setting
   - Consider async processing with Pub/Sub

### Debug Mode

Run locally with debug logging:
```bash
DEBUG=true LOG_LEVEL=DEBUG python main.py
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## License

Copyright (c) 2024. All rights reserved.