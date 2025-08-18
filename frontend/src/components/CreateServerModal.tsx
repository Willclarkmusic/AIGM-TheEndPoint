import React, { useState, useEffect } from "react";
import { FiX, FiPlus, FiUsers, FiMail } from "react-icons/fi";
import { collection, doc, setDoc, serverTimestamp, query, where, getDocs, limit, onSnapshot, deleteDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import type { User } from "firebase/auth";

interface CreateServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onServerCreated?: (serverId: string) => void;
}

interface ServerInvite {
  id: string;
  senderId: string;
  senderName: string;
  senderEmail: string;
  recipientId: string;
  serverId: string;
  serverName: string;
  createdAt: any;
  status: "pending";
}

const CreateServerModal: React.FC<CreateServerModalProps> = ({
  isOpen,
  onClose,
  user,
  onServerCreated,
}) => {
  const [activeTab, setActiveTab] = useState<"create" | "join" | "invites">("create");
  const [serverName, setServerName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [serverInvites, setServerInvites] = useState<ServerInvite[]>([]);

  // Load server invites
  useEffect(() => {
    if (!user?.uid || !isOpen) {
      setServerInvites([]);
      return;
    }

    const invitesRef = collection(db, "server_invites");
    const invitesQuery = query(
      invitesRef,
      where("recipientId", "==", user.uid),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(invitesQuery, (snapshot) => {
      const invitesList: ServerInvite[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        invitesList.push({
          id: doc.id,
          senderId: data.senderId,
          senderName: data.senderName || "Unknown User",
          senderEmail: data.senderEmail || "",
          recipientId: data.recipientId,
          serverId: data.serverId,
          serverName: data.serverName || "Unknown Server",
          createdAt: data.createdAt,
          status: data.status,
        });
      });
      setServerInvites(invitesList);
    });

    return () => unsubscribe();
  }, [user?.uid, isOpen]);

  // Accept server invite
  const acceptServerInvite = async (invite: ServerInvite) => {
    try {
      setIsLoading(true);
      setError("");

      // Add user to server members with user UID as document ID
      const memberRef = doc(db, `servers/${invite.serverId}/members`, user?.uid || "");
      await setDoc(memberRef, {
        userId: user?.uid,
        displayName: user?.displayName || user?.email?.split('@')[0] || "Unknown User",
        email: user?.email || "",
        role: "member",
        joinedAt: serverTimestamp(),
      });

      // Delete the invite
      await deleteDoc(doc(db, "server_invites", invite.id));

      console.log(`Successfully joined server ${invite.serverName}`);
      
      // Refresh server list to show newly joined server
      onServerCreated?.(invite.serverId);
      
      // Close modal after successful join
      onClose();
    } catch (error) {
      console.error("Error accepting server invite:", error);
      setError("Failed to accept invite. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Decline server invite
  const declineServerInvite = async (inviteId: string) => {
    try {
      setIsLoading(true);
      setError("");
      
      await deleteDoc(doc(db, "server_invites", inviteId));
      console.log("Server invite declined");
    } catch (error) {
      console.error("Error declining server invite:", error);
      setError("Failed to decline invite. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Optimized server code generation using timestamp + random
  const generateUniqueServerCode = async (): Promise<string> => {
    // Try timestamp-based approach first (more likely to be unique)
    const timestamp = Date.now();
    const baseCode = (timestamp % 100000).toString().padStart(5, '0');
    
    // Quick existence check
    const existingServerQuery = query(
      collection(db, "servers"),
      where("code", "==", baseCode),
      limit(1)
    );
    
    const existingServers = await getDocs(existingServerQuery);
    
    if (existingServers.empty) {
      return baseCode;
    }
    
    // Fallback: Add random suffix if timestamp code exists
    for (let i = 0; i < 3; i++) {
      const randomSuffix = Math.floor(Math.random() * 10);
      const modifiedCode = baseCode.slice(0, 4) + randomSuffix;
      
      const fallbackQuery = query(
        collection(db, "servers"),
        where("code", "==", modifiedCode),
        limit(1)
      );
      
      const fallbackServers = await getDocs(fallbackQuery);
      if (fallbackServers.empty) {
        return modifiedCode;
      }
    }
    
    // Final fallback: truly random
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

    const startTime = performance.now();
    console.log("🚀 Starting server creation...");

    try {
      // Generate a unique server code using optimized method
      const codeGenStart = performance.now();
      const serverCode = await generateUniqueServerCode();
      const codeGenTime = performance.now() - codeGenStart;
      console.log(`✅ Unique code generated in ${codeGenTime.toFixed(2)}ms`);
      
      // Create the server document
      const serverRef = doc(collection(db, "servers"));
      const serverId = serverRef.id;

      console.log("Creating server with ID:", serverId, "and code:", serverCode);

      // Use batch writes for better performance
      const batchStart = performance.now();
      const { writeBatch } = await import("firebase/firestore");
      const batch = writeBatch(db);

      // Add server document to batch
      batch.set(serverRef, {
        name: serverName.trim(),
        code: serverCode,
        ownerIds: [user.uid],
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      });

      // Add member document to batch
      const memberRef = doc(collection(serverRef, "members"), user.uid);
      batch.set(memberRef, {
        userId: user.uid,
        role: "owner",
        joinedAt: serverTimestamp(),
        displayName: user.displayName || user.email?.split('@')[0] || 'User',
        email: user.email || '',
      });

      // Add default room to batch
      const roomRef = doc(collection(serverRef, "chat_rooms"));
      batch.set(roomRef, {
        name: "General",
        type: "chat",
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      });

      // Execute all writes atomically
      await batch.commit();
      const batchTime = performance.now() - batchStart;
      console.log(`⚡ All server documents created in single batch: ${batchTime.toFixed(2)}ms`);

      const totalTime = performance.now() - startTime;
      console.log(`🎉 Server creation complete! Total time: ${totalTime.toFixed(2)}ms`);
      console.log("Performance breakdown:", {
        codeGeneration: `${codeGenTime.toFixed(2)}ms`,
        batchWrite: `${batchTime.toFixed(2)}ms`,
        total: `${totalTime.toFixed(2)}ms`
      });
      
      onServerCreated?.(serverId);
      onClose();
      setServerName("");
    } catch (error) {
      const errorTime = performance.now() - startTime;
      console.error(`❌ Server creation failed after ${errorTime.toFixed(2)}ms:`, error);
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
            className={`flex-1 py-3 px-2 font-black text-xs border-2 border-black dark:border-gray-600 transition-all uppercase text-black dark:text-white flex items-center justify-center gap-1 ${
              activeTab === "create"
                ? "bg-green-400 dark:bg-green-500 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)]"
                : "bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600"
            }`}
          >
            <FiPlus size={14} />
            Create
          </button>
          <button
            onClick={() => setActiveTab("join")}
            className={`flex-1 py-3 px-2 font-black text-xs border-2 border-black dark:border-gray-600 border-l-0 transition-all uppercase text-black dark:text-white flex items-center justify-center gap-1 ${
              activeTab === "join"
                ? "bg-blue-400 dark:bg-blue-500 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)]"
                : "bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600"
            }`}
          >
            <FiUsers size={14} />
            Join
          </button>
          <button
            onClick={() => setActiveTab("invites")}
            className={`flex-1 py-3 px-2 font-black text-xs border-2 border-black dark:border-gray-600 border-l-0 transition-all uppercase text-black dark:text-white flex items-center justify-center gap-1 relative ${
              activeTab === "invites"
                ? "bg-red-400 dark:bg-red-500 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)]"
                : "bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600"
            }`}
          >
            <FiMail size={14} />
            Invites
            {/* Badge for invite count */}
            {serverInvites.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 border-2 border-black dark:border-gray-600 rounded-full flex items-center justify-center text-xs font-bold text-white">
                {serverInvites.length > 9 ? "9+" : serverInvites.length}
              </span>
            )}
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

        {/* Server Invites Tab */}
        {activeTab === "invites" && (
          <div className="space-y-4">
            {serverInvites.length > 0 ? (
              <>
                <div className="text-sm font-bold text-red-600 dark:text-red-400 mb-3">
                  {serverInvites.length} pending invite{serverInvites.length !== 1 ? 's' : ''}
                </div>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {serverInvites.map((invite) => (
                    <div
                      key={invite.id}
                      className="bg-gray-50 dark:bg-gray-700 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] p-4"
                    >
                      <div className="mb-3">
                        <h3 className="font-black text-lg text-black dark:text-white">
                          {invite.serverName}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Invited by <span className="font-bold">{invite.senderName}</span>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          {invite.createdAt && new Date(invite.createdAt.seconds * 1000).toLocaleDateString()}
                        </p>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => acceptServerInvite(invite)}
                          disabled={isLoading}
                          className="flex-1 px-3 py-2 bg-green-400 dark:bg-green-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => declineServerInvite(invite.id)}
                          disabled={isLoading}
                          className="flex-1 px-3 py-2 bg-red-400 dark:bg-red-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                <FiMail size={48} className="mx-auto mb-4 opacity-50" />
                <p className="font-bold">No pending server invites</p>
                <p className="text-sm">Server invitations will appear here</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateServerModal;