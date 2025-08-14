import React, { useState, useEffect } from "react";
import type { User } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  onSnapshot,
  limit,
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

const FriendSearchSimple: React.FC<FriendSearchProps> = ({ user, onBackToFriends }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);

  // Load friend requests on component mount - simplified query
  useEffect(() => {
    if (!user?.uid) return;

    // Simple query for incoming requests (without orderBy)
    const incomingRequestsRef = collection(db, "friend_requests");
    const incomingQuery = query(
      incomingRequestsRef,
      where("toUserId", "==", user.uid),
      where("status", "==", "pending")
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
      
      // Sort manually in JavaScript
      requests.sort((a, b) => {
        if (!a.timestamp || !b.timestamp) return 0;
        const timeA = a.timestamp.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
        const timeB = b.timestamp.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
        return timeB.getTime() - timeA.getTime();
      });
      
      setIncomingRequests(requests);
    });

    // Simple query for sent requests
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

    return () => {
      unsubscribeIncoming();
      unsubscribeOutgoing();
    };
  }, [user?.uid]);

  // Simple search for users - exact email match only for now
  const handleSearch = async () => {
    if (!searchTerm.trim() || searching) return;

    setSearching(true);
    try {
      const usersRef = collection(db, "users");
      
      // Simple email search
      const emailQuery = query(
        usersRef,
        where("email", "==", searchTerm.toLowerCase()),
        limit(10)
      );

      const emailResults = await getDocs(emailQuery);
      const results: SearchResult[] = [];

      emailResults.forEach((doc) => {
        const data = doc.data();
        if (data.userId !== user.uid) {
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

  // Send friend request
  const sendFriendRequest = async (toUserId: string, toUserName: string, toUserEmail: string) => {
    try {
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

      setSentRequests((prev) => new Set(prev).add(toUserId));
    } catch (error) {
      console.error("Error sending friend request:", error);
      alert("Failed to send friend request. Please try again.");
    }
  };

  // Accept friend request - simplified
  const acceptFriendRequest = async (request: FriendRequest) => {
    try {
      console.log(`Accepted friend request from ${request.fromUserName}`);
      alert(`Friend request from ${request.fromUserName} accepted! (Full functionality requires Cloud Functions)`);
    } catch (error) {
      console.error("Error accepting friend request:", error);
      alert("Failed to accept friend request. Please try again.");
    }
  };

  // Decline friend request - simplified
  const declineFriendRequest = async (request: FriendRequest) => {
    try {
      console.log(`Declined friend request from ${request.fromUserName}`);
      alert(`Friend request from ${request.fromUserName} declined!`);
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
    if (sentRequests.has(userId)) return "pending";
    return "add";
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-blue-400 dark:bg-blue-500 px-6 py-4 border-b-4 border-black dark:border-gray-600">
        <h2 className="text-2xl font-black uppercase text-black dark:text-white">
          Find Friends (Simplified)
        </h2>
        <p className="text-black dark:text-white mt-2">
          Search for friends by exact email address
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
            Search Users by Email
          </h3>
          <div className="flex gap-3">
            <input
              type="email"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Enter exact email address..."
              className="flex-1 px-4 py-3 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] transition-all"
            />
            <button
              onClick={handleSearch}
              disabled={!searchTerm.trim() || searching}
              className="px-6 py-3 bg-blue-400 dark:bg-blue-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] disabled:hover:translate-x-0 disabled:hover:translate-y-0"
            >
              {searching ? "Searching..." : "Search"}
            </button>
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
              No users found with email "{searchTerm}". Try the exact email address.
            </p>
          </div>
        )}

        {/* Instructions */}
        {!searchTerm && searchResults.length === 0 && (
          <div className="text-center py-8">
            <div className="bg-blue-100 dark:bg-blue-900 border-4 border-black dark:border-gray-600 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(55,65,81,1)] p-6 max-w-md mx-auto">
              <h3 className="text-lg font-black uppercase text-black dark:text-white mb-4">
                How to Search
              </h3>
              <div className="text-left space-y-2">
                <p className="text-gray-700 dark:text-gray-300">
                  • Enter the <strong>exact email address</strong> of the user
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  • Partial matching requires Firestore indexes
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  • Set up indexes for full search functionality
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FriendSearchSimple;