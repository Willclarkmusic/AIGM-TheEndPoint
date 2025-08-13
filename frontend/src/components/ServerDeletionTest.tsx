import React, { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db, functions } from "../firebase/config";
import type { User } from "firebase/auth";

interface ServerDeletionTestProps {
  user: User;
}

const ServerDeletionTest: React.FC<ServerDeletionTestProps> = ({ user }) => {
  const [serverId, setServerId] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [results, setResults] = useState<any>(null);

  // Test server deletion
  const testServerDeletion = async () => {
    if (!serverId) {
      alert("Please enter a server ID");
      return;
    }

    setIsDeleting(true);
    setResults(null);

    try {
      console.log(`Testing deletion of server: ${serverId}`);
      
      // Call the Cloud Function
      const deleteServerFunction = httpsCallable(functions, 'deleteServer');
      const result = await deleteServerFunction({ serverId });
      
      console.log('Deletion result:', result.data);
      setResults(result.data);
      
    } catch (error: any) {
      console.error("Error testing server deletion:", error);
      setResults({ error: error.message });
    } finally {
      setIsDeleting(false);
    }
  };

  // Check if server and subcollections still exist
  const checkServerExists = async () => {
    if (!serverId) {
      alert("Please enter a server ID");
      return;
    }

    setIsChecking(true);
    
    try {
      console.log(`Checking if server ${serverId} still exists...`);
      
      // Check server document
      const serverDoc = await getDoc(doc(db, "servers", serverId));
      const serverExists = serverDoc.exists();
      
      // Check members subcollection
      const membersSnapshot = await getDocs(collection(db, `servers/${serverId}/members`));
      const membersCount = membersSnapshot.size;
      
      // Check rooms subcollection
      const roomsSnapshot = await getDocs(collection(db, `servers/${serverId}/chat_rooms`));
      const roomsCount = roomsSnapshot.size;
      
      const checkResult = {
        serverExists,
        serverData: serverExists ? serverDoc.data() : null,
        membersCount,
        roomsCount,
        timestamp: new Date().toISOString()
      };
      
      console.log('Check result:', checkResult);
      setResults(checkResult);
      
    } catch (error: any) {
      console.error("Error checking server:", error);
      setResults({ error: error.message });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="p-6 bg-gray-100 dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(55,65,81,1)] m-4">
      <h2 className="text-xl font-black uppercase mb-4 text-black dark:text-white">
        Server Deletion Test
      </h2>
      
      <div className="space-y-4">
        <div>
          <label className="block font-bold mb-2 text-black dark:text-white">
            Server ID to Test:
          </label>
          <input
            type="text"
            value={serverId}
            onChange={(e) => setServerId(e.target.value)}
            placeholder="Enter server ID..."
            className="w-full px-3 py-2 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white"
          />
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={testServerDeletion}
            disabled={isDeleting || !serverId}
            className="px-4 py-2 bg-red-500 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? "Deleting..." : "Delete Server"}
          </button>
          
          <button
            onClick={checkServerExists}
            disabled={isChecking || !serverId}
            className="px-4 py-2 bg-blue-500 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isChecking ? "Checking..." : "Check Status"}
          </button>
        </div>
        
        {results && (
          <div className="mt-4 p-4 bg-white dark:bg-gray-700 border-2 border-black dark:border-gray-600">
            <h3 className="font-bold mb-2 text-black dark:text-white">Results:</h3>
            <pre className="text-xs text-black dark:text-white overflow-x-auto">
              {JSON.stringify(results, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServerDeletionTest;