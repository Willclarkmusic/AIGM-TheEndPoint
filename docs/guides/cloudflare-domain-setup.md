# Cloudflare Domain Setup for Cloud Run

This guide walks you through connecting your custom domain (managed by Cloudflare) to your Google Cloud Run deployment.

## 📋 Prerequisites

Before starting, ensure you have:
- ✅ Your Cloud Run service successfully deployed (`aigm-frontend`)
- ✅ A domain registered and active in Cloudflare
- ✅ Access to both Google Cloud Console and Cloudflare dashboard
- ✅ Your Cloud Run service URL (e.g., `https://aigm-frontend-xxxxx-uc.a.run.app`)

## 🚀 Step 1: Create Domain Mapping in Cloud Run

### 1.1 Access Cloud Run Service
1. Go to [Google Cloud Console](https://console.cloud.google.com/run)
2. Click on your service name (`aigm-frontend`)
3. Note your service URL at the top of the page

### 1.2 Add Custom Domain Mapping
1. Click on the **"Manage Custom Domains"** button (or go to the **"Custom Domains"** tab)
2. Click **"Add Mapping"**
3. Select your service from the dropdown (if not already selected)
4. Enter your domain:
   - For subdomain: `app.yourdomain.com`
   - For root domain: `yourdomain.com`
5. Click **"Continue"**

### 1.3 Verify Domain Ownership
Google will ask you to verify domain ownership. Since you're using Cloudflare:

1. Choose **"Verify ownership via DNS record"**
2. Google will provide a TXT record like:
   ```
   Name: _acme-challenge.yourdomain.com
   Type: TXT
   Value: google-site-verification=XXXXXXXXXXXXX
   ```
3. **Keep this window open** - you'll add this record in Cloudflare

## 🌐 Step 2: Configure Cloudflare DNS

### 2.1 Add Domain Verification Record
1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select your domain
3. Go to **DNS** → **Records**
4. Click **"Add record"**
5. Add the verification TXT record:
   - **Type**: TXT
   - **Name**: `_acme-challenge` (or as provided by Google)
   - **Content**: The verification string from Google
   - **TTL**: Auto
   - **Proxy status**: DNS only (gray cloud)
6. Click **"Save"**

### 2.2 Return to Google Cloud Console
1. Go back to the Cloud Run domain mapping window
2. Click **"Verify"**
3. Once verified, Google will provide DNS records to add

## 📝 Step 3: Add Cloud Run DNS Records

Google will provide specific DNS records. Add these in Cloudflare:

### For Subdomain (e.g., app.yourdomain.com)
1. In Cloudflare DNS, click **"Add record"**
2. Create a CNAME record:
   - **Type**: CNAME
   - **Name**: `app` (or your chosen subdomain)
   - **Target**: `ghs.googlehosted.com`
   - **TTL**: Auto
   - **Proxy status**: DNS only (gray cloud) - **Important!**
3. Click **"Save"**

### For Root Domain (e.g., yourdomain.com)
1. Add multiple A records:
   ```
   Type: A
   Name: @
   Content: 216.239.32.21
   Proxy: DNS only (gray cloud)
   
   Type: A
   Name: @
   Content: 216.239.34.21
   Proxy: DNS only (gray cloud)
   
   Type: A
   Name: @
   Content: 216.239.36.21
   Proxy: DNS only (gray cloud)
   
   Type: A
   Name: @
   Content: 216.239.38.21
   Proxy: DNS only (gray cloud)
   ```

2. Add AAAA records (IPv6):
   ```
   Type: AAAA
   Name: @
   Content: 2001:4860:4802:32::15
   Proxy: DNS only (gray cloud)
   
   Type: AAAA
   Name: @
   Content: 2001:4860:4802:34::15
   Proxy: DNS only (gray cloud)
   
   Type: AAAA
   Name: @
   Content: 2001:4860:4802:36::15
   Proxy: DNS only (gray cloud)
   
   Type: AAAA
   Name: @
   Content: 2001:4860:4802:38::15
   Proxy: DNS only (gray cloud)
   ```

### For www Subdomain (optional)
If you want `www.yourdomain.com` to work:
1. Add a CNAME record:
   - **Type**: CNAME
   - **Name**: `www`
   - **Target**: `ghs.googlehosted.com`
   - **TTL**: Auto
   - **Proxy status**: DNS only (gray cloud)

## ⏱️ Step 4: Wait for DNS Propagation

1. DNS changes can take 5-30 minutes to propagate
2. Return to Google Cloud Console → Cloud Run → Custom Domains
3. Your domain should show status: **"DNS records configured"**
4. Google will automatically provision an SSL certificate (may take up to 24 hours, usually faster)

## 🔒 Step 5: Configure SSL/TLS in Cloudflare

### 5.1 Initial Setup (Gray Cloud)
While Google provisions the SSL certificate, keep Cloudflare proxy **disabled** (gray cloud).

### 5.2 SSL/TLS Settings
1. In Cloudflare, go to **SSL/TLS** → **Overview**
2. Set encryption mode to **"Full (strict)"**
3. This ensures end-to-end encryption

### 5.3 After SSL Certificate is Active
Once Google shows the SSL certificate as active (green checkmark):
1. You can optionally enable Cloudflare proxy (orange cloud) for your records
2. This adds Cloudflare's CDN and security features

## 🔧 Step 6: Firebase Configuration Update

**Important**: Add your custom domain to Firebase authorized domains:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`aigm-theendpoint`)
3. Go to **Authentication** → **Settings** → **Authorized domains**
4. Click **"Add domain"**
5. Add your custom domains:
   - `yourdomain.com`
   - `app.yourdomain.com`
   - `www.yourdomain.com` (if using)
6. Click **"Add"**

## ✅ Step 7: Testing

### 7.1 Basic Connectivity
1. Visit your custom domain: `https://app.yourdomain.com`
2. Verify the React app loads
3. Check browser shows secure connection (padlock icon)

### 7.2 Authentication Testing
1. Try logging in with email/password
2. Test social login (Google/GitHub)
3. Verify all authentication flows work

### 7.3 SSL Certificate Verification
1. Click the padlock icon in browser
2. View certificate details
3. Should show certificate issued by Google

## 🚀 Optional: Performance Optimization

### Enable Cloudflare Features
Once everything works, you can enable:

1. **Auto Minify** (HTML, CSS, JS)
   - Go to **Speed** → **Optimization**
   - Enable Auto Minify

2. **Brotli Compression**
   - Go to **Speed** → **Optimization**
   - Enable Brotli

3. **Browser Cache TTL**
   - Go to **Caching** → **Configuration**
   - Set Browser Cache TTL

4. **Page Rules** (Free plan includes 3)
   - Go to **Rules** → **Page Rules**
   - Example rule for static assets:
     ```
     URL: app.yourdomain.com/assets/*
     Cache Level: Cache Everything
     Browser Cache TTL: 1 month
     ```

## 🛠️ Troubleshooting

### Common Issues and Solutions

#### Domain Not Working
- **Issue**: Site doesn't load on custom domain
- **Solution**: 
  - Verify DNS records in Cloudflare match Google's requirements exactly
  - Ensure proxy status is "DNS only" (gray cloud) initially
  - Check DNS propagation using [dnschecker.org](https://dnschecker.org)

#### SSL Certificate Errors
- **Issue**: Browser shows security warning
- **Solution**:
  - Wait for Google to provision certificate (up to 24 hours)
  - Ensure Cloudflare SSL mode is "Full (strict)"
  - Keep Cloudflare proxy disabled until Google's cert is active

#### Authentication Failures
- **Issue**: Login fails on custom domain
- **Solution**:
  - Add custom domain to Firebase authorized domains
  - Clear browser cache and cookies
  - Test in incognito/private mode

#### Redirect Loops
- **Issue**: Page keeps redirecting
- **Solution**:
  - Set Cloudflare SSL to "Full (strict)"
  - Disable "Always Use HTTPS" in Cloudflare temporarily
  - Check for conflicting page rules

## 📊 Monitoring

### Cloud Run Metrics
- Monitor traffic to your custom domain in Cloud Run console
- Check latency and error rates
- Verify SSL certificate status

### Cloudflare Analytics
- View traffic analytics in Cloudflare dashboard
- Monitor cache hit rates
- Check for blocked threats

## 🎯 Final Checklist

- [ ] Domain mapping created in Cloud Run
- [ ] Domain ownership verified
- [ ] DNS records added in Cloudflare (gray cloud)
- [ ] SSL certificate provisioned by Google
- [ ] Custom domains added to Firebase authorized domains
- [ ] Authentication tested and working
- [ ] HTTPS working without warnings
- [ ] Optional: Cloudflare proxy enabled (orange cloud)
- [ ] Optional: Performance features configured

## 📚 Additional Resources

- [Cloud Run Domain Mappings Documentation](https://cloud.google.com/run/docs/mapping-custom-domains)
- [Cloudflare DNS Documentation](https://developers.cloudflare.com/dns/)
- [Firebase Authorized Domains Guide](https://firebase.google.com/docs/auth/web/redirect-best-practices)

---

After completing these steps, your messaging platform will be accessible via your custom domain with full SSL encryption and authentication support!