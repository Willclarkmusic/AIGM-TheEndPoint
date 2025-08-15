# Domain Mapping Troubleshooting Guide

## Current Setup Analysis

Based on your DNS records for `theendpoint.xyz`, you have:
- ✅ 4 A records (IPv4) pointing to Google's IPs
- ✅ 4 AAAA records (IPv6) pointing to Google's IPs  
- ✅ TXT verification record for Google
- ✅ All records set to "DNS only" (gray cloud) - correct!

## 🔍 Common Reasons for Slow Domain Mapping

### 1. DNS Propagation Time
Even though records are added, global DNS propagation can take:
- **Typical**: 15-60 minutes
- **Maximum**: Up to 48 hours (rare)
- **Cloudflare**: Usually faster (5-30 minutes)

### 2. Check Domain Mapping Status

Go to Cloud Run and check the exact status:

1. [Google Cloud Console](https://console.cloud.google.com/run)
2. Click your service (`aigm-frontend`)
3. Go to **"Custom Domains"** tab
4. Check the status message for `theendpoint.xyz`

Common statuses:
- **"Waiting for DNS configuration"** - DNS not propagated yet
- **"DNS configuration in progress"** - Google detected records, provisioning SSL
- **"Certificate provisioning"** - DNS verified, SSL being created

### 3. Verify DNS Propagation

Check if your DNS records have propagated:

```bash
# Check A records
nslookup theendpoint.xyz

# Check with Google's DNS
nslookup theendpoint.xyz 8.8.8.8

# Or use online tool
# Visit: https://dnschecker.org/#A/theendpoint.xyz
```

Expected results for A records:
- 216.239.32.21
- 216.239.34.21
- 216.239.36.21
- 216.239.38.21

### 4. Potential Issues to Check

#### Missing Records?
For a complete setup, ensure you have:

**For root domain (theendpoint.xyz):**
- ✅ 4 A records (you have these)
- ✅ 4 AAAA records (you have these)
- ✅ TXT verification (you have this)

**For www subdomain (optional but recommended):**
```
Type: CNAME
Name: www
Target: ghs.googlehosted.com
Proxy: DNS only (gray cloud)
TTL: Auto
```

#### Verification Record
Your TXT record looks correct:
```
TXT | theendpoint.xyz | "google-site-verification=GHR8m1fTqVLgxlf3bIaZ9YHRN9FA51HaD0pOrtmf8sU"
```

Make sure:
- The value matches exactly what Google provided
- There are quotes around the value
- It's been at least 15 minutes since adding

### 5. Quick Fixes to Try

#### Force DNS Refresh
1. In Cloudflare, edit any record (like changing TTL)
2. Save it
3. Change it back
4. This can trigger faster propagation

#### Verify in Cloud Run Console
1. Go to Cloud Run → Your Service → Custom Domains
2. Click on your domain mapping
3. Click **"Verify"** button again (if available)
4. This forces Google to recheck DNS

#### Clear DNS Cache Locally
```bash
# Windows
ipconfig /flushdns

# macOS
sudo dscacheutil -flushcache

# Linux
sudo systemctl restart systemd-resolved
```

### 6. Alternative Setup - Subdomain

If the root domain continues to have issues, try a subdomain first:

1. Add in Cloudflare:
```
Type: CNAME
Name: app
Target: ghs.googlehosted.com
Proxy: DNS only (gray cloud)
TTL: Auto
```

2. Map `app.theendpoint.xyz` in Cloud Run
3. This often verifies faster than root domains

### 7. Advanced Debugging

#### Check with dig command:
```bash
# Check all A records
dig theendpoint.xyz A

# Check all AAAA records
dig theendpoint.xyz AAAA

# Check TXT records
dig theendpoint.xyz TXT

# Trace DNS resolution
dig +trace theendpoint.xyz
```

#### Verify with Google's Tools:
```bash
# Use Google's DNS
dig @8.8.8.8 theendpoint.xyz A
```

### 8. What to Expect

Once DNS is properly configured:
1. **Stage 1**: "DNS records configured" (5-30 minutes)
2. **Stage 2**: "Certificate provisioning" (15-60 minutes)
3. **Stage 3**: ✅ "Active" with green checkmark

### 9. If Still Not Working After 2 Hours

1. **Delete and Recreate Mapping**:
   - Remove the domain mapping in Cloud Run
   - Wait 5 minutes
   - Add it again
   - This can resolve stuck provisioning

2. **Check Cloudflare Settings**:
   - Ensure "DNSSEC" is not causing issues
   - Verify no conflicting Page Rules
   - Check that you're not rate limited

3. **Contact Support**:
   - Google Cloud Support (if you have a support plan)
   - Post in Google Cloud forums with your domain

### 10. Quick Checklist

Run through this checklist:
- [ ] All 4 A records added correctly
- [ ] All 4 AAAA records added correctly  
- [ ] TXT verification record added
- [ ] All records set to "DNS only" (gray cloud)
- [ ] At least 30 minutes have passed
- [ ] DNS propagation verified with dnschecker.org
- [ ] No typos in record values
- [ ] Domain not using DNSSEC (or properly configured)
- [ ] No Cloudflare Page Rules interfering

## 🎯 Most Likely Solution

Based on your setup, the records look correct. The most likely scenarios are:

1. **DNS hasn't fully propagated yet** - Wait another 30-60 minutes
2. **Google is still provisioning the SSL certificate** - Can take up to 24 hours
3. **Need to add www CNAME record** - Some setups require this

## 📞 Need More Help?

If the domain still doesn't work after following this guide:
1. Share the exact status message from Cloud Run console
2. Run `dig theendpoint.xyz A` and share the output
3. Check Cloud Run logs for any domain-related errors

Your DNS configuration looks correct, so it's likely just a matter of waiting for propagation and SSL provisioning!