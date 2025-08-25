import React, { useState, useEffect } from "react";
import type { User } from "firebase/auth";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  addDoc,
  getDoc,
  query,
  where,
  getDocs,
  limit,
  } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase/config";
import {
  FiEdit2,
  FiPlus,
  FiTrash2,
  FiUserPlus,
  FiSearch,
  FiEye,
  FiEyeOff,
  FiCopy,
  FiSettings,
  FiSend,
} from "react-icons/fi";
import RoomSettingsModal from "./RoomSettingsModal";

interface ServerSettingsProps {
  serverId: string;
  serverName: string;
  user: User;
  userRole: "owner" | "admin" | "member";
  onServerDeleted?: () => void;
}

interface Room {
  id: string;
  name: string;
  type: "chat" | "genai" | "ai-agent-design";
  visible?: boolean;
}

interface Member {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  role: "owner" | "admin" | "member";
  joinedAt: any;
}

interface SearchUser {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  isAlreadyMember?: boolean;
  hasInvite?: boolean;
}

interface ServerData {
  name: string;
  icon: string;
  color: string;
  isPublic: boolean;
  createdAt: any;
  ownerId: string;
}

const ServerSettings: React.FC<ServerSettingsProps> = ({
  serverId,
  serverName,
  user,
  userRole,
  onServerDeleted,
}) => {
  const [serverData, setServerData] = useState<ServerData | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Modal states
  const [showEditServer, setShowEditServer] = useState(false);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [showRenameRoom, setShowRenameRoom] = useState<string | null>(null);
  const [showRoomSettings, setShowRoomSettings] = useState<{
    roomId: string;
    roomName: string;
    roomType: string;
    roomIcon?: string;
  } | null>(null);
  const [showEditMember, setShowEditMember] = useState<string | null>(null);
  const [showAddFriend, setShowAddFriend] = useState<string | null>(null);

  // Server invite states
  const [inviteSearchTerm, setInviteSearchTerm] = useState("");
  const [searchUsers, setSearchUsers] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sendingInvites, setSendingInvites] = useState<Set<string>>(new Set());
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Form states
  const [editServerForm, setEditServerForm] = useState({
    name: "",
    icon: "",
    color: "",
    isPublic: false,
  });
  const [newRoomForm, setNewRoomForm] = useState({
    name: "",
    type: "chat" as "chat" | "genai" | "ai-agent-design",
  });
  const [renameRoomForm, setRenameRoomForm] = useState("");
  const [editMemberRole, setEditMemberRole] = useState<"admin" | "member">(
    "member"
  );

  // Load server data
  useEffect(() => {
    const loadServerData = async () => {
      try {
        const serverDoc = await getDoc(doc(db, "servers", serverId));
        if (serverDoc.exists()) {
          const data = serverDoc.data() as ServerData;
          setServerData(data);
          setEditServerForm({
            name: data.name,
            icon: data.icon,
            color: data.color,
            isPublic: data.isPublic,
          });
        }
      } catch (error) {
        console.error("Error loading server data:", error);
      }
    };

    loadServerData();
  }, [serverId]);

  // Load rooms
  useEffect(() => {
    const roomsRef = collection(db, `servers/${serverId}/chat_rooms`);
    const unsubscribe = onSnapshot(roomsRef, (snapshot) => {
      const roomsList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Room[];
      setRooms(roomsList);
    });

    return () => unsubscribe();
  }, [serverId]);

  // Load members
  useEffect(() => {
    const membersRef = collection(db, `servers/${serverId}/members`);
    const unsubscribe = onSnapshot(membersRef, (snapshot) => {
      const membersList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Member[];
      setMembers(
        membersList.sort((a, b) => {
          // Sort by role: owner > admin > member
          const roleOrder = { owner: 0, admin: 1, member: 2 };
          return roleOrder[a.role] - roleOrder[b.role];
        })
      );
    });

    return () => unsubscribe();
  }, [serverId]);

  // Filter members by search term
  const filteredMembers = members.filter(
    (member) =>
      member.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle server update
  const handleUpdateServer = async () => {
    try {
      await updateDoc(doc(db, "servers", serverId), {
        name: editServerForm.name,
        icon: editServerForm.icon,
        color: editServerForm.color,
        isPublic: editServerForm.isPublic,
        updatedAt: serverTimestamp(),
      });
      setShowEditServer(false);
    } catch (error) {
      console.error("Error updating server:", error);
    }
  };

  // Handle add room
  const handleAddRoom = async () => {
    try {
      await addDoc(collection(db, `servers/${serverId}/chat_rooms`), {
        name: newRoomForm.name,
        type: newRoomForm.type,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      });
      setShowAddRoom(false);
      setNewRoomForm({ name: "", type: "chat" });
    } catch (error) {
      console.error("Error adding room:", error);
    }
  };

  // Handle rename room
  const handleRenameRoom = async (roomId: string) => {
    try {
      await updateDoc(doc(db, `servers/${serverId}/chat_rooms/${roomId}`), {
        name: renameRoomForm,
        updatedAt: serverTimestamp(),
      });
      setShowRenameRoom(null);
      setRenameRoomForm("");
    } catch (error) {
      console.error("Error renaming room:", error);
    }
  };

  // Handle room updated
  const handleRoomUpdated = () => {
    // Room list will update automatically through real-time listener
  };

  // Handle room deleted
  const handleRoomDeleted = () => {
    setShowRoomSettings(null);
  };

  // Handle toggle room visibility (for members)
  const handleToggleRoomVisibility = (
    roomId: string,
    currentVisibility: boolean
  ) => {
    // This would typically update user preferences in a user-specific collection
    console.log(`Toggle room ${roomId} visibility to ${!currentVisibility}`);
  };

  // Handle update member role
  const handleUpdateMemberRole = async (memberId: string) => {
    try {
      await updateDoc(doc(db, `servers/${serverId}/members/${memberId}`), {
        role: editMemberRole,
        updatedAt: serverTimestamp(),
      });
      // Close modal after successful update
      console.log("Member role updated successfully, closing modal");
      setShowEditMember(null);
      // Reset role selection
      setEditMemberRole("member");
    } catch (error) {
      console.error("Error updating member role:", error);
      alert("Failed to update member role. Please try again.");
    }
  };

  // Handle kick member
  const handleKickMember = async (memberId: string) => {
    try {
      await deleteDoc(doc(db, `servers/${serverId}/members/${memberId}`));
      setShowEditMember(null);
    } catch (error) {
      console.error("Error kicking member:", error);
    }
  };

  // Handle delete server
  const handleDeleteServer = async () => {
    setIsDeleting(true);
    try {
      // Call the Cloud Function to delete server with cascading deletion
      const deleteServerFunction = httpsCallable(functions, "deleteServer");
      const result = await deleteServerFunction({ serverId });

      console.log("Server deletion result:", result.data);
      onServerDeleted?.();
    } catch (error: any) {
      console.error("Error deleting server:", error);
      alert(`Failed to delete server: ${error.message || "Unknown error"}`);
      setIsDeleting(false);
    }
  };

  // Search users for server invites
  const performUserSearch = async (searchTerm: string) => {
    if (!searchTerm.trim() || searchTerm.length < 2) {
      setSearchUsers([]);
      setShowSearchDropdown(false);
      return;
    }

    setIsSearching(true);
    setShowSearchDropdown(true);
    try {
      // Search by email or display name
      const usersRef = collection(db, "users");
      
      // Search by email (exact match)
      const emailQuery = query(
        usersRef,
        where("email", ">=", searchTerm.toLowerCase()),
        where("email", "<=", searchTerm.toLowerCase() + '\uf8ff'),
        limit(10)
      );
      
      // Search by display name (partial match)
      const nameQuery = query(
        usersRef,
        where("displayName", ">=", searchTerm),
        where("displayName", "<=", searchTerm + '\uf8ff'),
        limit(10)
      );

      const [emailSnapshot, nameSnapshot] = await Promise.all([
        getDocs(emailQuery),
        getDocs(nameQuery)
      ]);

      // Combine results and remove duplicates
      const userMap = new Map<string, SearchUser>();
      
      emailSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.userId !== user.uid) { // Don't include current user
          userMap.set(data.userId, {
            id: doc.id,
            userId: data.userId,
            displayName: data.displayName || data.email?.split('@')[0] || 'Unknown User',
            email: data.email || '',
          });
        }
      });

      nameSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.userId !== user.uid && !userMap.has(data.userId)) {
          userMap.set(data.userId, {
            id: doc.id,
            userId: data.userId,
            displayName: data.displayName || data.email?.split('@')[0] || 'Unknown User',
            email: data.email || '',
          });
        }
      });

      // Check which users are already members or have pending invites
      const userResults = Array.from(userMap.values());
      
      // Check existing members
      const memberUserIds = members.map(m => m.userId);
      
      // Check pending invites
      const invitesRef = collection(db, "server_invites");
      const invitesQuery = query(
        invitesRef,
        where("serverId", "==", serverId),
        where("recipientId", "in", userResults.map(u => u.userId))
      );
      const invitesSnapshot = await getDocs(invitesQuery);
      const pendingInviteUserIds = invitesSnapshot.docs.map(doc => doc.data().recipientId);

      // Mark users appropriately
      const finalResults = userResults.map(user => ({
        ...user,
        isAlreadyMember: memberUserIds.includes(user.userId),
        hasInvite: pendingInviteUserIds.includes(user.userId)
      }));

      setSearchUsers(finalResults);
    } catch (error) {
      console.error("Error searching users:", error);
      setSearchUsers([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Send server invite
  const sendServerInvite = async (recipientId: string) => {
    try {
      setSendingInvites(prev => new Set(prev.add(recipientId)));

      // Create invite document
      await addDoc(collection(db, "server_invites"), {
        senderId: user.uid,
        senderName: user.displayName || user.email?.split('@')[0] || 'Unknown User',
        senderEmail: user.email || '',
        recipientId: recipientId,
        serverId: serverId,
        serverName: serverName,
        createdAt: serverTimestamp(),
        status: "pending"
      });

      // Update the local state to show invite sent
      setSearchUsers(prev => prev.map(user => 
        user.userId === recipientId 
          ? { ...user, hasInvite: true }
          : user
      ));

      console.log(`Server invite sent to user ${recipientId}`);
    } catch (error) {
      console.error("Error sending server invite:", error);
      alert("Failed to send invite. Please try again.");
    } finally {
      setSendingInvites(prev => {
        const newSet = new Set(prev);
        newSet.delete(recipientId);
        return newSet;
      });
    }
  };

  // Handle invite search input change
  const handleInviteSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInviteSearchTerm(value);
    
    // Debounce search
    const timeoutId = setTimeout(() => {
      performUserSearch(value);
    }, 300);

    return () => clearTimeout(timeoutId);
  };

  // Close dropdown when clicking outside
  const handleSearchInputBlur = () => {
    // Delay hiding to allow for clicking on dropdown items
    setTimeout(() => {
      setShowSearchDropdown(false);
    }, 200);
  };

  // Handle selecting a user from dropdown
  const handleUserSelect = (searchUser: SearchUser) => {
    if (!searchUser.isAlreadyMember && !searchUser.hasInvite) {
      sendServerInvite(searchUser.userId);
    }
    setShowSearchDropdown(false);
  };

  // Render room icon based on type
  const getRoomIcon = (type: string) => {
    switch (type) {
      case "chat":
        return "#";
      case "genai":
        return "🎨";
      case "ai-agent-design":
        return "🤖";
      default:
        return "#";
    }
  };

  return (
    <div className="flex-1 bg-white dark:bg-gray-900 flex flex-col h-full">
      <div className="flex-1  p-6 overflow-y-auto">
        <h1 className="text-3xl font-black uppercase mb-8 text-black dark:text-white">
          Server Settings
        </h1>

        {/* Server Info and Invite Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Combined Server Info and Join Code Section */}
          <div className="bg-gray-100 dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(55,65,81,1)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black uppercase text-black dark:text-white">
                Server Information
              </h2>
              {userRole === "owner" && (
                <button
                  onClick={() => setShowEditServer(true)}
                  className="px-4 py-2 bg-blue-400 dark:bg-blue-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white flex items-center gap-2"
                >
                  <FiEdit2 size={16} />
                  Edit
                </button>
              )}
            </div>

            {serverData && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-bold text-gray-700 dark:text-gray-300">
                    Name
                  </p>
                  <p className="text-black dark:text-white">{serverData.name}</p>
                </div>
                <div>
                  <p className="font-bold text-gray-700 dark:text-gray-300">
                    Icon
                  </p>
                  <p className="text-2xl">{serverData.icon}</p>
                </div>
                <div>
                  <p className="font-bold text-gray-700 dark:text-gray-300">
                    Color
                  </p>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 border-2 border-black dark:border-gray-600"
                      style={{ backgroundColor: serverData.color }}
                    />
                    <span className="text-black dark:text-white">
                      {serverData.color}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="font-bold text-gray-700 dark:text-gray-300">
                    Visibility
                  </p>
                  <p className="text-black dark:text-white">
                    {serverData.isPublic ? "Public" : "Private"}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Server Invite Section - Now visible to all users */}
          <div className="bg-green-100 dark:bg-green-900 border-4 border-black dark:border-gray-600 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(55,65,81,1)] p-6">
            <h2 className="text-xl font-black uppercase text-black dark:text-white mb-4">
              Invite Members
            </h2>
            
            {/* Join Code Section - Visible to all users */}
            <div className="mb-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-700 border-2 border-black dark:border-gray-600">
                  <span className="text-sm font-bold text-gray-600 dark:text-gray-400">Join Code:</span>
                  <span className="text-2xl font-black text-black dark:text-white tracking-wider">
                    {serverId.slice(-5).toUpperCase()}
                  </span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(serverId.slice(-5).toUpperCase());
                    alert("Join code copied to clipboard!");
                  }}
                  className="px-4 py-3 bg-blue-400 dark:bg-blue-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white flex items-center gap-2"
                >
                  <FiCopy size={16} />
                  Copy
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Share this code with others to let them join your server
              </p>
            </div>
            
            {(userRole === "owner" || userRole === "admin") ? (
              <>
                {/* Search Bar with Floating Dropdown */}
                <div className="relative mb-4 mt-6">
                  <FiSearch
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                    size={20}
                  />
                  <input
                    type="text"
                    placeholder="Search users by name or email..."
                    value={inviteSearchTerm}
                    onChange={handleInviteSearchChange}
                    onFocus={() => inviteSearchTerm && setShowSearchDropdown(true)}
                    onBlur={handleSearchInputBlur}
                    className="w-full pl-10 pr-4 py-3 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] transition-all"
                  />

                  {/* Floating Search Dropdown */}
                  {showSearchDropdown && (
                    <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-700 border-4 border-black dark:border-gray-600 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(55,65,81,1)] z-50 max-h-64 overflow-y-auto">
                      {isSearching && (
                        <div className="p-4 text-center text-gray-600 dark:text-gray-400">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                            Searching users...
                          </div>
                        </div>
                      )}

                      {!isSearching && inviteSearchTerm && searchUsers.length === 0 && (
                        <div className="p-4 text-center text-gray-600 dark:text-gray-400">
                          No users found matching "{inviteSearchTerm}"
                        </div>
                      )}

                      {!isSearching && searchUsers.length > 0 && (
                        <div className="divide-y-2 divide-black dark:divide-gray-600">
                          {searchUsers.map((searchUser) => (
                            <div
                              key={searchUser.userId}
                              className="flex items-center justify-between p-4 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer transition-colors"
                              onMouseDown={(e) => e.preventDefault()} // Prevent blur
                              onClick={() => handleUserSelect(searchUser)}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-black dark:text-white truncate">
                                  {searchUser.displayName}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                                  {searchUser.email}
                                </p>
                              </div>

                              <div className="ml-3 flex-shrink-0">
                                {searchUser.isAlreadyMember ? (
                                  <span className="px-2 py-1 bg-gray-300 dark:bg-gray-600 border border-black dark:border-gray-500 font-bold text-xs text-gray-700 dark:text-gray-300 rounded">
                                    Member
                                  </span>
                                ) : searchUser.hasInvite ? (
                                  <span className="px-2 py-1 bg-orange-300 dark:bg-orange-600 border border-black dark:border-gray-500 font-bold text-xs text-black dark:text-white rounded">
                                    Invited
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold text-sm">
                                    <FiSend size={12} />
                                    Invite
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Start typing to search for users to invite to the server
                </p>
              </>
            ) : (
              <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                <FiUserPlus size={48} className="mx-auto mb-4 opacity-50" />
                <p className="font-bold">Share the join code above to invite members</p>
                <p className="text-sm">Only owners and admins can send direct invites</p>
              </div>
            )}
          </div>
        </div>

        {/* Horizontal Layout: Rooms and Members */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Rooms Section */}
          <div className="bg-gray-100 dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(55,65,81,1)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black uppercase text-black dark:text-white">
                Rooms ({rooms.length})
              </h2>
              {(userRole === "owner" || userRole === "admin") && (
                <button
                  onClick={() => setShowAddRoom(true)}
                  className="px-4 py-2 bg-green-400 dark:bg-green-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white flex items-center gap-2"
                >
                  <FiPlus size={16} />
                  Add Room
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 border-2 border-black dark:border-gray-600"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{room.icon || getRoomIcon(room.type)}</span>
                    <span className="font-bold text-black dark:text-white">
                      {room.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {userRole === "member" ? (
                      <button
                        onClick={() =>
                          handleToggleRoomVisibility(
                            room.id,
                            room.visible !== false
                          )
                        }
                        className="p-2 bg-gray-300 dark:bg-gray-600 border-2 border-black dark:border-gray-500 hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                        title={room.visible !== false ? "Hide Room" : "Show Room"}
                      >
                        {room.visible !== false ? (
                          <FiEye
                            size={16}
                            className="text-black dark:text-white"
                          />
                        ) : (
                          <FiEyeOff
                            size={16}
                            className="text-black dark:text-white"
                          />
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowRoomSettings({
                          roomId: room.id,
                          roomName: room.name,
                          roomType: room.type,
                          roomIcon: room.icon
                        })}
                        className="p-2 bg-purple-400 dark:bg-purple-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
                        title="Room Settings"
                      >
                        <FiSettings size={16} className="text-black dark:text-white" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Members Section */}
          <div className="bg-gray-100 dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(55,65,81,1)] p-6">
            <h2 className="text-xl font-black uppercase mb-4 text-black dark:text-white">
              Members ({members.length})
            </h2>

            {/* Search Bar */}
            <div className="relative mb-4">
              <FiSearch
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                size={20}
              />
              <input
                type="text"
                placeholder="Search members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)]"
              />
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {filteredMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 border-2 border-black dark:border-gray-600"
                >
                  <div>
                    <p className="font-bold text-black dark:text-white">
                      {member.displayName}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {member.email}
                    </p>
                    <p className="text-xs font-bold uppercase text-gray-500 dark:text-gray-500">
                      {member.role}
                    </p>
                  </div>

                  {userRole === "member"
                    ? member.userId !== user.uid && (
                        <button
                          onClick={() => setShowAddFriend(member.userId)}
                          className="px-3 py-1 bg-green-400 dark:bg-green-500 border-2 border-black dark:border-gray-600 hover:bg-green-500 dark:hover:bg-green-600 transition-colors font-bold text-sm text-black dark:text-white flex items-center gap-2"
                        >
                          <FiUserPlus size={14} />
                          Add Friend
                        </button>
                      )
                    : member.role !== "owner" &&
                      member.userId !== user.uid && (
                        <button
                          onClick={() => {
                            setEditMemberRole(member.role as "admin" | "member");
                            setShowEditMember(member.id);
                          }}
                          className="px-3 py-1 bg-yellow-400 dark:bg-yellow-500 border-2 border-black dark:border-gray-600 hover:bg-yellow-500 dark:hover:bg-yellow-600 transition-colors font-bold text-sm text-black dark:text-white"
                        >
                          Edit
                        </button>
                      )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Delete Server Button - Only for owners */}
        {userRole === "owner" && (
          <div className="mt-8">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full px-6 py-3 bg-red-500 dark:bg-red-600 border-4 border-black dark:border-gray-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all font-black text-white uppercase flex items-center justify-center gap-2"
            >
              <FiTrash2 size={20} />
              Delete Server
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {/* Edit Server Modal */}
      {showEditServer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(55,65,81,1)] p-6 max-w-md w-full m-4">
            <h3 className="text-xl font-black uppercase mb-4 text-black dark:text-white">
              Edit Server
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block font-bold mb-1 text-black dark:text-white">
                  Name
                </label>
                <input
                  type="text"
                  value={editServerForm.name}
                  onChange={(e) =>
                    setEditServerForm({
                      ...editServerForm,
                      name: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold mb-1 text-black dark:text-white">
                  Icon
                </label>
                <input
                  type="text"
                  value={editServerForm.icon}
                  onChange={(e) =>
                    setEditServerForm({
                      ...editServerForm,
                      icon: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white"
                  maxLength={2}
                />
              </div>

              <div>
                <label className="block font-bold mb-1 text-black dark:text-white">
                  Color
                </label>
                <input
                  type="color"
                  value={editServerForm.color}
                  onChange={(e) =>
                    setEditServerForm({
                      ...editServerForm,
                      color: e.target.value,
                    })
                  }
                  className="w-full h-10 border-2 border-black dark:border-gray-600 cursor-pointer"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editServerForm.isPublic}
                    onChange={(e) =>
                      setEditServerForm({
                        ...editServerForm,
                        isPublic: e.target.checked,
                      })
                    }
                    className="w-4 h-4"
                  />
                  <span className="font-bold text-black dark:text-white">
                    Public Server
                  </span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleUpdateServer}
                className="flex-1 px-4 py-2 bg-green-400 dark:bg-green-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white"
              >
                Save
              </button>
              <button
                onClick={() => setShowEditServer(false)}
                className="flex-1 px-4 py-2 bg-gray-400 dark:bg-gray-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Room Modal */}
      {showAddRoom && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(55,65,81,1)] p-6 max-w-md w-full m-4">
            <h3 className="text-xl font-black uppercase mb-4 text-black dark:text-white">
              Add Room
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block font-bold mb-1 text-black dark:text-white">
                  Room Name
                </label>
                <input
                  type="text"
                  value={newRoomForm.name}
                  onChange={(e) =>
                    setNewRoomForm({ ...newRoomForm, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white"
                  placeholder="general"
                />
              </div>

              <div>
                <label className="block font-bold mb-1 text-black dark:text-white">
                  Room Type
                </label>
                <select
                  value={newRoomForm.type}
                  onChange={(e) =>
                    setNewRoomForm({
                      ...newRoomForm,
                      type: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white"
                >
                  <option value="chat">Chat Room</option>
                  <option value="genai">Gen AI Room</option>
                  <option value="ai-agent-design">AI Agent Room</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleAddRoom}
                disabled={!newRoomForm.name}
                className="flex-1 px-4 py-2 bg-green-400 dark:bg-green-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowAddRoom(false);
                  setNewRoomForm({ name: "", type: "chat" });
                }}
                className="flex-1 px-4 py-2 bg-gray-400 dark:bg-gray-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Room Modal */}
      {showRenameRoom && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(55,65,81,1)] p-6 max-w-md w-full m-4">
            <h3 className="text-xl font-black uppercase mb-4 text-black dark:text-white">
              Rename Room
            </h3>

            <input
              type="text"
              value={renameRoomForm}
              onChange={(e) => setRenameRoomForm(e.target.value)}
              className="w-full px-3 py-2 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white mb-4"
              placeholder="New room name"
            />

            <div className="flex gap-2">
              <button
                onClick={() => handleRenameRoom(showRenameRoom)}
                disabled={!renameRoomForm}
                className="flex-1 px-4 py-2 bg-blue-400 dark:bg-blue-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Rename
              </button>
              <button
                onClick={() => {
                  setShowRenameRoom(null);
                  setRenameRoomForm("");
                }}
                className="flex-1 px-4 py-2 bg-gray-400 dark:bg-gray-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Room Settings Modal */}
      {showRoomSettings && (
        <RoomSettingsModal
          serverId={serverId}
          roomId={showRoomSettings.roomId}
          roomName={showRoomSettings.roomName}
          roomType={showRoomSettings.roomType}
          roomIcon={showRoomSettings.roomIcon}
          onClose={() => setShowRoomSettings(null)}
          onRoomDeleted={handleRoomDeleted}
          onRoomUpdated={handleRoomUpdated}
          userRole={userRole}
        />
      )}

      {/* Edit Member Modal */}
      {showEditMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(55,65,81,1)] p-6 max-w-md w-full m-4">
            <h3 className="text-xl font-black uppercase mb-4 text-black dark:text-white">
              Edit Member
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block font-bold mb-1 text-black dark:text-white">
                  Role
                </label>
                <select
                  value={editMemberRole}
                  onChange={(e) =>
                    setEditMemberRole(e.target.value as "admin" | "member")
                  }
                  className="w-full px-3 py-2 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white"
                >
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={async () => {
                  await handleUpdateMemberRole(showEditMember);
                }}
                className="flex-1 px-4 py-2 bg-blue-400 dark:bg-blue-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white"
              >
                Update
              </button>
              <button
                onClick={() => handleKickMember(showEditMember)}
                className="px-4 py-2 bg-red-500 dark:bg-red-600 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-white"
              >
                Kick
              </button>
              <button
                onClick={() => setShowEditMember(null)}
                className="flex-1 px-4 py-2 bg-gray-400 dark:bg-gray-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Friend Modal */}
      {showAddFriend && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(55,65,81,1)] p-6 max-w-md w-full m-4">
            <h3 className="text-xl font-black uppercase mb-4 text-black dark:text-white">
              Send Friend Request
            </h3>

            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Send a friend request to this user?
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  // Friend request functionality will be implemented in Phase 2
                  console.log("Send friend request to:", showAddFriend);
                  setShowAddFriend(null);
                }}
                className="flex-1 px-4 py-2 bg-green-400 dark:bg-green-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white"
              >
                Send Request
              </button>
              <button
                onClick={() => setShowAddFriend(null)}
                className="flex-1 px-4 py-2 bg-gray-400 dark:bg-gray-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Server Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(55,65,81,1)] p-6 max-w-md w-full m-4">
            <h3 className="text-xl font-black uppercase mb-4 text-red-600 dark:text-red-400">
              Delete Server
            </h3>

            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete <strong>{serverName}</strong>?
              This will permanently delete the server, all rooms, and all
              messages. This action cannot be undone.
            </p>

            <div className="flex gap-2">
              <button
                onClick={handleDeleteServer}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-red-500 dark:bg-red-600 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? "Deleting..." : "Delete Server"}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-gray-400 dark:bg-gray-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServerSettings;
