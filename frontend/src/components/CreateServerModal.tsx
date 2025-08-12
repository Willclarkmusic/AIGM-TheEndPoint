import React, { useState } from "react";
import { FiX, FiPlus, FiUsers } from "react-icons/fi";
import { collection, doc, setDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import type { User } from "firebase/auth";

interface CreateServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onServerCreated?: (serverId: string) => void;
}

const CreateServerModal: React.FC<CreateServerModalProps> = ({
  isOpen,
  onClose,
  user,
  onServerCreated,
}) => {
  const [activeTab, setActiveTab] = useState<"create" | "join">("create");
  const [serverName, setServerName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Generate a random 5-digit server code
  const generateServerCode = () => {
    return Math.floor(10000 + Math.random() * 90000).toString();
  };

  // Create a new server
  const handleCreateServer = async () => {
    if (!serverName.trim()) {
      setError("Server name is required");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      let serverCode;
      let codeExists = true;
      
      // Generate a unique server code
      while (codeExists) {
        serverCode = generateServerCode();
        
        // Check if this code already exists
        const existingServerQuery = query(
          collection(db, "servers"),
          where("code", "==", serverCode)
        );
        const existingServers = await getDocs(existingServerQuery);
        codeExists = !existingServers.empty;
      }
      
      // Create the server document
      const serverRef = doc(collection(db, "servers"));
      const serverId = serverRef.id;

      console.log("Creating server with ID:", serverId, "and code:", serverCode);

      await setDoc(serverRef, {
        name: serverName.trim(),
        code: serverCode,
        ownerIds: [user.uid],
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      });

      console.log("Server document created, adding creator as owner member...");

      // Add the creator as the first member with owner role
      const memberRef = doc(collection(serverRef, "members"), user.uid);
      await setDoc(memberRef, {
        userId: user.uid,
        role: "owner",
        joinedAt: serverTimestamp(),
        displayName: user.displayName || user.email?.split('@')[0] || 'User',
        email: user.email || '',
      });

      console.log("Creator added as owner member, creating default General room...");

      // Create the default #General room
      const roomRef = doc(collection(serverRef, "chat_rooms"));
      await setDoc(roomRef, {
        name: "General",
        type: "chat",
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      });

      console.log("Server creation complete!");
      console.log("Server created successfully:", { serverId, serverCode, serverName: serverName.trim() });
      
      onServerCreated?.(serverId);
      onClose();
      setServerName("");
    } catch (error) {
      console.error("Error creating server:", error);
      setError("Failed to create server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Join an existing server
  const handleJoinServer = async () => {
    if (!joinCode.trim() || joinCode.length !== 5) {
      setError("Please enter a valid 5-digit server code");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      console.log("Attempting to join server with code:", joinCode);
      
      // Query for server with the given code
      const serverQuery = query(
        collection(db, "servers"),
        where("code", "==", joinCode)
      );
      
      const serverSnapshot = await getDocs(serverQuery);
      
      if (serverSnapshot.empty) {
        setError("Invalid server code. Please check and try again.");
        return;
      }

      const serverDoc = serverSnapshot.docs[0];
      const serverId = serverDoc.id;
      const serverData = serverDoc.data();
      
      console.log("Found server:", { serverId, serverName: serverData.name });

      // Check if user is already a member
      const existingMemberQuery = query(
        collection(db, "servers", serverId, "members"),
        where("userId", "==", user.uid)
      );
      
      const existingMemberSnapshot = await getDocs(existingMemberQuery);
      
      if (!existingMemberSnapshot.empty) {
        setError("You are already a member of this server.");
        return;
      }

      console.log("Adding user as member...");

      // Add user as a member with 'member' role
      const memberRef = doc(collection(db, "servers", serverId, "members"), user.uid);
      await setDoc(memberRef, {
        userId: user.uid,
        role: "member",
        joinedAt: serverTimestamp(),
        displayName: user.displayName || user.email?.split('@')[0] || 'User',
        email: user.email || '',
      });

      console.log("Successfully joined server:", serverData.name);
      
      onServerCreated?.(serverId); // Reuse this callback to refresh server list
      onClose();
      setJoinCode("");
    } catch (error) {
      console.error("Error joining server:", error);
      setError("Failed to join server. Please check the code and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(55,65,81,1)] max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black uppercase text-black dark:text-white">
            Server Management
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-red-400 dark:bg-red-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
          >
            <FiX size={16} className="text-black dark:text-white" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex mb-6">
          <button
            onClick={() => setActiveTab("create")}
            className={`flex-1 py-3 px-4 font-black text-sm border-2 border-black dark:border-gray-600 transition-all uppercase text-black dark:text-white flex items-center justify-center gap-2 ${
              activeTab === "create"
                ? "bg-green-400 dark:bg-green-500 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)]"
                : "bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600"
            }`}
          >
            <FiPlus size={16} />
            Create Server
          </button>
          <button
            onClick={() => setActiveTab("join")}
            className={`flex-1 py-3 px-4 font-black text-sm border-2 border-black dark:border-gray-600 border-l-0 transition-all uppercase text-black dark:text-white flex items-center justify-center gap-2 ${
              activeTab === "join"
                ? "bg-blue-400 dark:bg-blue-500 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)]"
                : "bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600"
            }`}
          >
            <FiUsers size={16} />
            Join Server
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 border-2 border-red-500 text-red-700 dark:text-red-300 font-bold">
            {error}
          </div>
        )}

        {/* Create Server Tab */}
        {activeTab === "create" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-2 uppercase text-black dark:text-white">
                Server Name
              </label>
              <input
                type="text"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder="Enter server name..."
                className="w-full px-3 py-2 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)]"
                maxLength={50}
                disabled={isLoading}
              />
            </div>
            <button
              onClick={handleCreateServer}
              disabled={isLoading || !serverName.trim()}
              className="w-full bg-green-400 dark:bg-green-500 text-black dark:text-white font-black py-3 border-2 border-black dark:border-gray-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase flex items-center justify-center gap-2"
            >
              {isLoading ? "Creating..." : "Create Server"}
            </button>
          </div>
        )}

        {/* Join Server Tab */}
        {activeTab === "join" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-2 uppercase text-black dark:text-white">
                Server Code
              </label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 5))}
                placeholder="Enter 5-digit code..."
                className="w-full px-3 py-2 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] text-center text-xl font-black tracking-widest"
                maxLength={5}
                disabled={isLoading}
              />
            </div>
            <button
              onClick={handleJoinServer}
              disabled={isLoading || joinCode.length !== 5}
              className="w-full bg-blue-400 dark:bg-blue-500 text-black dark:text-white font-black py-3 border-2 border-black dark:border-gray-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase flex items-center justify-center gap-2"
            >
              {isLoading ? "Joining..." : "Join Server"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateServerModal;