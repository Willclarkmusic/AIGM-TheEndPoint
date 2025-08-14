# Cloud Run Deployment Checklist

## 🚀 Pre-Deployment Checklist

### Firebase Project Setup
- [ ] Firebase project created (`aigm-theendpoint`)
- [ ] Web app configured in Firebase Console
- [ ] Authentication enabled (Email/Password, Google, GitHub)
- [ ] Firestore database created and configured
- [ ] Firebase configuration copied to `frontend/src/firebase/config.ts`

### Google Cloud Setup
- [ ] Google Cloud project created with billing enabled
- [ ] Cloud Run API enabled
- [ ] Cloud Build API enabled
- [ ] Container Registry API enabled
- [ ] Secret Manager API enabled

### Code Repository
- [ ] GitHub repository created and code pushed
- [ ] `cloudbuild.yaml` configured with correct Firebase values
- [ ] `Dockerfile` optimized for production
- [ ] Firebase configuration validated in code

## 🔧 During Deployment

### Cloud Build Configuration
- [ ] Cloud Build connected to GitHub repository
- [ ] Build triggers configured for `main` branch
- [ ] Firebase environment variables set in Cloud Build
- [ ] Build completes successfully without errors

### Cloud Run Service
- [ ] Service deployed with correct configuration:
  - [ ] Port 8080
  - [ ] Memory: 1Gi
  - [ ] CPU: 1
  - [ ] Min instances: 0
  - [ ] Max instances: 100
  - [ ] Allow unauthenticated invocations
- [ ] Service URL accessible and serving the React app

## ✅ Post-Deployment Verification

### Firebase Authentication Setup
- [ ] **Get Cloud Run URL** from Google Cloud Console
- [ ] **Add Cloud Run domain to Firebase Authorized Domains**:
  - Go to Firebase Console → Authentication → Settings → Authorized domains
  - Add your Cloud Run URL (without https://)
  - Example: `aigm-frontend-xxxxx-uc.a.run.app`

### Application Testing
- [ ] **Basic functionality**:
  - [ ] React app loads correctly
  - [ ] No console errors related to Firebase configuration
  - [ ] Health check endpoint (`/health`) returns 200 OK

- [ ] **Authentication testing**:
  - [ ] Sign up with email/password works
  - [ ] Sign in with email/password works
  - [ ] Google social login works (if enabled)
  - [ ] GitHub social login works (if enabled)
  - [ ] User session persists on page refresh

- [ ] **Firebase services**:
  - [ ] Firestore read/write operations work
  - [ ] File uploads to Cloud Storage work
  - [ ] Real-time listeners function properly

### Security Verification
- [ ] **Firestore Security Rules** properly configured
- [ ] **Cloud Storage Security Rules** allow authenticated access
- [ ] **HTTPS** enforced (automatic with Cloud Run)
- [ ] **Security headers** present in nginx configuration

### Performance Testing
- [ ] **Page load speed** acceptable (< 3 seconds)
- [ ] **Bundle size** optimized (< 1MB gzipped)
- [ ] **Health checks** responding properly
- [ ] **Auto-scaling** working (scale to zero when idle)

## 🌐 Custom Domain Setup (Optional)

### Domain Configuration
- [ ] Custom domain purchased and configured
- [ ] Cloud Run domain mapping created
- [ ] DNS records configured in Cloudflare:
  - [ ] CNAME record pointing to Cloud Run
  - [ ] SSL certificate automatically provisioned
- [ ] Custom domain added to Firebase Authorized Domains

### Domain Testing
- [ ] Custom domain accessible via HTTPS
- [ ] Authentication works with custom domain
- [ ] SSL certificate valid and trusted

## 🚨 Troubleshooting Common Issues

### Firebase Configuration Issues
- **Problem**: `auth/invalid-api-key`
  - **Solution**: Update Firebase config in `config.ts` with actual values

- **Problem**: `auth/unauthorized-domain`
  - **Solution**: Add Cloud Run domain to Firebase Authorized Domains

### Build Issues
- **Problem**: Docker build fails
  - **Solution**: Check Dockerfile syntax and package.json dependencies

- **Problem**: TypeScript errors during build
  - **Solution**: Using `npx vite build` skips TypeScript checking

### Deployment Issues
- **Problem**: Cloud Run service not accessible
  - **Solution**: Ensure "Allow unauthenticated invocations" is enabled

- **Problem**: nginx not starting
  - **Solution**: Check nginx.conf syntax and file permissions

## 📊 Monitoring and Maintenance

### Regular Checks
- [ ] **Monitor Cloud Run metrics** (requests, latency, errors)
- [ ] **Check build logs** for any warnings or issues
- [ ] **Review Firebase usage** and quotas
- [ ] **Monitor costs** and set up budget alerts

### Security Updates
- [ ] **Update base Docker images** regularly
- [ ] **Review Firebase security rules** periodically
- [ ] **Monitor for security vulnerabilities** in dependencies

## 📋 Success Criteria

Your deployment is successful when:
- ✅ React app loads on Cloud Run URL
- ✅ Users can sign up and log in
- ✅ All Firebase services work properly
- ✅ No authentication or configuration errors
- ✅ Application performs well under load
- ✅ Security measures are properly implemented

## 🎯 Quick Fix Summary

For the current `auth/unauthorized-domain` error:

1. **Get your Cloud Run URL** from Google Cloud Console
2. **Go to Firebase Console** → Authentication → Settings → Authorized domains
3. **Click "Add domain"** and paste your Cloud Run URL (without https://)
4. **Test authentication** - it should work immediately

This should resolve the authentication issue and make your messaging platform fully functional on Cloud Run!