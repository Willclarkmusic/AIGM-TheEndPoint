import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  FiUserPlus,
  FiEdit,
  FiChevronDown,
  FiChevronRight,
  FiSettings,
  FiPlus,
  FiSearch,
  FiHash,
  FiEdit3,
} from "react-icons/fi";
import { FaHashtag, FaRobot, FaImage } from "react-icons/fa";
import { collection, onSnapshot, query, orderBy, where, getDocs, limit, doc, deleteDoc, addDoc, setDoc, serverTimestamp, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../firebase/config";
import type { User } from "firebase/auth";
import FeedModal from "./FeedModal";
import { searchTags } from "../utils/migrateTags";

interface InfoBarProps {
  width: number;
  selectedServer: string | null;
  selectedServerName?: string;
  selectedRoom?: string | null;
  selectedTab: "friends" | "feed" | "invites";
  onTabChange: (tab: "friends" | "feed" | "invites") => void;
  onContentItemClick?: () => void;
  onRoomSelect?: (roomId: string, roomName: string, serverId: string) => void;
  isMobile?: boolean;
  onServerSettings?: () => void;
  onAddFriendClick?: () => void;
  onFriendClick?: (friend: Friend) => void;
  user?: User;
  onCreatePost?: () => void;
  onFeedSelect?: (feed: CustomFeed) => void;
  onTagSelect?: (tag: string) => void;
  selectedFeed?: CustomFeed | null;
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

interface CustomFeed {
  id: string;
  name: string;
  tags: string[];
}

interface Tag {
  id: string;
  name: string;
  count?: number;
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
  onCreatePost,
  onFeedSelect,
  onTagSelect,
  selectedFeed,
}) => {
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    recent: true,
    online: true,
    idle: true,
    away: false,
    rooms: true,
    feeds: true,
    tags: true,
  });

  const [rooms, setRooms] = useState<
    Array<{
      id: string;
      name: string;
      type: "chat" | "genai" | "ai-agent";
      icon?: string;
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
  const [serverInvites, setServerInvites] = useState<ServerInvite[]>([]);
  const [recentDMs, setRecentDMs] = useState<RecentDM[]>([]);
  const [dmLoadLimit, setDmLoadLimit] = useState(10);
  const [hasMoreDMs, setHasMoreDMs] = useState(false);
  
  // Social feed state
  const [tagSearchQuery, setTagSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Tag[]>([]);
  const [subscribedTags, setSubscribedTags] = useState<string[]>([]);
  const [customFeeds, setCustomFeeds] = useState<CustomFeed[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showCreateFeedModal, setShowCreateFeedModal] = useState(false);
  const [editingFeed, setEditingFeed] = useState<CustomFeed | null>(null);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [popularTags, setPopularTags] = useState<Tag[]>([]);
  const [tagMenuPosition, setTagMenuPosition] = useState<{x: number, y: number} | null>(null);
  const [selectedTagForMenu, setSelectedTagForMenu] = useState<string | null>(null);

  // Load recent DMs with real-time updates
  useEffect(() => {
    if (!user?.uid) {
      setRecentDMs([]);
      setHasMoreDMs(false);
      return;
    }

    const dmQuery = query(
      collection(db, "private_messages"),
      where("participants", "array-contains", user.uid),
      orderBy("lastMessageTimestamp", "desc"),
      limit(dmLoadLimit)
    );

    const unsubscribe = onSnapshot(dmQuery, async (snapshot) => {
      try {
        const dmsList: RecentDM[] = [];
        
        // Get all user data for participants (we'll need this for naming)
        const allParticipantIds = new Set<string>();
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          data.participants?.forEach((id: string) => allParticipantIds.add(id));
        });
        
        // Fetch user data for all participants
        const userDataMap = new Map<string, any>();
        if (allParticipantIds.size > 0) {
          const userQueries = Array.from(allParticipantIds).map(async (userId) => {
            try {
              const userQuery = query(
                collection(db, "users"),
                where("userId", "==", userId),
                limit(1)
              );
              const userSnapshot = await getDocs(userQuery);
              if (!userSnapshot.empty) {
                const userData = userSnapshot.docs[0].data();
                userDataMap.set(userId, userData);
              }
            } catch (error) {
              console.error("Error fetching user data for", userId, error);
            }
          });
          await Promise.all(userQueries);
        }

        snapshot.docs.forEach((doc) => {
          const dmData = doc.data();
          const otherParticipants = dmData.participants?.filter((p: string) => p !== user.uid) || [];

          if (otherParticipants.length > 0) {
            // Generate DM name based on participants
            let dmName = "";
            if (otherParticipants.length === 1) {
              // 1-on-1 DM - use the other person's name
              const otherUser = userDataMap.get(otherParticipants[0]);
              dmName = otherUser?.displayName || otherUser?.email?.split('@')[0] || "Unknown User";
            } else {
              // Group DM - show participant count or create group name
              dmName = `Group (${dmData.participants.length} members)`;
            }

            dmsList.push({
              id: doc.id,
              name: dmName,
              participants: dmData.participants || [],
              lastMessage: dmData.lastMessage || "",
              lastMessageTimestamp: dmData.lastMessageTimestamp,
            });
          }
        });

        setRecentDMs(dmsList);
        
        // Check if there are more DMs by trying to load one more
        if (dmsList.length === dmLoadLimit) {
          const checkMoreQuery = query(
            collection(db, "private_messages"),
            where("participants", "array-contains", user.uid),
            orderBy("lastMessageTimestamp", "desc"),
            limit(dmLoadLimit + 1)
          );
          const checkSnapshot = await getDocs(checkMoreQuery);
          setHasMoreDMs(checkSnapshot.docs.length > dmLoadLimit);
        } else {
          setHasMoreDMs(false);
        }
      } catch (error) {
        console.error("Error loading DMs:", error);
        setRecentDMs([]);
        setHasMoreDMs(false);
      }
    });

    return () => unsubscribe();
  }, [user?.uid, dmLoadLimit]);

  // Load more DMs function
  const loadMoreDMs = () => {
    setDmLoadLimit(prev => prev + 10);
  };

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
          icon: doc.data().icon,
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
            recent: [] as RecentDM[], // This will be populated by the separate DM listener
            online: friendsData.filter(f => f.status === "online"),
            idle: friendsData.filter(f => f.status === "idle"),
            away: friendsData.filter(f => f.status === "away"),
          };

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

  // Load server invites
  useEffect(() => {
    if (!user?.uid) {
      setServerInvites([]);
      return;
    }

    const invitesRef = collection(db, "server_invites");
    const invitesQuery = query(
      invitesRef,
      where("recipientId", "==", user.uid),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc")
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
  }, [user?.uid]);

  // Accept server invite
  const acceptServerInvite = async (invite: ServerInvite) => {
    try {
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
    } catch (error) {
      console.error("Error accepting server invite:", error);
      alert("Failed to accept invite. Please try again.");
    }
  };

  // Decline server invite
  const declineServerInvite = async (inviteId: string) => {
    try {
      await deleteDoc(doc(db, "server_invites", inviteId));
      console.log("Server invite declined");
    } catch (error) {
      console.error("Error declining server invite:", error);
      alert("Failed to decline invite. Please try again.");
    }
  };

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

  // Handle tag click to show menu
  const handleTagClick = useCallback((e: React.MouseEvent, tagId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = e.currentTarget.getBoundingClientRect();
    setTagMenuPosition({
      x: rect.right + 10,
      y: rect.top + rect.height / 2
    });
    setSelectedTagForMenu(tagId);
  }, []);

  // Handle tag view action
  const handleTagView = useCallback(() => {
    if (selectedTagForMenu && onTagSelect) {
      onTagSelect(selectedTagForMenu);
      setTagMenuPosition(null);
      setSelectedTagForMenu(null);
    }
  }, [selectedTagForMenu, onTagSelect]);

  // Handle tag unsubscribe action
  const handleTagUnsubscribe = useCallback(async () => {
    if (!selectedTagForMenu || !user?.uid) return;

    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        subscribedTags: arrayRemove(selectedTagForMenu)
      });
      
      setTagMenuPosition(null);
      setSelectedTagForMenu(null);
    } catch (error) {
      console.error("Error unsubscribing from tag:", error);
    }
  }, [selectedTagForMenu, user?.uid]);

  // Close tag menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setTagMenuPosition(null);
      setSelectedTagForMenu(null);
    };

    if (tagMenuPosition) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [tagMenuPosition]);

  // Load popular tags for autocomplete suggestions
  useEffect(() => {
    const loadPopularTags = async () => {
      try {
        const results = await searchTags("", 20); // Get top 20 popular tags
        
        const formattedResults: Tag[] = results.map((tag: any) => ({
          id: tag.normalizedName,
          name: tag.name,
          count: tag.count,
        }));

        setPopularTags(formattedResults);
      } catch (error) {
        console.error("Error loading popular tags:", error);
      }
    };

    loadPopularTags();
  }, []);

  // Tag search functionality - now uses tags collection
  useEffect(() => {
    if (!tagSearchQuery.trim()) {
      setSearchResults(popularTags.slice(0, 8)); // Show popular tags when no query
      return;
    }

    const performTagSearch = async () => {
      setIsSearching(true);
      try {
        const results = await searchTags(tagSearchQuery, 10);
        
        // Convert to the format expected by the UI
        const formattedResults: Tag[] = results.map((tag: any) => ({
          id: tag.normalizedName,
          name: tag.name,
          count: tag.count,
        }));

        setSearchResults(formattedResults);
      } catch (error) {
        console.error("Error searching tags:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(performTagSearch, 300);
    return () => clearTimeout(debounceTimer);
  }, [tagSearchQuery, popularTags]);

  // Load user's subscribed tags and custom feeds
  useEffect(() => {
    if (!user?.uid) return;

    // Load subscribed tags
    const userDocRef = doc(db, "users", user.uid);
    const unsubscribeUser = onSnapshot(userDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setSubscribedTags(data.subscribedTags || []);
      }
    });

    // Load custom feeds
    const feedsQuery = query(
      collection(db, "users", user.uid, "feeds"),
      orderBy("name")
    );
    
    const unsubscribeFeeds = onSnapshot(feedsQuery, (snapshot) => {
      const feeds: CustomFeed[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as CustomFeed));
      setCustomFeeds(feeds);
    });

    return () => {
      unsubscribeUser();
      unsubscribeFeeds();
    };
  }, [user?.uid]);

  // Subscribe to tag
  const subscribeToTag = async (tagId: string) => {
    if (!user?.uid) return;

    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        subscribedTags: arrayUnion(tagId.toLowerCase()),
      });
    } catch (error) {
      console.error("Error subscribing to tag:", error);
    }
  };

  // Unsubscribe from tag
  const unsubscribeFromTag = async (tagId: string) => {
    if (!user?.uid) return;

    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        subscribedTags: arrayRemove(tagId.toLowerCase()),
      });
    } catch (error) {
      console.error("Error unsubscribing from tag:", error);
    }
  };

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
            
            {/* Load More Button for Recent DMs */}
            {sectionKey === "recent" && hasMoreDMs && (
              <button
                onClick={loadMoreDMs}
                className="w-full px-2 py-2 mt-2 text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-black dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 border-2 border-transparent hover:border-black dark:hover:border-gray-600 transition-all"
              >
                Load More...
              </button>
            )}
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
            {/* Server Invites Tab - Only show when there are pending invites */}
            {serverInvites.length > 0 && (
              <button
                onClick={() => onTabChange("invites")}
                className={`flex-1 py-2 px-4 font-black text-sm border-2 border-black dark:border-gray-600 border-l-0 transition-all uppercase text-black dark:text-white relative ${
                  selectedTab === "invites"
                    ? "bg-red-400 dark:bg-red-500 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)]"
                    : "bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600"
                }`}
              >
                Invites
                {/* Badge for invite count */}
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 border-2 border-black dark:border-gray-600 rounded-full flex items-center justify-center text-xs font-bold text-white">
                  {serverInvites.length > 9 ? "9+" : serverInvites.length}
                </span>
              </button>
            )}
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
              {renderFriendsSection("Recent DMs", recentDMs, "recent")}
              {renderFriendsSection("Online", friends.online, "online")}
              {renderFriendsSection("Idle", friends.idle, "idle")}
              {renderFriendsSection("Away", friends.away, "away")}
            </div>
          ) : selectedTab === "invites" ? (
            // Server Invites Tab Content
            <div>
              {/* Invites Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-black text-lg uppercase text-black dark:text-white">
                  Server Invites
                </h2>
                <div className="text-sm font-bold text-red-600 dark:text-red-400">
                  {serverInvites.length} pending
                </div>
              </div>

              {/* Invites List */}
              <div className="space-y-3">
                {serverInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="bg-white dark:bg-gray-700 border-4 border-black dark:border-gray-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(55,65,81,1)] p-4"
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
                        className="flex-1 px-4 py-2 bg-green-400 dark:bg-green-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => declineServerInvite(invite.id)}
                        className="flex-1 px-4 py-2 bg-red-400 dark:bg-red-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-white"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {serverInvites.length === 0 && (
                <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                  No pending server invites
                </div>
              )}
            </div>
          ) : (
            // Social Feed Tab Content
            <div>
              {/* Feed Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-black text-lg uppercase text-black dark:text-white">
                  Social
                </h2>
                <button 
                  onClick={onCreatePost}
                  className="w-8 h-8 bg-purple-400 dark:bg-purple-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
                  title="Create Post"
                >
                  <FiEdit3 size={16} className="text-black dark:text-white" />
                </button>
              </div>

              {/* Tag Search Bar */}
              <div className="mb-4 relative">
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={16} />
                  <input
                    type="text"
                    value={tagSearchQuery}
                    onChange={(e) => setTagSearchQuery(e.target.value)}
                    onFocus={() => setShowTagSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
                    placeholder="Search tags..."
                    className="w-full pl-10 pr-3 py-2 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] transition-all"
                  />
                </div>
                
                {/* Search Results Dropdown */}
                {showTagSuggestions && searchResults.length > 0 && (
                  <div className="absolute top-full mt-2 w-full bg-white dark:bg-gray-800 border-2 border-black dark:border-gray-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(55,65,81,1)] max-h-48 overflow-y-auto z-10">
                    {searchResults.map((tag) => (
                      <div
                        key={tag.id}
                        className="flex items-center justify-between px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <FiHash size={14} className="text-gray-500" />
                          <span className="text-sm font-medium text-black dark:text-white">{tag.name}</span>
                          {tag.count && (
                            <span className="text-xs text-gray-500">({tag.count} posts)</span>
                          )}
                        </div>
                        <button
                          onClick={async () => {
                            await subscribeToTag(tag.id);
                            setTagSearchQuery("");
                            setShowTagSuggestions(false);
                          }}
                          className="w-6 h-6 bg-green-400 dark:bg-green-500 border border-black dark:border-gray-600 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] dark:shadow-[1px_1px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
                          title="Subscribe to tag"
                          disabled={subscribedTags.includes(tag.id)}
                        >
                          <FiPlus size={12} className="text-black dark:text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Feeds Section */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => toggleSection("feeds")}
                    className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors uppercase"
                  >
                    {expandedSections.feeds ? (
                      <FiChevronDown size={12} />
                    ) : (
                      <FiChevronRight size={12} />
                    )}
                    Feeds
                  </button>
                  <button
                    onClick={() => setShowCreateFeedModal(true)}
                    className="w-5 h-5 bg-blue-400 dark:bg-blue-500 border border-black dark:border-gray-600 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] dark:shadow-[1px_1px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
                    title="Create new feed"
                  >
                    <FiPlus size={10} className="text-black dark:text-white" />
                  </button>
                </div>

                {expandedSections.feeds && (
                  <div className="space-y-2 ml-4">
                    {/* All Feed - Non-editable */}
                    <div 
                      onClick={() => onFeedSelect?.({id: "all", name: "All", tags: []})}
                      className={`flex items-center justify-between px-3 py-2 border-2 cursor-pointer transition-colors ${
                        selectedFeed?.id === "all" 
                          ? "bg-blue-200 dark:bg-blue-800 border-blue-500 dark:border-blue-400" 
                          : "bg-gray-100 dark:bg-gray-700 border-black dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600"
                      }`}
                    >
                      <span className="text-sm font-medium text-black dark:text-white">All</span>
                    </div>
                    
                    {/* Custom Feeds */}
                    {customFeeds.map((feed) => (
                      <div
                        key={feed.id}
                        onClick={() => onFeedSelect?.(feed)}
                        className={`flex items-center justify-between px-3 py-2 border-2 cursor-pointer transition-colors ${
                          selectedFeed?.id === feed.id 
                            ? "bg-blue-200 dark:bg-blue-800 border-blue-500 dark:border-blue-400" 
                            : "border-transparent hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-black dark:hover:border-gray-600"
                        }`}
                      >
                        <span className="text-sm font-medium text-black dark:text-white">{feed.name}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingFeed(feed);
                          }}
                          className="opacity-0 hover:opacity-100 transition-opacity"
                        >
                          <FiEdit size={14} className="text-gray-600 dark:text-gray-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tags Section */}
              <div>
                <button
                  onClick={() => toggleSection("tags")}
                  className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors uppercase mb-3"
                >
                  {expandedSections.tags ? (
                    <FiChevronDown size={12} />
                  ) : (
                    <FiChevronRight size={12} />
                  )}
                  Subscribed Tags ({subscribedTags.length})
                </button>

                {expandedSections.tags && (
                  <div className="space-y-2 ml-4">
                    {subscribedTags.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                        No subscribed tags yet
                      </p>
                    ) : (
                      subscribedTags.map((tagId) => {
                        const isHighlighted = selectedFeed && selectedFeed.id !== "all" && selectedFeed.tags.includes(tagId);
                        return (
                          <div
                            key={tagId}
                            onClick={(e) => handleTagClick(e, tagId)}
                            className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors border-2 ${
                              isHighlighted 
                                ? "bg-yellow-200 dark:bg-yellow-800 border-yellow-500 dark:border-yellow-400" 
                                : "border-transparent hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                            }`}
                          >
                            <FiHash size={14} className="text-gray-500" />
                            <span className="text-sm font-medium text-black dark:text-white">
                              {tagId}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
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
              onClick={() => {
                onServerSettings?.();
                onContentItemClick?.();
              }}
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
                      {room.icon ? (
                        <span className="text-lg">{room.icon}</span>
                      ) : (
                        getRoomIcon(room.type)
                      )}
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

      {/* Tag Menu Popup */}
      {tagMenuPosition && selectedTagForMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(55,65,81,1)] p-2"
          style={{
            left: tagMenuPosition.x,
            top: tagMenuPosition.y - 40, // Center vertically
          }}
        >
          <div className="flex flex-col space-y-1">
            <button
              onClick={handleTagView}
              className="px-3 py-2 text-sm font-medium text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 border-2 border-transparent hover:border-black dark:hover:border-gray-600 transition-all text-left"
            >
              View Posts
            </button>
            <button
              onClick={handleTagUnsubscribe}
              className="px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 border-2 border-transparent hover:border-red-500 dark:hover:border-red-400 transition-all text-left"
            >
              Unsubscribe
            </button>
          </div>
        </div>
      )}

      {/* Feed Management Modal */}
      {(showCreateFeedModal || editingFeed) && user && (
        <FeedModal
          user={user}
          feed={editingFeed}
          onClose={() => {
            setShowCreateFeedModal(false);
            setEditingFeed(null);
          }}
        />
      )}
    </div>
  );
});

InfoBar.displayName = 'InfoBar';

export default InfoBar;
