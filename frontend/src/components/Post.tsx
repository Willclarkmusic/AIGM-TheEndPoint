import React, { useState, useCallback, useEffect } from "react";
import type { User } from "firebase/auth";
import { FiHeart, FiMessageCircle, FiShare2, FiMoreHorizontal, FiExternalLink, FiDownload, FiEye, FiPlus, FiMinus } from "react-icons/fi";
import { doc, updateDoc, increment, arrayUnion, arrayRemove, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import EditPostModal from "./EditPostModal";

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
 * Props for Post component
 */
interface PostProps {
  /** Post data */
  post: SocialPost;
  /** Current authenticated user */
  currentUser: User;
  /** Callback when post is updated */
  onUpdate: (updatedPost: SocialPost) => void;
  /** Callback when tag is clicked */
  onTagClick: (tag: string) => void;
}

/**
 * Post Component
 * 
 * Displays a social feed post with:
 * - Author information and timestamp
 * - Post content with link detection
 * - Media attachments (images)
 * - Video embeds (YouTube/Vimeo)
 * - Interactive tags
 * - Like, comment, and share buttons
 * - Post actions menu
 */
const Post: React.FC<PostProps> = ({ post, currentUser, onUpdate, onTagClick }) => {
  // State
  const [isLiking, setIsLiking] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [hoveredImage, setHoveredImage] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [tagMenuPosition, setTagMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [subscribedTags, setSubscribedTags] = useState<string[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);

  // Check if current user has liked the post
  const isLiked = post.likedBy.includes(currentUser.uid);

  // Load user's subscribed tags
  useEffect(() => {
    const loadSubscribedTags = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setSubscribedTags(data.subscribedTags || []);
        }
      } catch (error) {
        console.error("Error loading subscribed tags:", error);
      }
    };

    loadSubscribedTags();
  }, [currentUser.uid]);

  /**
   * Handle tag click - show popup menu
   */
  const handleTagClick = (tag: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setSelectedTag(tag);
    setTagMenuPosition({
      x: rect.left,
      y: rect.bottom + 5,
    });
  };

  /**
   * Subscribe/Unsubscribe from tag
   */
  const toggleTagSubscription = async () => {
    if (!selectedTag) return;

    try {
      const userRef = doc(db, "users", currentUser.uid);
      const tagId = selectedTag.toLowerCase();
      
      if (subscribedTags.includes(tagId)) {
        // Unsubscribe
        await updateDoc(userRef, {
          subscribedTags: arrayRemove(tagId),
        });
        setSubscribedTags(prev => prev.filter(t => t !== tagId));
      } else {
        // Subscribe
        await updateDoc(userRef, {
          subscribedTags: arrayUnion(tagId),
        });
        setSubscribedTags(prev => [...prev, tagId]);
      }
    } catch (error) {
      console.error("Error toggling tag subscription:", error);
    }
    
    setSelectedTag(null);
    setTagMenuPosition(null);
  };

  /**
   * Format timestamp for display
   */
  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return "Just now";
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return date.toLocaleDateString();
  };

  /**
   * Handle like/unlike post
   */
  const handleLike = useCallback(async () => {
    if (isLiking) return;

    setIsLiking(true);
    try {
      const postRef = doc(db, "social_feed", post.id);
      
      if (isLiked) {
        // Unlike the post
        await updateDoc(postRef, {
          likes: increment(-1),
          likedBy: arrayRemove(currentUser.uid),
        });
        
        // Update local state
        const updatedPost = {
          ...post,
          likes: post.likes - 1,
          likedBy: post.likedBy.filter(id => id !== currentUser.uid),
        };
        onUpdate(updatedPost);
      } else {
        // Like the post
        await updateDoc(postRef, {
          likes: increment(1),
          likedBy: arrayUnion(currentUser.uid),
        });
        
        // Update local state
        const updatedPost = {
          ...post,
          likes: post.likes + 1,
          likedBy: [...post.likedBy, currentUser.uid],
        };
        onUpdate(updatedPost);
      }
    } catch (error) {
      console.error("Error updating like:", error);
    } finally {
      setIsLiking(false);
    }
  }, [post, currentUser.uid, isLiked, isLiking, onUpdate]);

  /**
   * Handle share post
   */
  const handleShare = useCallback(async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Post by ${post.authorName}`,
          text: post.content,
          url: window.location.href,
        });
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(`${post.content}\n\n- ${post.authorName}`);
        alert("Post content copied to clipboard!");
      }

      // Increment share count
      const postRef = doc(db, "social_feed", post.id);
      await updateDoc(postRef, {
        shareCount: increment(1),
      });

      const updatedPost = {
        ...post,
        shareCount: post.shareCount + 1,
      };
      onUpdate(updatedPost);
    } catch (error) {
      console.error("Error sharing post:", error);
    }
  }, [post, onUpdate]);

  /**
   * Handle image download
   */
  const handleImageDownload = useCallback(() => {
    if (!post.mediaUrl) return;

    const link = document.createElement('a');
    link.href = post.mediaUrl;
    link.download = `post-image-${post.id}.jpg`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [post.mediaUrl, post.id]);

  /**
   * Render video embed
   */
  const renderVideoEmbed = () => {
    if (!post.videoEmbed) return null;

    const { type, videoId } = post.videoEmbed;
    
    if (type === "youtube") {
      return (
        <div className="relative w-full h-64 bg-black border-4 border-black dark:border-gray-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(55,65,81,1)] overflow-hidden">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            title="YouTube video player"
            className="absolute inset-0 w-full h-full"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }
    
    if (type === "vimeo") {
      return (
        <div className="relative w-full h-64 bg-black border-4 border-black dark:border-gray-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(55,65,81,1)] overflow-hidden">
          <iframe
            src={`https://player.vimeo.com/video/${videoId}`}
            title="Vimeo video player"
            className="absolute inset-0 w-full h-full"
            frameBorder="0"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }

    return null;
  };

  /**
   * Render post content with clickable links
   */
  const renderContent = () => {
    const linkRegex = /(https?:\/\/[^\s]+)/g;
    const parts = post.content.split(linkRegex);

    return parts.map((part, index) => {
      if (linkRegex.test(part)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline break-all"
          >
            {part.length > 50 ? `${part.substring(0, 50)}...` : part}
          </a>
        );
      }
      return part;
    });
  };

  return (
    <article className="bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(55,65,81,1)] p-6">
      {/* Post Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Author Avatar */}
          <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] flex items-center justify-center">
            <span className="text-lg font-black text-white uppercase">
              {post.authorName.charAt(0)}
            </span>
          </div>
          
          {/* Author Info */}
          <div>
            <h4 className="font-black text-black dark:text-white">
              {post.authorName}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {formatTimestamp(post.timestamp)}
            </p>
          </div>
        </div>

        {/* Actions Menu */}
        <div className="relative">
          <button
            onClick={() => setShowActionsMenu(!showActionsMenu)}
            className="w-8 h-8 bg-gray-200 dark:bg-gray-700 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
          >
            <FiMoreHorizontal size={16} className="text-black dark:text-white" />
          </button>
          
          {showActionsMenu && (
            <div className="absolute top-10 right-0 bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(55,65,81,1)] z-10 min-w-[150px]">
              {post.authorId === currentUser.uid && (
                <button 
                  onClick={() => {
                    setShowEditModal(true);
                    setShowActionsMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-black dark:text-white font-bold border-b-2 border-black dark:border-gray-600"
                >
                  Edit Post
                </button>
              )}
              <button className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-black dark:text-white font-bold">
                Report Post
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Post Content */}
      <div className="mb-4">
        <p className="text-black dark:text-white leading-relaxed whitespace-pre-wrap">
          {renderContent()}
        </p>
      </div>

      {/* Tags */}
      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {post.tags.map((tag) => (
            <button
              key={tag}
              onClick={(e) => handleTagClick(tag, e)}
              className="px-3 py-1 bg-blue-400 dark:bg-blue-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all text-sm font-bold text-black dark:text-white"
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* Media Content */}
      {post.mediaUrl && post.mediaType === "image" && (
        <div className="mb-4">
          <div 
            className="relative inline-block cursor-pointer"
            onMouseEnter={() => setHoveredImage(true)}
            onMouseLeave={() => setHoveredImage(false)}
          >
            <img
              src={post.mediaUrl}
              alt="Post attachment"
              className="max-w-xs max-h-48 border-4 border-black dark:border-gray-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(55,65,81,1)] cursor-pointer"
              onClick={() => setImageModalOpen(true)}
            />
            
            {/* Hover Download Button */}
            {hoveredImage && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleImageDownload();
                }}
                className="absolute bottom-2 right-2 w-8 h-8 bg-black bg-opacity-70 hover:bg-opacity-90 border-2 border-white shadow-[2px_2px_0px_0px_rgba(255,255,255,0.8)] flex items-center justify-center transition-all"
                title="Download image"
              >
                <FiDownload size={14} className="text-white" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Video Embed */}
      {post.videoEmbed && (
        <div className="mb-4">
          {renderVideoEmbed()}
        </div>
      )}

      {/* Post Actions */}
      <div className="flex items-center justify-between pt-4 border-t-2 border-gray-200 dark:border-gray-600">
        <div className="flex items-center gap-4">
          {/* Like Button */}
          <button
            onClick={handleLike}
            disabled={isLiking}
            className={`flex items-center gap-2 px-3 py-2 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed ${
              isLiked 
                ? "bg-red-400 dark:bg-red-500 text-white" 
                : "bg-white dark:bg-gray-700 text-black dark:text-white"
            }`}
          >
            <FiHeart size={16} className={isLiked ? "fill-current" : ""} />
            <span>{post.likes}</span>
          </button>

          {/* Comment Button */}
          <button className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-700 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white">
            <FiMessageCircle size={16} />
            <span>{post.comments}</span>
          </button>

          {/* Share Button */}
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-700 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white"
          >
            <FiShare2 size={16} />
            {post.shareCount > 0 && <span>{post.shareCount}</span>}
          </button>
        </div>

        {/* External Link Button */}
        {post.videoEmbed && (
          <a
            href={post.videoEmbed.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 bg-purple-400 dark:bg-purple-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white"
          >
            <FiExternalLink size={16} />
            Watch
          </a>
        )}
      </div>

      {/* Image Modal */}
      {imageModalOpen && post.mediaUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-4xl max-h-full">
            <img
              src={post.mediaUrl}
              alt="Post attachment"
              className="max-w-full max-h-full border-4 border-white shadow-[8px_8px_0px_0px_rgba(255,255,255,0.8)]"
            />
            <button
              onClick={() => setImageModalOpen(false)}
              className="absolute top-4 right-4 w-10 h-10 bg-red-500 border-2 border-white shadow-[2px_2px_0px_0px_rgba(255,255,255,0.8)] flex items-center justify-center text-white hover:bg-red-600 transition-colors"
            >
              ×
            </button>
            <button
              onClick={handleImageDownload}
              className="absolute bottom-4 right-4 px-4 py-2 bg-blue-500 border-2 border-white shadow-[2px_2px_0px_0px_rgba(255,255,255,0.8)] text-white font-bold hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              <FiDownload size={16} />
              Download
            </button>
          </div>
        </div>
      )}

      {/* Click outside to close menus */}
      {showActionsMenu && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setShowActionsMenu(false)}
        />
      )}

      {/* Tag Popup Menu */}
      {selectedTag && tagMenuPosition && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => {
              setSelectedTag(null);
              setTagMenuPosition(null);
            }}
          />
          <div
            className="fixed z-50 bg-white dark:bg-gray-800 border-2 border-black dark:border-gray-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(55,65,81,1)] py-2 min-w-[150px]"
            style={{
              left: `${tagMenuPosition.x}px`,
              top: `${tagMenuPosition.y}px`,
            }}
          >
            <button
              onClick={() => {
                onTagClick(selectedTag);
                setSelectedTag(null);
                setTagMenuPosition(null);
              }}
              className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium text-black dark:text-white flex items-center gap-2"
            >
              <FiEye size={16} />
              View
            </button>
            <button
              onClick={toggleTagSubscription}
              className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium text-black dark:text-white flex items-center gap-2"
            >
              {subscribedTags.includes(selectedTag.toLowerCase()) ? (
                <>
                  <FiMinus size={16} />
                  Unsubscribe
                </>
              ) : (
                <>
                  <FiPlus size={16} />
                  Subscribe
                </>
              )}
            </button>
          </div>
        </>
      )}

      {/* Edit Post Modal */}
      {showEditModal && (
        <EditPostModal
          user={currentUser}
          post={post}
          onPostUpdated={(updatedPost) => {
            onUpdate(updatedPost);
            setShowEditModal(false);
          }}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </article>
  );
};

export default Post;