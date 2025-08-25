import React, { useState, useRef, useCallback, useEffect } from "react";
import type { User } from "firebase/auth";
import { FiChevronDown, FiChevronRight, FiImage, FiLink, FiHash, FiSave, FiX, FiFile, FiMusic } from "react-icons/fi";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "../firebase/config";

/**
 * Social post interface
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
 * Props for EditPostModal component
 */
interface EditPostModalProps {
  /** Current authenticated user */
  user: User;
  /** Post to edit */
  post: SocialPost;
  /** Callback when post is successfully updated */
  onPostUpdated: (updatedPost: SocialPost) => void;
  /** Callback to close modal */
  onClose: () => void;
}

/**
 * EditPostModal Component
 * 
 * Modal for editing an existing social post with:
 * - Content editing
 * - Tag management
 * - Media management
 * - Link detection and previews
 */
const EditPostModal: React.FC<EditPostModalProps> = ({ 
  user, 
  post, 
  onPostUpdated, 
  onClose 
}) => {
  // State
  const [content, setContent] = useState(post.content);
  const [tags, setTags] = useState<string[]>(post.tags);
  const [tagInput, setTagInput] = useState("");
  const [expandedSections, setExpandedSections] = useState({
    tags: true,
    media: false,
    links: false,
  });
  const [linkUrl, setLinkUrl] = useState(post.videoEmbed?.url || "");
  const [selectedMedia, setSelectedMedia] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(post.mediaUrl || null);
  const [mediaType, setMediaType] = useState<"image" | "video" | "audio" | null>(post.mediaType || null);
  const [linkPreview, setLinkPreview] = useState(post.linkPreview || null);
  const [videoEmbed, setVideoEmbed] = useState(post.videoEmbed || null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [content]);

  // Extract hashtags from content
  useEffect(() => {
    const hashtagRegex = /#(\w+)/g;
    const matches = content.match(hashtagRegex);
    if (matches) {
      const extractedTags = matches.map(tag => tag.substring(1).toLowerCase());
      const newTags = [...new Set([...tags, ...extractedTags])];
      if (newTags.length !== tags.length || !newTags.every(tag => tags.includes(tag))) {
        setTags(newTags);
      }
    }
  }, [content]);

  // Toggle section expansion
  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section as keyof typeof prev]
    }));
  }, []);

  // Handle tag addition
  const addTag = useCallback(() => {
    if (tagInput.trim() && !tags.includes(tagInput.trim().toLowerCase())) {
      setTags(prev => [...prev, tagInput.trim().toLowerCase()]);
      setTagInput("");
    }
  }, [tagInput, tags]);

  // Handle tag removal
  const removeTag = useCallback((tagToRemove: string) => {
    setTags(prev => prev.filter(tag => tag !== tagToRemove));
  }, []);

  // Handle media file selection
  const handleMediaSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      alert("File size must be less than 10MB");
      return;
    }

    // Determine media type
    let type: "image" | "video" | "audio";
    if (file.type.startsWith("image/")) {
      type = "image";
    } else if (file.type.startsWith("video/")) {
      type = "video";
    } else if (file.type.startsWith("audio/")) {
      type = "audio";
    } else {
      alert("Please select an image, video, or audio file");
      return;
    }

    setSelectedMedia(file);
    setMediaType(type);

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setMediaPreview(previewUrl);
  }, []);

  // Remove media
  const removeMedia = useCallback(() => {
    setSelectedMedia(null);
    setMediaType(null);
    if (mediaPreview && mediaPreview.startsWith('blob:')) {
      URL.revokeObjectURL(mediaPreview);
    }
    setMediaPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [mediaPreview]);

  // Detect and process links in content and linkUrl
  const detectLinks = useCallback(async (text: string) => {
    // Check both content and linkUrl for links
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const contentUrls = text.match(urlRegex);
    const allUrls = [...(contentUrls || [])];
    
    // Add linkUrl if it exists
    if (linkUrl.trim()) {
      allUrls.push(linkUrl.trim());
    }
    
    if (allUrls.length > 0) {
      const url = allUrls[0]; // Process first URL found
      
      // Check for YouTube/Vimeo videos
      const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/;
      const vimeoRegex = /vimeo\.com\/(\d+)/;
      
      const youtubeMatch = url.match(youtubeRegex);
      const vimeoMatch = url.match(vimeoRegex);
      
      if (youtubeMatch) {
        setVideoEmbed({
          type: "youtube",
          videoId: youtubeMatch[1],
          url: url
        });
        setLinkPreview(null);
      } else if (vimeoMatch) {
        setVideoEmbed({
          type: "vimeo", 
          videoId: vimeoMatch[1],
          url: url
        });
        setLinkPreview(null);
      }
    } else {
      setVideoEmbed(null);
      setLinkPreview(null);
    }
  }, [linkUrl]);

  // Handle content change with link detection
  const handleContentChange = useCallback((value: string) => {
    setContent(value);
    
    // Debounce link detection
    const timeoutId = setTimeout(() => {
      detectLinks(value);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [detectLinks]);

  // Upload media file to Firebase Storage
  const uploadMedia = useCallback(async (file: File): Promise<string> => {
    const timestamp = Date.now();
    const fileName = `posts/${user.uid}/${timestamp}_${file.name}`;
    const storageRef = ref(storage, fileName);
    
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  }, [user.uid]);

  // Delete old media from storage if it was replaced
  const deleteOldMedia = useCallback(async (oldMediaUrl: string) => {
    try {
      if (oldMediaUrl && oldMediaUrl.includes('firebase')) {
        const oldRef = ref(storage, oldMediaUrl);
        await deleteObject(oldRef);
      }
    } catch (error) {
      console.warn("Could not delete old media file:", error);
      // Don't throw error as this is not critical
    }
  }, []);

  // Handle post update
  const handleUpdatePost = useCallback(async () => {
    if (!content.trim()) {
      alert("Post content cannot be empty");
      return;
    }

    setIsUpdating(true);

    try {
      let mediaUrl = post.mediaUrl;
      let newMediaType = post.mediaType;

      // Handle media upload if new media was selected
      if (selectedMedia) {
        // Delete old media if it exists and we're replacing it
        if (post.mediaUrl) {
          await deleteOldMedia(post.mediaUrl);
        }
        
        mediaUrl = await uploadMedia(selectedMedia);
        newMediaType = mediaType;
      } else if (!mediaPreview && post.mediaUrl) {
        // User removed the media, delete it from storage
        await deleteOldMedia(post.mediaUrl);
        mediaUrl = undefined;
        newMediaType = undefined;
      }

      // Prepare updated post data (filter out undefined values)
      const updatedData: any = {
        content: content.trim(),
        tags,
        updatedAt: serverTimestamp(),
      };

      // Only add optional fields if they have values
      if (mediaUrl !== undefined) {
        updatedData.mediaUrl = mediaUrl;
      }
      if (newMediaType !== undefined) {
        updatedData.mediaType = newMediaType;
      }
      if (linkPreview !== undefined) {
        updatedData.linkPreview = linkPreview;
      }
      if (videoEmbed !== undefined) {
        updatedData.videoEmbed = videoEmbed;
      }

      // Update post in Firestore
      const postRef = doc(db, "social_feed", post.id);
      await updateDoc(postRef, updatedData);

      // Create updated post object for callback
      const updatedPost: SocialPost = {
        ...post,
        ...updatedData,
        timestamp: post.timestamp, // Keep original timestamp
      };

      // Notify parent component
      onPostUpdated(updatedPost);

      // Close modal
      onClose();

      alert("Post updated successfully!");
    } catch (error) {
      console.error("Error updating post:", error);
      alert("Failed to update post. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  }, [
    content,
    tags,
    selectedMedia,
    mediaType,
    mediaPreview,
    linkPreview,
    videoEmbed,
    post,
    uploadMedia,
    deleteOldMedia,
    onPostUpdated,
    onClose
  ]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(55,65,81,1)] w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b-4 border-black dark:border-gray-600 bg-blue-400 dark:bg-blue-500">
          <h2 className="text-2xl font-black uppercase text-black dark:text-white">
            Edit Post
          </h2>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-red-500 dark:bg-red-600 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
          >
            <FiX size={20} className="text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Text Content */}
          <div>
            <label className="block text-sm font-bold text-black dark:text-white mb-2 uppercase">
              Post Content
            </label>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="What's on your mind? Use #hashtags to add tags!"
              className="w-full p-4 border-4 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[4px_4px_0px_0px_rgba(55,65,81,1)] transition-all min-h-[120px] resize-none"
              maxLength={2000}
            />
            <div className="text-right text-sm text-gray-500 dark:text-gray-400 mt-1">
              {content.length}/2000
            </div>
          </div>

          {/* Video Embed Preview */}
          {videoEmbed && (
            <div className="border-4 border-black dark:border-gray-600 p-4 bg-gray-50 dark:bg-gray-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-black dark:text-white">Video Embed</h3>
                <button
                  onClick={() => setVideoEmbed(null)}
                  className="text-red-500 hover:text-red-700"
                >
                  <FiX size={16} />
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {videoEmbed.type === "youtube" ? "YouTube" : "Vimeo"} video will be embedded
              </p>
            </div>
          )}

          {/* Media Section */}
          <div className="border-4 border-black dark:border-gray-600">
            <button
              onClick={() => toggleSection("media")}
              className="w-full flex items-center justify-between p-4 bg-purple-400 dark:bg-purple-500 border-b-4 border-black dark:border-gray-600 font-black uppercase text-black dark:text-white"
            >
              <span className="flex items-center gap-2">
                <FiImage size={20} />
                Media
              </span>
              {expandedSections.media ? <FiChevronDown size={20} /> : <FiChevronRight size={20} />}
            </button>
            
            {expandedSections.media && (
              <div className="p-4 space-y-4">
                {/* Media Upload */}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*,audio/*"
                    onChange={handleMediaSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full p-4 border-2 border-dashed border-black dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2 font-bold text-black dark:text-white"
                  >
                    <FiFile size={20} />
                    {mediaPreview ? 'Change Media' : 'Upload Media'}
                  </button>
                </div>

                {/* Media Preview */}
                {mediaPreview && (
                  <div className="relative border-4 border-black dark:border-gray-600">
                    {mediaType === "image" && (
                      <img
                        src={mediaPreview}
                        alt="Media preview"
                        className="w-full h-auto max-h-64 object-cover"
                      />
                    )}
                    {mediaType === "video" && (
                      <video
                        src={mediaPreview}
                        controls
                        className="w-full h-auto max-h-64"
                      />
                    )}
                    {mediaType === "audio" && (
                      <div className="p-4 bg-gray-100 dark:bg-gray-700">
                        <FiMusic size={40} className="mx-auto text-gray-500 mb-2" />
                        <audio src={mediaPreview} controls className="w-full" />
                      </div>
                    )}
                    <button
                      onClick={removeMedia}
                      className="absolute top-2 right-2 w-8 h-8 bg-red-500 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
                    >
                      <FiX size={16} className="text-white" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tags Section */}
          <div className="border-4 border-black dark:border-gray-600">
            <button
              onClick={() => toggleSection("tags")}
              className="w-full flex items-center justify-between p-4 bg-green-400 dark:bg-green-500 border-b-4 border-black dark:border-gray-600 font-black uppercase text-black dark:text-white"
            >
              <span className="flex items-center gap-2">
                <FiHash size={20} />
                Tags ({tags.length})
              </span>
              {expandedSections.tags ? <FiChevronDown size={20} /> : <FiChevronRight size={20} />}
            </button>
            
            {expandedSections.tags && (
              <div className="p-4 space-y-4">
                {/* Tag Input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addTag()}
                    placeholder="Add a tag..."
                    className="flex-1 p-2 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white"
                  />
                  <button
                    onClick={addTag}
                    className="px-4 py-2 bg-green-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-white"
                  >
                    Add
                  </button>
                </div>

                {/* Tags Display */}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-200 dark:bg-blue-800 border-2 border-black dark:border-gray-600 font-bold text-black dark:text-white"
                      >
                        #{tag}
                        <button
                          onClick={() => removeTag(tag)}
                          className="ml-1 text-red-500 hover:text-red-700"
                        >
                          <FiX size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Links Section */}
          <div className="border-4 border-black dark:border-gray-600">
            <button
              onClick={() => toggleSection("links")}
              className="w-full flex items-center justify-between p-4 bg-yellow-400 dark:bg-yellow-500 border-b-4 border-black dark:border-gray-600 font-black uppercase text-black dark:text-white"
            >
              <span className="flex items-center gap-2">
                <FiLink size={20} />
                Links & Videos
              </span>
              {expandedSections.links ? <FiChevronDown size={20} /> : <FiChevronRight size={20} />}
            </button>
            
            {expandedSections.links && (
              <div className="p-4 space-y-4">
                {/* Link Input */}
                <div>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <FiLink className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={16} />
                      <input
                        type="url"
                        value={linkUrl}
                        onChange={(e) => {
                          setLinkUrl(e.target.value);
                          // Trigger link detection with debounce
                          setTimeout(() => {
                            detectLinks(content);
                          }, 1000);
                        }}
                        placeholder="Add a link (YouTube, Vimeo, or any website)"
                        className="w-full pl-10 pr-4 py-2 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] transition-all"
                      />
                    </div>
                    {linkUrl && (
                      <button
                        onClick={() => {
                          setLinkUrl("");
                          setVideoEmbed(null);
                          setLinkPreview(null);
                        }}
                        className="px-3 py-2 bg-red-400 dark:bg-red-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all text-black dark:text-white"
                      >
                        <FiX size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t-4 border-black dark:border-gray-600 bg-gray-100 dark:bg-gray-700">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-500 dark:bg-gray-600 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-black uppercase text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleUpdatePost}
            disabled={isUpdating || !content.trim()}
            className="px-6 py-3 bg-blue-500 dark:bg-blue-600 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-black uppercase text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <FiSave size={20} />
            {isUpdating ? 'Updating...' : 'Update Post'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditPostModal;