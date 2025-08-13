# Firebase Security Rules Guide

This document explains the comprehensive security rules implemented for the AIGM-TheEndPoint messaging platform.

## Firestore Security Rules Overview

### Key Security Principles

1. **Authentication Required**: All operations require user authentication
2. **Role-Based Access Control**: Server members have different permissions based on roles
3. **Data Ownership**: Users can only modify their own data
4. **Input Validation**: All data inputs are validated for security
5. **Principle of Least Privilege**: Users only get minimum required permissions

### Collection-Level Security

#### Users Collection (`/users/{userId}`)
- **Read/Write**: Only the user themselves (`request.auth.uid == userId`)
- **Validation**: User data must include required fields and match auth token
- **Purpose**: Prevents users from accessing or modifying other users' profiles

#### Servers Collection (`/servers/{serverId}`)
- **Read**: Only server members
- **Create**: Only if user is listed as owner in the document
- **Update/Delete**: Only server owners
- **Security**: Prevents unauthorized server access and modifications

#### Server Members Subcollection (`/servers/{serverId}/members/{memberId}`)
- **Read**: All server members
- **Create**: Admins/owners or self-joining as 'member'
- **Update/Delete**: Admins/owners or users leaving themselves
- **Security**: Prevents privilege escalation and unauthorized member management

#### Chat Rooms Subcollection (`/servers/{serverId}/chat_rooms/{roomId}`)
- **Read**: All server members
- **Create/Update/Delete**: Only admins and owners
- **Security**: Prevents unauthorized room creation and management

#### Messages Subcollection (`/messages/{messageId}`)
- **Read**: Server members only
- **Create**: Server members with validated message data
- **Update**: Disabled for security (prevents message tampering)
- **Delete**: Message author or server admins/owners
- **Validation**: Message must have required fields and sender must match auth user

#### Private Messages Collection (`/private_messages/{pmId}`)
- **Read/Write**: Only participants in the conversation
- **Create**: Authenticated users with max 20 participants
- **Security**: Ensures privacy of direct messages

#### AI Agents Collection (`/ai_agents/{agentId}`)
- **Read**: All authenticated users (agents are public)
- **Create/Update/Delete**: Only the agent creator
- **Security**: Prevents unauthorized agent modifications

#### Social Feed Collection (`/social_feed/{postId}`)
- **Read**: All authenticated users (public feed)
- **Create/Update/Delete**: Only post authors
- **Security**: Prevents unauthorized post modifications

#### Friend Requests Collection (`/friend_requests/{requestId}`)
- **Read/Write**: Only sender or receiver
- **Security**: Ensures privacy of friend requests

## Cloud Storage Security Rules Overview

### File Upload Security

1. **Size Limits**: 2MB maximum for all user uploads
2. **File Type Validation**: Only image files allowed for user uploads
3. **Path-Based Security**: Users can only access their own folders
4. **Public Content**: Some content (profiles, social feed) is publicly readable

### Storage Structure Security

#### User Profile Pictures (`/users/{userId}/profile/{fileName}`)
- **Read**: Public (profiles are discoverable)
- **Write**: Only the user themselves, with image validation
- **Delete**: Only the user themselves

#### User Private Uploads (`/users/{userId}/uploads/{fileName}`)
- **Read/Write**: Only the user themselves
- **Validation**: Images only, 2MB limit
- **Security**: Complete privacy for user files

#### Server Uploads (`/servers/{serverId}/uploads/{fileName}`)
- **Read**: Only server members
- **Write**: Server members with image validation
- **Security**: Server-scoped file access

#### AI Generated Content (`/ai_generated/{contentType}/{fileName}`)
- **Read**: Public (generated content is shareable)
- **Write**: Only Cloud Functions (prevents tampering)
- **Security**: Ensures AI content integrity

#### Chat Attachments (`/chat_attachments/{serverId}/{roomId}/{messageId}/{fileName}`)
- **Read**: Server members only
- **Write**: Server members with validation
- **Delete**: Message sender or server admins
- **Security**: Message-level attachment security

## Testing Security Rules

### Manual Testing Scenarios

1. **Unauthorized Access Test**:
   - Try accessing other users' data while authenticated as different user
   - Expected: Access denied

2. **Role Permission Test**:
   - Create server as regular user
   - Try to delete server as non-owner
   - Expected: Permission denied

3. **File Upload Test**:
   - Try uploading >2MB file
   - Try uploading non-image file
   - Try uploading to other user's folder
   - Expected: All should be denied

4. **Message Security Test**:
   - Try sending message with wrong senderId
   - Try editing existing message
   - Try deleting other user's message (as non-admin)
   - Expected: All should be denied

### Automated Testing

Run Firebase emulator with rules testing:

```bash
# Start emulator with security rules
firebase emulators:start --only firestore,storage

# Run security tests (if configured)
firebase emulators:exec --only firestore,storage "npm test"
```

## Security Best Practices Implemented

1. **Input Validation**: All user inputs are validated for type, size, and content
2. **Authentication Checks**: Every rule starts with authentication verification
3. **Data Integrity**: Cross-references between collections are validated
4. **Audit Trail**: System paths reserved for audit logging
5. **Fail-Safe Defaults**: Default deny rules for unmatched paths
6. **Role Segregation**: Clear separation between user roles and permissions
7. **File Security**: Comprehensive file type and size validation
8. **Privacy Protection**: Private messages and user data properly isolated

## Deployment Commands

Deploy only security rules:
```bash
firebase deploy --only firestore:rules,storage
```

Deploy everything:
```bash
firebase deploy
```

## Monitoring and Maintenance

1. **Regular Audits**: Review Firebase console for security rule violations
2. **Performance Monitoring**: Check for slow rule evaluations
3. **Access Logs**: Monitor unusual access patterns
4. **Rule Updates**: Keep rules updated as application evolves

## Troubleshooting Common Issues

1. **Permission Denied Errors**: Check if user is properly authenticated and has required roles
2. **File Upload Failures**: Verify file size and type restrictions
3. **Cross-Collection Issues**: Ensure referenced documents exist before creating relationships
4. **Performance Issues**: Consider caching frequently accessed data in client applications

## Security Rule Limitations

1. **Complex Queries**: Some complex permission logic may require client-side filtering
2. **Batch Operations**: Rules are evaluated per-document, not per-batch
3. **External Validations**: Rules cannot validate against external APIs
4. **Real-time Constraints**: Rule evaluation must complete within timeout limits

This security implementation provides enterprise-grade protection while maintaining the flexibility needed for the messaging platform's features.