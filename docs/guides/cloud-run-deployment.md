# Google Cloud Run Deployment Guide

This guide provides step-by-step instructions to deploy the React frontend from Firebase Hosting to Google Cloud Run with automated CI/CD, custom domain configuration via Cloudflare, and production optimization.

## Prerequisites

Before starting, ensure you have:
- A Google Cloud Project with billing enabled
- A GitHub account
- A Cloudflare account (for custom domain)
- A custom domain name
- `gcloud` CLI installed and authenticated
- Docker installed locally (for testing)

## Phase 1: GitHub Repository Setup

### 1.1 Create GitHub Repository

1. **Go to GitHub** and create a new repository:
   - Repository name: `aigm-messaging-platform` (or your preferred name)
   - Set to **Private** (recommended for production apps)
   - Initialize with README: **No** (we'll push existing code)

2. **Copy the repository URL** (you'll need this in the next step)

### 1.2 Initialize Git and Push Code

Open your terminal in the project root directory and run:

```bash
# Initialize git repository (if not already done)
git init

# Add all files to staging
git add .

# Create initial commit
git commit -m "Initial commit: React messaging platform with Cloud Run deployment setup"

# Add GitHub remote (replace with your repository URL)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Push to GitHub
git push -u origin main
```

### 1.3 Verify Repository Structure

Ensure your repository contains these key files:
```
/
├── frontend/
│   ├── Dockerfile                 # Production-ready Docker configuration
│   ├── nginx.conf                 # Nginx web server configuration
│   ├── docker-entrypoint.sh       # Container startup script
│   ├── .dockerignore              # Docker build exclusions
│   ├── package.json               # Node.js dependencies
│   └── src/                       # React application code
├── functions/                     # Firebase Cloud Functions
├── docs/                          # Project documentation
└── README.md
```

## Phase 2: Google Cloud Run CI/CD Setup

### 2.1 Enable Required APIs

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Select your project** or create a new one
3. **Enable the following APIs**:
   - Cloud Run API
   - Cloud Build API
   - Container Registry API
   - Secret Manager API

```bash
# Enable APIs via CLI (alternative method)
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

### 2.2 Configure Cloud Build Service Account

1. **Go to Cloud Build Settings**: https://console.cloud.google.com/cloud-build/settings/service-account
2. **Enable the following roles** for the Cloud Build service account:
   - Cloud Run Admin
   - Service Account User
   - Storage Admin

### 2.3 Create Cloud Run Service

1. **Go to Cloud Run**: https://console.cloud.google.com/run
2. **Click "Create Service"**
3. **Configure the service**:
   - **Service name**: `aigm-frontend`
   - **Region**: Choose closest to your users (e.g., `us-central1`)
   - **CPU allocation**: CPU is only allocated during request processing
   - **Ingress**: Allow all traffic
   - **Authentication**: Allow unauthenticated invocations

4. **Set up Continuous Deployment**:
   - **Source**: Repository
   - **Provider**: GitHub
   - **Connect repository**: Click "Connect" and authorize GitHub
   - **Select repository**: Choose your repository
   - **Branch**: `main`
   - **Build type**: Dockerfile
   - **Source location**: `/frontend/Dockerfile`

### 2.4 Configure Build Settings

1. **Advanced Settings**:
   - **Service account**: Use default Cloud Build service account
   - **Timeout**: 600 seconds (10 minutes)
   - **Machine type**: E2_HIGHCPU_8 (for faster builds)

2. **Environment Variables** (if needed):
   ```
   NODE_ENV=production
   ```

3. **Resource Allocation**:
   - **Memory**: 1 GiB
   - **CPU**: 1 vCPU
   - **Request timeout**: 300 seconds
   - **Maximum instances**: 100
   - **Minimum instances**: 0 (for cost optimization)

### 2.5 Create Cloud Build Configuration

Create a `cloudbuild.yaml` file in your repository root:

```yaml
# cloudbuild.yaml
steps:
  # Build the Docker image
  - name: 'gcr.io/cloud-builders/docker'
    args: [
      'build',
      '-t', 'gcr.io/$PROJECT_ID/aigm-frontend:$COMMIT_SHA',
      '-t', 'gcr.io/$PROJECT_ID/aigm-frontend:latest',
      './frontend'
    ]

  # Push the image to Google Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/aigm-frontend:$COMMIT_SHA']

  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/aigm-frontend:latest']

  # Deploy to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args: [
      'run', 'deploy', 'aigm-frontend',
      '--image', 'gcr.io/$PROJECT_ID/aigm-frontend:$COMMIT_SHA',
      '--region', 'us-central1',
      '--platform', 'managed',
      '--allow-unauthenticated',
      '--port', '8080',
      '--memory', '1Gi',
      '--cpu', '1',
      '--min-instances', '0',
      '--max-instances', '100',
      '--set-env-vars', 'NODE_ENV=production'
    ]

options:
  machineType: 'E2_HIGHCPU_8'
  logging: CLOUD_LOGGING_ONLY

timeout: '600s'
```

### 2.6 Test the Deployment

1. **Trigger a build** by pushing a commit:
   ```bash
   git add cloudbuild.yaml
   git commit -m "Add Cloud Build configuration"
   git push origin main
   ```

2. **Monitor the build**:
   - Go to Cloud Build History: https://console.cloud.google.com/cloud-build/builds
   - Check the build logs for any errors

3. **Test the deployed service**:
   - Go to Cloud Run: https://console.cloud.google.com/run
   - Click on your service
   - Click the URL to test your application

## Phase 3: Custom Domain with Cloudflare

### 3.1 Configure Cloud Run Domain Mapping

1. **Go to Cloud Run**: https://console.cloud.google.com/run
2. **Click on your service** (`aigm-frontend`)
3. **Go to the "Custom Domains" tab**
4. **Click "Add mapping"**
5. **Enter your domain**: `app.yourdomain.com` (or your preferred subdomain)
6. **Click "Continue"**
7. **Note the DNS records** that Google provides (you'll need these for Cloudflare)

### 3.2 Configure Cloudflare DNS

1. **Log in to Cloudflare**: https://dash.cloudflare.com/
2. **Select your domain**
3. **Go to DNS settings**
4. **Add the DNS records** provided by Google Cloud Run:

   **For a subdomain (app.yourdomain.com):**
   ```
   Type: CNAME
   Name: app
   Target: ghs.googlehosted.com
   Proxy status: DNS only (Gray cloud)
   TTL: Auto
   ```

   **For the root domain (yourdomain.com):**
   ```
   Type: A
   Name: @
   Content: 216.239.32.21
   Proxy status: DNS only (Gray cloud)
   TTL: Auto

   Type: A
   Name: @
   Content: 216.239.34.21
   Proxy status: DNS only (Gray cloud)
   TTL: Auto

   Type: A
   Name: @
   Content: 216.239.36.21
   Proxy status: DNS only (Gray cloud)
   TTL: Auto

   Type: A
   Name: @
   Content: 216.239.38.21
   Proxy status: DNS only (Gray cloud)
   TTL: Auto

   Type: AAAA
   Name: @
   Content: 2001:4860:4802:32::15
   Proxy status: DNS only (Gray cloud)
   TTL: Auto

   Type: AAAA
   Name: @
   Content: 2001:4860:4802:34::15
   Proxy status: DNS only (Gray cloud)
   TTL: Auto

   Type: AAAA
   Name: @
   Content: 2001:4860:4802:36::15
   Proxy status: DNS only (Gray cloud)
   TTL: Auto

   Type: AAAA
   Name: @
   Content: 2001:4860:4802:38::15
   Proxy status: DNS only (Gray cloud)
   TTL: Auto
   ```

### 3.3 Verify Domain Mapping

1. **Wait for DNS propagation** (5-30 minutes)
2. **Go back to Cloud Run** and check the domain mapping status
3. **Once verified**, Google will automatically provision an SSL certificate

### 3.4 Enable Cloudflare Proxy (Optional)

After SSL certificate is provisioned by Google:

1. **Go back to Cloudflare DNS settings**
2. **Change the proxy status** for your domain records to "Proxied" (Orange cloud)
3. **Configure SSL/TLS settings**:
   - Go to SSL/TLS → Overview
   - Set to "Full (strict)"

### 3.5 Configure Cloudflare Security Features

1. **Page Rules** (optional):
   ```
   URL: app.yourdomain.com/*
   Settings:
   - Cache Level: Standard
   - Browser Cache TTL: 4 hours
   - Security Level: Medium
   ```

2. **Security Settings**:
   - Enable "Under Attack Mode" if needed
   - Configure rate limiting
   - Set up WAF rules if required

## Phase 4: Production Optimization

### 4.1 Performance Monitoring

1. **Enable Cloud Run Monitoring**:
   - Go to Cloud Run → your service → Metrics
   - Monitor request latency, error rates, and instance count

2. **Set up Alerts**:
   ```bash
   # Create alerting policy for high error rate
   gcloud alpha monitoring policies create --policy-from-file=error-rate-policy.yaml
   ```

### 4.2 Security Hardening

1. **Configure IAM properly**:
   ```bash
   # Remove public access if not needed
   gcloud run services remove-iam-policy-binding aigm-frontend \
     --member="allUsers" \
     --role="roles/run.invoker" \
     --region=us-central1
   ```

2. **Enable VPC Connector** (if needed for internal services):
   ```bash
   gcloud compute networks vpc-access connectors create aigm-connector \
     --region=us-central1 \
     --subnet=default \
     --subnet-project=YOUR_PROJECT_ID
   ```

### 4.3 Cost Optimization

1. **Configure auto-scaling**:
   ```bash
   gcloud run services update aigm-frontend \
     --min-instances=0 \
     --max-instances=10 \
     --region=us-central1
   ```

2. **Set up budget alerts**:
   - Go to Billing → Budgets & alerts
   - Create budget for Cloud Run spending

## Testing and Verification

### Local Testing

Test the Docker container locally before deployment:

```bash
# Build the image
cd frontend
docker build -t aigm-frontend .

# Run the container
docker run -p 8080:8080 aigm-frontend

# Test the application
curl http://localhost:8080/health
```

### Production Testing

1. **Test the deployed application**:
   ```bash
   curl https://your-cloud-run-url.com/health
   ```

2. **Test with custom domain**:
   ```bash
   curl https://app.yourdomain.com/health
   ```

3. **Performance testing**:
   ```bash
   # Use Apache Bench for basic load testing
   ab -n 100 -c 10 https://app.yourdomain.com/
   ```

## Troubleshooting

### Common Issues

1. **Build failures**:
   - Check Cloud Build logs
   - Verify Dockerfile syntax
   - Ensure all dependencies are in package.json

2. **Container startup issues**:
   - Check Cloud Run logs
   - Verify nginx configuration
   - Test locally with Docker

3. **Domain mapping issues**:
   - Verify DNS records in Cloudflare
   - Check domain ownership verification
   - Wait for DNS propagation

4. **SSL certificate issues**:
   - Ensure DNS records are correctly configured
   - Wait for Google's automatic SSL provisioning
   - Check domain verification status

### Useful Commands

```bash
# View Cloud Run logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=aigm-frontend" --limit=50

# Update service configuration
gcloud run services update aigm-frontend --region=us-central1 --memory=2Gi

# Deploy specific image version
gcloud run deploy aigm-frontend --image=gcr.io/PROJECT_ID/aigm-frontend:COMMIT_SHA --region=us-central1

# Check service status
gcloud run services describe aigm-frontend --region=us-central1
```

## Next Steps

After successful deployment:

1. **Set up monitoring and alerting**
2. **Configure backup strategies**
3. **Implement staging environment**
4. **Set up automated testing pipeline**
5. **Configure log aggregation**
6. **Plan for disaster recovery**

## Security Considerations

1. **Enable VPC if handling sensitive data**
2. **Configure proper IAM roles and permissions**
3. **Regularly update container base images**
4. **Monitor for security vulnerabilities**
5. **Implement proper secret management**
6. **Configure Web Application Firewall (WAF)**

## Cost Management

1. **Monitor Cloud Run usage and costs**
2. **Optimize resource allocation based on traffic patterns**
3. **Set up billing alerts**
4. **Use committed use discounts for predictable workloads**
5. **Implement proper auto-scaling policies**

---

This deployment setup provides a production-ready, scalable, and secure hosting solution for your React messaging platform on Google Cloud Run with automated CI/CD and custom domain support through Cloudflare.