import React, { useState, useEffect, useRef } from "react";
import type { User } from "firebase/auth";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  serverTimestamp,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  startAfter,
  getDocs,
  where,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { FiTrash2, FiUserPlus, FiSend, FiSmile, FiX } from "react-icons/fi";
import EmojiPicker from "./EmojiPicker";

interface DirectMessageRoomProps {
  dmId: string;
  participants: string[];
  user: User;
  roomName: string;
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderEmail: string;
  timestamp: any;
  createdAt: any;
}

interface ParticipantInfo {
  id: string;
  name: string;
  email: string;
  status?: string;
}

const DirectMessageRoom: React.FC<DirectMessageRoomProps> = ({
  dmId,
  participants,
  user,
  roomName,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [hoveredMessage, setHoveredMessage] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [participantInfo, setParticipantInfo] = useState<ParticipantInfo[]>([]);
  const [friends, setFriends] = useState<ParticipantInfo[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const lastMessageDoc = useRef<any>(null);

  // Check if user is scrolled to bottom
  const isScrolledToBottom = () => {
    if (!messagesContainerRef.current) return true;
    const container = messagesContainerRef.current;
    const threshold = 100;
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  };

  // Scroll to bottom
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  // Load participant information
  useEffect(() => {
    const loadParticipants = async () => {
      try {
        const participantPromises = participants.map(async (participantId) => {
          const userQuery = query(
            collection(db, "users"),
            where("userId", "==", participantId),
            limit(1)
          );
          const userDocs = await getDocs(userQuery);
          if (!userDocs.empty) {
            const userData = userDocs.docs[0].data();
            return {
              id: participantId,
              name: userData.displayName || userData.email?.split("@")[0] || "Unknown User",
              email: userData.email || "",
              status: userData.status || "away",
            };
          }
          return {
            id: participantId,
            name: "Unknown User",
            email: "",
            status: "away",
          };
        });

        const participantData = await Promise.all(participantPromises);
        setParticipantInfo(participantData);
      } catch (error) {
        console.error("Error loading participants:", error);
      }
    };

    if (participants.length > 0) {
      loadParticipants();
    }
  }, [participants]);

  // Load user's friends for adding to DM
  useEffect(() => {
    const loadFriends = async () => {
      try {
        const userQuery = query(
          collection(db, "users"),
          where("userId", "==", user.uid),
          limit(1)
        );
        const userDocs = await getDocs(userQuery);
        if (!userDocs.empty) {
          const userData = userDocs.docs[0].data();
          const userFriends = userData.friends || [];
          
          // Load friend information
          if (userFriends.length > 0) {
            const friendPromises = userFriends
              .filter((friendId: string) => !participants.includes(friendId))
              .map(async (friendId: string) => {
                const friendQuery = query(
                  collection(db, "users"),
                  where("userId", "==", friendId),
                  limit(1)
                );
                const friendDocs = await getDocs(friendQuery);
                if (!friendDocs.empty) {
                  const friendData = friendDocs.docs[0].data();
                  return {
                    id: friendId,
                    name: friendData.displayName || friendData.email?.split("@")[0] || "Unknown User",
                    email: friendData.email || "",
                    status: friendData.status || "away",
                  };
                }
                return null;
              });

            const friendData = await Promise.all(friendPromises);
            setFriends(friendData.filter(Boolean) as ParticipantInfo[]);
          }
        }
      } catch (error) {
        console.error("Error loading friends:", error);
      }
    };

    loadFriends();
  }, [user.uid, participants]);

  // Load messages
  useEffect(() => {
    if (!dmId) return;

    setLoading(true);
    setMessages([]);
    lastMessageDoc.current = null;
    setHasMore(true);

    const messagesRef = collection(db, `private_messages/${dmId}/messages`);
    const messagesQuery = query(
      messagesRef,
      orderBy("timestamp", "desc"),
      limit(50)
    );

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

        messagesList.reverse();
        setMessages(messagesList);
        
        if (snapshot.docs.length > 0) {
          lastMessageDoc.current = snapshot.docs[snapshot.docs.length - 1];
        }
        
        setHasMore(snapshot.docs.length === 50);
        setLoading(false);

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
  }, [dmId]);

  // Send message function
  const sendMessage = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || sending) return;

    setSending(true);
    const startTime = performance.now();
    console.log("💬 Starting DM message send...");

    // Optimistic UI update - clear input immediately
    const originalMessage = message;
    setMessage("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      // Use batch writes for better performance
      const batchStart = performance.now();
      const { writeBatch } = await import("firebase/firestore");
      const batch = writeBatch(db);

      // Add message to batch
      const messagesRef = collection(db, `private_messages/${dmId}/messages`);
      const messageRef = doc(messagesRef);
      batch.set(messageRef, {
        text: trimmedMessage,
        senderId: user.uid,
        senderName: user.displayName || user.email?.split("@")[0] || "Anonymous",
        senderEmail: user.email || "",
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      // Update DM room in batch
      const dmRef = doc(db, "private_messages", dmId);
      batch.update(dmRef, {
        lastMessageTimestamp: serverTimestamp(),
        lastMessage: trimmedMessage.substring(0, 100),
      });

      // Execute both writes atomically
      await batch.commit();
      const batchTime = performance.now() - batchStart;

      const totalTime = performance.now() - startTime;
      console.log(`📤 DM message sent successfully in ${totalTime.toFixed(2)}ms`);
      console.log("DM Performance breakdown:", {
        batchWrite: `${batchTime.toFixed(2)}ms`,
        total: `${totalTime.toFixed(2)}ms`
      });
    } catch (error) {
      const errorTime = performance.now() - startTime;
      console.error(`❌ DM message send failed after ${errorTime.toFixed(2)}ms:`, error);
      
      // Revert optimistic update on error
      setMessage(originalMessage);
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
      }
      
      alert("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        120
      )}px`;
    }
  };

  // Handle emoji selection
  const handleEmojiSelect = (emoji: string) => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const startPos = textarea.selectionStart;
      const endPos = textarea.selectionEnd;
      
      const newValue = message.substring(0, startPos) + emoji + message.substring(endPos);
      setMessage(newValue);
      
      setTimeout(() => {
        if (textarea) {
          const newCursorPos = startPos + emoji.length;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
          textarea.focus();
          
          textarea.style.height = "auto";
          textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
        }
      }, 0);
    }
  };

  // Delete message
  const deleteMessage = async (messageId: string, senderId: string) => {
    try {
      if (senderId !== user.uid) {
        alert("You can only delete your own messages");
        return;
      }

      const messageRef = doc(db, `private_messages/${dmId}/messages/${messageId}`);
      await deleteDoc(messageRef);
    } catch (error) {
      console.error("Error deleting message:", error);
      alert("Failed to delete message. Please try again.");
    }
  };

  // Add friend to DM
  const addFriendToDM = async (friendId: string) => {
    try {
      if (participants.length >= 20) {
        alert("This DM room has reached the maximum of 20 participants.");
        return;
      }

      const dmRef = doc(db, "private_messages", dmId);
      const dmDoc = await getDoc(dmRef);
      
      if (dmDoc.exists()) {
        const currentParticipants = dmDoc.data().participants || [];
        if (!currentParticipants.includes(friendId)) {
          await updateDoc(dmRef, {
            participants: [...currentParticipants, friendId],
          });
        }
      }

      setShowAddFriend(false);
    } catch (error) {
      console.error("Error adding friend to DM:", error);
      alert("Failed to add friend to DM. Please try again.");
    }
  };

  // Check if message contains only emojis and is 3 or fewer emoji characters
  const isEmojiOnlyMessage = (text: string): boolean => {
    if (!text || text.length === 0) return false;
    
    const cleanText = text.replace(/\s/g, '');
    if (cleanText.length === 0) return false;
    
    const emojiRegex = /^[\p{Emoji}\p{Emoji_Modifier}\p{Emoji_Component}\p{Emoji_Modifier_Base}\p{Emoji_Presentation}\u200d\ufe0f\u2640\u2642\u2695\u26a7\u2764\ufe0f\u200d\u1f3f3\u1f3f4\u1f3fb\u1f3fc\u1f3fd\u1f3fe\u1f3ff]+$/u;
    
    if (!emojiRegex.test(cleanText)) return false;
    
    const emojiCount = [...cleanText].length;
    return emojiCount <= 3;
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

  // Get user initials
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
    <div className="flex-1 bg-white dark:bg-gray-900 flex flex-col h-full">
      {/* Messages - Takes full space */}
      <div className="flex-1 flex flex-col min-h-0">
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-4 py-4"
          style={{ maxWidth: "1000px", margin: "0 auto", width: "100%" }}
        >
          <div className="min-h-full flex flex-col">
            <div className="flex-1"></div>
            
            {/* Add Friend Button - Now in messages area */}
            {participants.length < 20 && friends.length > 0 && (
              <div className="mb-4 text-center">
                <button
                  onClick={() => setShowAddFriend(true)}
                  className="px-3 py-2 bg-green-400 dark:bg-green-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white flex items-center gap-2 mx-auto"
                >
                  <FiUserPlus size={16} />
                  Add Friend to Chat
                </button>
              </div>
            )}
            
            <div className="space-y-1 flex-shrink-0">
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 dark:text-gray-400">
                    No messages yet. Start the conversation!
                  </p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isOwnMessage = msg.senderId === user.uid;

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                      onMouseEnter={() => setHoveredMessage(msg.id)}
                      onMouseLeave={() => setHoveredMessage(null)}
                    >
                      <div className={`max-w-xs lg:max-w-md xl:max-w-lg ${
                        isOwnMessage ? "ml-12" : "mr-12"
                      }`}>
                        <div className={`flex items-center gap-2 mb-1 ${
                          isOwnMessage ? "justify-end" : "justify-start"
                        }`}>
                          {!isOwnMessage && (
                            <div className="w-6 h-6 bg-purple-400 dark:bg-purple-500 border border-black dark:border-gray-600 rounded-full flex items-center justify-center text-xs font-bold text-black dark:text-white">
                              {getUserInitials(msg.senderName, msg.senderEmail)}
                            </div>
                          )}
                          <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                            {isOwnMessage ? "You" : msg.senderName}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatTimestamp(msg.timestamp)}
                          </span>
                        </div>

                        <div className={`relative group ${isOwnMessage ? "text-right" : "text-left"}`}>
                          <div
                            className={`inline-block px-4 py-2 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] ${
                              isOwnMessage
                                ? "bg-purple-400 dark:bg-purple-500 text-black dark:text-white"
                                : "bg-white dark:bg-gray-700 text-black dark:text-white"
                            } break-words ${
                              isEmojiOnlyMessage(msg.text) ? "text-6xl leading-tight" : ""
                            }`}
                          >
                            {msg.text}
                          </div>

                          {hoveredMessage === msg.id && msg.senderId === user.uid && (
                            <button
                              onClick={() => deleteMessage(msg.id, msg.senderId)}
                              className={`absolute top-0 w-6 h-6 bg-red-500 border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center ${
                                isOwnMessage ? "-left-8" : "-right-8"
                              }`}
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

            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Message Composer */}
      <div className="border-t-4 border-black dark:border-gray-600 bg-gray-100 dark:bg-gray-800 p-4">
        <div className="max-w-4xl mx-auto" style={{ maxWidth: "1000px" }}>
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                disabled={sending}
                rows={1}
                className="w-full px-4 py-3 pr-12 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] transition-all resize-none overflow-hidden font-medium leading-tight"
                style={{
                  minHeight: "48px",
                  maxHeight: "200px",
                  lineHeight: "1.4",
                }}
              />
              
              <button
                ref={emojiButtonRef}
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                disabled={sending}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-yellow-400 dark:bg-yellow-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                title="Add emoji"
                type="button"
              >
                <FiSmile size={14} className="text-black dark:text-white hover:translate-x-0.5 hover:translate-y-0.5 transition-transform" />
              </button>
            </div>

            <button
              onClick={sendMessage}
              disabled={!message.trim() || sending}
              className="w-12 h-12 bg-purple-400 dark:bg-purple-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] disabled:hover:translate-x-0 disabled:hover:translate-y-0 flex-shrink-0"
              title="Send message"
            >
              <FiSend 
                size={16} 
                className={`text-black dark:text-white ${
                  sending ? "opacity-50" : ""
                }`} 
              />
            </button>
          </div>
        </div>
        
        {showEmojiPicker && (
          <EmojiPicker
            onEmojiSelect={handleEmojiSelect}
            onClose={() => setShowEmojiPicker(false)}
            anchorRef={emojiButtonRef}
          />
        )}
      </div>

      {/* Add Friend Modal */}
      {showAddFriend && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(55,65,81,1)] p-6 max-w-md w-full m-4 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-black uppercase text-black dark:text-white">
                Add Friends
              </h3>
              <button
                onClick={() => setShowAddFriend(false)}
                className="w-8 h-8 bg-red-500 dark:bg-red-600 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
              >
                <FiX size={16} className="text-white" />
              </button>
            </div>
            
            <div className="space-y-2">
              {friends.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400 text-center py-4">
                  No friends available to add to this conversation.
                </p>
              ) : (
                friends.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-700 border-2 border-black dark:border-gray-600"
                  >
                    <div>
                      <p className="font-bold text-black dark:text-white">{friend.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{friend.email}</p>
                    </div>
                    <button
                      onClick={() => addFriendToDM(friend.id)}
                      className="px-3 py-1 bg-green-400 dark:bg-green-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white"
                    >
                      Add
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DirectMessageRoom;