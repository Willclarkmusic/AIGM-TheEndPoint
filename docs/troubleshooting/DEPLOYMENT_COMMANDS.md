# Firebase Security Rules Deployment Commands

## Prerequisites

1. **Node.js Version**: Ensure you have Node.js >=20.0.0 installed
   ```bash
   node --version  # Should be 20.0.0 or higher
   ```

2. **Firebase CLI**: Install or update Firebase CLI
   ```bash
   npm install -g firebase-tools@latest
   ```

3. **Authentication**: Login to Firebase
   ```bash
   firebase login
   ```

4. **Project Selection**: Ensure correct Firebase project is selected
   ```bash
   firebase use --add  # Select your project
   # or
   firebase use [your-project-id]
   ```

## Deployment Commands

### Deploy Security Rules Only (Recommended)
```bash
firebase deploy --only firestore:rules,storage
```

### Deploy Everything (Full Deployment)
```bash
firebase deploy
```

### Validate Rules Before Deployment
```bash
# Validate Firestore rules
firebase firestore:rules:validate firestore.rules

# Validate Storage rules  
firebase storage:rules:validate storage.rules
```

### Using the Automated Script
```bash
# Make sure the script is executable
chmod +x deploy-security-rules.sh

# Run the deployment script
./deploy-security-rules.sh
```

## Testing Rules (Optional)

### Start Firebase Emulator for Testing
```bash
firebase emulators:start --only firestore,storage,auth
```

### Run Security Rules Tests
```bash
# Install test dependencies first
npm install firebase

# Run the test suite
node security-rules-test.js
```

## Post-Deployment Verification

1. **Check Firebase Console**:
   - Firestore Rules: https://console.firebase.google.com/project/[PROJECT-ID]/firestore/rules
   - Storage Rules: https://console.firebase.google.com/project/[PROJECT-ID]/storage/rules

2. **Monitor Rule Evaluation**:
   - Go to Firebase Console > Firestore/Storage > Usage tab
   - Check for any permission-denied errors

3. **Test Application**:
   - Create a test user account
   - Try accessing different features
   - Verify proper access control

## Troubleshooting

### Common Issues and Solutions

1. **"Firebase CLI is incompatible with Node.js"**
   ```bash
   # Update Node.js to version >=20.0.0
   nvm install 20  # If using nvm
   nvm use 20
   ```

2. **"No Firebase project configured"**
   ```bash
   firebase init  # Initialize project
   # or
   firebase use --add  # Add existing project
   ```

3. **Rules Validation Errors**
   - Check syntax in firestore.rules and storage.rules
   - Ensure all functions are properly defined
   - Verify collection paths match your data model

4. **Permission Denied in Application**
   - Check user authentication status
   - Verify user has required roles/permissions
   - Review rule logic for the specific operation

## Security Rules Summary

### Firestore Rules Protect:
- ✅ User profile data (users collection)
- ✅ Server access and management (servers collection)  
- ✅ Server member roles and permissions (members subcollection)
- ✅ Chat room access (chat_rooms subcollection)
- ✅ Message creation and deletion (messages subcollection)
- ✅ Private message privacy (private_messages collection)
- ✅ AI agent creation and management (ai_agents collection)
- ✅ Social feed post management (social_feed collection)
- ✅ Friend request privacy (friend_requests collection)

### Storage Rules Protect:
- ✅ User profile pictures (public read, user write)
- ✅ User private uploads (user access only)
- ✅ Server file uploads (member access only)
- ✅ Social feed images (public read, author write)
- ✅ AI generated content (public read, system write)
- ✅ Chat attachments (server member access)
- ✅ Private message attachments (participant access)
- ✅ File size limits (2MB maximum)
- ✅ File type restrictions (images only for user uploads)

## Monitoring and Maintenance

### Regular Security Checks
1. Review Firebase Console for unusual access patterns
2. Monitor rule evaluation performance
3. Check for permission-denied errors in logs
4. Update rules as application features evolve

### Security Best Practices Maintained
- ✅ Authentication required for all operations
- ✅ Role-based access control implemented
- ✅ Input validation and data sanitization
- ✅ Principle of least privilege enforced
- ✅ Audit trails for system operations
- ✅ File upload security restrictions
- ✅ Cross-collection reference validation