import React, { useState, useEffect, useRef } from "react";
import type { User } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  onSnapshot,
  orderBy,
  limit,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { FiUserPlus, FiCheck, FiClock, FiX } from "react-icons/fi";

interface FriendSearchProps {
  user: User;
  onBackToFriends?: () => void;
}

interface SearchResult {
  id: string;
  email: string;
  displayName: string;
  status?: "online" | "idle" | "away";
}

interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  fromUserName: string;
  fromUserEmail: string;
  status: "pending" | "accepted" | "declined";
  timestamp: any;
}

const FriendSearch: React.FC<FriendSearchProps> = ({ user, onBackToFriends }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Set<string>>(new Set());
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load friend requests and friends on component mount
  useEffect(() => {
    if (!user?.uid) return;

    // Listen to incoming friend requests
    const incomingRequestsRef = collection(db, "friend_requests");
    const incomingQuery = query(
      incomingRequestsRef,
      where("toUserId", "==", user.uid),
      where("status", "==", "pending"),
      orderBy("timestamp", "desc")
    );

    const unsubscribeIncoming = onSnapshot(incomingQuery, (snapshot) => {
      const requests: FriendRequest[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        requests.push({
          id: doc.id,
          fromUserId: data.fromUserId,
          toUserId: data.toUserId,
          fromUserName: data.fromUserName || "Unknown User",
          fromUserEmail: data.fromUserEmail || "",
          status: data.status,
          timestamp: data.timestamp,
        });
      });
      setIncomingRequests(requests);
    });

    // Listen to sent friend requests
    const outgoingRequestsRef = collection(db, "friend_requests");
    const outgoingQuery = query(
      outgoingRequestsRef,
      where("fromUserId", "==", user.uid),
      where("status", "==", "pending")
    );

    const unsubscribeOutgoing = onSnapshot(outgoingQuery, (snapshot) => {
      const sentRequestIds = new Set<string>();
      snapshot.forEach((doc) => {
        sentRequestIds.add(doc.data().toUserId);
      });
      setSentRequests(sentRequestIds);
    });

    // Load user's friends from subcollection with real-time updates
    const setupFriendsListener = () => {
      try {
        // Listen to friends subcollection using user UID directly
        const friendsRef = collection(db, `users/${user.uid}/friends`);
        const unsubscribeFriends = onSnapshot(friendsRef, (snapshot) => {
          try {
            const friendIds = new Set<string>();
            snapshot.forEach((doc) => {
              const friendData = doc.data();
              const friendId = friendData.userId || friendData.uid || doc.id;
              friendIds.add(friendId);
            });
            setFriends(friendIds);
          } catch (error) {
            console.error("Error loading user friends:", error);
            setFriends(new Set());
          }
        });
        
        return unsubscribeFriends;
      } catch (error) {
        console.error("Error setting up friends listener:", error);
        setFriends(new Set());
        return () => {};
      }
    };
    
    const unsubscribeFriends = setupFriendsListener();

    return () => {
      unsubscribeIncoming();
      unsubscribeOutgoing();
      if (unsubscribeFriends) {
        unsubscribeFriends();
      }
    };
  }, [user?.uid]);

  // Search for users
  const handleSearch = async (term?: string) => {
    const searchQuery = term !== undefined ? term : searchTerm;
    if (!searchQuery.trim() || searching) return;

    setSearching(true);
    try {
      const usersRef = collection(db, "users");
      
      // Search by email
      const emailQuery = query(
        usersRef,
        where("email", ">=", searchQuery.toLowerCase()),
        where("email", "<=", searchQuery.toLowerCase() + "\uf8ff"),
        limit(10)
      );

      // Search by display name
      const nameQuery = query(
        usersRef,
        where("displayName", ">=", searchQuery),
        where("displayName", "<=", searchQuery + "\uf8ff"),
        limit(10)
      );

      const [emailResults, nameResults] = await Promise.all([
        getDocs(emailQuery),
        getDocs(nameQuery),
      ]);

      const results: SearchResult[] = [];
      const seenIds = new Set<string>();

      // Process email results
      emailResults.forEach((doc) => {
        const data = doc.data();
        if (data.userId !== user.uid && !seenIds.has(data.userId)) {
          seenIds.add(data.userId);
          results.push({
            id: data.userId,
            email: data.email || "",
            displayName: data.displayName || data.email?.split("@")[0] || "Unknown User",
            status: data.status || "away",
          });
        }
      });

      // Process name results
      nameResults.forEach((doc) => {
        const data = doc.data();
        if (data.userId !== user.uid && !seenIds.has(data.userId)) {
          seenIds.add(data.userId);
          results.push({
            id: data.userId,
            email: data.email || "",
            displayName: data.displayName || data.email?.split("@")[0] || "Unknown User",
            status: data.status || "away",
          });
        }
      });

      setSearchResults(results);
    } catch (error) {
      console.error("Error searching users:", error);
      alert("Failed to search users. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  // Handle search input change with debouncing
  const handleSearchInputChange = (value: string) => {
    setSearchTerm(value);
    
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Clear results if search is empty
    if (!value.trim()) {
      setSearchResults([]);
      return;
    }
    
    // Set new timeout for 1 second
    searchTimeoutRef.current = setTimeout(() => {
      handleSearch(value);
    }, 1000);
  };

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Send friend request
  const sendFriendRequest = async (toUserId: string, toUserName: string, toUserEmail: string) => {
    try {
      // Check if already friends
      if (friends.has(toUserId)) {
        alert("You are already friends with this user!");
        return;
      }

      // Check if request already sent
      if (sentRequests.has(toUserId)) {
        alert("Friend request already sent!");
        return;
      }

      await addDoc(collection(db, "friend_requests"), {
        fromUserId: user.uid,
        toUserId,
        fromUserName: user.displayName || user.email?.split("@")[0] || "Unknown User",
        fromUserEmail: user.email || "",
        toUserName,
        toUserEmail,
        status: "pending",
        timestamp: serverTimestamp(),
      });

      // Update local state
      setSentRequests((prev) => new Set(prev).add(toUserId));
      alert(`Friend request sent to ${toUserName}!`);
    } catch (error) {
      console.error("Error sending friend request:", error);
      alert("Failed to send friend request. Please try again.");
    }
  };

  // Accept friend request
  const acceptFriendRequest = async (request: FriendRequest) => {
    try {
      // Update request status
      const requestRef = collection(db, "friend_requests");
      const requestQuery = query(
        requestRef,
        where("fromUserId", "==", request.fromUserId),
        where("toUserId", "==", user.uid),
        where("status", "==", "pending"),
        limit(1)
      );

      const requestDocs = await getDocs(requestQuery);
      if (!requestDocs.empty) {
        const docRef = requestDocs.docs[0].ref;
        await updateDoc(docRef, { status: "accepted" });
      }

      // Add users to each other's friends subcollections using UIDs directly
      
      // Check if friendship already exists to prevent duplicates
      const currentUserFriendsRef = collection(db, `users/${user.uid}/friends`);
      const existingFriendQuery = query(
        currentUserFriendsRef,
        where("userId", "==", request.fromUserId),
        limit(1)
      );
      const existingFriendDocs = await getDocs(existingFriendQuery);
      
      if (existingFriendDocs.empty) {
        // Add friend to current user's friends subcollection
        await addDoc(currentUserFriendsRef, {
          uid: request.fromUserId,
          userId: request.fromUserId,
          name: request.fromUserName,
          email: request.fromUserEmail,
          status: "online",
          lastSeen: serverTimestamp(),
          statusUpdatedAt: serverTimestamp()
        });
      }
      
      // Check if reverse friendship already exists
      const friendUserFriendsRef = collection(db, `users/${request.fromUserId}/friends`);
      const existingReverseFriendQuery = query(
        friendUserFriendsRef,
        where("userId", "==", user.uid),
        limit(1)
      );
      const existingReverseFriendDocs = await getDocs(existingReverseFriendQuery);
      
      if (existingReverseFriendDocs.empty) {
        // Add current user to friend's friends subcollection
        await addDoc(friendUserFriendsRef, {
          uid: user.uid,
          userId: user.uid,
          name: user.displayName || user.email?.split("@")[0] || "Unknown User",
          email: user.email || "",
          status: "online",
          lastSeen: serverTimestamp(),
          statusUpdatedAt: serverTimestamp()
        });
      }

      console.log(`Successfully accepted friend request from ${request.fromUserName}`);
      alert(`You and ${request.fromUserName} are now friends!`);
    } catch (error) {
      console.error("Error accepting friend request:", error);
      alert("Failed to accept friend request. Please try again.");
    }
  };

  // Decline friend request
  const declineFriendRequest = async (request: FriendRequest) => {
    try {
      const requestRef = collection(db, "friend_requests");
      const requestQuery = query(
        requestRef,
        where("fromUserId", "==", request.fromUserId),
        where("toUserId", "==", user.uid),
        where("status", "==", "pending"),
        limit(1)
      );

      const requestDocs = await getDocs(requestQuery);
      if (!requestDocs.empty) {
        const docRef = requestDocs.docs[0].ref;
        await updateDoc(docRef, { status: "declined" });
      }
    } catch (error) {
      console.error("Error declining friend request:", error);
      alert("Failed to decline friend request. Please try again.");
    }
  };

  // Get status color
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

  // Get button state for user
  const getButtonState = (userId: string) => {
    if (friends.has(userId)) return "friends";
    if (sentRequests.has(userId)) return "pending";
    return "add";
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-blue-400 dark:bg-blue-500 px-6 py-4 border-b-4 border-black dark:border-gray-600">
        <h2 className="text-2xl font-black uppercase text-black dark:text-white">
          Find Friends
        </h2>
        <p className="text-black dark:text-white mt-2">
          Search for friends by username or email address
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Incoming Friend Requests */}
        {incomingRequests.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-black uppercase text-black dark:text-white mb-4">
              Friend Requests ({incomingRequests.length})
            </h3>
            <div className="space-y-3">
              {incomingRequests.map((request) => (
                <div
                  key={request.id}
                  className="bg-yellow-100 dark:bg-yellow-900 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-bold text-black dark:text-white">
                      {request.fromUserName}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {request.fromUserEmail}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => acceptFriendRequest(request)}
                      className="px-3 py-1 bg-green-400 dark:bg-green-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white flex items-center gap-1"
                    >
                      <FiCheck size={14} />
                      Accept
                    </button>
                    <button
                      onClick={() => declineFriendRequest(request)}
                      className="px-3 py-1 bg-red-500 dark:bg-red-600 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-white flex items-center gap-1"
                    >
                      <FiX size={14} />
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search Section */}
        <div className="mb-6">
          <h3 className="text-lg font-black uppercase text-black dark:text-white mb-4">
            Search Users
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Start typing to search automatically, or press Enter to search immediately
          </p>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => handleSearchInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (searchTimeoutRef.current) {
                      clearTimeout(searchTimeoutRef.current);
                    }
                    handleSearch();
                  }
                }}
                placeholder="Enter username or email (auto-searches after 1 sec)..."
                className="w-full px-4 py-3 pr-20 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] transition-all"
              />
              {searching && (
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900 dark:border-gray-100"></div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div>
            <h3 className="text-lg font-black uppercase text-black dark:text-white mb-4">
              Search Results ({searchResults.length})
            </h3>
            <div className="space-y-3">
              {searchResults.map((result) => {
                const buttonState = getButtonState(result.id);
                return (
                  <div
                    key={result.id}
                    className="bg-white dark:bg-gray-800 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-3 h-3 ${getStatusColor(
                          result.status || "away"
                        )} border border-black rounded-full`}
                      />
                      <div>
                        <p className="font-bold text-black dark:text-white">
                          {result.displayName}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {result.email}
                        </p>
                      </div>
                    </div>
                    <div>
                      {buttonState === "friends" && (
                        <span className="px-3 py-1 bg-green-200 dark:bg-green-800 border-2 border-black dark:border-gray-600 font-bold text-black dark:text-white flex items-center gap-1">
                          <FiCheck size={14} />
                          Friends
                        </span>
                      )}
                      {buttonState === "pending" && (
                        <span className="px-3 py-1 bg-yellow-200 dark:bg-yellow-800 border-2 border-black dark:border-gray-600 font-bold text-black dark:text-white flex items-center gap-1">
                          <FiClock size={14} />
                          Pending
                        </span>
                      )}
                      {buttonState === "add" && (
                        <button
                          onClick={() =>
                            sendFriendRequest(result.id, result.displayName, result.email)
                          }
                          className="px-3 py-1 bg-green-400 dark:bg-green-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white flex items-center gap-1"
                        >
                          <FiUserPlus size={14} />
                          Add Friend
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* No results message */}
        {searchTerm && !searching && searchResults.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400">
              No users found matching "{searchTerm}". Try a different search term.
            </p>
          </div>
        )}

        {/* Initial state message */}
        {!searchTerm && searchResults.length === 0 && incomingRequests.length === 0 && (
          <div className="text-center py-8">
            <div className="bg-purple-100 dark:bg-purple-900 border-4 border-black dark:border-gray-600 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(55,65,81,1)] p-6 max-w-md mx-auto">
              <h3 className="text-lg font-black uppercase text-black dark:text-white mb-4">
                How to Find Friends
              </h3>
              <div className="text-left space-y-2 text-gray-700 dark:text-gray-300">
                <p>✨ <strong>Auto-Search:</strong> Type and wait 1 second</p>
                <p>⚡ <strong>Instant Search:</strong> Press Enter</p>
                <p>🔍 <strong>Partial Match:</strong> Search works with partial names/emails</p>
                <p>📧 <strong>Example:</strong> Type "john" to find "john@example.com"</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FriendSearch;