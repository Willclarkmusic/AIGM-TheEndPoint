import React, { useState, useEffect, useRef } from "react";
import type { User } from "firebase/auth";
import { doc, updateDoc, serverTimestamp, onSnapshot, query, where, getDocs, setDoc, collectionGroup, getDoc, collection } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { db, auth } from "../firebase/config";
import ServerBar from "./ServerBar";
import InfoBar from "./InfoBar";
import ActionWindow from "./ActionWindow";
import RightSidebar from "./RightSidebar";
import MobileHeader from "./MobileHeader";
import MobileFooter from "./MobileFooter";
import MobileServerBar from "./MobileServerBar";
import { useTheme } from "../contexts/ThemeContext";
import CreateServerModal from "./CreateServerModal";
import ServerSettingsModal from "./ServerSettingsModal";
import { FiSun, FiMoon, FiLogOut } from "react-icons/fi";
import { findOrCreateDMRoom, getDMDisplayName } from "../utils/dmUtils";

interface HomeScreenProps {
  user: User;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ user }) => {
  const { theme, toggleTheme } = useTheme();
  const [serverBarWidth, setServerBarWidth] = useState(64); // Default 64px (w-16)
  const [infoBarWidth, setInfoBarWidth] = useState(240);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(320);
  const [showRightSidebar, setShowRightSidebar] = useState(false);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<"friends" | "feed" | "invites">("friends");
  const [userStatus, setUserStatus] = useState<string>("online");
  const [customStatus, setCustomStatus] = useState<{
    title: string;
    color: string;
  } | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customColor, setCustomColor] = useState("#9333EA");

  // Mobile states
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [mobileFooterTab, setMobileFooterTab] = useState<
    "profile" | "settings" | null
  >(null);
  const [showMobileProfile, setShowMobileProfile] = useState(false);
  const [showMobileSettings, setShowMobileSettings] = useState(false);

  const isResizingServer = useRef(false);
  const isResizingInfo = useRef(false);
  const isResizingRight = useRef(false);
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);

  // Server management states
  const [servers, setServers] = useState<
    { id: string; name: string; icon: string; role: string }[]
  >([]);
  const [showCreateServerModal, setShowCreateServerModal] = useState(false);
  const [showServerSettingsModal, setShowServerSettingsModal] = useState(false);
  const [showServerSettingsView, setShowServerSettingsView] = useState(false);
  const [selectedServerData, setSelectedServerData] = useState<{
    id: string;
    name: string;
    role: "owner" | "admin" | "member" | null;
  } | null>(null);

  // Room selection state
  const [selectedRoom, setSelectedRoom] = useState<{
    id: string;
    name: string;
    serverId: string;
  } | null>(null);

  // Friends and DM states
  const [showFriendSearch, setShowFriendSearch] = useState(false);
  const [selectedDM, setSelectedDM] = useState<{
    id: string;
    name: string;
    participants: string[];
  } | null>(null);

  // Feed and tag states
  const [selectedFeed, setSelectedFeed] = useState<{
    id: string;
    name: string;
    tags: string[];
  } | null>(null);
  const [selectedFilterTag, setSelectedFilterTag] = useState<string | null>(null);

  // Update user presence on activity
  const updatePresence = async () => {
    if (user && userStatus === "online") {
      try {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
          lastSeen: serverTimestamp(),
          status: "online",
        });
      } catch (error) {
        console.error("Error updating presence:", error);
      }
    }
  };

  // Reset inactivity timer
  const resetInactivityTimer = () => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }

    updatePresence();

    // Set timer for 5 minutes of inactivity
    inactivityTimer.current = setTimeout(() => {
      updatePresence();
    }, 5 * 60 * 1000);
  };

  // Listen for user activity
  useEffect(() => {
    const handleActivity = () => {
      resetInactivityTimer();
    };

    // Add event listeners for user activity
    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("click", handleActivity);
    window.addEventListener("scroll", handleActivity);

    // Initial presence update
    updatePresence();
    resetInactivityTimer();

    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("scroll", handleActivity);

      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
    };
  }, [user, userStatus]);

  // Initialize user document and listen to status changes
  useEffect(() => {
    if (!user) return;

    const initializeUser = async () => {
      try {
        const userRef = doc(db, "users", user.uid);

        // Create user document if it doesn't exist
        await setDoc(
          userRef,
          {
            userId: user.uid, // Add userId field for queries
            uid: user.uid,
            email: user.email || "",
            displayName:
              user.displayName || user.email?.split("@")[0] || "User",
            status: "online",
            lastSeen: serverTimestamp(),
            createdAt: serverTimestamp(),
            customStatus: null,
            friends: [], // Initialize empty friends array
          },
          { merge: true }
        ); // Use merge to avoid overwriting existing data

        console.log("User document initialized");
      } catch (error) {
        console.error("Error initializing user document:", error);
      }
    };

    // Initialize user first, then set up listener
    initializeUser().then(() => {
      const userRef = doc(db, "users", user.uid);
      const unsubscribe = onSnapshot(userRef, (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          setUserStatus(data.status || "online");
          if (data.customStatus) {
            setCustomStatus(data.customStatus);
            setCustomTitle(data.customStatus.title);
            setCustomColor(data.customStatus.color);
          } else {
            setCustomStatus(null);
          }
        }
      });

      return () => unsubscribe();
    });
  }, [user]);

  // Load user's servers using optimized batch query
  useEffect(() => {
    if (!user?.uid) return;

    const loadUserServers = async () => {
      try {
        console.log("Loading servers for user:", user.uid);

        // Query all member documents where userId equals current user
        const membersQuery = query(
          collectionGroup(db, "members"),
          where("userId", "==", user.uid)
        );

        const membersSnapshot = await getDocs(membersQuery);
        console.log("Found", membersSnapshot.size, "memberships");

        // Extract all server IDs and member data
        const serverMemberMap = new Map<string, string>();
        const serverIds: string[] = [];

        for (const memberDoc of membersSnapshot.docs) {
          const memberData = memberDoc.data();
          const serverId = memberDoc.ref.parent.parent?.id;
          
          if (serverId) {
            serverIds.push(serverId);
            serverMemberMap.set(serverId, memberData.role);
          }
        }

        if (serverIds.length === 0) {
          setServers([]);
          console.log("No servers found for user");
          return;
        }

        // OPTIMIZED: Batch fetch all servers using Promise.all
        const serverPromises = serverIds.map(serverId => 
          getDoc(doc(db, "servers", serverId))
        );
        
        const serverDocs = await Promise.all(serverPromises);
        
        const userServersList: {
          id: string;
          name: string;
          icon: string;
          role: string;
        }[] = [];

        serverDocs.forEach((serverDoc, index) => {
          if (serverDoc.exists()) {
            const serverData = serverDoc.data();
            const serverId = serverIds[index];
            const role = serverMemberMap.get(serverId);

            userServersList.push({
              id: serverId,
              name: serverData.name,
              icon:
                serverData.name.charAt(0).toUpperCase() +
                (serverData.name.charAt(1) || "").toUpperCase(),
              role: role || "member",
            });

            console.log(
              "Added server:",
              serverData.name,
              "with role:",
              role
            );
          } else {
            console.warn("Server document not found:", serverIds[index]);
          }
        });

        setServers(userServersList);
        console.log("Loaded", userServersList.length, "servers");
      } catch (error) {
        console.error("Error loading user servers:", error);
      }
    };

    // Remove artificial delay - use proper dependency instead
    loadUserServers();
  }, [user?.uid]);

  // Handle server creation
  const handleServerCreated = (serverId: string) => {
    console.log("Server created or joined:", serverId);
    // Auto-select the new server - the real-time listener will update the list
    setSelectedServer(serverId);
  };

  // Handle server deletion
  const handleServerDeleted = () => {
    setSelectedServer(null);
    setShowServerSettingsModal(false);
    setShowServerSettingsView(false);
    setSelectedServerData(null);
    // The real-time listener will automatically update the server list
  };

  // Handle server settings click
  const handleServerSettings = async (serverId: string) => {
    const server = servers.find((s) => s.id === serverId);
    if (server) {
      try {
        // Fetch member count
        const membersRef = collection(db, `servers/${serverId}/members`);
        const membersSnapshot = await getDocs(membersRef);
        const memberCount = membersSnapshot.size;

        setSelectedServerData({
          id: server.id,
          name: server.name,
          role: server.role as "owner" | "admin" | "member",
          memberCount: memberCount,
        });
        setShowServerSettingsView(true);
        setSelectedRoom(null); // Clear room selection when opening server settings
      } catch (error) {
        console.error("Error loading server member count:", error);
        // Fall back to setting data without member count
        setSelectedServerData({
          id: server.id,
          name: server.name,
          role: server.role as "owner" | "admin" | "member",
        });
        setShowServerSettingsView(true);
        setSelectedRoom(null);
      }
    }
  };

  // Handle room selection
  const handleRoomSelect = async (
    roomId: string,
    roomName: string,
    serverId: string
  ) => {
    try {
      // Fetch room details to get type and other info
      const roomRef = doc(db, `servers/${serverId}/chat_rooms/${roomId}`);
      const roomDoc = await getDoc(roomRef);
      
      // Get member count for the server (rooms don't have separate member counts)
      const membersRef = collection(db, `servers/${serverId}/members`);
      const membersSnapshot = await getDocs(membersRef);
      const memberCount = membersSnapshot.size;

      let roomType = "chat"; // default
      if (roomDoc.exists()) {
        roomType = roomDoc.data().type || "chat";
      }

      setSelectedRoom({
        id: roomId,
        name: roomName,
        serverId: serverId,
        type: roomType,
        memberCount: memberCount,
      });
    } catch (error) {
      console.error("Error loading room details:", error);
      // Fall back to basic room data
      setSelectedRoom({
        id: roomId,
        name: roomName,
        serverId: serverId,
      });
    }
    
    setShowServerSettingsView(false); // Close server settings if open
    setShowFriendSearch(false); // Close friend search if open
    setSelectedDM(null); // Close DM if open
    setShowMobileSidebar(false); // Close mobile sidebar when selecting room
  };

  // Handle Add Friend button click
  const handleAddFriendClick = () => {
    setShowFriendSearch(true);
    setSelectedRoom(null); // Close room if open
    setShowServerSettingsView(false); // Close server settings if open
    setSelectedDM(null); // Close DM if open
    setShowMobileSidebar(false); // Close mobile sidebar
  };

  // Handle friend click to open DM
  const handleFriendClick = async (friend: any) => {
    try {
      let dmId: string;
      let participants: string[];
      
      if (friend.participants) {
        // Existing DM room
        dmId = friend.id;
        participants = friend.participants;
      } else {
        // Create new DM with friend
        const dmRoom = await findOrCreateDMRoom(user.uid, friend.id);
        dmId = dmRoom.dmId;
        participants = dmRoom.participants;
      }
      
      // Get display name for the DM
      const dmName = friend.participants 
        ? friend.name 
        : await getDMDisplayName(dmId, participants, user.uid);
      
      setSelectedDM({
        id: dmId,
        name: dmName,
        participants: participants,
      });
      
      setSelectedRoom(null); // Close room if open
      setShowServerSettingsView(false); // Close server settings if open
      setShowFriendSearch(false); // Close friend search if open
      setShowMobileSidebar(false); // Close mobile sidebar
    } catch (error) {
      console.error("Error opening DM:", error);
      alert("Failed to open direct message. Please try again.");
    }
  };

  // Handle feed selection
  const handleFeedSelect = (feed: { id: string; name: string; tags: string[] }) => {
    setSelectedFeed(feed);
    setSelectedFilterTag(null); // Clear single tag filter when selecting feed
    setSelectedDM(null); // Close DM if open
    setSelectedRoom(null); // Close room if open  
    setSelectedTab("feed"); // Switch to feed tab
    setShowFriendSearch(false);
    setShowServerSettingsView(false);
    setShowMobileSidebar(false);
  };

  // Handle single tag selection
  const handleTagSelect = (tag: string) => {
    setSelectedFilterTag(tag);
    setSelectedFeed(null); // Clear feed filter when selecting single tag
    setSelectedDM(null); // Close DM if open
    setSelectedRoom(null); // Close room if open
    setSelectedTab("feed"); // Switch to feed tab
    setShowFriendSearch(false);
    setShowServerSettingsView(false);
    setShowMobileSidebar(false);
  };

  // Handle back from feed/tag view
  const handleBackFromFeed = () => {
    setSelectedFeed(null);
    setSelectedFilterTag(null);
  };

  // Handle resizing of ServerBar
  const handleServerMouseDown = (e: React.MouseEvent) => {
    isResizingServer.current = true;
    e.preventDefault();
  };

  // Handle resizing of InfoBar
  const handleInfoMouseDown = (e: React.MouseEvent) => {
    isResizingInfo.current = true;
    e.preventDefault();
  };

  // Handle resizing of RightSidebar
  const handleRightMouseDown = (e: React.MouseEvent) => {
    isResizingRight.current = true;
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingServer.current) {
        const newWidth = e.clientX;
        // Constrain ServerBar width between 64px (default) and 96px
        if (newWidth >= 64 && newWidth <= 96) {
          setServerBarWidth(newWidth);
        }
      } else if (isResizingInfo.current) {
        const newWidth = e.clientX - serverBarWidth;
        if (newWidth >= 180 && newWidth <= 400) {
          setInfoBarWidth(newWidth);
        }
      } else if (isResizingRight.current) {
        const newWidth = window.innerWidth - e.clientX;
        if (newWidth >= 280 && newWidth <= 500) {
          setRightSidebarWidth(newWidth);
        }
      }
    };

    const handleMouseUp = () => {
      isResizingServer.current = false;
      isResizingInfo.current = false;
      isResizingRight.current = false;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [serverBarWidth, rightSidebarWidth]);

  // Mobile footer handlers
  const handleMobileFooterClick = (tab: "profile" | "settings") => {
    if (mobileFooterTab === tab) {
      // If clicking the same tab, deselect it
      setMobileFooterTab(null);
      setShowMobileProfile(false);
      setShowMobileSettings(false);
    } else {
      setMobileFooterTab(tab);
      setShowMobileProfile(tab === "profile");
      setShowMobileSettings(tab === "settings");
      setShowMobileSidebar(false);
    }
  };

  // Get title for mobile header
  const getMobileTitle = () => {
    if (showFriendSearch) return "Find Friends";
    if (selectedDM) return selectedDM.name;
    if (selectedServer) return `Server ${selectedServer}`;
    return selectedTab === "friends" ? "Friends" : "Social Feed";
  };

  return (
    <>
      {/* Mobile Header - Only visible on mobile */}
      <MobileHeader
        title={getMobileTitle()}
        showSidebar={showMobileSidebar}
        onToggleSidebar={() => setShowMobileSidebar(!showMobileSidebar)}
      />

      {/* Main Layout */}
      <div className="flex h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden pt-16 pb-16 md:pt-0 md:pb-0">
        {/* Mobile Sidebar Overlay */}
        {showMobileSidebar && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
            onClick={() => setShowMobileSidebar(false)}
          />
        )}

        {/* Mobile Sidebar - Only visible on mobile */}
        <div
          className={`fixed left-0 top-16 bottom-16 right-0 w-full z-40 flex bg-white dark:bg-gray-900 transition-transform duration-300 md:hidden ${
            showMobileSidebar
              ? "translate-x-0"
              : "-translate-x-full"
          }`}
        >
          {/* Mobile Server Bar */}
          <MobileServerBar
            servers={servers}
            selectedServer={selectedServer}
            onServerSelect={(serverId) => {
              setSelectedServer(serverId);
              setSelectedRoom(null); // Clear room selection when changing servers
              setShowServerSettingsView(false); // Close server settings if open
              setShowFriendSearch(false); // Close friend search if open
              setSelectedDM(null); // Close DM if open
              // Don't close menu when selecting servers
              // Reset mobile footer when selecting home or a server
              setMobileFooterTab(null);
              setShowMobileProfile(false);
              setShowMobileSettings(false);
            }}
            onCreateServer={() => setShowCreateServerModal(true)}
          />

          {/* Mobile Info Bar */}
          <div className="flex flex-1">
            <InfoBar
              width={infoBarWidth}
              selectedServer={selectedServer}
              selectedServerName={
                servers.find((s) => s.id === selectedServer)?.name
              }
              selectedRoom={selectedRoom?.id || null}
              selectedTab={selectedTab}
              onTabChange={(tab) => {
                setSelectedTab(tab);
                // Don't close menu when changing tabs
              }}
              onContentItemClick={() => {
                // Close menu when clicking content items (friends, rooms, etc.)
                setShowMobileSidebar(false);
              }}
              onRoomSelect={handleRoomSelect}
              isMobile={showMobileSidebar}
              onServerSettings={() => {
                if (selectedServer) {
                  handleServerSettings(selectedServer);
                }
              }}
              onAddFriendClick={handleAddFriendClick}
              onFriendClick={handleFriendClick}
              user={user}
              onCreatePost={() => {
                // This will be handled by ActionWindow's create post modal
                setShowMobileSidebar(false);
              }}
              onFeedSelect={handleFeedSelect}
              onTagSelect={handleTagSelect}
              selectedFeed={selectedFeed}
            />
          </div>
        </div>

        {/* Desktop Sidebars - Only visible on desktop */}
        <div className="hidden md:flex">
          {/* Desktop Server Bar with resize handle */}
          <div className="flex">
            <ServerBar
              width={serverBarWidth}
              user={user}
              userStatus={userStatus}
              customStatus={customStatus}
              onServerSelect={(serverId) => {
                setSelectedServer(serverId);
                setSelectedRoom(null); // Clear room selection when changing servers
                setShowServerSettingsView(false); // Close server settings if open
                setShowMobileSidebar(false);
              }}
              selectedServer={selectedServer}
              onStatusChange={(status) => setUserStatus(status)}
              onCustomStatusChange={(custom) => setCustomStatus(custom)}
              servers={servers}
              onCreateServer={() => setShowCreateServerModal(true)}
            />

            {/* Resize Handle for ServerBar */}
            <div
              className="w-1 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 cursor-col-resize transition-colors"
              onMouseDown={handleServerMouseDown}
            />
          </div>

          {/* Desktop Info Bar */}
          <div className="flex flex-1">
            <InfoBar
              width={infoBarWidth}
              selectedServer={selectedServer}
              selectedServerName={
                servers.find((s) => s.id === selectedServer)?.name
              }
              selectedRoom={selectedRoom?.id || null}
              selectedTab={selectedTab}
              onTabChange={(tab) => {
                setSelectedTab(tab);
                // Don't close menu when changing tabs
              }}
              onContentItemClick={() => {
                // Close menu when clicking content items (friends, rooms, etc.)
                setShowMobileSidebar(false);
              }}
              onRoomSelect={handleRoomSelect}
              isMobile={false}
              onServerSettings={() => {
                if (selectedServer) {
                  handleServerSettings(selectedServer);
                }
              }}
              onAddFriendClick={handleAddFriendClick}
              onFriendClick={handleFriendClick}
              user={user}
              onCreatePost={() => {
                // This will be handled by ActionWindow's create post modal
                setShowMobileSidebar(false);
              }}
              onFeedSelect={handleFeedSelect}
              onTagSelect={handleTagSelect}
              selectedFeed={selectedFeed}
            />

            {/* Resize Handle for InfoBar - Desktop only */}
            <div
              className="w-1 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 cursor-col-resize transition-colors"
              onMouseDown={handleInfoMouseDown}
            />
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex">
          {/* Show different content based on mobile footer selection */}
          {mobileFooterTab === "profile" && showMobileProfile ? (
            <div className="flex-1 overflow-y-auto md:hidden">
              <div className="p-4">
                <div className="bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(55,65,81,1)] p-6">
                  <h2 className="text-2xl font-black mb-6 uppercase text-black dark:text-white">
                    Profile
                  </h2>

                  {/* User Info */}
                  <div className="space-y-6">
                    <div>
                      <p className="font-bold text-black dark:text-white mb-1">
                        Email
                      </p>
                      <p className="text-gray-600 dark:text-gray-400">
                        {user.email}
                      </p>
                    </div>

                    {/* Status Section */}
                    <div>
                      <p className="font-bold text-black dark:text-white mb-3 uppercase">
                        Status
                      </p>

                      {/* Preset Status Options */}
                      <div className="space-y-2 mb-4">
                        <button
                          onClick={async () => {
                            setUserStatus("online");
                            setCustomStatus(null);
                            setShowCustomForm(false);
                            const userRef = doc(db, "users", user.uid);
                            await updateDoc(userRef, {
                              status: "online",
                              customStatus: null,
                            });
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 border-2 border-black dark:border-gray-600 ${
                            userStatus === "online" && !customStatus
                              ? "bg-gray-200 dark:bg-gray-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)]"
                              : "hover:bg-gray-100 dark:hover:bg-gray-700"
                          } transition-all`}
                        >
                          <div className="w-3 h-3 bg-green-500 border border-black rounded-full" />
                          <span className="font-bold text-black dark:text-white">
                            Online
                          </span>
                        </button>

                        <button
                          onClick={async () => {
                            setUserStatus("idle");
                            setCustomStatus(null);
                            setShowCustomForm(false);
                            const userRef = doc(db, "users", user.uid);
                            await updateDoc(userRef, {
                              status: "idle",
                              customStatus: null,
                            });
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 border-2 border-black dark:border-gray-600 ${
                            userStatus === "idle" && !customStatus
                              ? "bg-gray-200 dark:bg-gray-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)]"
                              : "hover:bg-gray-100 dark:hover:bg-gray-700"
                          } transition-all`}
                        >
                          <div className="w-3 h-3 bg-yellow-500 border border-black rounded-full" />
                          <span className="font-bold text-black dark:text-white">
                            Idle
                          </span>
                        </button>

                        <button
                          onClick={async () => {
                            setUserStatus("away");
                            setCustomStatus(null);
                            setShowCustomForm(false);
                            const userRef = doc(db, "users", user.uid);
                            await updateDoc(userRef, {
                              status: "away",
                              customStatus: null,
                            });
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 border-2 border-black dark:border-gray-600 ${
                            userStatus === "away" && !customStatus
                              ? "bg-gray-200 dark:bg-gray-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)]"
                              : "hover:bg-gray-100 dark:hover:bg-gray-700"
                          } transition-all`}
                        >
                          <div className="w-3 h-3 bg-red-500 border border-black rounded-full" />
                          <span className="font-bold text-black dark:text-white">
                            Away
                          </span>
                        </button>

                        {/* Custom Status Button */}
                        <button
                          onClick={() => {
                            setShowCustomForm(!showCustomForm);
                            if (customStatus) {
                              setCustomTitle(customStatus.title);
                              setCustomColor(customStatus.color);
                            }
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 border-2 border-black dark:border-gray-600 ${
                            userStatus === "custom" && customStatus
                              ? "bg-gray-200 dark:bg-gray-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)]"
                              : "hover:bg-gray-100 dark:hover:bg-gray-700"
                          } transition-all`}
                        >
                          <div
                            className="w-3 h-3 border border-black rounded-full"
                            style={{
                              backgroundColor:
                                customStatus?.color || customColor,
                            }}
                          />
                          <span className="font-bold text-black dark:text-white">
                            {customStatus
                              ? customStatus.title
                              : "Custom Status"}
                          </span>
                        </button>
                      </div>

                      {/* Custom Status Form */}
                      {showCustomForm && (
                        <div className="border-t-2 border-black dark:border-gray-600 pt-4 space-y-3">
                          <div>
                            <label className="block text-sm font-bold mb-1 uppercase text-black dark:text-white">
                              Status Text
                            </label>
                            <input
                              type="text"
                              value={customTitle}
                              onChange={(e) => setCustomTitle(e.target.value)}
                              placeholder="Enter custom status..."
                              className="w-full px-3 py-2 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)]"
                              maxLength={20}
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-bold mb-1 uppercase text-black dark:text-white">
                              Color
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                              {[
                                "#10B981", // green
                                "#F59E0B", // yellow
                                "#EF4444", // red
                                "#9333EA", // purple
                                "#3B82F6", // blue
                                "#EC4899", // pink
                                "#8B5CF6", // violet
                                "#6366F1", // indigo
                              ].map((color) => (
                                <button
                                  key={color}
                                  onClick={() => setCustomColor(color)}
                                  className={`w-10 h-10 border-2 border-black dark:border-gray-600 ${
                                    customColor === color
                                      ? "shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)]"
                                      : "hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)]"
                                  } transition-all`}
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </div>
                          </div>

                          <button
                            onClick={async () => {
                              if (customTitle.trim()) {
                                const custom = {
                                  title: customTitle,
                                  color: customColor,
                                };
                                setUserStatus("custom");
                                setCustomStatus(custom);
                                setShowCustomForm(false);
                                const userRef = doc(db, "users", user.uid);
                                await updateDoc(userRef, {
                                  status: "custom",
                                  customStatus: custom,
                                });
                              }
                            }}
                            disabled={!customTitle.trim()}
                            className="w-full bg-purple-400 dark:bg-purple-500 text-black dark:text-white font-bold py-2 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase"
                          >
                            Set Custom Status
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : mobileFooterTab === "settings" && showMobileSettings ? (
            <div className="flex-1 p-4 md:hidden">
              <div className="bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(55,65,81,1)] p-6">
                <h2 className="text-2xl font-black mb-4 uppercase text-black dark:text-white">
                  Settings
                </h2>
                <div className="space-y-2">
                  <button
                    onClick={toggleTheme}
                    className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 font-bold text-black dark:text-white rounded border-2 border-black dark:border-gray-600 flex items-center gap-3"
                  >
                    {theme === "light" ? (
                      <FiMoon
                        size={20}
                        className="text-black dark:text-white"
                      />
                    ) : (
                      <FiSun size={20} className="text-black dark:text-white" />
                    )}
                    {theme === "light" ? "Dark Mode" : "Light Mode"}
                  </button>
                  <button className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 font-bold text-black dark:text-white rounded border-2 border-black dark:border-gray-600">
                    Account Settings
                  </button>
                  <button className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 font-bold text-black dark:text-white rounded border-2 border-black dark:border-gray-600">
                    Server Settings
                  </button>
                  <button className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 font-bold text-black dark:text-white rounded border-2 border-black dark:border-gray-600">
                    Notification Settings
                  </button>
                  <hr className="my-4 border-gray-300 dark:border-gray-600" />
                  <button
                    onClick={async () => {
                      try {
                        await signOut(auth);
                        console.log("User signed out from mobile");
                      } catch (error) {
                        console.error("Error signing out:", error);
                      }
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-red-100 dark:hover:bg-red-900 font-bold text-red-600 dark:text-red-400 rounded border-2 border-red-500 flex items-center gap-3"
                  >
                    <FiLogOut size={20} />
                    Log Out
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <ActionWindow
              selectedServer={selectedServer}
              selectedTab={selectedTab}
              user={user}
              showServerSettings={showServerSettingsView}
              selectedServerData={selectedServerData}
              selectedRoom={selectedRoom}
              showFriendSearch={showFriendSearch}
              selectedDM={selectedDM}
              userRole={
                selectedServer 
                  ? servers.find(s => s.id === selectedServer)?.role as "owner" | "admin" | "member" | null 
                  : null
              }
              onBackFromServerSettings={() => {
                setShowServerSettingsView(false);
                setSelectedServerData(null);
              }}
              onServerDeleted={() => {
                setShowServerSettingsView(false);
                setSelectedServerData(null);
                setSelectedServer(null);
              }}
              onBackFromFriendSearch={() => {
                setShowFriendSearch(false);
              }}
              onBackFromDM={() => {
                setSelectedDM(null);
              }}
              onToggleRightSidebar={() => setShowRightSidebar(!showRightSidebar)}
              selectedFeed={selectedFeed}
              selectedFilterTag={selectedFilterTag}
              onBackFromFeed={handleBackFromFeed}
            />
          )}
        </div>

        {/* Right Sidebar - Only visible on desktop */}
        {showRightSidebar && (
          <div className="hidden md:flex">
            {/* Resize Handle for RightSidebar */}
            <div
              className="w-1 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 cursor-col-resize transition-colors"
              onMouseDown={handleRightMouseDown}
            />
            
            <RightSidebar
              width={rightSidebarWidth}
              isCollapsed={false}
              onToggleCollapse={() => setShowRightSidebar(false)}
              user={user}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateServerModal
        isOpen={showCreateServerModal}
        onClose={() => setShowCreateServerModal(false)}
        user={user}
        onServerCreated={handleServerCreated}
      />

      {selectedServerData && (
        <ServerSettingsModal
          isOpen={showServerSettingsModal}
          onClose={() => {
            setShowServerSettingsModal(false);
            setSelectedServerData(null);
          }}
          user={user}
          serverId={selectedServerData.id}
          serverName={selectedServerData.name}
          userRole={selectedServerData.role}
          onServerDeleted={handleServerDeleted}
        />
      )}

      {/* Mobile Footer - Only visible on mobile */}
      <MobileFooter
        user={user}
        userStatus={userStatus}
        customStatus={customStatus}
        onProfileClick={() => handleMobileFooterClick("profile")}
        onSettingsClick={() => handleMobileFooterClick("settings")}
        selectedTab={mobileFooterTab}
      />
    </>
  );
};

export default HomeScreen;