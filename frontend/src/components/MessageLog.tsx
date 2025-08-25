import React, { useState, useEffect, useRef } from "react";
import type { User } from "firebase/auth";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  deleteDoc,
  doc,
  startAfter,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { FiTrash2 } from "react-icons/fi";

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderEmail: string;
  timestamp: any;
  createdAt: any;
}

interface MessageLogProps {
  serverId: string;
  roomId: string;
  user: User;
  userRole: "owner" | "admin" | "member";
}

const MessageLog: React.FC<MessageLogProps> = ({
  serverId,
  roomId,
  user,
  userRole,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [hoveredMessage, setHoveredMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastMessageDoc = useRef<any>(null);

  // Check if user is scrolled to bottom (within small threshold)
  const isScrolledToBottom = () => {
    if (!messagesContainerRef.current) return true;
    const container = messagesContainerRef.current;
    const threshold = 100; // 100px threshold
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  };

  // Scroll to bottom when new messages arrive (only if user was already at bottom)
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  // Load initial messages and set up real-time listener
  useEffect(() => {
    if (!serverId || !roomId) return;

    setLoading(true);
    setMessages([]);
    lastMessageDoc.current = null;
    setHasMore(true);

    const messagesRef = collection(
      db,
      `servers/${serverId}/chat_rooms/${roomId}/messages`
    );

    // Query for the most recent messages
    const messagesQuery = query(
      messagesRef,
      orderBy("timestamp", "desc"),
      limit(50)
    );

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const wasAtBottom = isScrolledToBottom();
        const messagesList: Message[] = [];
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          messagesList.push({
            id: doc.id,
            text: data.text || "",
            senderId: data.senderId || "",
            senderName: data.senderName || "Unknown User",
            senderEmail: data.senderEmail || "",
            timestamp: data.timestamp,
            createdAt: data.createdAt || data.timestamp,
          });
        });

        // Reverse to show oldest first (since we queried newest first)
        messagesList.reverse();
        setMessages(messagesList);
        
        // Store the last document for pagination
        if (snapshot.docs.length > 0) {
          lastMessageDoc.current = snapshot.docs[snapshot.docs.length - 1];
        }
        
        setHasMore(snapshot.docs.length === 50);
        setLoading(false);

        // Only scroll to bottom if user was already at bottom or this is initial load
        if (wasAtBottom || messages.length === 0) {
          setTimeout(scrollToBottom, 100);
        }
      },
      (error) => {
        console.error("Error listening to messages:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [serverId, roomId]);

  // Load more messages (pagination)
  const loadMoreMessages = async () => {
    if (!hasMore || loadingMore || !lastMessageDoc.current) return;

    setLoadingMore(true);

    try {
      const messagesRef = collection(
        db,
        `servers/${serverId}/chat_rooms/${roomId}/messages`
      );

      const moreMessagesQuery = query(
        messagesRef,
        orderBy("timestamp", "desc"),
        startAfter(lastMessageDoc.current),
        limit(50)
      );

      const snapshot = await getDocs(moreMessagesQuery);
      
      if (snapshot.empty) {
        setHasMore(false);
        setLoadingMore(false);
        return;
      }

      const moreMessages: Message[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        moreMessages.push({
          id: doc.id,
          text: data.text || "",
          senderId: data.senderId || "",
          senderName: data.senderName || "Unknown User",
          senderEmail: data.senderEmail || "",
          timestamp: data.timestamp,
          createdAt: data.createdAt || data.timestamp,
        });
      });

      // Reverse and prepend to existing messages
      moreMessages.reverse();
      setMessages((prev) => [...moreMessages, ...prev]);
      
      // Update last document reference
      lastMessageDoc.current = snapshot.docs[snapshot.docs.length - 1];
      setHasMore(snapshot.docs.length === 50);
    } catch (error) {
      console.error("Error loading more messages:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  // Delete message function
  const deleteMessage = async (messageId: string, senderId: string) => {
    try {
      // Check if user can delete this message
      const canDelete = senderId === user.uid || 
                       userRole === "owner" || 
                       userRole === "admin";

      if (!canDelete) {
        alert("You don't have permission to delete this message");
        return;
      }

      const messageRef = doc(
        db,
        `servers/${serverId}/chat_rooms/${roomId}/messages/${messageId}`
      );

      await deleteDoc(messageRef);
      console.log(`Message ${messageId} deleted successfully`);
    } catch (error) {
      console.error("Error deleting message:", error);
      alert("Failed to delete message. Please try again.");
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return "";
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { 
        hour: "2-digit", 
        minute: "2-digit" 
      });
    } else {
      return date.toLocaleDateString([], { 
        month: "short", 
        day: "numeric",
        hour: "2-digit", 
        minute: "2-digit" 
      });
    }
  };

  // Check if messages should be grouped
  const shouldGroupMessage = (currentMessage: Message, previousMessage: Message | null) => {
    if (!previousMessage) return false;
    
    // Different sender = new group
    if (currentMessage.senderId !== previousMessage.senderId) return false;
    
    // Check time gap (2+ hours = new group)
    if (currentMessage.timestamp && previousMessage.timestamp) {
      const currentTime = currentMessage.timestamp.toDate ? 
                         currentMessage.timestamp.toDate() : 
                         new Date(currentMessage.timestamp);
      const prevTime = previousMessage.timestamp.toDate ? 
                      previousMessage.timestamp.toDate() : 
                      new Date(previousMessage.timestamp);
      
      const timeDiff = (currentTime.getTime() - prevTime.getTime()) / (1000 * 60 * 60);
      if (timeDiff >= 2) return false;
    }
    
    return true;
  };

  // Get user initials for avatar
  const getUserInitials = (name: string, email: string) => {
    if (name && name.trim()) {
      const nameParts = name.trim().split(" ");
      if (nameParts.length >= 2) {
        return (nameParts[0][0] + nameParts[1][0]).toUpperCase();
      }
      return nameParts[0][0].toUpperCase();
    }
    
    if (email) {
      return email[0].toUpperCase();
    }
    
    return "U";
  };

  // Check if message contains only emojis and is 3 or fewer emoji characters
  const isEmojiOnlyMessage = (text: string): boolean => {
    if (!text || text.length === 0) return false;
    
    // Remove all whitespace for checking
    const cleanText = text.replace(/\s/g, '');
    if (cleanText.length === 0) return false;
    
    // Unicode ranges for emojis
    const emojiRegex = /^[\p{Emoji}\p{Emoji_Modifier}\p{Emoji_Component}\p{Emoji_Modifier_Base}\p{Emoji_Presentation}\u200d\ufe0f\u2640\u2642\u2695\u26a7\u2764\ufe0f\u200d\u1f3f3\u1f3f4\u1f3fb\u1f3fc\u1f3fd\u1f3fe\u1f3ff]+$/u;
    
    // Check if it's all emojis
    if (!emojiRegex.test(cleanText)) return false;
    
    // Count actual emoji characters (accounting for multi-byte emojis)
    const emojiCount = [...cleanText].length;
    
    // Return true if 3 or fewer emojis
    return emojiCount <= 3;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">
          Loading messages...
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Messages Container - Scrollable with proper overflow handling */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{ maxWidth: "1000px", margin: "0 auto", width: "100%" }}
      >
        <div className="min-h-full flex flex-col">
          {/* Load More Button - at top when needed */}
          {hasMore && messages.length > 0 && (
            <div className="text-center mb-4 flex-shrink-0">
              <button
                onClick={loadMoreMessages}
                disabled={loadingMore}
                className="px-4 py-2 bg-gray-400 dark:bg-gray-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMore ? "Loading..." : "Load More Messages"}
              </button>
            </div>
          )}

          {/* Spacer to push messages to bottom when there aren't many */}
          <div className="flex-1"></div>

          {/* Messages List */}
          <div className="space-y-1 flex-shrink-0">
            {messages.length === 0 ? (
              <div className="text-center py-8 flex items-center justify-center h-full">
                <p className="text-gray-600 dark:text-gray-400">
                  No messages yet. Start the conversation!
                </p>
              </div>
            ) : (
              messages.map((message, index) => {
                const previousMessage = index > 0 ? messages[index - 1] : null;
                const isGrouped = shouldGroupMessage(message, previousMessage);
                const isOwnMessage = message.senderId === user.uid;

                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                    onMouseEnter={() => setHoveredMessage(message.id)}
                    onMouseLeave={() => setHoveredMessage(null)}
                  >
                    <div className={`max-w-xs lg:max-w-md xl:max-w-lg ${
                      isOwnMessage ? "ml-12" : "mr-12"
                    }`}>
                      {/* Message Header (only if not grouped) */}
                      {!isGrouped && (
                        <div className={`flex items-center gap-2 mb-1 ${
                          isOwnMessage ? "justify-end" : "justify-start"
                        }`}>
                          {!isOwnMessage && (
                            <div className="w-6 h-6 bg-blue-400 dark:bg-blue-500 border border-black dark:border-gray-600 rounded-full flex items-center justify-center text-xs font-bold text-black dark:text-white">
                              {getUserInitials(message.senderName, message.senderEmail)}
                            </div>
                          )}
                          <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                            {isOwnMessage ? "You" : message.senderName}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatTimestamp(message.timestamp)}
                          </span>
                        </div>
                      )}

                      {/* Message Content */}
                      <div className={`relative group ${isOwnMessage ? "text-right" : "text-left"}`}>
                        <div
                          className={`inline-block px-4 py-2 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] ${
                            isOwnMessage
                              ? "bg-blue-400 dark:bg-blue-500 text-black dark:text-white"
                              : "bg-white dark:bg-gray-700 text-black dark:text-white"
                          } break-words ${
                            isEmojiOnlyMessage(message.text) ? "text-6xl leading-tight" : ""
                          }`}
                        >
                          {message.text}
                        </div>

                        {/* Delete Button (on hover) */}
                        {hoveredMessage === message.id && (
                          <button
                            onClick={() => deleteMessage(message.id, message.senderId)}
                            className={`absolute top-0 w-6 h-6 bg-red-500 border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center ${
                              isOwnMessage ? "-left-8" : "-right-8"
                            }`}
                            title="Delete message"
                          >
                            <FiTrash2 size={12} className="text-white" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Scroll anchor at bottom */}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );
};

export default MessageLog;