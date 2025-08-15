import React, { useState, useEffect, useRef } from "react";
import {
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase/config";
import {
  FiTrash2,
  FiEdit2,
  FiSmile,
} from "react-icons/fi";
import EmojiPicker from "./EmojiPicker";

interface RoomSettingsModalProps {
  serverId: string;
  roomId: string;
  roomName: string;
  roomType: string;
  roomIcon?: string;
  onClose: () => void;
  onRoomDeleted?: () => void;
  onRoomUpdated?: () => void;
  userRole: "owner" | "admin" | "member";
}

interface RoomData {
  name: string;
  type: string;
  icon?: string;
  createdBy?: string;
  createdAt?: any;
}

const RoomSettingsModal: React.FC<RoomSettingsModalProps> = ({
  serverId,
  roomId,
  roomName,
  roomType,
  roomIcon,
  onClose,
  onRoomDeleted,
  onRoomUpdated,
  userRole,
}) => {
  const [roomData, setRoomData] = useState<RoomData>({
    name: roomName,
    type: roomType,
    icon: roomIcon,
  });
  const [isRenaming, setIsRenaming] = useState(false);
  const [newRoomName, setNewRoomName] = useState(roomName);
  const [selectedIcon, setSelectedIcon] = useState(roomIcon || "");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [creatorName, setCreatorName] = useState<string>("");
  
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  // Load room data and creator info
  useEffect(() => {
    const loadRoomData = async () => {
      try {
        const roomDoc = await getDoc(doc(db, `servers/${serverId}/chat_rooms/${roomId}`));
        if (roomDoc.exists()) {
          const data = roomDoc.data() as RoomData;
          setRoomData(data);
          setSelectedIcon(data.icon || "");
          
          // Load creator name if available
          if (data.createdBy) {
            const userDoc = await getDoc(doc(db, "users", data.createdBy));
            if (userDoc.exists()) {
              setCreatorName(userDoc.data().displayName || userDoc.data().email || "Unknown User");
            }
          }
        }
      } catch (error) {
        console.error("Error loading room data:", error);
      }
    };

    loadRoomData();
  }, [serverId, roomId]);

  // Handle room rename
  const handleRename = async () => {
    if (!newRoomName.trim() || newRoomName === roomData.name) {
      setIsRenaming(false);
      return;
    }

    try {
      await updateDoc(doc(db, `servers/${serverId}/chat_rooms/${roomId}`), {
        name: newRoomName.trim(),
        updatedAt: serverTimestamp(),
      });
      setRoomData({ ...roomData, name: newRoomName.trim() });
      setIsRenaming(false);
      onRoomUpdated?.();
    } catch (error) {
      console.error("Error renaming room:", error);
      setNewRoomName(roomData.name);
      setIsRenaming(false);
    }
  };

  // Handle icon selection
  const handleEmojiSelect = async (emoji: string) => {
    try {
      await updateDoc(doc(db, `servers/${serverId}/chat_rooms/${roomId}`), {
        icon: emoji,
        updatedAt: serverTimestamp(),
      });
      setSelectedIcon(emoji);
      setRoomData({ ...roomData, icon: emoji });
      setShowEmojiPicker(false);
      onRoomUpdated?.();
    } catch (error) {
      console.error("Error updating room icon:", error);
    }
  };

  // Handle room deletion
  const handleDeleteRoom = async () => {
    setIsDeleting(true);
    try {
      // Call a Cloud Function to handle cascading deletion if messages exist
      // For now, we'll delete directly (you should implement a Cloud Function for production)
      await deleteDoc(doc(db, `servers/${serverId}/chat_rooms/${roomId}`));
      onRoomDeleted?.();
      onClose();
    } catch (error) {
      console.error("Error deleting room:", error);
      alert("Failed to delete room. Please try again.");
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Get display icon for room type
  const getDefaultIcon = (type: string) => {
    switch (type) {
      case "chat":
        return "#";
      case "genai":
        return "🎨";
      case "ai-agent":
        return "🤖";
      default:
        return "#";
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(55,65,81,1)] p-6 max-w-md w-full m-4">
        <h3 className="text-xl font-black uppercase mb-6 text-black dark:text-white">
          Room Settings
        </h3>

        {/* Room Information */}
        <div className="space-y-4 mb-6">
          {/* Room Name */}
          <div>
            <label className="block font-bold text-sm mb-1 text-gray-700 dark:text-gray-300">
              Room Name
            </label>
            {isRenaming ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename();
                    if (e.key === "Escape") {
                      setNewRoomName(roomData.name);
                      setIsRenaming(false);
                    }
                  }}
                  className="flex-1 px-3 py-2 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)]"
                  autoFocus
                />
                <button
                  onClick={handleRename}
                  className="px-3 py-2 bg-green-400 dark:bg-green-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-lg font-medium text-black dark:text-white">
                  {roomData.name}
                </p>
                {(userRole === "owner" || userRole === "admin") && (
                  <button
                    onClick={() => {
                      setNewRoomName(roomData.name);
                      setIsRenaming(true);
                    }}
                    className="p-2 bg-blue-400 dark:bg-blue-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
                    title="Rename room"
                  >
                    <FiEdit2 size={16} className="text-black dark:text-white" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Room Icon */}
          <div>
            <label className="block font-bold text-sm mb-1 text-gray-700 dark:text-gray-300">
              Room Icon
            </label>
            <div className="flex items-center gap-3">
              <div className="text-3xl">
                {selectedIcon || getDefaultIcon(roomData.type)}
              </div>
              {(userRole === "owner" || userRole === "admin") && (
                <div className="relative">
                  <button
                    ref={emojiButtonRef}
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="px-4 py-2 bg-yellow-400 dark:bg-yellow-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white flex items-center gap-2"
                  >
                    <FiSmile size={16} />
                    Change Icon
                  </button>
                  {showEmojiPicker && (
                    <div className="absolute top-full mt-2 left-0 z-50">
                      <EmojiPicker
                        onEmojiSelect={handleEmojiSelect}
                        onClose={() => setShowEmojiPicker(false)}
                        buttonRef={emojiButtonRef}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Room Type */}
          <div>
            <label className="block font-bold text-sm mb-1 text-gray-700 dark:text-gray-300">
              Room Type
            </label>
            <p className="text-black dark:text-white capitalize">
              {roomData.type === "genai" ? "Gen AI" : roomData.type === "ai-agent" ? "AI Agent" : "Chat"} Room
            </p>
          </div>

          {/* Creator */}
          {creatorName && (
            <div>
              <label className="block font-bold text-sm mb-1 text-gray-700 dark:text-gray-300">
                Created By
              </label>
              <p className="text-black dark:text-white">
                {creatorName}
              </p>
            </div>
          )}

          {/* Created Date */}
          {roomData.createdAt && (
            <div>
              <label className="block font-bold text-sm mb-1 text-gray-700 dark:text-gray-300">
                Created On
              </label>
              <p className="text-black dark:text-white">
                {new Date(roomData.createdAt.seconds * 1000).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          {/* Delete Room Button - Only for owners and admins */}
          {(userRole === "owner" || userRole === "admin") && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full px-4 py-3 bg-red-500 dark:bg-red-600 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-white flex items-center justify-center gap-2"
            >
              <FiTrash2 size={18} />
              Delete Room
            </button>
          )}

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-gray-400 dark:bg-gray-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white"
          >
            Close
          </button>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
            <div className="bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(55,65,81,1)] p-6 max-w-sm w-full m-4">
              <h4 className="text-lg font-black uppercase mb-4 text-red-600 dark:text-red-400">
                Delete Room
              </h4>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Are you sure you want to delete <strong>{roomData.name}</strong>?
                This will permanently delete the room and all messages. This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteRoom}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-red-500 dark:bg-red-600 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-gray-400 dark:bg-gray-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoomSettingsModal;