import React, { useState, useEffect, useRef, useCallback } from "react";
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
  startAfter,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { FiTrash2, FiMoreVertical, FiDownload, FiPlay, FiPause, FiFile, FiImage, FiMusic } from "react-icons/fi";

/**
 * Message attachment interface
 */
interface MessageAttachment {
  type: "image" | "audio" | "file";
  url: string;
  name: string;
  size: number;
  mimeType: string;
}

/**
 * Video embed data
 */
interface VideoEmbed {
  type: "youtube" | "vimeo";
  videoId: string;
  url: string;
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderEmail: string;
  timestamp: any;
  createdAt: any;
  attachment?: MessageAttachment;
  videoEmbed?: VideoEmbed;
}

interface MessageLogProps {
  serverId?: string;
  roomId?: string;
  privateMessageId?: string;
  user: User;
  userRole?: "owner" | "admin" | "member";
}

/**
 * MessageLog Component
 * 
 * Enhanced message log with media rendering:
 * - Images displayed inline
 * - Audio files with playback controls
 * - File attachments with download buttons
 * - YouTube/Vimeo video embeds
 */
const MessageLog: React.FC<MessageLogProps> = ({
  serverId,
  roomId,
  privateMessageId,
  user,
  userRole = "member",
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [hoveredMessage, setHoveredMessage] = useState<string | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [hoveredImage, setHoveredImage] = useState<string | null>(null);
  const [modalImage, setModalImage] = useState<{
    url: string;
    name: string;
  } | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastMessageDoc = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  /**
   * Extract video ID from YouTube URL
   */
  const extractYouTubeId = (url: string): string | null => {
    const patterns = [
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&\s]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^&\s]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^&\s]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  };

  /**
   * Extract video ID from Vimeo URL
   */
  const extractVimeoId = (url: string): string | null => {
    const patterns = [
      /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/([0-9]+)/,
      /(?:https?:\/\/)?player\.vimeo\.com\/video\/([0-9]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  };

  /**
   * Detect video links in message text
   */
  const detectVideoEmbed = (text: string): VideoEmbed | null => {
    // Check for YouTube
    const youtubeId = extractYouTubeId(text);
    if (youtubeId) {
      return {
        type: "youtube",
        videoId: youtubeId,
        url: text,
      };
    }

    // Check for Vimeo
    const vimeoId = extractVimeoId(text);
    if (vimeoId) {
      return {
        type: "vimeo",
        videoId: vimeoId,
        url: text,
      };
    }

    return null;
  };

  /**
   * Process message to extract video embeds
   */
  const processMessage = (messageData: any): Message => {
    const message: Message = {
      id: messageData.id,
      text: messageData.text || "",
      senderId: messageData.senderId || "",
      senderName: messageData.senderName || "Unknown User",
      senderEmail: messageData.senderEmail || "",
      timestamp: messageData.timestamp,
      createdAt: messageData.createdAt || messageData.timestamp,
      attachment: messageData.attachment,
    };

    // Check for video embed if no attachment
    if (!message.attachment && message.text) {
      const videoEmbed = detectVideoEmbed(message.text);
      if (videoEmbed) {
        message.videoEmbed = videoEmbed;
      }
    }

    return message;
  };

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

  // Load initial messages and set up real-time listener
  useEffect(() => {
    if ((!serverId || !roomId) && !privateMessageId) return;

    setLoading(true);
    setMessages([]);
    lastMessageDoc.current = null;
    setHasMore(true);

    const messagesRef = privateMessageId
      ? collection(db, `private_messages/${privateMessageId}/messages`)
      : collection(db, `servers/${serverId}/chat_rooms/${roomId}/messages`);

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
          messagesList.push(processMessage({ ...data, id: doc.id }));
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
  }, [serverId, roomId, privateMessageId]);

  // Load more messages (pagination)
  const loadMoreMessages = async () => {
    if (!hasMore || loadingMore || !lastMessageDoc.current) return;

    setLoadingMore(true);

    try {
      const messagesRef = privateMessageId
        ? collection(db, `private_messages/${privateMessageId}/messages`)
        : collection(db, `servers/${serverId}/chat_rooms/${roomId}/messages`);

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
        moreMessages.push(processMessage({ ...data, id: doc.id }));
      });

      moreMessages.reverse();
      setMessages((prev) => [...moreMessages, ...prev]);
      
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
      const canDelete = senderId === user.uid || 
                       userRole === "owner" || 
                       userRole === "admin";

      if (!canDelete) {
        alert("You don't have permission to delete this message");
        return;
      }

      const messageRef = privateMessageId
        ? doc(db, `private_messages/${privateMessageId}/messages/${messageId}`)
        : doc(db, `servers/${serverId}/chat_rooms/${roomId}/messages/${messageId}`);

      await deleteDoc(messageRef);
      console.log(`Message ${messageId} deleted successfully`);
    } catch (error) {
      console.error("Error deleting message:", error);
      alert("Failed to delete message. Please try again.");
    }
  };

  // Toggle audio playback
  const toggleAudioPlayback = useCallback((messageId: string, audioUrl: string) => {
    if (!audioRef.current) return;

    if (playingAudio === messageId) {
      audioRef.current.pause();
      setPlayingAudio(null);
    } else {
      audioRef.current.src = audioUrl;
      audioRef.current.play();
      setPlayingAudio(messageId);
    }
  }, [playingAudio]);

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

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Check if messages should be grouped
  const shouldGroupMessage = (currentMessage: Message, previousMessage: Message | null) => {
    if (!previousMessage) return false;
    
    if (currentMessage.senderId !== previousMessage.senderId) return false;
    
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

  // Check if message contains only emojis
  const isEmojiOnlyMessage = (text: string): boolean => {
    if (!text || text.length === 0) return false;
    
    const cleanText = text.replace(/\s/g, '');
    if (cleanText.length === 0) return false;
    
    const emojiRegex = /^[\p{Emoji}\p{Emoji_Modifier}\p{Emoji_Component}\p{Emoji_Modifier_Base}\p{Emoji_Presentation}\u200d\ufe0f\u2640\u2642\u2695\u26a7\u2764\ufe0f\u200d\u1f3f3\u1f3f4\u1f3fb\u1f3fc\u1f3fd\u1f3fe\u1f3ff]+$/u;
    
    if (!emojiRegex.test(cleanText)) return false;
    
    const emojiCount = [...cleanText].length;
    
    return emojiCount <= 3;
  };

  // Render video embed
  const renderVideoEmbed = (embed: VideoEmbed) => {
    if (embed.type === "youtube") {
      return (
        <div className="mt-2 relative pb-[56.25%] h-0 overflow-hidden rounded border-2 border-black dark:border-gray-600">
          <iframe
            className="absolute top-0 left-0 w-full h-full"
            src={`https://www.youtube.com/embed/${embed.videoId}`}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }

    if (embed.type === "vimeo") {
      return (
        <div className="mt-2 relative pb-[56.25%] h-0 overflow-hidden rounded border-2 border-black dark:border-gray-600">
          <iframe
            className="absolute top-0 left-0 w-full h-full"
            src={`https://player.vimeo.com/video/${embed.videoId}`}
            title="Vimeo video player"
            frameBorder="0"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }

    return null;
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
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onEnded={() => setPlayingAudio(null)}
        onError={() => setPlayingAudio(null)}
      />

      {/* Messages Container */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{ maxWidth: "1000px", margin: "0 auto", width: "100%" }}
      >
        <div className="min-h-full flex flex-col">
          {/* Load More Button */}
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

          {/* Spacer */}
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
                      {/* Message Header */}
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
                        {/* Text content */}
                        {message.text && !message.videoEmbed && (
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
                        )}

                        {/* Video embed */}
                        {message.videoEmbed && (
                          <div className={`inline-block ${isOwnMessage ? "" : ""}`}>
                            <div className="mb-2">
                              <div
                                className={`inline-block px-4 py-2 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] ${
                                  isOwnMessage
                                    ? "bg-blue-400 dark:bg-blue-500 text-black dark:text-white"
                                    : "bg-white dark:bg-gray-700 text-black dark:text-white"
                                } break-words`}
                              >
                                {message.text}
                              </div>
                            </div>
                            <div className="max-w-md">
                              {renderVideoEmbed(message.videoEmbed)}
                            </div>
                          </div>
                        )}

                        {/* Attachment */}
                        {message.attachment && (
                          <div className={`mt-2 ${isOwnMessage ? "inline-block" : "inline-block"}`}>
                            {/* Image attachment */}
                            {message.attachment.type === "image" && (
                              <div className="max-w-xs relative">
                                <img 
                                  src={message.attachment.url} 
                                  alt={message.attachment.name}
                                  className="w-full max-h-48 object-cover rounded border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] cursor-pointer hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
                                  onClick={() => setModalImage({
                                    url: message.attachment!.url,
                                    name: message.attachment!.name
                                  })}
                                  onMouseEnter={() => setHoveredImage(message.id)}
                                  onMouseLeave={() => setHoveredImage(null)}
                                />
                                
                                {/* Download button on hover */}
                                {hoveredImage === message.id && (
                                  <a
                                    href={message.attachment.url}
                                    download={message.attachment.name}
                                    className="absolute bottom-2 right-2 w-8 h-8 bg-black/70 backdrop-blur-sm border-2 border-white shadow-[2px_2px_0px_0px_rgba(255,255,255,0.8)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center rounded"
                                    title="Download image"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <FiDownload size={14} className="text-white" />
                                  </a>
                                )}
                              </div>
                            )}

                            {/* Audio attachment */}
                            {message.attachment.type === "audio" && (
                              <div className="bg-white dark:bg-gray-700 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] p-3 rounded">
                                <div className="flex items-center gap-3">
                                  <button
                                    onClick={() => toggleAudioPlayback(message.id, message.attachment!.url)}
                                    className="w-10 h-10 bg-purple-400 dark:bg-purple-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
                                  >
                                    {playingAudio === message.id ? (
                                      <FiPause size={16} className="text-black dark:text-white" />
                                    ) : (
                                      <FiPlay size={16} className="text-black dark:text-white" />
                                    )}
                                  </button>
                                  
                                  <div className="flex-1">
                                    <p className="font-bold text-sm text-black dark:text-white truncate">
                                      {message.attachment.name}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      Audio • {formatFileSize(message.attachment.size)}
                                    </p>
                                  </div>

                                  <a
                                    href={message.attachment.url}
                                    download={message.attachment.name}
                                    className="w-8 h-8 bg-blue-400 dark:bg-blue-500 border border-black dark:border-gray-600 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] dark:shadow-[1px_1px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
                                    title="Download"
                                  >
                                    <FiDownload size={12} className="text-black dark:text-white" />
                                  </a>
                                </div>
                              </div>
                            )}

                            {/* File attachment */}
                            {message.attachment.type === "file" && (
                              <div className="bg-white dark:bg-gray-700 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] p-3 rounded">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 border border-black dark:border-gray-500 rounded flex items-center justify-center">
                                    <FiFile size={20} className="text-blue-600 dark:text-blue-400" />
                                  </div>
                                  
                                  <div className="flex-1">
                                    <p className="font-bold text-sm text-black dark:text-white truncate">
                                      {message.attachment.name}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {formatFileSize(message.attachment.size)}
                                    </p>
                                  </div>

                                  <a
                                    href={message.attachment.url}
                                    download={message.attachment.name}
                                    className="w-8 h-8 bg-blue-400 dark:bg-blue-500 border border-black dark:border-gray-600 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] dark:shadow-[1px_1px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
                                    title="Download"
                                  >
                                    <FiDownload size={12} className="text-black dark:text-white" />
                                  </a>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Delete Button */}
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

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Image Modal */}
      {modalImage && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(55,65,81,1)] p-4 mb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-black dark:text-white truncate pr-4">
                  {modalImage.name}
                </h3>
                <div className="flex items-center gap-2">
                  {/* Download button */}
                  <a
                    href={modalImage.url}
                    download={modalImage.name}
                    className="w-10 h-10 bg-blue-400 dark:bg-blue-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
                    title="Download image"
                  >
                    <FiDownload size={16} className="text-black dark:text-white" />
                  </a>
                  
                  {/* Close button */}
                  <button
                    onClick={() => setModalImage(null)}
                    className="w-10 h-10 bg-red-400 dark:bg-red-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
                    title="Close"
                  >
                    <span className="text-black dark:text-white font-bold">×</span>
                  </button>
                </div>
              </div>
            </div>
            
            {/* Modal Image */}
            <div className="bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(55,65,81,1)] p-4 flex items-center justify-center overflow-hidden">
              <img 
                src={modalImage.url} 
                alt={modalImage.name}
                className="max-w-full max-h-[70vh] object-contain"
                onClick={() => setModalImage(null)}
              />
            </div>
          </div>
          
          {/* Backdrop click to close */}
          <div 
            className="absolute inset-0 -z-10"
            onClick={() => setModalImage(null)}
          />
        </div>
      )}
    </div>
  );
};

export default MessageLog;