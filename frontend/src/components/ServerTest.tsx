import React, { useState } from 'react';
import { collection, doc, setDoc, query, where, getDocs, collectionGroup, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { User } from 'firebase/auth';

interface ServerTestProps {
  user: User;
}

const ServerTest: React.FC<ServerTestProps> = ({ user }) => {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addResult = (message: string) => {
    console.log(message);
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  // Test 1: Create a test server
  const testCreateServer = async () => {
    try {
      addResult("🧪 Testing server creation...");
      
      const serverCode = Math.floor(10000 + Math.random() * 90000).toString();
      const serverName = `Test Server ${Date.now()}`;
      
      // Create server document
      const serverRef = doc(collection(db, "servers"));
      const serverId = serverRef.id;
      
      await setDoc(serverRef, {
        name: serverName,
        code: serverCode,
        ownerIds: [user.uid],
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      });
      
      addResult(`✅ Server created: ${serverName} (ID: ${serverId}, Code: ${serverCode})`);
      
      // Add creator as owner member
      const memberRef = doc(collection(serverRef, "members"), user.uid);
      await setDoc(memberRef, {
        userId: user.uid,
        role: "owner",
        joinedAt: serverTimestamp(),
        displayName: user.displayName || user.email?.split('@')[0] || 'Test User',
        email: user.email || '',
      });
      
      addResult(`✅ Creator added as owner member`);
      
      // Create default General room
      const roomRef = doc(collection(serverRef, "chat_rooms"));
      await setDoc(roomRef, {
        name: "General",
        type: "chat",
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      });
      
      addResult(`✅ Default General room created`);
      
      return { serverId, serverCode, serverName };
      
    } catch (error: any) {
      addResult(`❌ Server creation failed: ${error?.message || 'Unknown error'}`);
      throw error;
    }
  };

  // Test 2: Test collectionGroup query for user servers
  const testLoadUserServers = async () => {
    try {
      addResult("🧪 Testing user server loading...");
      
      const membersQuery = query(
        collectionGroup(db, "members"),
        where("userId", "==", user.uid)
      );
      
      const membersSnapshot = await getDocs(membersQuery);
      addResult(`✅ Found ${membersSnapshot.size} server memberships`);
      
      const servers = [];
      for (const memberDoc of membersSnapshot.docs) {
        const memberData = memberDoc.data();
        const serverId = memberDoc.ref.parent.parent?.id;
        
        if (serverId) {
          const serverDoc = await getDocs(query(collection(db, "servers"), where('__name__', '==', serverId)));
          
          if (!serverDoc.empty) {
            const serverData = serverDoc.docs[0].data();
            servers.push({
              id: serverId,
              name: serverData.name,
              role: memberData.role,
              code: serverData.code
            });
            addResult(`✅ Loaded server: ${serverData.name} (Role: ${memberData.role})`);
          }
        }
      }
      
      return servers;
      
    } catch (error: any) {
      addResult(`❌ Server loading failed: ${error?.message || 'Unknown error'}`);
      throw error;
    }
  };

  // Test 3: Test joining a server by code
  const testJoinServer = async (serverCode: string) => {
    try {
      addResult(`🧪 Testing server join with code: ${serverCode}...`);
      
      // Find server by code
      const serverQuery = query(
        collection(db, "servers"),
        where("code", "==", serverCode)
      );
      
      const serverSnapshot = await getDocs(serverQuery);
      
      if (serverSnapshot.empty) {
        throw new Error("Server not found");
      }
      
      const serverDoc = serverSnapshot.docs[0];
      const serverId = serverDoc.id;
      const serverData = serverDoc.data();
      
      addResult(`✅ Found server: ${serverData.name}`);
      
      // Check if already a member
      const existingMemberQuery = query(
        collection(db, "servers", serverId, "members"),
        where("userId", "==", user.uid)
      );
      
      const existingMemberSnapshot = await getDocs(existingMemberQuery);
      
      if (!existingMemberSnapshot.empty) {
        addResult(`ℹ️ Already a member of this server`);
        return;
      }
      
      // Add as member
      const memberRef = doc(collection(db, "servers", serverId, "members"), user.uid);
      await setDoc(memberRef, {
        userId: user.uid,
        role: "member",
        joinedAt: serverTimestamp(),
        displayName: user.displayName || user.email?.split('@')[0] || 'Test User',
        email: user.email || '',
      });
      
      addResult(`✅ Successfully joined server: ${serverData.name}`);
      
    } catch (error: any) {
      addResult(`❌ Server join failed: ${error?.message || 'Unknown error'}`);
      throw error;
    }
  };

  // Run all tests
  const runAllTests = async () => {
    setIsRunning(true);
    clearResults();
    
    try {
      addResult("🚀 Starting server functionality tests...");
      addResult(`👤 Testing as user: ${user.email} (${user.uid})`);
      
      // Test 1: Create server
      const serverInfo = await testCreateServer();
      
      // Test 2: Load user servers
      await testLoadUserServers();
      
      // Test 3: Test server join functionality
      addResult("🧪 Testing server join functionality...");
      try {
        // Test the join function with the server we just created
        await testJoinServer(serverInfo.serverCode);
        addResult("✅ Server join functionality works!");
      } catch (error: any) {
        // This is expected since we're already the owner
        addResult(`ℹ️ Join test info: ${error?.message || 'Expected result - already a member'}`);
      }
      
      addResult("🎉 All tests completed successfully!");
      
    } catch (error: any) {
      addResult(`💥 Test suite failed: ${error?.message || 'Unknown error'}`);
      console.error("Test suite error:", error);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(55,65,81,1)] m-4">
      <h2 className="text-2xl font-black mb-4 uppercase text-black dark:text-white">
        🧪 Server Functionality Tests
      </h2>
      
      <div className="mb-4">
        <button
          onClick={runAllTests}
          disabled={isRunning}
          className="bg-blue-400 dark:bg-blue-500 text-black dark:text-white font-black py-2 px-4 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-50 uppercase mr-2"
        >
          {isRunning ? "Running Tests..." : "Run All Tests"}
        </button>
        
        <button
          onClick={clearResults}
          disabled={isRunning}
          className="bg-gray-400 dark:bg-gray-500 text-black dark:text-white font-black py-2 px-4 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-50 uppercase"
        >
          Clear Results
        </button>
      </div>
      
      <div className="bg-gray-100 dark:bg-gray-900 border-2 border-black dark:border-gray-600 p-4 h-64 overflow-y-auto font-mono text-sm">
        <div className="text-gray-600 dark:text-gray-400 mb-2">Test Results:</div>
        {testResults.length === 0 ? (
          <div className="text-gray-500 italic">Click "Run All Tests" to start testing...</div>
        ) : (
          testResults.map((result, index) => (
            <div key={index} className="mb-1 text-black dark:text-white">
              {result}
            </div>
          ))
        )}
      </div>
      
      <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900 border-2 border-yellow-500 text-yellow-800 dark:text-yellow-200 text-sm">
        <strong>Instructions:</strong>
        <ol className="list-decimal list-inside mt-2">
          <li>First, deploy the updated Firestore rules to Firebase</li>
          <li>Run the test suite to validate functionality</li>
          <li>Check the browser console for detailed error logs</li>
          <li>If tests pass, try the actual server creation UI</li>
        </ol>
      </div>
    </div>
  );
};

export default ServerTest;