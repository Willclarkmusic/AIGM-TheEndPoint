import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  FiUserPlus,
  FiEdit,
  FiChevronDown,
  FiChevronRight,
  FiSettings,
} from "react-icons/fi";
import { FaHashtag, FaRobot, FaImage } from "react-icons/fa";
import { collection, onSnapshot, query, orderBy, where, getDocs, limit } from "firebase/firestore";
import { db } from "../firebase/config";
import type { User } from "firebase/auth";
import { testFirestoreConnection, getPerformanceDiagnostics } from "../utils/performanceUtils";

interface InfoBarProps {
  width: number;
  selectedServer: string | null;
  selectedServerName?: string;
  selectedRoom?: string | null;
  selectedTab: "friends" | "feed";
  onTabChange: (tab: "friends" | "feed") => void;
  onContentItemClick?: () => void;
  onRoomSelect?: (roomId: string, roomName: string, serverId: string) => void;
  isMobile?: boolean;
  onServerSettings?: () => void;
  onAddFriendClick?: () => void;
  onFriendClick?: (friend: Friend) => void;
  user?: User;
}

interface Friend {
  id: string;
  name: string;
  email: string;
  status: "online" | "idle" | "away";
  lastMessage?: string;
  lastMessageTimestamp?: any;
}

interface RecentDM {
  id: string;
  name: string;
  participants: string[];
  lastMessage?: string;
  lastMessageTimestamp?: any;
}

const InfoBar: React.FC<InfoBarProps> = React.memo(({
  width,
  selectedServer,
  selectedServerName,
  selectedRoom,
  selectedTab,
  onTabChange,
  onContentItemClick,
  onRoomSelect,
  isMobile = false,
  onServerSettings,
  onAddFriendClick,
  onFriendClick,
  user,
}) => {
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    recent: true,
    online: true,
    idle: true,
    away: false,
    rooms: true,
  });

  const [rooms, setRooms] = useState<
    Array<{
      id: string;
      name: string;
      type: "chat" | "genai" | "ai-agent";
    }>
  >([]);
  
  const [friends, setFriends] = useState<{
    recent: RecentDM[];
    online: Friend[];
    idle: Friend[];
    away: Friend[];
  }>({
    recent: [],
    online: [],
    idle: [],
    away: [],
  });
  
  const [friendRequestCount, setFriendRequestCount] = useState(0);

  // Load rooms when server is selected
  useEffect(() => {
    if (!selectedServer) {
      setRooms([]);
      return;
    }

    const roomsRef = collection(db, `servers/${selectedServer}/chat_rooms`);
    const roomsQuery = query(roomsRef, orderBy("name"));

    const unsubscribe = onSnapshot(
      roomsQuery,
      (snapshot) => {
        const roomsList = snapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name || "Unnamed Room",
          type: doc.data().type || "chat",
        }));
        setRooms(roomsList);
      },
      (error) => {
        console.error("Error loading rooms:", error);
        setRooms([]);
      }
    );

    return () => unsubscribe();
  }, [selectedServer]);

  // Load friends data from Firestore subcollection with real-time updates
  useEffect(() => {
    if (!user?.uid) {
      setFriends({ recent: [], online: [], idle: [], away: [] });
      return;
    }

    // Listen to friends subcollection using user UID directly
    const setupFriendsListener = () => {
      // Listen to the friends subcollection using the user's UID
      const friendsRef = collection(db, `users/${user.uid}/friends`);
      
      const unsubscribeFriends = onSnapshot(
        friendsRef, 
        async (snapshot) => {
          try {
            if (snapshot.empty) {
              setFriends({ recent: [], online: [], idle: [], away: [] });
              return;
            }

            // Get friends directly from subcollection documents
            const friendsData: Friend[] = [];
            snapshot.forEach((doc) => {
              const friendData = doc.data();
              
              // Use the data directly from the friends subcollection
              friendsData.push({
                id: friendData.userId || friendData.uid || doc.id,
                name: friendData.name || "Unknown User",
                email: friendData.email || "",
                status: friendData.status || "away",
              });
            });

            if (friendsData.length === 0) {
              setFriends({ recent: [], online: [], idle: [], away: [] });
              return;
            }

          // Categorize friends by status
          const categorizedFriends = {
            recent: [] as RecentDM[],
            online: friendsData.filter(f => f.status === "online"),
            idle: friendsData.filter(f => f.status === "idle"),
            away: friendsData.filter(f => f.status === "away"),
          };

          // Load recent DMs
          try {
            const dmQuery = query(
              collection(db, "private_messages"),
              where("participants", "array-contains", user.uid),
              orderBy("lastMessageTimestamp", "desc"),
              limit(5)
            );

            const dmDocs = await getDocs(dmQuery);
            const recentDMs: RecentDM[] = [];

            dmDocs.forEach((doc) => {
              const dmData = doc.data();
              const otherParticipants = dmData.participants.filter((p: string) => p !== user.uid);

              if (otherParticipants.length > 0) {
                const friendData = friendsData.find(f => f.id === otherParticipants[0]);
                const dmName = otherParticipants.length === 1
                  ? (friendData?.name || "Unknown User")
                  : `Group (${otherParticipants.length + 1})`;

                recentDMs.push({
                  id: doc.id,
                  name: dmName,
                  participants: dmData.participants,
                  lastMessage: dmData.lastMessage,
                  lastMessageTimestamp: dmData.lastMessageTimestamp,
                });
              }
            });

            categorizedFriends.recent = recentDMs;
          } catch (dmError) {
            console.log("No DMs found or DM query failed:", dmError);
          }

          setFriends(categorizedFriends);

        } catch (error) {
          console.error("Error in friends listener:", error);
          setFriends({ recent: [], online: [], idle: [], away: [] });
        }
      });

      return unsubscribeFriends;
    };

    const unsubscribeFriends = setupFriendsListener();

    // Return cleanup function
    return () => {
      if (unsubscribeFriends) {
        unsubscribeFriends();
      }
    };
  }, [user?.uid]);
  
  // Load friend request count
  useEffect(() => {
    if (!user?.uid) {
      setFriendRequestCount(0);
      return;
    }

    const requestsRef = collection(db, "friend_requests");
    const requestsQuery = query(
      requestsRef,
      where("toUserId", "==", user.uid),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(requestsQuery, (snapshot) => {
      setFriendRequestCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Memoized helper functions to prevent recreation on every render
  const getRoomIcon = useMemo(() => (type: string) => {
    switch (type) {
      case "chat":
        return <FaHashtag size={14} />;
      case "genai":
        return <FaImage size={14} />;
      case "ai-agent":
        return <FaRobot size={14} />;
      default:
        return <FaHashtag size={14} />;
    }
  }, []);

  const getStatusColor = useMemo(() => (status: string) => {
    switch (status) {
      case "online":
        return "bg-green-500";
      case "idle":
        return "bg-yellow-500";
      case "away":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  }, []);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  const renderFriendsSection = (
    title: string,
    friendsList: (Friend | RecentDM)[],
    sectionKey: string
  ) => {
    const isExpanded = expandedSections[sectionKey];

    return (
      <div className="mb-4">
        <button
          onClick={() => toggleSection(sectionKey)}
          className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors uppercase mb-2"
        >
          {isExpanded ? (
            <FiChevronDown size={12} />
          ) : (
            <FiChevronRight size={12} />
          )}
          {title} ({friendsList.length})
        </button>
        {isExpanded && (
          <div className="space-y-1 ml-4">
            {friendsList.map((item) => {
              const isRecentDM = 'participants' in item;
              const friend = item as Friend;
              const dm = item as RecentDM;
              
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-2 px-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-700 border-2 border-transparent hover:border-black dark:hover:border-gray-600 transition-all cursor-pointer"
                  onClick={() => {
                    if (isRecentDM) {
                      // Open existing DM
                      onFriendClick?.({
                        id: dm.id,
                        name: dm.name,
                        email: "",
                        status: "online",
                        participants: dm.participants,
                      } as any);
                    } else {
                      // Start new DM with friend
                      onFriendClick?.(friend);
                    }
                    onContentItemClick?.();
                  }}
                >
                  {!isRecentDM && (
                    <div
                      className={`w-2 h-2 ${getStatusColor(
                        friend.status
                      )} border border-black rounded-full`}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm text-black dark:text-white block truncate">
                      {item.name}
                    </span>
                    {isRecentDM && dm.lastMessage && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 block truncate">
                        {dm.lastMessage}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`bg-gray-200 dark:bg-gray-800 border-r-2 md:border-r-2 border-r-0 border-black dark:border-gray-600 flex flex-col ${
        isMobile ? "flex-1" : ""
      }`}
      style={isMobile ? {} : { width }}
    >
      {selectedServer === null ? (
        // Home content
        <div className="p-4 h-full overflow-y-auto">
          {/* Tab Navigation */}
          <div className="flex mb-6">
            <button
              onClick={() => onTabChange("friends")}
              className={`flex-1 py-2 px-4 font-black text-sm border-2 border-black dark:border-gray-600 transition-all uppercase text-black dark:text-white ${
                selectedTab === "friends"
                  ? "bg-blue-400 dark:bg-blue-500 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)]"
                  : "bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600"
              }`}
            >
              Friends
            </button>
            <button
              onClick={() => onTabChange("feed")}
              className={`flex-1 py-2 px-4 font-black text-sm border-2 border-black dark:border-gray-600 border-l-0 transition-all uppercase text-black dark:text-white ${
                selectedTab === "feed"
                  ? "bg-orange-400 dark:bg-orange-500 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)]"
                  : "bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600"
              }`}
            >
              Social
            </button>
          </div>

          {selectedTab === "friends" ? (
            // Friends Tab Content
            <div>
              {/* Friends Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-black text-lg uppercase text-black dark:text-white">
                  Friends
                </h2>
                <div className="relative">
                  <button 
                    onClick={onAddFriendClick}
                    className="w-8 h-8 bg-green-400 dark:bg-green-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
                  >
                    <FiUserPlus
                      size={16}
                      className="text-black dark:text-white"
                    />
                  </button>
                  {friendRequestCount > 0 && (
                    <div className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 border-2 border-black dark:border-gray-600 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-white">
                        {friendRequestCount > 9 ? "9+" : friendRequestCount}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Friends Lists */}
              {renderFriendsSection("Recent DMs", friends.recent, "recent")}
              {renderFriendsSection("Online", friends.online, "online")}
              {renderFriendsSection("Idle", friends.idle, "idle")}
              {renderFriendsSection("Away", friends.away, "away")}
            </div>
          ) : (
            // Social Feed Tab Content
            <div>
              {/* Feed Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-black text-lg uppercase text-black dark:text-white">
                  Social
                </h2>
                <button className="w-8 h-8 bg-purple-400 dark:bg-purple-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center">
                  <FiEdit size={16} className="text-black dark:text-white" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search users or tags..."
                  className="w-full px-3 py-2 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] transition-all"
                />
              </div>

              {/* Performance Test Button */}
              <div className="mb-4">
                <button
                  onClick={async () => {
                    console.log("🔧 Running performance diagnostics...");
                    console.log("System info:", getPerformanceDiagnostics());
                    const result = await testFirestoreConnection();
                    
                    if (result.success) {
                      alert(`Connection Test Results:\n\nRead: ${result.readLatency.toFixed(2)}ms\nWrite: ${result.writeLatency.toFixed(2)}ms\nDelete: ${result.deleteLatency.toFixed(2)}ms\nTotal: ${result.totalLatency.toFixed(2)}ms\n\n${result.totalLatency > 2000 ? '⚠️ Slow connection detected!' : '✅ Connection looks good!'}`);
                    } else {
                      alert(`Connection Test Failed!\n\nError: ${result.error}\n\nCheck console for details.`);
                    }
                  }}
                  className="w-full px-3 py-2 bg-orange-400 dark:bg-orange-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white text-sm"
                >
                  🧪 Test DB Performance
                </button>
              </div>

              {/* Public Rooms Section */}
              <div className="mb-6">
                <h3 className="font-bold text-sm text-gray-700 dark:text-gray-300 uppercase mb-2">
                  Public Rooms
                </h3>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Browse public rooms...
                </div>
              </div>

              {/* Subscription Feed */}
              <div>
                <h3 className="font-bold text-sm text-gray-700 dark:text-gray-300 uppercase mb-2">
                  Your Feed
                </h3>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  No posts yet. Subscribe to users or tags to see content here.
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        // Server content
        <div className="p-4 h-full overflow-y-auto">
          {/* Server Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-black text-lg uppercase text-black dark:text-white truncate">
              {selectedServerName || "Server"}
            </h2>
            <button
              onClick={onServerSettings}
              className="w-8 h-8 bg-purple-400 dark:bg-purple-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
              title="Server Settings"
            >
              <FiSettings size={16} className="text-black dark:text-white" />
            </button>
          </div>

          {/* Rooms Section */}
          <div>
            <button
              onClick={() => toggleSection("rooms")}
              className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors uppercase mb-4"
            >
              {expandedSections.rooms ? (
                <FiChevronDown size={12} />
              ) : (
                <FiChevronRight size={12} />
              )}
              Rooms ({rooms.length})
            </button>

            {expandedSections.rooms && (
              <div className="space-y-2 ml-4">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className={`flex items-center gap-3 px-3 py-2 hover:bg-gray-300 dark:hover:bg-gray-700 border-2 transition-all cursor-pointer ${
                      selectedRoom === room.id
                        ? "bg-blue-200 dark:bg-blue-800 border-black dark:border-gray-600"
                        : "border-transparent hover:border-black dark:hover:border-gray-600"
                    }`}
                    onClick={() => {
                      if (selectedServer && onRoomSelect) {
                        onRoomSelect(room.id, room.name, selectedServer);
                      }
                      onContentItemClick?.();
                    }}
                  >
                    <div className="text-gray-600 dark:text-gray-400">
                      {getRoomIcon(room.type)}
                    </div>
                    <span className="font-medium text-sm text-black dark:text-white">
                      {room.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

InfoBar.displayName = 'InfoBar';

export default InfoBar;
