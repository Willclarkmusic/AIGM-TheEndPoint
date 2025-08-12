/**
 * Firebase Cloud Functions for AIGM-TheEndPoint
 * 
 * This file contains the serverless functions for the messaging platform,
 * including presence management and other backend operations.
 */

import {setGlobalOptions} from "firebase-functions";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {onDocumentDeleted} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

// Global settings for cost control
setGlobalOptions({ maxInstances: 10 });

/**
 * Presence Management Function
 * 
 * This function runs every 5 minutes to update user presence status.
 * It checks all users' lastSeen timestamps and updates their status:
 * - Online: User is active (managed by client-side)
 * - Idle: User hasn't been active for 10+ minutes
 * - Away: User hasn't been active for 20+ minutes
 */
export const updateUserPresence = onSchedule({
  schedule: "every 5 minutes",
  timeZone: "UTC",
  memory: "256MiB",
  timeoutSeconds: 300,
}, async (event) => {
  try {
    logger.info("Starting presence update job", {
      timestamp: event.scheduleTime,
    });

    const now = admin.firestore.Timestamp.now();
    const tenMinutesAgo = new admin.firestore.Timestamp(
      now.seconds - (10 * 60), // 10 minutes in seconds
      now.nanoseconds
    );
    const twentyMinutesAgo = new admin.firestore.Timestamp(
      now.seconds - (20 * 60), // 20 minutes in seconds
      now.nanoseconds
    );

    // Get all users from the users collection
    const usersSnapshot = await db.collection("users").get();
    
    if (usersSnapshot.empty) {
      logger.info("No users found to update presence for");
      return;
    }

    const batch = db.batch();
    let updatesCount = 0;

    // Process each user
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const lastSeen = userData.lastSeen;
      const currentStatus = userData.status || "online";

      // Skip if lastSeen is not available
      if (!lastSeen) {
        logger.warn(`User ${userDoc.id} has no lastSeen timestamp`);
        continue;
      }

      let newStatus = currentStatus;

      // Determine new status based on lastSeen timestamp
      if (lastSeen < twentyMinutesAgo && currentStatus !== "away") {
        newStatus = "away";
      } else if (lastSeen < tenMinutesAgo && currentStatus === "online") {
        newStatus = "idle";
      }

      // Only update if status needs to change
      if (newStatus !== currentStatus) {
        const userRef = db.collection("users").doc(userDoc.id);
        batch.update(userRef, {
          status: newStatus,
          statusUpdatedAt: now,
        });
        
        updatesCount++;
        logger.info(`Updating user ${userDoc.id} status from ${currentStatus} to ${newStatus}`);
      }
    }

    // Commit all updates in a batch
    if (updatesCount > 0) {
      await batch.commit();
      logger.info(`Successfully updated presence for ${updatesCount} users`);
    } else {
      logger.info("No presence updates needed");
    }

    // Log completion
    logger.info("Presence update job completed", {
      totalUsers: usersSnapshot.size,
      updatedUsers: updatesCount,
    });

  } catch (error) {
    logger.error("Error updating user presence:", error);
    throw error;
  }
});

/**
 * User Cleanup Function
 * 
 * This function runs daily to clean up old user data and maintain database hygiene.
 * It can be expanded to include cleanup of old messages, expired sessions, etc.
 */
export const dailyCleanup = onSchedule({
  schedule: "0 2 * * *", // Daily at 2 AM UTC
  timeZone: "UTC",
  memory: "512MiB",
  timeoutSeconds: 540, // 9 minutes
}, async (event) => {
  try {
    logger.info("Starting daily cleanup job", {
      timestamp: event.scheduleTime,
    });

    // Example: Clean up users who haven't been seen in 30 days
    const thirtyDaysAgo = new admin.firestore.Timestamp(
      admin.firestore.Timestamp.now().seconds - (30 * 24 * 60 * 60),
      0
    );

    const inactiveUsersQuery = db.collection("users")
      .where("lastSeen", "<", thirtyDaysAgo);
    
    const inactiveUsers = await inactiveUsersQuery.get();
    
    if (!inactiveUsers.empty) {
      logger.info(`Found ${inactiveUsers.size} inactive users to process`);
      // Add cleanup logic here as needed
    }

    logger.info("Daily cleanup job completed");

  } catch (error) {
    logger.error("Error in daily cleanup:", error);
    throw error;
  }
});

/**
 * Server Deletion Cascade Function
 * 
 * This function is triggered when a server document is deleted.
 * It performs a cascading delete of all associated data:
 * - All members in the server's members subcollection
 * - All chat rooms in the server's chat_rooms subcollection
 * - All messages in each chat room's messages subcollection
 * - Removes the server ID from all user profiles
 * 
 * This ensures data consistency and prevents orphaned data.
 */
export const onServerDelete = onDocumentDeleted(
  "servers/{serverId}",
  async (event) => {
    const serverId = event.params.serverId;
    const serverData = event.data?.data();
    
    try {
      logger.info(`Starting cascading delete for server: ${serverId}`, {
        serverId,
        serverName: serverData?.name,
      });

      const batch = db.batch();
      let deletionCount = 0;

      // Step 1: Get all members and remove server from their profiles
      logger.info("Step 1: Processing server members");
      const membersRef = db.collection("servers").doc(serverId).collection("members");
      const membersSnapshot = await membersRef.get();
      
      // Remove server ID from each member's profile
      for (const memberDoc of membersSnapshot.docs) {
        const userId = memberDoc.id;
        const userRef = db.collection("users").doc(userId);
        
        // Remove server ID from user's servers array
        batch.update(userRef, {
          servers: admin.firestore.FieldValue.arrayRemove(serverId)
        });
        
        // Delete the member document
        batch.delete(memberDoc.ref);
        deletionCount++;
      }
      
      logger.info(`Processed ${membersSnapshot.size} members`);

      // Step 2: Get all chat rooms and their messages
      logger.info("Step 2: Processing chat rooms and messages");
      const roomsRef = db.collection("servers").doc(serverId).collection("chat_rooms");
      const roomsSnapshot = await roomsRef.get();
      
      // Process each room
      for (const roomDoc of roomsSnapshot.docs) {
        const roomId = roomDoc.id;
        logger.info(`Processing room: ${roomId}`);
        
        // Get all messages in this room
        const messagesRef = roomDoc.ref.collection("messages");
        const messagesSnapshot = await messagesRef.get();
        
        // Delete all messages in the room
        for (const messageDoc of messagesSnapshot.docs) {
          batch.delete(messageDoc.ref);
          deletionCount++;
        }
        
        // Delete the room document
        batch.delete(roomDoc.ref);
        deletionCount++;
        
        logger.info(`Deleted room ${roomId} with ${messagesSnapshot.size} messages`);
      }
      
      logger.info(`Processed ${roomsSnapshot.size} chat rooms`);

      // Step 3: Handle private messages (if any are associated with the server)
      logger.info("Step 3: Processing private messages");
      const privateMessagesRef = db.collection("servers").doc(serverId).collection("private_messages");
      const privateMessagesSnapshot = await privateMessagesRef.get();
      
      // Process each private message thread
      for (const pmDoc of privateMessagesSnapshot.docs) {
        const pmId = pmDoc.id;
        logger.info(`Processing private message thread: ${pmId}`);
        
        // Get all messages in this private message thread
        const pmMessagesRef = pmDoc.ref.collection("messages");
        const pmMessagesSnapshot = await pmMessagesRef.get();
        
        // Delete all messages in the private message thread
        for (const messageDoc of pmMessagesSnapshot.docs) {
          batch.delete(messageDoc.ref);
          deletionCount++;
        }
        
        // Delete the private message thread document
        batch.delete(pmDoc.ref);
        deletionCount++;
      }
      
      logger.info(`Processed ${privateMessagesSnapshot.size} private message threads`);

      // Commit the batch (Firestore has a 500 operation limit per batch)
      // For large deletions, this would need to be split into multiple batches in production
      await batch.commit();
      logger.info(`Committed batch operations for server deletion`);

      // Log completion
      logger.info(`Successfully completed cascading delete for server: ${serverId}`, {
        serverId,
        serverName: serverData?.name,
        totalDeletions: deletionCount,
        membersDeleted: membersSnapshot.size,
        roomsDeleted: roomsSnapshot.size,
        privateMessageThreadsDeleted: privateMessagesSnapshot.size,
      });

    } catch (error: any) {
      logger.error(`Error in cascading delete for server ${serverId}:`, error);
      
      // Don't throw the error to prevent infinite retries
      // Instead, log it for manual investigation
      logger.error("Manual cleanup may be required for server:", {
        serverId,
        serverName: serverData?.name,
        error: error?.message || 'Unknown error',
      });
    }
  }
);

/**
 * User Account Deletion Function
 * 
 * This function is triggered when a user document is deleted.
 * It cleans up all associated user data across the platform.
 */
export const onUserDelete = onDocumentDeleted(
  "users/{userId}",
  async (event) => {
    const userId = event.params.userId;
    const userData = event.data?.data();
    
    try {
      logger.info(`Starting user data cleanup for: ${userId}`, {
        userId,
        email: userData?.email,
      });

      const batch = db.batch();

      // Remove user from all server memberships
      const serversQuery = db.collectionGroup("members").where("userId", "==", userId);
      const serverMemberships = await serversQuery.get();
      
      for (const membership of serverMemberships.docs) {
        batch.delete(membership.ref);
      }
      
      logger.info(`Removed user from ${serverMemberships.size} servers`);

      // Clean up user's messages (mark as deleted rather than actually delete)
      // This preserves chat history while anonymizing the user
      const messagesQuery = db.collectionGroup("messages").where("senderId", "==", userId);
      const userMessages = await messagesQuery.get();
      
      for (const message of userMessages.docs) {
        batch.update(message.ref, {
          senderId: "deleted-user",
          senderName: "Deleted User",
          deletedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      
      logger.info(`Anonymized ${userMessages.size} messages`);

      // Commit all updates
      if (serverMemberships.size > 0 || userMessages.size > 0) {
        await batch.commit();
      }

      logger.info(`Successfully completed user cleanup for: ${userId}`);

    } catch (error) {
      logger.error(`Error in user cleanup for ${userId}:`, error);
    }
  }
);
