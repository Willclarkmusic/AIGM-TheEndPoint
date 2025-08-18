/**
 * Firebase Cloud Functions for AIGM-TheEndPoint
 *
 * This file contains the serverless functions for the messaging platform,
 * including presence management and other backend operations.
 */

import {setGlobalOptions} from "firebase-functions";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {
  onDocumentDeleted,
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import {onCall} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import {FieldValue} from "firebase-admin/firestore";

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

// Global settings for cost control
setGlobalOptions({maxInstances: 10});

/**
 * Presence Management Function
 *
 * This function runs every 5 minutes to update user presence status.
 * It checks all users' lastSeen timestamps and updates their status:
 * - Online: User is active (managed by client-side)
 * - Idle: User hasn't been active for 10+ minutes
 * - Away: User hasn't been active for 20+ minutes
 */
export const updateUserPresence = onSchedule(
  {
    schedule: "every 5 minutes",
    timeZone: "UTC",
    memory: "256MiB",
    timeoutSeconds: 300,
  },
  async (event) => {
    try {
      logger.info("Starting presence update job", {
        timestamp: event.scheduleTime,
      });

      const now = admin.firestore.Timestamp.now();
      const tenMinutesAgo = new admin.firestore.Timestamp(
        now.seconds - 10 * 60, // 10 minutes in seconds
        now.nanoseconds
      );
      const twentyMinutesAgo = new admin.firestore.Timestamp(
        now.seconds - 20 * 60, // 20 minutes in seconds
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
          logger.info(
            `Updating user ${userDoc.id} status from ` +
              `${currentStatus} to ${newStatus}`
          );
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
  }
);

/**
 * User Cleanup Function
 *
 * This function runs daily to clean up old user data and maintain
 * database hygiene. It can be expanded to include cleanup of old
 * messages, expired sessions, etc.
 */
export const dailyCleanup = onSchedule(
  {
    schedule: "0 2 * * *", // Daily at 2 AM UTC
    timeZone: "UTC",
    memory: "512MiB",
    timeoutSeconds: 540, // 9 minutes
  },
  async (event) => {
    try {
      logger.info("Starting daily cleanup job", {
        timestamp: event.scheduleTime,
      });

      // Example: Clean up users who haven't been seen in 30 days
      const thirtyDaysAgo = new admin.firestore.Timestamp(
        admin.firestore.Timestamp.now().seconds - 30 * 24 * 60 * 60,
        0
      );

      const inactiveUsersQuery = db
        .collection("users")
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
  }
);

/**
 * Server Deletion Cascade Function
 *
 * This function is triggered BEFORE a server document is deleted.
 * It performs a cascading delete of all associated data:
 * - All members in the server's members subcollection
 * - All chat rooms in the server's chat_rooms subcollection
 * - All messages in each chat room's messages subcollection
 * - Removes the server ID from all user profiles
 *
 * This ensures data consistency and prevents orphaned data.
 */
export const cascadeServerDelete = onDocumentDeleted(
  "servers/{serverId}",
  async (event) => {
    const serverId = event.params.serverId;
    const serverData = event.data?.data();

    try {
      logger.info(`Starting cascading delete for server: ${serverId}`, {
        serverId,
        serverName: serverData?.name,
      });

      // Step 1: Delete all members and update user profiles
      logger.info("Step 1: Processing server members");
      const membersRef = db
        .collection("servers")
        .doc(serverId)
        .collection("members");
      const membersSnapshot = await membersRef.get();

      // Process members in batches
      const membersBatch = db.batch();
      let membersDeleted = 0;

      for (const memberDoc of membersSnapshot.docs) {
        const memberData = memberDoc.data();
        const userId = memberData.userId;

        // Update user's profile to remove this server
        const userRef = db.collection("users").doc(userId);
        membersBatch.update(userRef, {
          servers: admin.firestore.FieldValue.arrayRemove(serverId),
        });

        // Delete the member document
        membersBatch.delete(memberDoc.ref);
        membersDeleted++;
      }

      if (membersDeleted > 0) {
        await membersBatch.commit();
        logger.info(`Deleted ${membersDeleted} members`);
      }

      // Step 2: Delete all chat rooms and their messages
      logger.info("Step 2: Processing chat rooms and messages");
      const roomsRef = db
        .collection("servers")
        .doc(serverId)
        .collection("chat_rooms");
      const roomsSnapshot = await roomsRef.get();

      let roomsDeleted = 0;
      let messagesDeleted = 0;

      // Process each room
      for (const roomDoc of roomsSnapshot.docs) {
        const roomId = roomDoc.id;
        logger.info(`Processing room: ${roomId}`);

        // Get all messages in this room
        const messagesRef = roomDoc.ref.collection("messages");
        const messagesSnapshot = await messagesRef.get();

        // Delete messages in batches (Firestore batch limit is 500)
        const messagesBatch = db.batch();
        for (const messageDoc of messagesSnapshot.docs) {
          messagesBatch.delete(messageDoc.ref);
          messagesDeleted++;
        }

        // Commit messages batch if there are messages
        if (messagesSnapshot.size > 0) {
          await messagesBatch.commit();
        }

        // Delete the room document
        await roomDoc.ref.delete();
        roomsDeleted++;

        logger.info(
          `Deleted room ${roomId} with ` + `${messagesSnapshot.size} messages`
        );
      }

      logger.info(
        `Processed ${roomsDeleted} chat rooms with ` +
          `${messagesDeleted} total messages`
      );

      // Step 3: Clean up any additional server-related data
      logger.info("Step 3: Final cleanup");

      // The server document itself is already deleted by the client
      // We just need to ensure all subcollections are cleaned up

      // Log completion
      logger.info(
        "Successfully completed cascading delete for server: " + `${serverId}`,
        {
          serverId,
          serverName: serverData?.name,
          membersDeleted,
          roomsDeleted,
          messagesDeleted,
        }
      );
    } catch (error: unknown) {
      logger.error(`Error in cascading delete for server ${serverId}:`, error);

      // Log detailed error for debugging
      logger.error("Detailed error information:", {
        serverId,
        serverName: serverData?.name,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
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
      const serversQuery = db
        .collectionGroup("members")
        .where("userId", "==", userId);
      const serverMemberships = await serversQuery.get();

      for (const membership of serverMemberships.docs) {
        batch.delete(membership.ref);
      }

      logger.info(`Removed user from ${serverMemberships.size} servers`);

      // Clean up user's messages (mark as deleted rather than delete)
      // This preserves chat history while anonymizing the user
      const messagesQuery = db
        .collectionGroup("messages")
        .where("senderId", "==", userId);
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

/**
 * Callable Function: Delete Server with Cascading
 *
 * This function safely deletes a server and all its associated data.
 * It first verifies the user has permission to delete the server,
 * then performs cascading deletion of all subcollections.
 */
export const deleteServer = onCall(
  {
    memory: "512MiB",
    timeoutSeconds: 300,
  },
  async (request) => {
    try {
      // Verify authentication
      if (!request.auth) {
        throw new Error("Authentication required");
      }

      const {serverId} = request.data;
      const userId = request.auth.uid;

      if (!serverId) {
        throw new Error("Server ID is required");
      }

      logger.info(`Starting server deletion for: ${serverId}`, {
        serverId,
        userId,
      });

      // Step 1: Verify user has permission to delete this server
      const serverRef = db.collection("servers").doc(serverId);
      const serverDoc = await serverRef.get();

      if (!serverDoc.exists) {
        throw new Error("Server not found");
      }

      const serverData = serverDoc.data();

      // Check if user is an owner
      const memberRef = db
        .collection("servers")
        .doc(serverId)
        .collection("members")
        .doc(userId);
      const memberDoc = await memberRef.get();

      if (!memberDoc.exists || memberDoc.data()?.role !== "owner") {
        throw new Error("Only server owners can delete servers");
      }

      // Step 2: Delete all members and update user profiles
      logger.info("Step 2: Deleting server members");
      const membersRef = db
        .collection("servers")
        .doc(serverId)
        .collection("members");
      const membersSnapshot = await membersRef.get();

      let membersDeleted = 0;
      const membersBatch = db.batch();

      for (const memberDoc of membersSnapshot.docs) {
        const memberData = memberDoc.data();
        const memberUserId = memberData.userId;

        // Update user's profile (if it exists)
        try {
          const userRef = db.collection("users").doc(memberUserId);
          const userDoc = await userRef.get();
          if (userDoc.exists) {
            membersBatch.update(userRef, {
              servers: admin.firestore.FieldValue.arrayRemove(serverId),
            });
          }
        } catch (error) {
          logger.warn(
            `Could not update user profile for ${memberUserId}:`,
            error
          );
        }

        // Delete the member document
        membersBatch.delete(memberDoc.ref);
        membersDeleted++;
      }

      if (membersDeleted > 0) {
        await membersBatch.commit();
        logger.info(`Deleted ${membersDeleted} members`);
      }

      // Step 3: Delete all chat rooms and their messages
      logger.info("Step 3: Deleting chat rooms and messages");
      const roomsRef = db
        .collection("servers")
        .doc(serverId)
        .collection("chat_rooms");
      const roomsSnapshot = await roomsRef.get();

      let roomsDeleted = 0;
      let messagesDeleted = 0;

      for (const roomDoc of roomsSnapshot.docs) {
        const roomId = roomDoc.id;
        logger.info(`Deleting room: ${roomId}`);

        // Get all messages in this room
        const messagesRef = roomDoc.ref.collection("messages");
        const messagesSnapshot = await messagesRef.get();

        // Delete messages in batches
        if (messagesSnapshot.size > 0) {
          const messagesBatch = db.batch();
          for (const messageDoc of messagesSnapshot.docs) {
            messagesBatch.delete(messageDoc.ref);
            messagesDeleted++;
          }
          await messagesBatch.commit();
        }

        // Delete the room document
        await roomDoc.ref.delete();
        roomsDeleted++;
      }

      logger.info(
        `Deleted ${roomsDeleted} rooms with ${messagesDeleted} ` + "messages"
      );

      // Step 4: Finally delete the server document
      logger.info("Step 4: Deleting server document");
      await serverRef.delete();

      logger.info(`Successfully deleted server: ${serverId}`, {
        serverId,
        serverName: serverData?.name,
        membersDeleted,
        roomsDeleted,
        messagesDeleted,
      });

      return {
        success: true,
        serverId,
        membersDeleted,
        roomsDeleted,
        messagesDeleted,
      };
    } catch (error: unknown) {
      logger.error("Error deleting server:", error);
      const message =
        error instanceof Error ? error.message : "Failed to delete server";
      throw new Error(message);
    }
  }
);

/**
 * Tag Management: Auto-update tags when posts are created
 */
export const onPostCreate = onDocumentCreated(
  "social_feed/{postId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const postData = snapshot.data();
    const tags = postData.tags;

    if (!tags || !Array.isArray(tags) || tags.length === 0) return;

    try {
      const batch = db.batch();
      const timestamp = postData.timestamp || FieldValue.serverTimestamp();

      for (const tag of tags) {
        if (!tag || typeof tag !== "string") continue;

        const normalizedTag = tag.toLowerCase().trim();
        const tagRef = db.collection("tags").doc(normalizedTag);

        // Check if tag exists
        const tagDoc = await tagRef.get();

        if (tagDoc.exists) {
          // Update existing tag
          batch.update(tagRef, {
            count: FieldValue.increment(1),
            lastUsed: timestamp,
            trendingScore: FieldValue.increment(10), // Boost for new posts
          });
        } else {
          // Create new tag
          batch.set(tagRef, {
            name: tag, // Keep original casing
            normalizedName: normalizedTag,
            count: 1,
            firstUsed: timestamp,
            lastUsed: timestamp,
            trendingScore: 10,
            metadata: {
              description: null,
              category: null,
              relatedTags: [],
            },
          });
        }
      }

      await batch.commit();
      logger.info(`Updated ${tags.length} tags for new post`);
    } catch (error) {
      logger.error("Error updating tags for new post:", error);
    }
  }
);

/**
 * Tag Management: Handle tag changes when posts are updated
 */
export const onPostUpdate = onDocumentUpdated(
  "social_feed/{postId}",
  async (event) => {
    const beforeData = event.data?.before?.data();
    const afterData = event.data?.after?.data();

    if (!beforeData || !afterData) return;

    const oldTags = beforeData.tags || [];
    const newTags = afterData.tags || [];

    // Find added and removed tags
    const addedTags = newTags.filter((tag: string) => !oldTags.includes(tag));
    const removedTags = oldTags.filter((tag: string) => !newTags.includes(tag));

    if (addedTags.length === 0 && removedTags.length === 0) return;

    try {
      const batch = db.batch();
      const timestamp = afterData.timestamp || FieldValue.serverTimestamp();

      // Handle added tags
      for (const tag of addedTags) {
        const normalizedTag = tag.toLowerCase().trim();
        const tagRef = db.collection("tags").doc(normalizedTag);

        const tagDoc = await tagRef.get();
        if (tagDoc.exists) {
          batch.update(tagRef, {
            count: FieldValue.increment(1),
            lastUsed: timestamp,
            trendingScore: FieldValue.increment(5),
          });
        } else {
          batch.set(tagRef, {
            name: tag,
            normalizedName: normalizedTag,
            count: 1,
            firstUsed: timestamp,
            lastUsed: timestamp,
            trendingScore: 10,
            metadata: {
              description: null,
              category: null,
              relatedTags: [],
            },
          });
        }
      }

      // Handle removed tags
      for (const tag of removedTags) {
        const normalizedTag = tag.toLowerCase().trim();
        const tagRef = db.collection("tags").doc(normalizedTag);

        const tagDoc = await tagRef.get();
        if (tagDoc.exists) {
          const currentCount = tagDoc.data()?.count || 1;
          if (currentCount <= 1) {
            // Delete tag if count would be 0
            batch.delete(tagRef);
          } else {
            batch.update(tagRef, {
              count: FieldValue.increment(-1),
            });
          }
        }
      }

      await batch.commit();
      logger.info(`Updated tags: +${addedTags.length}, -${removedTags.length}`);
    } catch (error) {
      logger.error("Error updating tags for post update:", error);
    }
  }
);

/**
 * Tag Management: Cleanup tags when posts are deleted
 */
export const onPostDelete = onDocumentDeleted(
  "social_feed/{postId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const postData = snapshot.data();
    const tags = postData.tags;

    if (!tags || !Array.isArray(tags) || tags.length === 0) return;

    try {
      const batch = db.batch();

      for (const tag of tags) {
        if (!tag || typeof tag !== "string") continue;

        const normalizedTag = tag.toLowerCase().trim();
        const tagRef = db.collection("tags").doc(normalizedTag);

        const tagDoc = await tagRef.get();
        if (tagDoc.exists) {
          const currentCount = tagDoc.data()?.count || 1;
          if (currentCount <= 1) {
            // Delete tag if count would be 0
            batch.delete(tagRef);
          } else {
            batch.update(tagRef, {
              count: FieldValue.increment(-1),
            });
          }
        }
      }

      await batch.commit();
      logger.info(`Cleaned up ${tags.length} tags for deleted post`);
    } catch (error) {
      logger.error("Error cleaning up tags for deleted post:", error);
    }
  }
);
