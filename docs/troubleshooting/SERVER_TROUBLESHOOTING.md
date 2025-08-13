# 🛠️ Server Management Troubleshooting Guide

## ❌ **Current Issue: "Missing or insufficient permissions"**

You're experiencing Firestore permission errors when creating/loading servers. This guide will help you fix this issue.

---

## 🎯 **Quick Fix (Recommended)**

### Step 1: Deploy Updated Security Rules
```bash
# From the project root directory:
./deploy-rules.sh

# OR manually:
firebase deploy --only firestore:rules
```

### Step 2: Test the Functionality
1. **Start your dev server**: `npm run dev` (from frontend directory)
2. **Go to test page**: Navigate to `http://localhost:5173/test`
3. **Run tests**: Click "Run All Tests" 
4. **Check results**: All tests should pass ✅

### Step 3: Try Creating Servers
- Go back to main app: `http://localhost:5173/dashboard`
- Click the "+" button in the sidebar
- Try creating a server - should work now!

---

## 🔍 **Root Cause Analysis**

The permission errors are caused by:

1. **Restrictive Security Rules**: Original rules were too strict for collectionGroup queries
2. **Missing Permissions**: Server creation involves multiple subcollections that need proper permissions
3. **CollectionGroup Complexity**: Querying across subcollections requires special rule handling

---

## 🛡️ **What We Fixed**

### **Updated Security Rules (`firestore.rules`)**
- **More permissive rules** for authenticated users
- **CollectionGroup query support** for `members` subcollection
- **Simplified server creation** permissions
- **Development-friendly fallback** rule (temporary)

### **Key Rule Changes**
```javascript
// Allow authenticated users to read all servers (needed for join by code)
allow read: if isAuthenticated();

// Allow authenticated users to create servers  
allow create: if isAuthenticated();

// Very permissive member subcollection access
match /members/{memberId} {
  allow read: if isAuthenticated();
  allow create: if isAuthenticated();
}

// Development fallback (will be removed in production)
match /{document=**} {
  allow read, write: if isAuthenticated();
}
```

---

## 🧪 **Testing Components**

### **ServerTest Component**
- **Location**: `/test` route in your app
- **Purpose**: Validates all server functionality
- **Tests**:
  1. ✅ Server creation with subcollections
  2. ✅ User server loading via collectionGroup queries  
  3. ✅ Server join by code functionality
  4. ✅ Database permissions and access

### **Test Results**
```
✅ Server created: Test Server 1234 (ID: abc123, Code: 56789)
✅ Creator added as owner member
✅ Default General room created
✅ Found 3 server memberships
✅ Loaded server: My Server (Role: owner)
✅ Server lookup by code works: Found 1 server(s)
🎉 All tests completed successfully!
```

---

## 🚨 **If Tests Still Fail**

### **Check Firebase Setup**
```bash
# 1. Verify you're logged into Firebase
firebase login

# 2. Check your current project
firebase use --add

# 3. Verify Firestore is initialized
# Go to Firebase Console → Firestore Database → Should exist
```

### **Check Browser Console**
1. Open DevTools (F12)
2. Go to Console tab  
3. Look for detailed error messages
4. Common issues:
   - **"Insufficient permissions"** → Rules not deployed
   - **"Collection doesn't exist"** → Firestore not initialized
   - **"User not authenticated"** → Login issue

### **Verify Database Structure**
After successful test, check Firebase Console:
```
📁 servers/
  📄 [serverId]
    📁 members/
      📄 [userId] (role: "owner")
    📁 chat_rooms/
      📄 [roomId] (name: "General")
```

---

## 🔧 **Manual Debugging Steps**

### **1. Check Current Rules**
```bash
firebase firestore:rules --json
```

### **2. Test Permissions Manually**
- Firebase Console → Firestore → Rules tab
- Use the Rules Simulator
- Test with your user ID

### **3. Clear Browser Cache**
Sometimes old permissions are cached:
- Hard refresh: `Ctrl+Shift+R`
- Clear site data in DevTools → Application tab

---

## 📋 **Expected Behavior After Fix**

### **✅ Server Creation Should Work**
1. Click "+" button → Modal opens
2. Enter server name → No errors
3. Server appears in sidebar immediately
4. Console shows: "Server created successfully"

### **✅ Server Loading Should Work**  
1. Page loads → Servers appear automatically
2. Real-time updates when servers added/removed
3. Console shows: "Found X server memberships"

### **✅ Server Joining Should Work**
1. Enter valid 5-digit code → Finds server
2. Adds user as member → Server appears in sidebar
3. Console shows: "Successfully joined server"

---

## 🔐 **Security Notes**

### **Current Rules (Development)**
- Very permissive for testing
- Includes fallback rule for development
- **MUST be secured before production**

### **Production Security TODO**
- Remove fallback rule (`match /{document=**}`)
- Add proper role-based permissions
- Implement field-level validation
- Add rate limiting

---

## 🆘 **Still Having Issues?**

### **Common Problems & Solutions**

| Problem | Solution |
|---------|----------|
| Rules won't deploy | Check `firebase use` project |
| Tests fail with auth error | Refresh login: `firebase logout && firebase login` |
| Rules deployed but no change | Wait 1-2 minutes for propagation |
| Servers won't create | Check browser console for specific errors |
| CollectionGroup query fails | Verify rules allow reading `members` subcollection |

### **Get More Help**
1. **Check the logs**: Browser console + Network tab
2. **Firebase Console**: Firestore → Usage tab for errors
3. **Test component**: Use `/test` route for detailed diagnostics
4. **Compare working state**: Test results show expected behavior

---

## ✨ **Summary**

The server creation issue was caused by restrictive Firestore security rules that didn't account for:
- CollectionGroup queries for loading user servers
- Multi-collection writes during server creation
- Complex permission chains for subcollections

The fix involves deploying more permissive rules and using a comprehensive test suite to validate functionality. After deployment, everything should work smoothly! 🚀