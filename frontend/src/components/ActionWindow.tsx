import React, { useState } from "react";
import type { User } from "firebase/auth";
import {
  FiSidebar,
  FiArrowLeft,
  FiUserPlus,
  FiX,
  FiSearch,
  FiEdit3,
} from "react-icons/fi";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  arrayUnion,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";
import ServerSettings from "./ServerSettings";
import ChatRoom from "./ChatRoom";
import FriendSearch from "./FriendSearch";
import DirectMessageRoom from "./DirectMessageRoom";
import SocialFeed from "./SocialFeed";
import PostComposer from "./PostComposer";

interface ActionWindowProps {
  selectedServer: string | null;
  selectedTab: "friends" | "feed";
  user: User;
  showServerSettings?: boolean;
  selectedServerData?: {
    id: string;
    name: string;
    role: "owner" | "admin" | "member" | null;
    memberCount?: number;
  } | null;
  selectedRoom?: {
    id: string;
    name: string;
    serverId: string;
    type?: string;
    memberCount?: number;
  } | null;
  onBackFromServerSettings?: () => void;
  onServerDeleted?: () => void;
  showFriendSearch?: boolean;
  selectedFeed?: {
    id: string;
    name: string;
    tags: string[];
  } | null;
  selectedFilterTag?: string | null;
  onBackFromFeed?: () => void;
  selectedDM?: {
    id: string;
    name: string;
    participants: string[];
  } | null;
  onBackFromFriendSearch?: () => void;
  onBackFromDM?: () => void;
  userRole?: "owner" | "admin" | "member" | null;
  onToggleRightSidebar?: () => void;
}

const ActionWindow: React.FC<ActionWindowProps> = ({
  selectedServer,
  selectedTab,
  user,
  showServerSettings = false,
  selectedServerData,
  selectedRoom,
  onBackFromServerSettings,
  onServerDeleted,
  showFriendSearch = false,
  selectedDM,
  onBackFromFriendSearch,
  onBackFromDM,
  userRole,
  onToggleRightSidebar,
  selectedFeed,
  selectedFilterTag,
  onBackFromFeed,
}) => {
  const [showAddUsersModal, setShowAddUsersModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);

  // Search for users to add to DM
  const searchUsers = async (searchTerm: string) => {
    if (!searchTerm.trim() || searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // Search by email or display name
      const usersRef = collection(db, "users");

      // Search by email
      const emailQuery = query(
        usersRef,
        where("email", ">=", searchTerm.toLowerCase()),
        where("email", "<=", searchTerm.toLowerCase() + "\uf8ff")
      );

      // Search by display name
      const nameQuery = query(
        usersRef,
        where("displayName", ">=", searchTerm),
        where("displayName", "<=", searchTerm + "\uf8ff")
      );

      const [emailSnapshot, nameSnapshot] = await Promise.all([
        getDocs(emailQuery),
        getDocs(nameQuery),
      ]);

      // Combine results and remove duplicates
      const userMap = new Map();

      emailSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (
          data.userId !== user.uid &&
          !selectedDM?.participants.includes(data.userId)
        ) {
          userMap.set(data.userId, {
            id: doc.id,
            userId: data.userId,
            displayName:
              data.displayName || data.email?.split("@")[0] || "Unknown User",
            email: data.email || "",
          });
        }
      });

      nameSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (
          data.userId !== user.uid &&
          !selectedDM?.participants.includes(data.userId) &&
          !userMap.has(data.userId)
        ) {
          userMap.set(data.userId, {
            id: doc.id,
            userId: data.userId,
            displayName:
              data.displayName || data.email?.split("@")[0] || "Unknown User",
            email: data.email || "",
          });
        }
      });

      setSearchResults(Array.from(userMap.values()));
    } catch (error) {
      console.error("Error searching users:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Add selected users to DM
  const addUsersToDM = async () => {
    if (!selectedDM || selectedUsers.length === 0) return;

    try {
      const currentParticipantCount = selectedDM.participants.length;

      if (currentParticipantCount === 2) {
        // Create new group DM (leave 2-person DM intact)
        console.log("Creating new group DM for 2-person chat");

        const newParticipants = [...selectedDM.participants, ...selectedUsers];
        const newDMRef = doc(collection(db, "private_messages"));

        await setDoc(newDMRef, {
          participants: newParticipants,
          createdAt: serverTimestamp(),
          lastMessage: "",
          lastMessageTimestamp: serverTimestamp(),
        });

        console.log("New group DM created with ID:", newDMRef.id);

        // TODO: Navigate to the new group DM
        // The InfoBar will automatically pick up the new DM via real-time listener
      } else {
        // Add users directly to existing 3+ person DM
        console.log("Adding users to existing group DM");

        const dmRef = doc(db, "private_messages", selectedDM.id);
        await updateDoc(dmRef, {
          participants: arrayUnion(...selectedUsers),
        });
      }

      // Close modal and reset state
      setShowAddUsersModal(false);
      setSearchTerm("");
      setSearchResults([]);
      setSelectedUsers([]);

      console.log("Users added to DM successfully");
    } catch (error) {
      console.error("Error adding users to DM:", error);
      alert("Failed to add users to conversation. Please try again.");
    }
  };

  const getTitle = () => {
    if (showServerSettings && selectedServerData) {
      return "Server Settings";
    }
    if (showFriendSearch) {
      return "Find Friends";
    }
    if (selectedDM) {
      return selectedDM.name;
    }
    if (selectedRoom) {
      return selectedRoom.name;
    }
    if (selectedServer) {
      return `Server ${selectedServer}`;
    }
    if (selectedFeed && selectedFeed.id !== "all") {
      return selectedFeed.name;
    }
    if (selectedFilterTag) {
      return `#${selectedFilterTag}`;
    }
    return selectedTab === "friends" ? "Friends" : "Social Feed";
  };

  const getSecondaryText = () => {
    if (showServerSettings && selectedServerData) {
      const memberText = selectedServerData.memberCount
        ? `${selectedServerData.memberCount} member${
            selectedServerData.memberCount !== 1 ? "s" : ""
          }`
        : "";
      const roleText = selectedServerData.role
        ? `You are ${selectedServerData.role}`
        : "";
      if (memberText && roleText) {
        return `${memberText} • ${roleText}`;
      }
      return memberText || roleText;
    }
    if (selectedDM) {
      const participantCount = selectedDM.participants.length;
      return `${participantCount} participant${
        participantCount !== 1 ? "s" : ""
      }`;
    }
    if (selectedRoom && selectedServerData) {
      const memberText = selectedRoom.memberCount
        ? `${selectedRoom.memberCount} member${
            selectedRoom.memberCount !== 1 ? "s" : ""
          }`
        : "";
      const roleText = userRole ? `You are ${userRole}` : "";
      const roomType = selectedRoom.type
        ? `${
            selectedRoom.type.charAt(0).toUpperCase() +
            selectedRoom.type.slice(1)
          } room`
        : "";

      const parts = [roomType, memberText, roleText].filter(Boolean);
      return parts.join(" • ");
    }
    if (selectedFeed && selectedFeed.id !== "all") {
      const tagCount = selectedFeed.tags.length;
      return `${tagCount} tag${tagCount !== 1 ? "s" : ""}`;
    }
    if (selectedFilterTag) {
      return "Filtered posts";
    }
    return ""; // Return empty string for other cases
  };

  const getToolbarButtons = () => {
    const buttons = [];

    // For Social Feed, show Create Post button
    if (
      selectedTab === "feed" &&
      !showServerSettings &&
      !showFriendSearch &&
      !selectedDM &&
      !selectedRoom
    ) {
      buttons.push(
        <button
          key="create-post"
          onClick={() => setShowCreatePostModal(true)}
          className="px-3 py-2 bg-pink-400 dark:bg-pink-500 border-2 border-black dark:border-gray-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white flex items-center gap-2"
        >
          <FiEdit3 size={16} />
          Create Post
        </button>
      );
    }

    // For DMs, show Add Users button if not at max capacity (10 users)
    if (selectedDM) {
      const canAddUsers = selectedDM.participants.length < 10;
      if (canAddUsers) {
        buttons.push(
          <button
            key="add-users"
            onClick={() => setShowAddUsersModal(true)}
            className="px-3 py-2 bg-green-400 dark:bg-green-500 border-2 border-black dark:border-gray-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white flex items-center gap-2"
          >
            <FiUserPlus size={16} />
            Add Users
          </button>
        );
      }
    }

    return buttons.length > 0 ? buttons : null;
  };

  const getContent = () => {
    // Show ServerSettings when requested
    if (showServerSettings && selectedServerData && selectedServerData.role) {
      return (
        <ServerSettings
          serverId={selectedServerData.id}
          serverName={selectedServerData.name}
          user={user}
          userRole={selectedServerData.role}
          onServerDeleted={onServerDeleted}
        />
      );
    }

    // Show FriendSearch when requested
    if (showFriendSearch) {
      return (
        <FriendSearch user={user} onBackToFriends={onBackFromFriendSearch} />
      );
    }

    // Show DirectMessageRoom when a DM is selected
    if (selectedDM) {
      return (
        <DirectMessageRoom
          dmId={selectedDM.id}
          participants={selectedDM.participants}
          user={user}
          roomName={selectedDM.name}
        />
      );
    }

    // Show ChatRoom when a room is selected
    if (selectedRoom) {
      return (
        <ChatRoom
          serverId={selectedRoom.serverId}
          roomId={selectedRoom.id}
          roomName={selectedRoom.name}
          user={user}
        />
      );
    }

    if (selectedServer) {
      return (
        <div className="text-center">
          <h2 className="text-2xl font-black mb-4 uppercase text-black dark:text-white">
            Server {selectedServer}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Select a room from the sidebar to start chatting.
          </p>
        </div>
      );
    }

    if (selectedTab === "friends") {
      return (
        <div className="text-center h-full flex items-center justify-center">
          <div className="max-w-md mx-auto">
            <h2 className="text-3xl font-black mb-6 uppercase text-black dark:text-white">
              Friends
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              Click the "Add Friend" button in the sidebar to search for
              friends, or select a friend to start chatting.
            </p>
            <div className="bg-blue-100 dark:bg-blue-900 border-4 border-black dark:border-gray-600 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(55,65,81,1)] p-6">
              <h3 className="text-lg font-black uppercase text-black dark:text-white mb-2">
                Getting Started
              </h3>
              <ul className="text-left text-sm text-gray-700 dark:text-gray-300 space-y-2">
                <li>
                  • Use the <strong>Add Friend</strong> button to search for
                  users
                </li>
                <li>• Send friend requests to connect with others</li>
                <li>• Click on friends to start private conversations</li>
                <li>• Recent conversations appear at the top of the list</li>
              </ul>
            </div>
          </div>
        </div>
      );
    }

    // Determine filter parameters for SocialFeed
    let filterTag = selectedFilterTag;
    let filterDescription = "";
    
    if (selectedFeed && selectedFeed.id !== "all") {
      // For custom feeds, we'll pass multiple tags as a comma-separated string
      // The SocialFeed component will need to be updated to handle this
      filterTag = selectedFeed.tags.join(",");
      filterDescription = `Feed: ${selectedFeed.name}`;
    } else if (selectedFilterTag) {
      filterDescription = `Tag: #${selectedFilterTag}`;
    }

    return (
      <div className="text-center flex items-center justify-center">
        <SocialFeed 
          user={user} 
          filterTag={filterTag}
          filterDescription={filterDescription}
        />
      </div>
    );
  };

  return (
    <div className="flex-1 bg-white dark:bg-gray-900 flex flex-col">
      {/* Top Bar */}
      <div className="bg-gray-800 dark:bg-gray-950 text-white px-6 py-4 border-b-4 border-black dark:border-gray-600 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {showServerSettings && onBackFromServerSettings && (
            <button
              onClick={onBackFromServerSettings}
              className="w-10 h-10 bg-gray-600 dark:bg-gray-700 border-2 border-black dark:border-gray-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
            >
              <FiArrowLeft size={18} className="text-white" />
            </button>
          )}
          {showFriendSearch && onBackFromFriendSearch && (
            <button
              onClick={onBackFromFriendSearch}
              className="w-10 h-10 bg-gray-600 dark:bg-gray-700 border-2 border-black dark:border-gray-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
            >
              <FiArrowLeft size={18} className="text-white" />
            </button>
          )}
          {selectedDM && onBackFromDM && (
            <button
              onClick={onBackFromDM}
              className="w-10 h-10 bg-gray-600 dark:bg-gray-700 border-2 border-black dark:border-gray-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
            >
              <FiArrowLeft size={18} className="text-white" />
            </button>
          )}
          {(selectedFeed || selectedFilterTag) && onBackFromFeed && (
            <button
              onClick={onBackFromFeed}
              className="w-10 h-10 bg-gray-600 dark:bg-gray-700 border-2 border-black dark:border-gray-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
            >
              <FiArrowLeft size={18} className="text-white" />
            </button>
          )}
          <div className="flex flex-col">
            <h1 className="text-xl font-black uppercase leading-tight">
              {getTitle()}
            </h1>
            {getSecondaryText() && (
              <p className="text-sm text-gray-300 dark:text-gray-400 leading-tight mt-1">
                {getSecondaryText()}
              </p>
            )}
          </div>
        </div>

        {/* Adaptable Toolbar Area */}
        <div className="flex items-center gap-3">
          {getToolbarButtons()}

          {/* Right Sidebar Toggle - Only show on desktop */}
          <button
            onClick={onToggleRightSidebar}
            className="hidden md:flex w-10 h-10 bg-purple-600 dark:bg-purple-700 border-2 border-black dark:border-gray-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all items-center justify-center"
            title="Toggle AI & Media Sidebar"
          >
            <FiSidebar size={18} className="text-white" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div
        className={`flex-1 flex flex-col ${
          showServerSettings || selectedRoom || showFriendSearch || selectedDM
            ? "overflow-hidden"
            : "overflow-y-auto p-8"
        }`}
      >
        {getContent()}
      </div>

      {/* Welcome Message
      {!selectedServer && (
        <div className="p-6 bg-gray-100 dark:bg-gray-800 border-t-4 border-black dark:border-gray-600">
          <p className="text-center text-gray-600 dark:text-gray-400">
            Welcome{" "}
            <span className="font-bold text-black dark:text-white">
              {user.displayName}
            </span>
            ! To the End Point.
          </p>
        </div>
      )} */}

      {/* Add Users to DM Modal */}
      {showAddUsersModal && selectedDM && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(55,65,81,1)] max-w-md w-full">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b-2 border-black dark:border-gray-600">
              <h3 className="text-xl font-black uppercase text-black dark:text-white">
                Add Users to {selectedDM.name}
              </h3>
              <button
                onClick={() => {
                  setShowAddUsersModal(false);
                  setSearchTerm("");
                  setSearchResults([]);
                  setSelectedUsers([]);
                }}
                className="w-8 h-8 bg-red-400 dark:bg-red-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
              >
                <FiX size={16} className="text-black dark:text-white" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {/* Search Bar */}
              <div className="relative mb-4">
                <FiSearch
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                  size={20}
                />
                <input
                  type="text"
                  placeholder="Search users by name or email..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    const timeoutId = setTimeout(
                      () => searchUsers(e.target.value),
                      300
                    );
                    return () => clearTimeout(timeoutId);
                  }}
                  className="w-full pl-10 pr-4 py-3 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] transition-all"
                />
              </div>
              ;{/* Search Results */}
              <div className="mb-4">
                {isSearching && (
                  <div className="text-center py-4 text-gray-600 dark:text-gray-400">
                    Searching users...
                  </div>
                )}

                {!isSearching && searchTerm && searchResults.length === 0 && (
                  <div className="text-center py-4 text-gray-600 dark:text-gray-400">
                    No users found matching "{searchTerm}"
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {searchResults.map((searchUser) => (
                      <div
                        key={searchUser.userId}
                        className={`flex items-center justify-between p-3 border-2 transition-all cursor-pointer ${
                          selectedUsers.includes(searchUser.userId)
                            ? "bg-green-100 dark:bg-green-900 border-green-500"
                            : "bg-gray-50 dark:bg-gray-700 border-black dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600"
                        }`}
                        onClick={() => {
                          if (selectedUsers.includes(searchUser.userId)) {
                            setSelectedUsers(
                              selectedUsers.filter(
                                (id) => id !== searchUser.userId
                              )
                            );
                          } else {
                            if (
                              selectedUsers.length +
                                selectedDM.participants.length <
                              10
                            ) {
                              setSelectedUsers([
                                ...selectedUsers,
                                searchUser.userId,
                              ]);
                            }
                          }
                        }}
                      >
                        <div>
                          <p className="font-bold text-black dark:text-white">
                            {searchUser.displayName}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {searchUser.email}
                          </p>
                        </div>
                        {selectedUsers.includes(searchUser.userId) && (
                          <div className="text-green-600 dark:text-green-400 font-bold">
                            ✓ Selected
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              ;{/* Current Participants Info */}
              <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-700 border-2 border-black dark:border-gray-600">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Current participants: {selectedDM.participants.length}/10
                </p>
                {selectedUsers.length > 0 && (
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    Adding {selectedUsers.length} user
                    {selectedUsers.length !== 1 ? "s" : ""}
                    (New total:{" "}
                    {selectedDM.participants.length + selectedUsers.length}/10)
                  </p>
                )}
              </div>
              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={addUsersToDM}
                  disabled={selectedUsers.length === 0}
                  className="flex-1 px-4 py-3 bg-green-400 dark:bg-green-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add {selectedUsers.length} User
                  {selectedUsers.length !== 1 ? "s" : ""}
                </button>
                <button
                  onClick={() => {
                    setShowAddUsersModal(false);
                    setSearchTerm("");
                    setSearchResults([]);
                    setSelectedUsers([]);
                  }}
                  className="px-4 py-3 bg-gray-400 dark:bg-gray-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Post Modal */}
      {showCreatePostModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <PostComposer
              user={user}
              onPostCreated={() => {
                setShowCreatePostModal(false);
              }}
              isFloating={true}
              onClose={() => setShowCreatePostModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ActionWindow;