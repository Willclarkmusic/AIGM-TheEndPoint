import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  doc,
  serverTimestamp,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";

export interface DMRoom {
  id: string;
  participants: string[];
  createdAt: any;
  lastMessageTimestamp?: any;
  lastMessage?: string;
}

export interface Friend {
  id: string;
  name: string;
  email: string;
  status: "online" | "idle" | "away";
  participants?: string[]; // For existing DMs
}

/**
 * Creates a deterministic DM room ID from participant IDs
 * Ensures the same participants always get the same room ID
 */
export const createDMRoomId = (participants: string[]): string => {
  // Sort participant IDs to ensure consistent room ID generation
  const sortedParticipants = [...participants].sort();
  return sortedParticipants.join("_");
};

/**
 * Finds or creates a DM room between participants
 * Returns the DM room ID and participant list
 */
export const findOrCreateDMRoom = async (
  currentUserId: string,
  targetUserId: string
): Promise<{ dmId: string; participants: string[] }> => {
  const participants = [currentUserId, targetUserId];
  const dmId = createDMRoomId(participants);

  try {
    // Check if DM room already exists
    const dmRef = doc(db, "private_messages", dmId);
    const dmDoc = await getDoc(dmRef);

    if (dmDoc.exists()) {
      // Room exists, return it
      const dmData = dmDoc.data();
      return {
        dmId,
        participants: dmData.participants || participants,
      };
    }

    // Room doesn't exist, create it
    await setDoc(dmRef, {
      participants,
      createdAt: serverTimestamp(),
      lastMessageTimestamp: serverTimestamp(),
      lastMessage: "",
    });

    return {
      dmId,
      participants,
    };
  } catch (error) {
    console.error("Error finding or creating DM room:", error);
    throw new Error("Failed to create or find DM room");
  }
};

/**
 * Finds an existing DM room with the given participants
 * Returns null if no room exists
 */
export const findExistingDMRoom = async (
  participants: string[]
): Promise<string | null> => {
  try {
    const dmId = createDMRoomId(participants);
    const dmRef = doc(db, "private_messages", dmId);
    const dmDoc = await getDoc(dmRef);

    if (dmDoc.exists()) {
      return dmId;
    }

    return null;
  } catch (error) {
    console.error("Error finding existing DM room:", error);
    return null;
  }
};

/**
 * Creates a group DM room with multiple participants
 * For groups larger than 2 people
 */
export const createGroupDMRoom = async (
  participants: string[],
  createdBy: string
): Promise<{ dmId: string; participants: string[] }> => {
  if (participants.length < 2) {
    throw new Error("Group DM must have at least 2 participants");
  }

  if (participants.length > 20) {
    throw new Error("Group DM cannot have more than 20 participants");
  }

  const dmId = createDMRoomId(participants);

  try {
    // Check if room already exists with exact same participants
    const dmRef = doc(db, "private_messages", dmId);
    const dmDoc = await getDoc(dmRef);

    if (dmDoc.exists()) {
      // Room exists, return it
      const dmData = dmDoc.data();
      return {
        dmId,
        participants: dmData.participants || participants,
      };
    }

    // Create new group DM
    await setDoc(dmRef, {
      participants,
      createdAt: serverTimestamp(),
      createdBy,
      lastMessageTimestamp: serverTimestamp(),
      lastMessage: "",
      isGroup: participants.length > 2,
    });

    return {
      dmId,
      participants,
    };
  } catch (error) {
    console.error("Error creating group DM room:", error);
    throw new Error("Failed to create group DM room");
  }
};

/**
 * Adds a participant to an existing DM room
 * Converts 1-on-1 DMs to group DMs when adding third person
 */
export const addParticipantToDMRoom = async (
  dmId: string,
  newParticipantId: string
): Promise<{ dmId: string; participants: string[] }> => {
  try {
    const dmRef = doc(db, "private_messages", dmId);
    const dmDoc = await getDoc(dmRef);

    if (!dmDoc.exists()) {
      throw new Error("DM room not found");
    }

    const dmData = dmDoc.data();
    const currentParticipants = dmData.participants || [];

    // Check if participant is already in the room
    if (currentParticipants.includes(newParticipantId)) {
      return {
        dmId,
        participants: currentParticipants,
      };
    }

    // Check participant limit
    if (currentParticipants.length >= 20) {
      throw new Error("Cannot add more participants. Maximum is 20.");
    }

    const newParticipants = [...currentParticipants, newParticipantId];

    // For groups with different participants, we need a new room ID
    const newDMId = createDMRoomId(newParticipants);

    if (newDMId !== dmId) {
      // Create new room with updated participants
      await setDoc(doc(db, "private_messages", newDMId), {
        participants: newParticipants,
        createdAt: dmData.createdAt,
        lastMessageTimestamp: dmData.lastMessageTimestamp,
        lastMessage: dmData.lastMessage,
        isGroup: newParticipants.length > 2,
        originalRoomId: dmId, // Reference to original room
      });

      return {
        dmId: newDMId,
        participants: newParticipants,
      };
    } else {
      // Update existing room
      await updateDoc(dmRef, {
        participants: newParticipants,
        isGroup: newParticipants.length > 2,
      });

      return {
        dmId,
        participants: newParticipants,
      };
    }
  } catch (error) {
    console.error("Error adding participant to DM room:", error);
    throw new Error("Failed to add participant to DM room");
  }
};

/**
 * Gets recent DM rooms for a user
 * Returns rooms ordered by last message timestamp
 */
export const getUserRecentDMs = async (
  userId: string,
  limit: number = 10
): Promise<DMRoom[]> => {
  try {
    const dmQuery = query(
      collection(db, "private_messages"),
      where("participants", "array-contains", userId)
    );

    const dmDocs = await getDocs(dmQuery);
    const dmRooms: DMRoom[] = [];

    dmDocs.forEach((doc) => {
      const data = doc.data();
      dmRooms.push({
        id: doc.id,
        participants: data.participants || [],
        createdAt: data.createdAt,
        lastMessageTimestamp: data.lastMessageTimestamp,
        lastMessage: data.lastMessage,
      });
    });

    // Sort by last message timestamp (most recent first)
    dmRooms.sort((a, b) => {
      if (!a.lastMessageTimestamp) return 1;
      if (!b.lastMessageTimestamp) return -1;
      
      const timeA = a.lastMessageTimestamp.toDate ? a.lastMessageTimestamp.toDate() : new Date(a.lastMessageTimestamp);
      const timeB = b.lastMessageTimestamp.toDate ? b.lastMessageTimestamp.toDate() : new Date(b.lastMessageTimestamp);
      
      return timeB.getTime() - timeA.getTime();
    });

    return dmRooms.slice(0, limit);
  } catch (error) {
    console.error("Error getting user recent DMs:", error);
    return [];
  }
};

/**
 * Updates DM room's last message info
 * Called when a new message is sent
 */
export const updateDMLastMessage = async (
  dmId: string,
  message: string,
  timestamp: any
): Promise<void> => {
  try {
    const dmRef = doc(db, "private_messages", dmId);
    await updateDoc(dmRef, {
      lastMessage: message.substring(0, 100), // Truncate to 100 chars
      lastMessageTimestamp: timestamp,
    });
  } catch (error) {
    console.error("Error updating DM last message:", error);
    // Don't throw error here as it's not critical for message sending
  }
};

/**
 * Gets display name for a DM room
 * For 1-on-1 DMs, returns the other participant's name
 * For group DMs, returns "Group (X)" format
 */
export const getDMDisplayName = async (
  dmId: string,
  participants: string[],
  currentUserId: string,
  userCache?: Map<string, { name: string; email: string }>
): Promise<string> => {
  try {
    const otherParticipants = participants.filter(p => p !== currentUserId);
    
    if (otherParticipants.length === 0) {
      return "You";
    }
    
    if (otherParticipants.length === 1) {
      // 1-on-1 DM - get the other user's name
      const otherUserId = otherParticipants[0];
      
      // Check cache first
      if (userCache?.has(otherUserId)) {
        const cachedUser = userCache.get(otherUserId)!;
        return cachedUser.name || cachedUser.email.split("@")[0] || "Unknown User";
      }
      
      // Query Firestore for user info
      const userQuery = query(
        collection(db, "users"),
        where("userId", "==", otherUserId)
      );
      
      const userDocs = await getDocs(userQuery);
      if (!userDocs.empty) {
        const userData = userDocs.docs[0].data();
        const userName = userData.displayName || userData.email?.split("@")[0] || "Unknown User";
        
        // Cache the result
        if (userCache) {
          userCache.set(otherUserId, {
            name: userName,
            email: userData.email || "",
          });
        }
        
        return userName;
      }
      
      return "Unknown User";
    }
    
    // Group DM
    return `Group (${participants.length})`;
  } catch (error) {
    console.error("Error getting DM display name:", error);
    return participants.length > 2 ? `Group (${participants.length})` : "Unknown";
  }
};