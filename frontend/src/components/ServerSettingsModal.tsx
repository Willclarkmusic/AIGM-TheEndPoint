import React, { useState, useEffect } from "react";
import { FiX, FiUsers, FiSettings, FiTrash2, FiSearch } from "react-icons/fi";
import { collection, query, getDocs, doc, updateDoc, deleteDoc, where } from "firebase/firestore";
import { db } from "../firebase/config";
import type { User } from "firebase/auth";

interface ServerMember {
  userId: string;
  role: "owner" | "admin" | "member";
  joinedAt: any;
  displayName?: string;
  email?: string;
}

interface ServerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  serverId: string | null;
  serverName: string;
  userRole: "owner" | "admin" | "member" | null;
  onServerDeleted?: () => void;
}

const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({
  isOpen,
  onClose,
  user,
  serverId,
  serverName,
  userRole,
  onServerDeleted,
}) => {
  const [activeTab, setActiveTab] = useState<"general" | "roles">("general");
  const [members, setMembers] = useState<ServerMember[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<ServerMember[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Load server members
  useEffect(() => {
    if (isOpen && serverId && userRole === "owner") {
      loadMembers();
    }
  }, [isOpen, serverId, userRole]);

  // Filter members based on search query
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredMembers(members);
    } else {
      const filtered = members.filter(member =>
        member.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.userId.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredMembers(filtered);
    }
  }, [members, searchQuery]);

  const loadMembers = async () => {
    if (!serverId) return;

    setIsLoading(true);
    try {
      // Get all members from the server's members subcollection
      const membersRef = collection(db, "servers", serverId, "members");
      const membersQuery = query(membersRef);
      const membersSnapshot = await getDocs(membersQuery);

      const membersList: ServerMember[] = [];
      const userIds: string[] = [];

      membersSnapshot.forEach((doc) => {
        const data = doc.data();
        membersList.push({
          userId: doc.id,
          role: data.role,
          joinedAt: data.joinedAt,
        });
        userIds.push(doc.id);
      });

      // Get user details from the users collection
      if (userIds.length > 0) {
        const usersRef = collection(db, "users");
        const usersQuery = query(usersRef, where("__name__", "in", userIds));
        const usersSnapshot = await getDocs(usersQuery);

        const userDetails: { [key: string]: { displayName?: string; email?: string } } = {};
        usersSnapshot.forEach((doc) => {
          const data = doc.data();
          userDetails[doc.id] = {
            displayName: data.displayName || data.name,
            email: data.email,
          };
        });

        // Merge member data with user details
        membersList.forEach(member => {
          if (userDetails[member.userId]) {
            member.displayName = userDetails[member.userId].displayName;
            member.email = userDetails[member.userId].email;
          }
        });
      }

      setMembers(membersList);
    } catch (error) {
      console.error("Error loading members:", error);
      setError("Failed to load server members");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: "owner" | "admin" | "member") => {
    if (!serverId) return;

    // Prevent changing your own role
    if (memberId === user.uid) {
      setError("You cannot change your own role");
      return;
    }

    // Prevent having more than 3 owners
    if (newRole === "owner") {
      const ownerCount = members.filter(m => m.role === "owner").length;
      if (ownerCount >= 3) {
        setError("Maximum of 3 owners allowed per server");
        return;
      }
    }

    setIsLoading(true);
    setError("");

    try {
      const memberRef = doc(db, "servers", serverId, "members", memberId);
      await updateDoc(memberRef, {
        role: newRole
      });

      // Update local state
      setMembers(prev => prev.map(member => 
        member.userId === memberId ? { ...member, role: newRole } : member
      ));
    } catch (error) {
      console.error("Error updating member role:", error);
      setError("Failed to update member role");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteServer = async () => {
    if (!serverId || userRole !== "owner") return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${serverName}"? This action cannot be undone and will delete all rooms and messages.`
    );

    if (!confirmed) return;

    setIsLoading(true);
    try {
      // Delete the server document - this will trigger the Cloud Function for cascading delete
      await deleteDoc(doc(db, "servers", serverId));
      onServerDeleted?.();
      onClose();
    } catch (error) {
      console.error("Error deleting server:", error);
      setError("Failed to delete server");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(55,65,81,1)] max-w-2xl w-full p-6 max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black uppercase text-black dark:text-white">
            Server Settings
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-red-400 dark:bg-red-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
          >
            <FiX size={16} className="text-black dark:text-white" />
          </button>
        </div>

        {/* Server Name */}
        <div className="mb-4">
          <h3 className="text-lg font-black text-black dark:text-white">{serverName}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Your role: {userRole}</p>
        </div>

        {/* Tab Navigation - Only show roles tab for owners */}
        <div className="flex mb-6">
          <button
            onClick={() => setActiveTab("general")}
            className={`flex-1 py-3 px-4 font-black text-sm border-2 border-black dark:border-gray-600 transition-all uppercase text-black dark:text-white flex items-center justify-center gap-2 ${
              activeTab === "general"
                ? "bg-blue-400 dark:bg-blue-500 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)]"
                : "bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600"
            }`}
          >
            <FiSettings size={16} />
            General
          </button>
          {userRole === "owner" && (
            <button
              onClick={() => setActiveTab("roles")}
              className={`flex-1 py-3 px-4 font-black text-sm border-2 border-black dark:border-gray-600 border-l-0 transition-all uppercase text-black dark:text-white flex items-center justify-center gap-2 ${
                activeTab === "roles"
                  ? "bg-purple-400 dark:bg-purple-500 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)]"
                  : "bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600"
              }`}
            >
              <FiUsers size={16} />
              Roles
            </button>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 border-2 border-red-500 text-red-700 dark:text-red-300 font-bold">
            {error}
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">
          {/* General Tab */}
          {activeTab === "general" && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-100 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600">
                <h4 className="font-black text-black dark:text-white mb-2">Server Information</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Server ID: {serverId}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Members: {members.length}
                </p>
              </div>

              {userRole === "owner" && (
                <div className="p-4 bg-red-50 dark:bg-red-900 border-2 border-red-300 dark:border-red-700">
                  <h4 className="font-black text-red-700 dark:text-red-300 mb-2">Danger Zone</h4>
                  <p className="text-sm text-red-600 dark:text-red-400 mb-3">
                    Delete this server permanently. This action cannot be undone.
                  </p>
                  <button
                    onClick={handleDeleteServer}
                    disabled={isLoading}
                    className="bg-red-500 dark:bg-red-600 text-white font-black py-2 px-4 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase flex items-center gap-2"
                  >
                    <FiTrash2 size={16} />
                    {isLoading ? "Deleting..." : "Delete Server"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Roles Tab - Only visible to owners */}
          {activeTab === "roles" && userRole === "owner" && (
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <FiSearch 
                  size={20} 
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search members..."
                  className="w-full pl-10 pr-3 py-2 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)]"
                />
              </div>

              {/* Members List */}
              <div className="space-y-2">
                {filteredMembers.map((member) => (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600"
                  >
                    <div>
                      <p className="font-bold text-black dark:text-white">
                        {member.displayName || member.email || member.userId}
                        {member.userId === user.uid && " (You)"}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {member.email}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs font-black uppercase border-2 border-black dark:border-gray-600 ${
                        member.role === "owner" 
                          ? "bg-red-400 dark:bg-red-500" 
                          : member.role === "admin"
                          ? "bg-yellow-400 dark:bg-yellow-500"
                          : "bg-blue-400 dark:bg-blue-500"
                      } text-black dark:text-white`}>
                        {member.role}
                      </span>
                      
                      {member.userId !== user.uid && (
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.userId, e.target.value as "owner" | "admin" | "member")}
                          disabled={isLoading}
                          className="px-2 py-1 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-800 text-black dark:text-white text-sm font-bold disabled:opacity-50"
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                          <option value="owner">Owner</option>
                        </select>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {filteredMembers.length === 0 && !isLoading && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No members found matching your search.
                </div>
              )}

              {isLoading && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  Loading members...
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ServerSettingsModal;