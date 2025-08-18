import React, { useState, useRef, useCallback, useEffect } from "react";
import type { User } from "firebase/auth";
import { FiChevronDown, FiChevronRight, FiImage, FiLink, FiHash, FiSend, FiX, FiFile, FiMusic } from "react-icons/fi";
import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/config";

/**
 * Social post interface for creation
 */
interface SocialPost {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorEmail: string;
  timestamp: any;
  createdAt: any;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "audio";
  tags: string[];
  likes: number;
  likedBy: string[];
  comments: number;
  shareCount: number;
  linkPreview?: {
    url: string;
    title: string;
    description: string;
    image: string;
  };
  videoEmbed?: {
    type: "youtube" | "vimeo";
    videoId: string;
    url: string;
  };
}

/**
 * Props for PostComposer component
 */
interface PostComposerProps {
  /** Current authenticated user */
  user: User;
  /** Callback when a post is successfully created */
  onPostCreated: (post: SocialPost) => void;
  /** Whether this composer is floating/modal */
  isFloating?: boolean;
  /** Callback to close floating composer */
  onClose?: () => void;
}

/**
 * PostComposer Component
 * 
 * An accordion-style component for creating social posts with:
 * - Rich text input area for post content
 * - Tag management interface
 * - Media attachment support (images, links)
 * - Link preview detection
 * - Video embed detection for YouTube/Vimeo
 */
const PostComposer: React.FC<PostComposerProps> = ({ user, onPostCreated, isFloating = false, onClose }) => {
  // Accordion state
  const [isExpanded, setIsExpanded] = useState(isFloating);
  
  // Form state
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  
  // Media state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedMediaUrl, setSelectedMediaUrl] = useState<string | null>(null);
  const [selectedMediaName, setSelectedMediaName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showMediaBucket, setShowMediaBucket] = useState(false);
  const [userMediaFiles, setUserMediaFiles] = useState<any[]>([]);
  
  // UI state
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Load user's media files from Personal Media Bucket
   */
  useEffect(() => {
    if (!user || !showMediaBucket) return;

    const q = query(
      collection(db, "user_media"),
      where("userId", "==", user.uid),
      orderBy("uploadedAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const files = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUserMediaFiles(files);
    });

    return () => unsubscribe();
  }, [user, showMediaBucket]);

  /**
   * Format file size for display
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  /**
   * Select media from bucket
   */
  const selectMediaFromBucket = useCallback((file: any) => {
    if (file.type === "image") {
      setSelectedMediaUrl(file.url);
      setSelectedMediaName(file.name);
      setSelectedFile(null); // Clear any locally selected file
      setShowMediaBucket(false);
      setError(null);
    } else {
      setError("Only image files can be added to posts");
    }
  }, []);

  /**
   * Detect if URL is a YouTube video
   */
  const detectYouTubeVideo = (url: string) => {
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(youtubeRegex);
    if (match) {
      return {
        type: "youtube" as const,
        videoId: match[1],
        url: url,
      };
    }
    return null;
  };

  /**
   * Detect if URL is a Vimeo video
   */
  const detectVimeoVideo = (url: string) => {
    const vimeoRegex = /(?:vimeo\.com\/)([0-9]+)/;
    const match = url.match(vimeoRegex);
    if (match) {
      return {
        type: "vimeo" as const,
        videoId: match[1],
        url: url,
      };
    }
    return null;
  };

  /**
   * Extract hashtags from content
   */
  const extractHashtags = (text: string): string[] => {
    const hashtagRegex = /#([a-zA-Z0-9_]+)/g;
    const matches = text.match(hashtagRegex);
    if (!matches) return [];
    
    return matches.map(tag => tag.slice(1).toLowerCase());
  };

  /**
   * Add a new tag
   */
  const addTag = useCallback(() => {
    const trimmedTag = tagInput.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag) && tags.length < 10) {
      setTags(prev => [...prev, trimmedTag]);
      setTagInput("");
    }
  }, [tagInput, tags]);

  /**
   * Remove a tag
   */
  const removeTag = useCallback((tagToRemove: string) => {
    setTags(prev => prev.filter(tag => tag !== tagToRemove));
  }, []);

  /**
   * Handle file selection
   */
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type and size (2MB limit as per UXUI.md)
      if (!file.type.startsWith('image/')) {
        setError("Only image files are allowed");
        return;
      }
      
      if (file.size > 2 * 1024 * 1024) {
        setError("File size must be less than 2MB");
        return;
      }
      
      setSelectedFile(file);
      setError(null);
    }
  }, []);

  /**
   * Upload file to Firebase Storage
   */
  const uploadFile = async (file: File): Promise<string> => {
    const fileName = `social_posts/${user.uid}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, fileName);
    
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  };

  /**
   * Handle post submission
   */
  const handleSubmit = async () => {
    if (!content.trim()) {
      setError("Post content cannot be empty");
      return;
    }

    setIsPosting(true);
    setError(null);

    try {
      // Extract hashtags from content
      const contentHashtags = extractHashtags(content);
      const allTags = [...new Set([...tags, ...contentHashtags])];

      // Handle media - either from file upload or media bucket selection
      let mediaUrl: string | undefined;
      let mediaType: "image" | "video" | "audio" | undefined;
      
      if (selectedFile) {
        setIsUploading(true);
        mediaUrl = await uploadFile(selectedFile);
        mediaType = "image";
        setIsUploading(false);
      } else if (selectedMediaUrl) {
        // Use the media URL from Personal Media Bucket
        mediaUrl = selectedMediaUrl;
        mediaType = "image";
      }

      // Detect video embeds
      let videoEmbed: SocialPost['videoEmbed'];
      if (linkUrl) {
        const youtubeEmbed = detectYouTubeVideo(linkUrl);
        const vimeoEmbed = detectVimeoVideo(linkUrl);
        
        if (youtubeEmbed) {
          videoEmbed = youtubeEmbed;
        } else if (vimeoEmbed) {
          videoEmbed = vimeoEmbed;
        }
      }

      // Create post data (only include defined fields)
      const postData: any = {
        content: content.trim(),
        authorId: user.uid,
        authorName: user.displayName || user.email?.split('@')[0] || "Anonymous User",
        authorEmail: user.email || "",
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
        tags: allTags,
        likes: 0,
        likedBy: [],
        comments: 0,
        shareCount: 0,
      };

      // Only add optional fields if they have values
      if (mediaUrl) {
        postData.mediaUrl = mediaUrl;
      }
      if (mediaType) {
        postData.mediaType = mediaType;
      }
      if (videoEmbed) {
        postData.videoEmbed = videoEmbed;
      }

      // Add to Firestore
      const docRef = await addDoc(collection(db, "social_feed"), postData);
      
      // Create the post object for callback
      const newPost: SocialPost = {
        id: docRef.id,
        ...postData,
        timestamp: new Date(),
        createdAt: new Date(),
      };

      // Call the callback
      onPostCreated(newPost);

      // Reset form
      setContent("");
      setTags([]);
      setTagInput("");
      setLinkUrl("");
      setSelectedFile(null);
      setSelectedMediaUrl(null);
      setSelectedMediaName(null);
      setIsExpanded(false);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

    } catch (error) {
      console.error("Error creating post:", error);
      setError("Failed to create post. Please try again.");
    } finally {
      setIsPosting(false);
      setIsUploading(false);
    }
  };

  /**
   * Handle accordion toggle
   */
  const toggleAccordion = useCallback(() => {
    setIsExpanded(prev => !prev);
    setError(null);
  }, []);

  /**
   * Auto-resize textarea
   */
  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    
    // Auto-resize textarea
    if (textAreaRef.current) {
      textAreaRef.current.style.height = 'auto';
      textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`;
    }
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(55,65,81,1)]">
      {/* Accordion Header */}
      {!isFloating ? (
        <button
          onClick={toggleAccordion}
          className="w-full p-4 flex items-center justify-between bg-purple-400 dark:bg-purple-500 border-b-4 border-black dark:border-gray-600 hover:bg-purple-300 dark:hover:bg-purple-600 transition-colors"
        >
          <div className="flex items-center gap-3">
            {isExpanded ? (
              <FiChevronDown size={20} className="text-black dark:text-white" />
            ) : (
              <FiChevronRight size={20} className="text-black dark:text-white" />
            )}
            <h3 className="text-xl font-black uppercase text-black dark:text-white">
              Create Post
            </h3>
          </div>
          <div className="text-sm font-bold text-black dark:text-white">
            {isExpanded ? "Click to close" : "Share your thoughts"}
          </div>
        </button>
      ) : (
        <div className="p-4 flex items-center justify-between bg-purple-400 dark:bg-purple-500 border-b-4 border-black dark:border-gray-600">
          <h3 className="text-xl font-black uppercase text-black dark:text-white">
            Create Post
          </h3>
          {onClose && (
            <button
              onClick={onClose}
              className="w-10 h-10 bg-red-400 dark:bg-red-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
            >
              <FiX size={20} className="text-black dark:text-white" />
            </button>
          )}
        </div>
      )}

      {/* Accordion Content */}
      {isExpanded && (
        <div className="p-6">
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-400 dark:bg-red-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)]">
              <p className="text-black dark:text-white font-bold">{error}</p>
            </div>
          )}

          {/* Main Content Input */}
          <div className="mb-4">
            <label className="block text-sm font-bold text-black dark:text-white mb-2 uppercase">
              What's on your mind?
            </label>
            <textarea
              ref={textAreaRef}
              value={content}
              onChange={handleContentChange}
              placeholder="Share your thoughts, ideas, or updates with the community..."
              className="w-full px-4 py-3 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[4px_4px_0px_0px_rgba(55,65,81,1)] transition-all resize-none min-h-[120px]"
              disabled={isPosting}
            />
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Use #hashtags to make your post discoverable
            </div>
          </div>

          {/* Tags Section */}
          <div className="mb-4">
            <label className="block text-sm font-bold text-black dark:text-white mb-2 uppercase">
              Tags
            </label>
            
            {/* Current Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {tags.map((tag) => (
                  <div
                    key={tag}
                    className="flex items-center gap-1 px-3 py-1 bg-blue-400 dark:bg-blue-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)]"
                  >
                    <FiHash size={12} className="text-black dark:text-white" />
                    <span className="text-sm font-bold text-black dark:text-white">{tag}</span>
                    <button
                      onClick={() => removeTag(tag)}
                      className="ml-1 text-black dark:text-white hover:text-red-600 dark:hover:text-red-400"
                      disabled={isPosting}
                    >
                      <FiX size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Tag Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Add a tag..."
                className="flex-1 px-3 py-2 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] transition-all"
                disabled={isPosting || tags.length >= 10}
              />
              <button
                onClick={addTag}
                disabled={!tagInput.trim() || tags.length >= 10 || isPosting}
                className="px-4 py-2 bg-green-400 dark:bg-green-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {tags.length}/10 tags
            </div>
          </div>

          {/* Media Attachments */}
          <div className="mb-4">
            <label className="block text-sm font-bold text-black dark:text-white mb-2 uppercase">
              Attachments
            </label>
            
            <div className="space-y-3">
              {/* Image Selection */}
              <div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowMediaBucket(true)}
                    disabled={isPosting || isUploading}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-400 dark:bg-purple-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FiImage size={16} />
                    Select Image
                  </button>
                  {(selectedFile || selectedMediaUrl) && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedFile ? selectedFile.name : selectedMediaName}
                      </span>
                      <button
                        onClick={() => {
                          setSelectedFile(null);
                          setSelectedMediaUrl(null);
                          setSelectedMediaName(null);
                        }}
                        disabled={isPosting}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                      >
                        <FiX size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Link Input */}
              <div>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <FiLink className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={16} />
                    <input
                      type="url"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="Add a link (YouTube, Vimeo, or any website)"
                      className="w-full pl-10 pr-4 py-2 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] transition-all"
                      disabled={isPosting}
                    />
                  </div>
                  {linkUrl && (
                    <button
                      onClick={() => setLinkUrl("")}
                      disabled={isPosting}
                      className="px-3 py-2 bg-red-400 dark:bg-red-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all text-black dark:text-white"
                    >
                      <FiX size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t-2 border-gray-200 dark:border-gray-600">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {content.length > 0 && `${content.length} characters`}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={toggleAccordion}
                disabled={isPosting}
                className="px-4 py-2 bg-gray-400 dark:bg-gray-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              
              <button
                onClick={handleSubmit}
                disabled={!content.trim() || isPosting || isUploading}
                className="flex items-center gap-2 px-6 py-2 bg-pink-400 dark:bg-pink-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold uppercase text-black dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiSend size={16} />
                {isPosting ? "Posting..." : "Post"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Personal Media Bucket Modal */}
      {showMediaBucket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(55,65,81,1)] max-w-4xl w-full max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b-2 border-black dark:border-gray-600">
              <h3 className="text-xl font-black uppercase text-black dark:text-white">
                Select Image from Media Bucket
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
                  {userMediaFiles.filter(file => file.type === "image").map((file) => (
                    <button
                      key={file.id}
                      onClick={() => selectMediaFromBucket(file)}
                      className="bg-white dark:bg-gray-700 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all p-3 text-left"
                    >
                      {/* Image preview */}
                      <img 
                        src={file.url} 
                        alt={file.name}
                        className="w-full h-24 object-cover mb-2 border border-black dark:border-gray-600"
                      />
                      
                      <p className="text-xs font-bold text-black dark:text-white truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatFileSize(file.size)}
                      </p>
                    </button>
                  ))}
                  
                  {/* Show message if no images */}
                  {userMediaFiles.filter(file => file.type === "image").length === 0 && userMediaFiles.length > 0 && (
                    <div className="col-span-full text-center py-8 text-gray-500 dark:text-gray-400">
                      <p>No image files found in your media bucket</p>
                      <p className="text-sm mt-2">Only image files can be added to posts</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Upload from desktop button */}
            <div className="p-4 border-t-2 border-black dark:border-gray-600">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isPosting}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-4 py-3 bg-purple-400 dark:bg-purple-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white"
              >
                Or Upload New Image from Desktop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostComposer;