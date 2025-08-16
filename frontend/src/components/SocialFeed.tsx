import React, { useState, useEffect, useRef, useCallback } from "react";
import type { User } from "firebase/auth";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  startAfter,
  getDocs,
  where,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import type { DocumentData } from "firebase/firestore";
import { db } from "../firebase/config";
import PostComposer from "./PostComposer";
import Post from "./Post";

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
 * Props for SocialFeed component
 */
interface SocialFeedProps {
  /** Current authenticated user */
  user: User;
  /** Optional filter by tag */
  filterTag?: string;
  /** Optional filter by user */
  filterUserId?: string;
}

/**
 * SocialFeed Component
 * 
 * Displays an infinite scrolling feed of social posts with:
 * - Post creation composer at the top
 * - Real-time updates
 * - Infinite scroll pagination
 * - Tag and user filtering
 * - Link previews and video embeds
 */
const SocialFeed: React.FC<SocialFeedProps> = ({
  user,
  filterTag,
  filterUserId,
}) => {
  // State management
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs for infinite scroll
  const feedContainerRef = useRef<HTMLDivElement>(null);
  const lastPostRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

  // Posts per page for pagination
  const POSTS_PER_PAGE = 10;

  /**
   * Build Firestore query based on filters
   */
  const buildQuery = useCallback((startAfterDoc?: QueryDocumentSnapshot<DocumentData>) => {
    const postsRef = collection(db, "social_feed");
    let q = query(postsRef, orderBy("timestamp", "desc"));

    // Apply filters
    if (filterTag) {
      q = query(postsRef, where("tags", "array-contains", filterTag), orderBy("timestamp", "desc"));
    } else if (filterUserId) {
      q = query(postsRef, where("authorId", "==", filterUserId), orderBy("timestamp", "desc"));
    }

    // Add pagination
    q = query(q, limit(POSTS_PER_PAGE));
    
    if (startAfterDoc) {
      q = query(q, startAfter(startAfterDoc));
    }

    return q;
  }, [filterTag, filterUserId]);

  /**
   * Process post data from Firestore
   */
  const processPost = (doc: QueryDocumentSnapshot<DocumentData>): SocialPost => {
    const data = doc.data();
    return {
      id: doc.id,
      content: data.content || "",
      authorId: data.authorId || "",
      authorName: data.authorName || "Unknown User",
      authorEmail: data.authorEmail || "",
      timestamp: data.timestamp,
      createdAt: data.createdAt || data.timestamp,
      mediaUrl: data.mediaUrl,
      mediaType: data.mediaType,
      tags: data.tags || [],
      likes: data.likes || 0,
      likedBy: data.likedBy || [],
      comments: data.comments || 0,
      shareCount: data.shareCount || 0,
      linkPreview: data.linkPreview,
      videoEmbed: data.videoEmbed,
    };
  };

  /**
   * Load initial posts
   */
  const loadInitialPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const q = buildQuery();
      
      // Set up real-time listener for initial posts
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const newPosts: SocialPost[] = [];
          
          snapshot.forEach((doc) => {
            newPosts.push(processPost(doc));
          });

          setPosts(newPosts);
          setHasMore(snapshot.docs.length === POSTS_PER_PAGE);
          
          if (snapshot.docs.length > 0) {
            lastPostRef.current = snapshot.docs[snapshot.docs.length - 1];
          }
          
          setLoading(false);
        },
        (error) => {
          console.error("Error loading initial posts:", error);
          setError("Failed to load posts. Please try again.");
          setLoading(false);
        }
      );

      return unsubscribe;
    } catch (error) {
      console.error("Error setting up posts listener:", error);
      setError("Failed to load posts. Please try again.");
      setLoading(false);
    }
  }, [buildQuery]);

  /**
   * Load more posts for pagination
   */
  const loadMorePosts = useCallback(async () => {
    if (loadingMore || !hasMore || !lastPostRef.current) return;

    setLoadingMore(true);
    
    try {
      const q = buildQuery(lastPostRef.current);
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        setHasMore(false);
        setLoadingMore(false);
        return;
      }

      const newPosts: SocialPost[] = [];
      
      snapshot.forEach((doc) => {
        newPosts.push(processPost(doc));
      });

      setPosts(prevPosts => [...prevPosts, ...newPosts]);
      setHasMore(snapshot.docs.length === POSTS_PER_PAGE);
      
      if (snapshot.docs.length > 0) {
        lastPostRef.current = snapshot.docs[snapshot.docs.length - 1];
      }
    } catch (error) {
      console.error("Error loading more posts:", error);
      setError("Failed to load more posts. Please try again.");
    } finally {
      setLoadingMore(false);
    }
  }, [buildQuery, loadingMore, hasMore]);

  /**
   * Set up intersection observer for infinite scroll
   */
  useEffect(() => {
    if (!loadMoreTriggerRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !loadingMore) {
          loadMorePosts();
        }
      },
      {
        threshold: 0.1,
        rootMargin: "100px",
      }
    );

    observerRef.current.observe(loadMoreTriggerRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loadingMore, loadMorePosts]);

  /**
   * Load initial posts on mount or filter change
   */
  useEffect(() => {
    const unsubscribe = loadInitialPosts();
    
    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [loadInitialPosts]);

  /**
   * Handle new post creation
   */
  const handlePostCreated = useCallback((newPost: SocialPost) => {
    // Add new post to the beginning of the feed
    setPosts(prevPosts => [newPost, ...prevPosts]);
  }, []);

  /**
   * Handle post interactions (like, comment, etc.)
   */
  const handlePostUpdate = useCallback((updatedPost: SocialPost) => {
    setPosts(prevPosts => 
      prevPosts.map(post => 
        post.id === updatedPost.id ? updatedPost : post
      )
    );
  }, []);

  /**
   * Handle tag click for filtering
   */
  const handleTagClick = useCallback((tag: string) => {
    // This would typically update the URL and trigger a filter change
    console.log("Tag clicked:", tag);
    // TODO: Implement tag filtering navigation
  }, []);

  /**
   * Scroll to top
   */
  const scrollToTop = useCallback(() => {
    if (feedContainerRef.current) {
      feedContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  // Render loading state
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-black dark:border-white border-t-transparent dark:border-t-transparent rounded-full mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400 font-bold">
            Loading posts...
          </p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-red-400 dark:bg-red-500 border-4 border-black dark:border-gray-600 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(55,65,81,1)] p-6">
            <h3 className="text-xl font-black uppercase text-black dark:text-white mb-2">
              Oops!
            </h3>
            <p className="text-black dark:text-white mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-white dark:bg-gray-800 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={feedContainerRef}
      className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900"
    >
      <div className="max-w-2xl mx-auto p-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-black uppercase text-black dark:text-white mb-2">
            {filterTag ? `#${filterTag}` : filterUserId ? "User Posts" : "Social Feed"}
          </h1>
          {filterTag && (
            <p className="text-gray-600 dark:text-gray-400">
              Posts tagged with #{filterTag}
            </p>
          )}
        </div>

        {/* Post Composer - Only show if not filtered */}
        {!filterTag && !filterUserId && (
          <div className="mb-6">
            <PostComposer 
              user={user} 
              onPostCreated={handlePostCreated}
            />
          </div>
        )}

        {/* Posts Feed */}
        <div className="space-y-6">
          {posts.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(55,65,81,1)] p-8">
                <h3 className="text-xl font-black uppercase text-black dark:text-white mb-4">
                  No Posts Yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {filterTag 
                    ? `No posts found with the tag #${filterTag}`
                    : "Be the first to share something with the community!"
                  }
                </p>
                {!filterTag && !filterUserId && (
                  <button
                    onClick={scrollToTop}
                    className="px-4 py-2 bg-blue-400 dark:bg-blue-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold uppercase text-black dark:text-white"
                  >
                    Create First Post
                  </button>
                )}
              </div>
            </div>
          ) : (
            posts.map((post) => (
              <Post
                key={post.id}
                post={post}
                currentUser={user}
                onUpdate={handlePostUpdate}
                onTagClick={handleTagClick}
              />
            ))
          )}

          {/* Load More Trigger */}
          {hasMore && (
            <div ref={loadMoreTriggerRef} className="py-4">
              {loadingMore && (
                <div className="text-center">
                  <div className="animate-spin w-8 h-8 border-4 border-black dark:border-white border-t-transparent dark:border-t-transparent rounded-full mx-auto mb-2"></div>
                  <p className="text-gray-600 dark:text-gray-400 font-bold">
                    Loading more posts...
                  </p>
                </div>
              )}
            </div>
          )}

          {/* End of Feed */}
          {!hasMore && posts.length > 0 && (
            <div className="text-center py-8">
              <div className="bg-gray-200 dark:bg-gray-700 border-4 border-black dark:border-gray-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(55,65,81,1)] p-6">
                <p className="text-gray-600 dark:text-gray-400 font-bold">
                  You've reached the end! 🎉
                </p>
                <button
                  onClick={scrollToTop}
                  className="mt-3 px-4 py-2 bg-blue-400 dark:bg-blue-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold uppercase text-black dark:text-white"
                >
                  Back to Top
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SocialFeed;