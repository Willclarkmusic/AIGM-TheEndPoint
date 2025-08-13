import React, { useState, useEffect } from "react";
import {
  FiUserPlus,
  FiEdit,
  FiChevronDown,
  FiChevronRight,
  FiSettings,
} from "react-icons/fi";
import { FaHashtag, FaRobot, FaImage } from "react-icons/fa";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../firebase/config";

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
}

const InfoBar: React.FC<InfoBarProps> = ({
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

  // Mock data
  const friends = {
    recent: [
      { id: "1", name: "Alice", status: "online" },
      { id: "2", name: "Bob", status: "idle" },
      { id: "3", name: "Charlie", status: "away" },
    ],
    online: [
      { id: "4", name: "David", status: "online" },
      { id: "5", name: "Eve", status: "online" },
    ],
    idle: [{ id: "6", name: "Frank", status: "idle" }],
    away: [
      { id: "7", name: "Grace", status: "away" },
      { id: "8", name: "Henry", status: "away" },
    ],
  };

  const getRoomIcon = (type: string) => {
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
  };

  const getStatusColor = (status: string) => {
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
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const renderFriendsSection = (
    title: string,
    friendsList: any[],
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
            {friendsList.map((friend) => (
              <div
                key={friend.id}
                className="flex items-center gap-2 px-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-700 border-2 border-transparent hover:border-black dark:hover:border-gray-600 transition-all cursor-pointer"
                onClick={() => onContentItemClick?.()}
              >
                <div
                  className={`w-2 h-2 ${getStatusColor(
                    friend.status
                  )} border border-black rounded-full`}
                />
                <span className="font-medium text-sm text-black dark:text-white">
                  {friend.name}
                </span>
              </div>
            ))}
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
              Social Feed
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
                <button className="w-8 h-8 bg-green-400 dark:bg-green-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center">
                  <FiUserPlus
                    size={16}
                    className="text-black dark:text-white"
                  />
                </button>
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
                  Social Feed
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
};

export default InfoBar;
