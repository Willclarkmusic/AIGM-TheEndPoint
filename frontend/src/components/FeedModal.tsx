import React, { useState, useEffect } from "react";
import { FiX, FiPlus, FiMinus, FiHash } from "react-icons/fi";
import { collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../firebase/config";
import type { User } from "firebase/auth";
import { searchTags } from "../utils/migrateTags";

interface FeedModalProps {
  user: User;
  feed?: {
    id: string;
    name: string;
    tags: string[];
  } | null;
  onClose: () => void;
}

interface Tag {
  id: string;
  name: string;
  count?: number;
}

/**
 * FeedModal Component
 * 
 * Modal for creating and editing custom feeds.
 * Allows users to name their feed and select tags to include.
 */
const FeedModal: React.FC<FeedModalProps> = ({ user, feed, onClose }) => {
  const [feedName, setFeedName] = useState(feed?.name || "");
  const [selectedTags, setSelectedTags] = useState<string[]>(feed?.tags || []);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [tagSearchQuery, setTagSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load available tags from tags collection
  useEffect(() => {
    const loadTags = async () => {
      try {
        // Get all tags sorted by count (popularity)
        const allTags = await searchTags("", 1000); // Get up to 1000 tags
        
        const tags: Tag[] = allTags.map((tag: any) => ({
          id: tag.normalizedName,
          name: tag.name,
          count: tag.count,
        }));

        setAvailableTags(tags);
      } catch (error) {
        console.error("Error loading tags:", error);
      }
    };

    loadTags();
  }, []);

  // Filter tags based on search
  const filteredTags = availableTags.filter(tag =>
    tag.name.toLowerCase().includes(tagSearchQuery.toLowerCase()) &&
    !selectedTags.includes(tag.id)
  );

  // Toggle tag selection
  const toggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      setSelectedTags(prev => prev.filter(t => t !== tagId));
    } else {
      setSelectedTags(prev => [...prev, tagId]);
    }
  };

  // Save feed
  const handleSave = async () => {
    if (!feedName.trim()) {
      setError("Feed name is required");
      return;
    }

    if (selectedTags.length === 0) {
      setError("Please select at least one tag");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const feedData = {
        name: feedName.trim(),
        tags: selectedTags,
        updatedAt: new Date(),
      };

      if (feed) {
        // Update existing feed
        await updateDoc(doc(db, "users", user.uid, "feeds", feed.id), feedData);
      } else {
        // Create new feed
        await addDoc(collection(db, "users", user.uid, "feeds"), {
          ...feedData,
          createdAt: new Date(),
        });
      }

      onClose();
    } catch (error) {
      console.error("Error saving feed:", error);
      setError("Failed to save feed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete feed
  const handleDelete = async () => {
    if (!feed || !confirm("Are you sure you want to delete this feed?")) return;

    setIsSaving(true);
    
    try {
      await deleteDoc(doc(db, "users", user.uid, "feeds", feed.id));
      onClose();
    } catch (error) {
      console.error("Error deleting feed:", error);
      setError("Failed to delete feed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(55,65,81,1)] max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b-2 border-black dark:border-gray-600">
          <h2 className="text-2xl font-black uppercase text-black dark:text-white">
            {feed ? "Edit Feed" : "Create Feed"}
          </h2>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-red-400 dark:bg-red-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
          >
            <FiX size={20} className="text-black dark:text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-400 dark:bg-red-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)]">
              <p className="text-black dark:text-white font-bold">{error}</p>
            </div>
          )}

          {/* Feed Name */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-black dark:text-white mb-2 uppercase">
              Feed Name
            </label>
            <input
              type="text"
              value={feedName}
              onChange={(e) => setFeedName(e.target.value)}
              placeholder="e.g., Web Development"
              className="w-full px-4 py-3 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[4px_4px_0px_0px_rgba(55,65,81,1)] transition-all"
              disabled={isSaving}
            />
          </div>

          {/* Selected Tags */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-black dark:text-white mb-3 uppercase">
              Selected Tags ({selectedTags.length})
            </h3>
            {selectedTags.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 italic">
                No tags selected. Search and add tags below.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selectedTags.map((tagId) => {
                  const tag = availableTags.find(t => t.id === tagId);
                  return (
                    <div
                      key={tagId}
                      className="flex items-center gap-1 px-3 py-1 bg-green-400 dark:bg-green-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)]"
                    >
                      <FiHash size={12} className="text-black dark:text-white" />
                      <span className="text-sm font-bold text-black dark:text-white">
                        {tag?.name || tagId}
                      </span>
                      <button
                        onClick={() => toggleTag(tagId)}
                        className="ml-1 text-black dark:text-white hover:text-red-600 dark:hover:text-red-400"
                        disabled={isSaving}
                      >
                        <FiX size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tag Search */}
          <div className="mb-4">
            <label className="block text-sm font-bold text-black dark:text-white mb-2 uppercase">
              Add Tags
            </label>
            <input
              type="text"
              value={tagSearchQuery}
              onChange={(e) => setTagSearchQuery(e.target.value)}
              placeholder="Search for tags..."
              className="w-full px-4 py-3 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[4px_4px_0px_0px_rgba(55,65,81,1)] transition-all"
              disabled={isSaving}
            />
          </div>

          {/* Available Tags */}
          <div className="max-h-48 overflow-y-auto border-2 border-black dark:border-gray-600 bg-gray-50 dark:bg-gray-900">
            {filteredTags.length === 0 ? (
              <p className="p-4 text-center text-gray-500 dark:text-gray-400">
                {tagSearchQuery ? "No matching tags found" : "All tags have been selected"}
              </p>
            ) : (
              <div className="p-2 space-y-1">
                {filteredTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    disabled={isSaving}
                  >
                    <div className="flex items-center gap-2">
                      <FiHash size={14} className="text-gray-500" />
                      <span className="text-sm font-medium text-black dark:text-white">
                        {tag.name}
                      </span>
                      {tag.count && (
                        <span className="text-xs text-gray-500">({tag.count} posts)</span>
                      )}
                    </div>
                    <FiPlus size={16} className="text-green-600 dark:text-green-400" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t-2 border-black dark:border-gray-600">
          {feed && (
            <button
              onClick={handleDelete}
              disabled={isSaving}
              className="px-4 py-3 bg-red-400 dark:bg-red-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Delete Feed
            </button>
          )}
          
          <div className="flex gap-3 ml-auto">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-3 bg-gray-400 dark:bg-gray-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !feedName.trim() || selectedTags.length === 0}
              className="px-6 py-3 bg-green-400 dark:bg-green-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Saving..." : "Save Feed"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedModal;