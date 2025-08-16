import React, { useState, useRef, KeyboardEvent, useCallback, useEffect } from "react";
import type { User } from "firebase/auth";
import { addDoc, collection, serverTimestamp, query, where, onSnapshot, orderBy, limit } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { FiSend, FiSmile, FiImage, FiX, FiFile, FiMusic } from "react-icons/fi";
import EmojiPicker from "./EmojiPicker";

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

interface MessageComposerProps {
  serverId?: string;
  roomId?: string;
  privateMessageId?: string;
  user: User;
  disabled?: boolean;
}

/**
 * MessageComposer Component
 * 
 * Enhanced message composer with media upload capabilities:
 * - Image upload button with Personal Media Bucket modal
 * - Drag-and-drop from desktop
 * - Drag-and-drop from Personal Media Bucket
 * - File attachment preview
 */
const MessageComposer: React.FC<MessageComposerProps> = ({
  serverId,
  roomId,
  privateMessageId,
  user,
  disabled = false,
}) => {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMediaBucket, setShowMediaBucket] = useState(false);
  const [attachment, setAttachment] = useState<MessageAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [userMediaFiles, setUserMediaFiles] = useState<MediaFile[]>([]);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  /**
   * Send message with optional attachment
   */
  const sendMessage = async () => {
    const trimmedMessage = message.trim();
    if ((!trimmedMessage && !attachment) || sending || disabled) return;

    setSending(true);
    const startTime = performance.now();
    console.log("💬 Starting message send...");

    // Optimistic UI update
    const originalMessage = message;
    const originalAttachment = attachment;
    setMessage("");
    setAttachment(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      // Determine the collection path
      const messagesRef = privateMessageId
        ? collection(db, `private_messages/${privateMessageId}/messages`)
        : collection(db, `servers/${serverId}/chat_rooms/${roomId}/messages`);

      const messageData: any = {
        text: trimmedMessage,
        senderId: user.uid,
        senderName: user.displayName || user.email?.split("@")[0] || "Anonymous",
        senderEmail: user.email || "",
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
      };

      // Add attachment data if present
      if (attachment) {
        messageData.attachment = {
          type: attachment.type,
          url: attachment.url,
          name: attachment.name,
          size: attachment.size,
          mimeType: attachment.mimeType,
        };
      }

      await addDoc(messagesRef, messageData);
      
      const totalTime = performance.now() - startTime;
      console.log(`📤 Message sent successfully in ${totalTime.toFixed(2)}ms`);
    } catch (error) {
      console.error("❌ Message send failed:", error);
      
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
   * Determine file type from MIME type
   */
  const getFileType = (mimeType: string): "image" | "audio" | "file" => {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("audio/")) return "audio";
    return "file";
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
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if dragging files from desktop or media bucket data
    if (e.dataTransfer.types.includes("Files") || e.dataTransfer.types.includes("application/json")) {
      setDragOver(true);
    }
  }, []);

  /**
   * Handle drag leave events
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only set dragOver to false if leaving the composer area
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOver(false);
    }
  }, []);

  /**
   * Handle file drop
   */
  const handleDrop = useCallback(async (e: React.DragEvent) => {
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
        const mediaFile: MediaFile = JSON.parse(mediaData);
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
  }, [user.uid]);

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /**
   * Handle text input change
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        120
      )}px`;
    }
  };

  /**
   * Handle emoji selection
   */
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
   * Format file size
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
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
        {/* Enhanced drag overlay with animation */}
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

        <div className="flex gap-3 items-end">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,audio/*,.pdf,.txt,.doc,.docx"
          />

          {/* Message Input */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={
                disabled 
                  ? "You don't have permission to send messages" 
                  : "Type a message... (Enter to send, Shift+Enter for new line)"
              }
              disabled={disabled || sending || uploading}
              rows={1}
              className={`w-full px-4 py-3 pr-20 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] transition-all resize-none overflow-hidden font-medium leading-tight ${
                disabled 
                  ? "opacity-50 cursor-not-allowed" 
                  : ""
              }`}
              style={{
                minHeight: "48px",
                maxHeight: "200px",
                lineHeight: "1.4",
              }}
            />
            
            {/* Action buttons - Inside textarea */}
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
              {/* Image upload button */}
              <button
                onClick={() => setShowMediaBucket(true)}
                disabled={disabled || sending || uploading}
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
                disabled={disabled || sending}
                className="w-8 h-8 bg-yellow-400 dark:bg-yellow-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                title="Add emoji"
                type="button"
              >
                <FiSmile size={14} className="text-black dark:text-white" />
              </button>
            </div>
          </div>

          {/* Send Button */}
          <button
            onClick={sendMessage}
            disabled={(!message.trim() && !attachment) || sending || disabled || uploading}
            className="w-12 h-12 bg-blue-400 dark:bg-blue-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] disabled:hover:translate-x-0 disabled:hover:translate-y-0 flex-shrink-0"
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
        
        {/* Emoji Picker */}
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

        {/* Helper Text */}
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
          {disabled ? (
            "You need to be a member of this server to send messages"
          ) : (
            <>
              Press <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-xs">Enter</kbd> to send, 
              <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-xs ml-1">Shift + Enter</kbd> for new line
              • Drag & drop files to attach
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageComposer;