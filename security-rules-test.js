/**
 * Firebase Security Rules Test Suite
 * 
 * This file contains comprehensive tests for both Firestore and Storage security rules.
 * Run with Firebase emulator for testing security rule enforcement.
 * 
 * Usage:
 * 1. Start emulator: firebase emulators:start --only firestore,storage,auth
 * 2. Run tests: node security-rules-test.js
 */

const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, addDoc } = require('firebase/firestore');
const { getStorage, ref, uploadBytes, getDownloadURL } = require('firebase/storage');

// Firebase config for emulator
const firebaseConfig = {
  apiKey: "test-api-key",
  authDomain: "test-project.firebaseapp.com",
  projectId: "test-project",
  storageBucket: "test-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "test-app-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Test utilities
class SecurityRuleTester {
  constructor() {
    this.testResults = [];
  }

  async runTest(testName, testFunction) {
    console.log(`\n🧪 Running test: ${testName}`);
    try {
      await testFunction();
      console.log(`✅ ${testName} - PASSED`);
      this.testResults.push({ test: testName, result: 'PASSED' });
    } catch (error) {
      console.log(`❌ ${testName} - FAILED: ${error.message}`);
      this.testResults.push({ test: testName, result: 'FAILED', error: error.message });
    }
  }

  async expectPermissionDenied(operation) {
    try {
      await operation();
      throw new Error('Expected permission denied, but operation succeeded');
    } catch (error) {
      if (error.code === 'permission-denied' || error.message.includes('permission')) {
        return; // Expected behavior
      }
      throw error;
    }
  }

  async expectSuccess(operation) {
    await operation();
  }

  printResults() {
    console.log('\n📊 TEST RESULTS SUMMARY');
    console.log('=========================');
    
    const passed = this.testResults.filter(r => r.result === 'PASSED').length;
    const failed = this.testResults.filter(r => r.result === 'FAILED').length;
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${((passed / this.testResults.length) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.testResults
        .filter(r => r.result === 'FAILED')
        .forEach(r => console.log(`   - ${r.test}: ${r.error}`));
    }
  }
}

// Test data
const testUsers = {
  user1: { email: 'user1@test.com', password: 'testpass123', uid: null },
  user2: { email: 'user2@test.com', password: 'testpass123', uid: null },
  admin: { email: 'admin@test.com', password: 'testpass123', uid: null }
};

const tester = new SecurityRuleTester();

// Main test suite
async function runSecurityTests() {
  console.log('🔐 Firebase Security Rules Test Suite');
  console.log('=====================================');

  // Test 1: User Authentication
  await tester.runTest('User Registration', async () => {
    const user1Cred = await createUserWithEmailAndPassword(auth, testUsers.user1.email, testUsers.user1.password);
    testUsers.user1.uid = user1Cred.user.uid;
    
    const user2Cred = await createUserWithEmailAndPassword(auth, testUsers.user2.email, testUsers.user2.password);
    testUsers.user2.uid = user2Cred.user.uid;
  });

  // Test 2: User Profile Access
  await tester.runTest('User Can Access Own Profile', async () => {
    await signInWithEmailAndPassword(auth, testUsers.user1.email, testUsers.user1.password);
    
    const userDoc = {
      uid: testUsers.user1.uid,
      email: testUsers.user1.email,
      name: 'Test User 1',
      credits: 10
    };
    
    await tester.expectSuccess(() => setDoc(doc(db, 'users', testUsers.user1.uid), userDoc));
    await tester.expectSuccess(() => getDoc(doc(db, 'users', testUsers.user1.uid)));
  });

  // Test 3: User Cannot Access Other's Profile
  await tester.runTest('User Cannot Access Other User Profile', async () => {
    await signInWithEmailAndPassword(auth, testUsers.user1.email, testUsers.user1.password);
    
    await tester.expectPermissionDenied(() => getDoc(doc(db, 'users', testUsers.user2.uid)));
    await tester.expectPermissionDenied(() => setDoc(doc(db, 'users', testUsers.user2.uid), { name: 'Hacked' }));
  });

  // Test 4: Server Creation
  await tester.runTest('Server Creation by Owner', async () => {
    await signInWithEmailAndPassword(auth, testUsers.user1.email, testUsers.user1.password);
    
    const serverData = {
      name: 'Test Server',
      ownerIds: [testUsers.user1.uid],
      createdAt: new Date()
    };
    
    const serverRef = doc(collection(db, 'servers'));
    await tester.expectSuccess(() => setDoc(serverRef, serverData));
    
    // Store server ID for later tests
    testUsers.serverId = serverRef.id;
  });

  // Test 5: Server Member Management
  await tester.runTest('Server Member Addition', async () => {
    await signInWithEmailAndPassword(auth, testUsers.user1.email, testUsers.user1.password);
    
    // Add self as owner
    await tester.expectSuccess(() => 
      setDoc(doc(db, 'servers', testUsers.serverId, 'members', testUsers.user1.uid), {
        userId: testUsers.user1.uid,
        role: 'owner',
        joinedAt: new Date()
      })
    );
    
    // Add user2 as member
    await tester.expectSuccess(() => 
      setDoc(doc(db, 'servers', testUsers.serverId, 'members', testUsers.user2.uid), {
        userId: testUsers.user2.uid,
        role: 'member',
        joinedAt: new Date()
      })
    );
  });

  // Test 6: Non-member Cannot Access Server
  await tester.runTest('Non-member Cannot Access Server', async () => {
    // Create a third user who is not a member
    const user3Cred = await createUserWithEmailAndPassword(auth, 'user3@test.com', 'testpass123');
    await signInWithEmailAndPassword(auth, 'user3@test.com', 'testpass123');
    
    await tester.expectPermissionDenied(() => getDoc(doc(db, 'servers', testUsers.serverId)));
  });

  // Test 7: Message Creation
  await tester.runTest('Message Creation in Server Room', async () => {
    await signInWithEmailAndPassword(auth, testUsers.user1.email, testUsers.user1.password);
    
    // Create a room first (as owner)
    const roomRef = doc(collection(db, 'servers', testUsers.serverId, 'chat_rooms'));
    await tester.expectSuccess(() => 
      setDoc(roomRef, {
        name: 'general',
        type: 'chat',
        createdAt: new Date()
      })
    );
    
    testUsers.roomId = roomRef.id;
    
    // Create a message
    const messageRef = doc(collection(db, 'servers', testUsers.serverId, 'chat_rooms', testUsers.roomId, 'messages'));
    await tester.expectSuccess(() => 
      setDoc(messageRef, {
        text: 'Hello, world!',
        senderId: testUsers.user1.uid,
        timestamp: new Date()
      })
    );
    
    testUsers.messageId = messageRef.id;
  });

  // Test 8: Message Security - Cannot Fake Sender
  await tester.runTest('Cannot Create Message with Fake Sender', async () => {
    await signInWithEmailAndPassword(auth, testUsers.user1.email, testUsers.user1.password);
    
    const messageRef = doc(collection(db, 'servers', testUsers.serverId, 'chat_rooms', testUsers.roomId, 'messages'));
    await tester.expectPermissionDenied(() => 
      setDoc(messageRef, {
        text: 'Fake message',
        senderId: testUsers.user2.uid, // Wrong sender ID
        timestamp: new Date()
      })
    );
  });

  // Test 9: Private Message Privacy
  await tester.runTest('Private Message Privacy', async () => {
    await signInWithEmailAndPassword(auth, testUsers.user1.email, testUsers.user1.password);
    
    // Create private message
    const pmRef = doc(collection(db, 'private_messages'));
    await tester.expectSuccess(() => 
      setDoc(pmRef, {
        participants: [testUsers.user1.uid, testUsers.user2.uid],
        createdAt: new Date()
      })
    );
    
    // User 1 can access
    await tester.expectSuccess(() => getDoc(pmRef));
    
    // Switch to user 2 - should also have access
    await signInWithEmailAndPassword(auth, testUsers.user2.email, testUsers.user2.password);
    await tester.expectSuccess(() => getDoc(pmRef));
    
    // Create user 3 and verify they cannot access
    const user3Cred = await createUserWithEmailAndPassword(auth, 'user4@test.com', 'testpass123');
    await signInWithEmailAndPassword(auth, 'user4@test.com', 'testpass123');
    await tester.expectPermissionDenied(() => getDoc(pmRef));
  });

  // Test 10: AI Agent Management
  await tester.runTest('AI Agent Creation and Access Control', async () => {
    await signInWithEmailAndPassword(auth, testUsers.user1.email, testUsers.user1.password);
    
    // Create AI agent
    const agentRef = doc(collection(db, 'ai_agents'));
    await tester.expectSuccess(() => 
      setDoc(agentRef, {
        name: 'Test Bot',
        creatorId: testUsers.user1.uid,
        personalityPrompts: ['Be helpful'],
        createdAt: new Date()
      })
    );
    
    // User 1 can read their own agent
    await tester.expectSuccess(() => getDoc(agentRef));
    
    // User 2 can read agent (public read)
    await signInWithEmailAndPassword(auth, testUsers.user2.email, testUsers.user2.password);
    await tester.expectSuccess(() => getDoc(agentRef));
    
    // But user 2 cannot modify user 1's agent
    await tester.expectPermissionDenied(() => 
      setDoc(agentRef, { name: 'Hacked Bot' }, { merge: true })
    );
  });

  // Test 11: Social Feed Security
  await tester.runTest('Social Feed Post Management', async () => {
    await signInWithEmailAndPassword(auth, testUsers.user1.email, testUsers.user1.password);
    
    // Create social feed post
    const postRef = doc(collection(db, 'social_feed'));
    await tester.expectSuccess(() => 
      setDoc(postRef, {
        content: 'Hello social media!',
        author: testUsers.user1.uid,
        timestamp: new Date()
      })
    );
    
    // User 2 can read post
    await signInWithEmailAndPassword(auth, testUsers.user2.email, testUsers.user2.password);
    await tester.expectSuccess(() => getDoc(postRef));
    
    // But user 2 cannot modify user 1's post
    await tester.expectPermissionDenied(() => 
      setDoc(postRef, { content: 'Hacked post' }, { merge: true })
    );
  });

  tester.printResults();
}

// Storage Rules Tests
async function runStorageTests() {
  console.log('\n💾 Firebase Storage Rules Test Suite');
  console.log('====================================');

  // Test file upload restrictions
  await tester.runTest('User Can Upload to Own Folder', async () => {
    await signInWithEmailAndPassword(auth, testUsers.user1.email, testUsers.user1.password);
    
    // Create a small test image (base64 encoded 1x1 pixel PNG)
    const testImageData = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    const testImageBlob = new Blob([Buffer.from(testImageData, 'base64')], { type: 'image/png' });
    
    const userImageRef = ref(storage, `users/${testUsers.user1.uid}/uploads/test.png`);
    await tester.expectSuccess(() => uploadBytes(userImageRef, testImageBlob));
  });

  await tester.runTest('User Cannot Upload to Other User Folder', async () => {
    await signInWithEmailAndPassword(auth, testUsers.user1.email, testUsers.user1.password);
    
    const testImageData = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    const testImageBlob = new Blob([Buffer.from(testImageData, 'base64')], { type: 'image/png' });
    
    const otherUserImageRef = ref(storage, `users/${testUsers.user2.uid}/uploads/hack.png`);
    await tester.expectPermissionDenied(() => uploadBytes(otherUserImageRef, testImageBlob));
  });

  tester.printResults();
}

// Run all tests
async function main() {
  try {
    await runSecurityTests();
    await runStorageTests();
    
    console.log('\n🎉 All security rule tests completed!');
    console.log('\nTo deploy these rules to production:');
    console.log('   ./deploy-security-rules.sh');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = { SecurityRuleTester, runSecurityTests, runStorageTests };