import React, { useState, useEffect } from "react";
import type { User } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import MessageLog from "./MessageLog";
import MessageComposer from "./MessageComposer";

interface ChatRoomProps {
  serverId: string;
  roomId: string;
  roomName: string;
  user: User;
}

interface RoomData {
  name: string;
  type: "chat" | "genai" | "ai-agent-design";
  createdAt: any;
  createdBy: string;
}

interface UserRole {
  role: "owner" | "admin" | "member";
  userId: string;
  displayName: string;
  email: string;
}

const ChatRoom: React.FC<ChatRoomProps> = ({
  serverId,
  roomId,
  roomName,
  user,
}) => {
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [userRole, setUserRole] = useState<"owner" | "admin" | "member">("member");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load room data and user role
  useEffect(() => {
    const loadRoomAndUserData = async () => {
      if (!serverId || !roomId || !user.uid) return;

      setLoading(true);
      setError(null);

      try {
        // Load room data
        const roomRef = doc(db, `servers/${serverId}/chat_rooms/${roomId}`);
        const roomDoc = await getDoc(roomRef);

        if (!roomDoc.exists()) {
          setError("Room not found");
          setLoading(false);
          return;
        }

        const roomData = roomDoc.data() as RoomData;
        setRoomData(roomData);

        // Load user's role in this server
        const memberRef = doc(db, `servers/${serverId}/members/${user.uid}`);
        const memberDoc = await getDoc(memberRef);

        if (memberDoc.exists()) {
          const memberData = memberDoc.data();
          setUserRole(memberData.role || "member");
        } else {
          // User is not a member of this server
          setError("You are not a member of this server");
          setLoading(false);
          return;
        }

        setLoading(false);
      } catch (error) {
        console.error("Error loading room data:", error);
        setError("Failed to load room data");
        setLoading(false);
      }
    };

    loadRoomAndUserData();
  }, [serverId, roomId, user.uid]);

  // Get room type icon
  const getRoomIcon = (type: string) => {
    switch (type) {
      case "chat":
        return "#";
      case "genai":
        return "🎨";
      case "ai-agent-design":
        return "🤖";
      default:
        return "#";
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <div className="text-gray-600 dark:text-gray-400 mb-2">
            Loading chat room...
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-500">
            {roomName}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <div className="text-red-600 dark:text-red-400 mb-2 font-bold">
            {error}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-500">
            {roomName}
          </div>
        </div>
      </div>
    );
  }

  // Check if user can send messages
  const canSendMessages = userRole === "owner" || userRole === "admin" || userRole === "member";

  return (
    <div className="flex-1 bg-white dark:bg-gray-900 flex flex-col h-full min-h-0">
      <MessageLog
        serverId={serverId}
        roomId={roomId}
        user={user}
        userRole={userRole}
      />
      
      {/* Message Composer - Fixed at bottom */}
      <div className="flex-shrink-0">
        <MessageComposer
          serverId={serverId}
          roomId={roomId}
          user={user}
          disabled={!canSendMessages}
          roomType={roomData?.type as "chat" | "genai" | "ai-agent-design"}
        />
      </div>
    </div>
  );
};

export default ChatRoom;