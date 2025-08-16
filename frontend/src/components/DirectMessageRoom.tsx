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
import { db, storage } from "../firebase/config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { FiTrash2, FiUserPlus, FiSend, FiSmile, FiX, FiDownload, FiPlay, FiPause, FiFile, FiImage, FiMusic } from "react-icons/fi";
import EmojiPicker from "./EmojiPicker";

interface DirectMessageRoomProps {
  dmId: string;
  participants: string[];
  user: User;
  roomName: string;
}

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

/**
 * Media file from Personal Media Bucket
 */
interface MediaFile {
  id: string;
  name: string;
  type: "image" | "audio" | "file";
  url: string;
  size: number;
  uploadedAt: any;
  mimeType: string;
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
  const [hoveredImage, setHoveredImage] = useState<string | null>(null);
  const [modalImage, setModalImage] = useState<{
    url: string;
    name: string;
  } | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<MessageAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showMediaBucket, setShowMediaBucket] = useState(false);
  const [userMediaFiles, setUserMediaFiles] = useState<any[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const lastMessageDoc = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  /**
   * Toggle audio playback
   */
  const toggleAudioPlayback = (messageId: string, audioUrl: string) => {
    if (!audioRef.current) return;

    if (playingAudio === messageId) {
      audioRef.current.pause();
      setPlayingAudio(null);
    } else {
      audioRef.current.src = audioUrl;
      audioRef.current.play();
      setPlayingAudio(messageId);
    }
  };

  /**
   * Format file size
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  /**
   * Determine file type from MIME type
   */
  const getFileType = (mimeType: string): "image" | "audio" | "file" => {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("audio/")) return "audio";
    return "file";
  };

  /**
   * Upload file to Firebase Storage
   */
  const uploadFile = async (file: File): Promise<MessageAttachment | null> => {
    const maxSize = 10 * 1024 * 1024; // 10MB limit
    
    if (file.size > maxSize) {
      alert("File size must be less than 10MB");
      return null;
    }

    setUploading(true);
    try {
      const fileName = `${Date.now()}_${file.name}`;
      const fileType = getFileType(file.type);
      const storagePath = `message_attachments/${user.uid}/${fileType}/${fileName}`;
      const storageRef = ref(storage, storagePath);

      console.log("Uploading file:", file.name, "to", storagePath);

      const uploadResult = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(uploadResult.ref);

      return {
        type: fileType,
        url: downloadURL,
        name: file.name,
        size: file.size,
        mimeType: file.type,
      };
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Failed to upload file. Please try again.");
      return null;
    } finally {
      setUploading(false);
    }
  };

  /**
   * Handle file selection from input
   */
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const attachment = await uploadFile(file);
    if (attachment) {
      setAttachment(attachment);
    }

    // Reset input
    e.target.value = "";
  };

  /**
   * Handle drag over events
   */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if dragging files from desktop or media bucket data
    if (e.dataTransfer.types.includes("Files") || e.dataTransfer.types.includes("application/json")) {
      setDragOver(true);
    }
  };

  /**
   * Handle drag leave events
   */
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only set dragOver to false if leaving the composer area
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOver(false);
    }
  };

  /**
   * Handle file drop
   */
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    // Check for files from desktop
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0]; // Only handle first file
      const attachment = await uploadFile(file);
      if (attachment) {
        setAttachment(attachment);
      }
      return;
    }

    // Check for data from Personal Media Bucket
    const mediaData = e.dataTransfer.getData("application/json");
    if (mediaData) {
      try {
        const mediaFile = JSON.parse(mediaData);
        setAttachment({
          type: mediaFile.type,
          url: mediaFile.url,
          name: mediaFile.name,
          size: mediaFile.size,
          mimeType: mediaFile.mimeType,
        });
      } catch (error) {
        console.error("Error parsing media data:", error);
      }
    }
  };

  /**
   * Select media from Personal Media Bucket
   */
  const selectMediaFromBucket = (mediaFile: MediaFile) => {
    setAttachment({
      type: mediaFile.type,
      url: mediaFile.url,
      name: mediaFile.name,
      size: mediaFile.size,
      mimeType: mediaFile.mimeType,
    });
    setShowMediaBucket(false);
  };

  /**
   * Render video embed
   */
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

  /**
   * Load user's media files when media bucket is opened
   */
  useEffect(() => {
    if (!showMediaBucket || !user?.uid) return;

    const mediaQuery = query(
      collection(db, "user_media"),
      where("userId", "==", user.uid),
      orderBy("uploadedAt", "desc")
    );

    const unsubscribe = onSnapshot(mediaQuery, (snapshot) => {
      const files: MediaFile[] = [];
      snapshot.docs.forEach((doc) => {
        const data = doc.data() as MediaFile;
        files.push({ ...data, id: doc.id });
      });
      setUserMediaFiles(files);
    });

    return () => unsubscribe();
  }, [showMediaBucket, user?.uid]);

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
  }, [dmId]);

  // Send message function
  const sendMessage = async () => {
    const trimmedMessage = message.trim();
    if ((!trimmedMessage && !attachment) || sending || uploading) return;

    setSending(true);
    const startTime = performance.now();
    console.log("💬 Starting DM message send...");

    // Optimistic UI update - clear input immediately
    const originalMessage = message;
    const originalAttachment = attachment;
    setMessage("");
    setAttachment(null);
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

      const messageData: any = {
        text: trimmedMessage,
        senderId: user.uid,
        senderName: user.displayName || user.email?.split("@")[0] || "Anonymous",
        senderEmail: user.email || "",
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
      };

      // Add attachment data if present
      if (originalAttachment) {
        messageData.attachment = {
          type: originalAttachment.type,
          url: originalAttachment.url,
          name: originalAttachment.name,
          size: originalAttachment.size,
          mimeType: originalAttachment.mimeType,
        };
      }

      batch.set(messageRef, messageData);

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
      setAttachment(originalAttachment);
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
                          {/* Text content */}
                          {msg.text && !msg.videoEmbed && (
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
                          )}

                          {/* Video embed */}
                          {msg.videoEmbed && (
                            <div className={`inline-block ${isOwnMessage ? "" : ""}`}>
                              <div className="mb-2">
                                <div
                                  className={`inline-block px-4 py-2 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] ${
                                    isOwnMessage
                                      ? "bg-purple-400 dark:bg-purple-500 text-black dark:text-white"
                                      : "bg-white dark:bg-gray-700 text-black dark:text-white"
                                  } break-words`}
                                >
                                  {msg.text}
                                </div>
                              </div>
                              <div className="max-w-md">
                                {renderVideoEmbed(msg.videoEmbed)}
                              </div>
                            </div>
                          )}

                          {/* Attachment */}
                          {msg.attachment && (
                            <div className={`mt-2 ${isOwnMessage ? "inline-block" : "inline-block"}`}>
                              {/* Image attachment */}
                              {msg.attachment.type === "image" && (
                                <div className="max-w-xs relative">
                                  <img 
                                    src={msg.attachment.url} 
                                    alt={msg.attachment.name}
                                    className="w-full max-h-48 object-cover rounded border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] cursor-pointer hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
                                    onClick={() => setModalImage({
                                      url: msg.attachment!.url,
                                      name: msg.attachment!.name
                                    })}
                                    onMouseEnter={() => setHoveredImage(msg.id)}
                                    onMouseLeave={() => setHoveredImage(null)}
                                  />
                                  
                                  {/* Download button on hover */}
                                  {hoveredImage === msg.id && (
                                    <a
                                      href={msg.attachment.url}
                                      download={msg.attachment.name}
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
                              {msg.attachment.type === "audio" && (
                                <div className="bg-white dark:bg-gray-700 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] p-3 rounded">
                                  <div className="flex items-center gap-3">
                                    <button
                                      onClick={() => toggleAudioPlayback(msg.id, msg.attachment!.url)}
                                      className="w-10 h-10 bg-purple-400 dark:bg-purple-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
                                    >
                                      {playingAudio === msg.id ? (
                                        <FiPause size={16} className="text-black dark:text-white" />
                                      ) : (
                                        <FiPlay size={16} className="text-black dark:text-white" />
                                      )}
                                    </button>
                                    
                                    <div className="flex-1">
                                      <p className="font-bold text-sm text-black dark:text-white truncate">
                                        {msg.attachment.name}
                                      </p>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Audio • {formatFileSize(msg.attachment.size)}
                                      </p>
                                    </div>

                                    <a
                                      href={msg.attachment.url}
                                      download={msg.attachment.name}
                                      className="w-8 h-8 bg-blue-400 dark:bg-blue-500 border border-black dark:border-gray-600 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] dark:shadow-[1px_1px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
                                      title="Download"
                                    >
                                      <FiDownload size={12} className="text-black dark:text-white" />
                                    </a>
                                  </div>
                                </div>
                              )}

                              {/* File attachment */}
                              {msg.attachment.type === "file" && (
                                <div className="bg-white dark:bg-gray-700 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] p-3 rounded">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 border border-black dark:border-gray-500 rounded flex items-center justify-center">
                                      <FiFile size={20} className="text-blue-600 dark:text-blue-400" />
                                    </div>
                                    
                                    <div className="flex-1">
                                      <p className="font-bold text-sm text-black dark:text-white truncate">
                                        {msg.attachment.name}
                                      </p>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {formatFileSize(msg.attachment.size)}
                                      </p>
                                    </div>

                                    <a
                                      href={msg.attachment.url}
                                      download={msg.attachment.name}
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
                          {hoveredMessage === msg.id && msg.senderId === user.uid && (
                            <button
                              onClick={() => deleteMessage(msg.id, msg.senderId)}
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

            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Message Composer */}
      <div 
        className="border-t-4 border-black dark:border-gray-600 bg-gray-100 dark:bg-gray-800 p-4"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div
          className="max-w-4xl mx-auto"
          style={{ maxWidth: "1000px" }}
        >
          {/* Drag overlay */}
          {dragOver && (
            <div className="absolute inset-0 bg-gradient-to-br from-blue-400/30 to-purple-400/30 dark:from-blue-500/30 dark:to-purple-500/30 border-4 border-dashed border-blue-600 dark:border-blue-400 flex items-center justify-center z-10 pointer-events-none animate-pulse">
              <div className="bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(55,65,81,1)] p-8 rounded-lg transform scale-105">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">📎</span>
                  <p className="text-xl font-black text-black dark:text-white">Drop to Attach</p>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                  Release to add file to your message
                </p>
              </div>
            </div>
          )}

          {/* Attachment preview */}
          {attachment && (
            <div className="mb-3 bg-white dark:bg-gray-700 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Icon based on type */}
                  {attachment.type === "image" && <FiImage size={20} className="text-green-600 dark:text-green-400" />}
                  {attachment.type === "audio" && <FiMusic size={20} className="text-purple-600 dark:text-purple-400" />}
                  {attachment.type === "file" && <FiFile size={20} className="text-blue-600 dark:text-blue-400" />}
                  
                  <div>
                    <p className="font-bold text-sm text-black dark:text-white truncate max-w-xs">
                      {attachment.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatFileSize(attachment.size)}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => setAttachment(null)}
                  className="w-6 h-6 bg-red-400 dark:bg-red-500 border border-black dark:border-gray-600 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] dark:shadow-[1px_1px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
                  title="Remove attachment"
                >
                  <FiX size={12} className="text-black dark:text-white" />
                </button>
              </div>
              
              {/* Image preview */}
              {attachment.type === "image" && (
                <img 
                  src={attachment.url} 
                  alt={attachment.name}
                  className="mt-2 max-h-32 rounded border-2 border-black dark:border-gray-600"
                />
              )}
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,audio/*,.pdf,.txt,.doc,.docx"
          />

          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                disabled={sending || uploading}
                rows={1}
                className="w-full px-4 py-3 pr-20 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] transition-all resize-none overflow-hidden font-medium leading-tight"
                style={{
                  minHeight: "48px",
                  maxHeight: "200px",
                  lineHeight: "1.4",
                }}
              />
              
              {/* Action buttons - Inside textarea */}
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                {/* Media bucket button */}
                <button
                  onClick={() => setShowMediaBucket(true)}
                  disabled={sending || uploading}
                  className="w-8 h-8 bg-green-400 dark:bg-green-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Add image from media bucket"
                  type="button"
                >
                  <FiImage size={14} className="text-black dark:text-white" />
                </button>
                
                {/* Emoji button */}
                <button
                  ref={emojiButtonRef}
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  disabled={sending}
                  className="w-8 h-8 bg-yellow-400 dark:bg-yellow-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Add emoji"
                  type="button"
                >
                  <FiSmile size={14} className="text-black dark:text-white" />
                </button>
              </div>
            </div>

            <button
              onClick={sendMessage}
              disabled={(!message.trim() && !attachment) || sending || uploading}
              className="w-12 h-12 bg-purple-400 dark:bg-purple-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] disabled:hover:translate-x-0 disabled:hover:translate-y-0 flex-shrink-0"
              title="Send message"
            >
              <FiSend 
                size={16} 
                className={`text-black dark:text-white ${
                  sending || uploading ? "opacity-50" : ""
                }`} 
              />
            </button>
          </div>

          {/* Helper Text */}
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
            Press <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-xs">Enter</kbd> to send, 
            <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-xs ml-1">Shift + Enter</kbd> for new line
            • Drag & drop files to attach
          </div>
        </div>
        
        {showEmojiPicker && (
          <EmojiPicker
            onEmojiSelect={handleEmojiSelect}
            onClose={() => setShowEmojiPicker(false)}
            anchorRef={emojiButtonRef}
          />
        )}

        {/* Personal Media Bucket Modal */}
        {showMediaBucket && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(55,65,81,1)] max-w-4xl w-full max-h-[80vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b-2 border-black dark:border-gray-600">
                <h3 className="text-xl font-black uppercase text-black dark:text-white">
                  Select Media from Bucket
                </h3>
                <button
                  onClick={() => setShowMediaBucket(false)}
                  className="w-8 h-8 bg-red-400 dark:bg-red-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
                >
                  <FiX size={16} className="text-black dark:text-white" />
                </button>
              </div>

              {/* Media Grid */}
              <div className="flex-1 overflow-y-auto p-4">
                {userMediaFiles.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <p className="mb-2">No media files in your bucket</p>
                    <p className="text-sm">Upload files to your Personal Media Bucket from the right sidebar</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {userMediaFiles.map((file) => (
                      <button
                        key={file.id}
                        onClick={() => selectMediaFromBucket(file)}
                        className="bg-white dark:bg-gray-700 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all p-3 text-left"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("application/json", JSON.stringify(file));
                          e.dataTransfer.effectAllowed = "copy";
                        }}
                      >
                        {/* File preview */}
                        {file.type === "image" ? (
                          <img 
                            src={file.url} 
                            alt={file.name}
                            className="w-full h-24 object-cover mb-2 border border-black dark:border-gray-600"
                          />
                        ) : (
                          <div className="w-full h-24 bg-gray-100 dark:bg-gray-600 border border-black dark:border-gray-500 flex items-center justify-center mb-2">
                            {file.type === "audio" && <FiMusic size={32} className="text-purple-600 dark:text-purple-400" />}
                            {file.type === "file" && <FiFile size={32} className="text-blue-600 dark:text-blue-400" />}
                          </div>
                        )}
                        
                        <p className="text-xs font-bold text-black dark:text-white truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatFileSize(file.size)}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Upload from desktop button */}
              <div className="p-4 border-t-2 border-black dark:border-gray-600">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-4 py-3 bg-purple-400 dark:bg-purple-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white"
                >
                  Or Upload New File from Desktop
                </button>
              </div>
            </div>
          </div>
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

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onEnded={() => setPlayingAudio(null)}
        onError={() => setPlayingAudio(null)}
      />

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

export default DirectMessageRoom;