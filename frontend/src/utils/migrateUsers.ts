import { collection, getDocs, doc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase/config";

/**
 * Migration script to add subscribedTags field to existing users
 * This should be run once to update all existing user documents
 */
export async function migrateUsersAddSubscribedTags() {
  console.log("Starting user migration: Adding subscribedTags field...");
  
  try {
    // Get all users
    const usersRef = collection(db, "users");
    const snapshot = await getDocs(usersRef);
    
    if (snapshot.empty) {
      console.log("No users found to migrate");
      return { success: true, migrated: 0 };
    }

    // Use batch writes for better performance
    const batch = writeBatch(db);
    let count = 0;
    
    snapshot.docs.forEach((userDoc) => {
      const userData = userDoc.data();
      
      // Only update if subscribedTags doesn't exist
      if (!userData.subscribedTags) {
        const userRef = doc(db, "users", userDoc.id);
        batch.update(userRef, {
          subscribedTags: []
        });
        count++;
      }
    });

    if (count > 0) {
      // Commit the batch
      await batch.commit();
      console.log(`Migration completed: Updated ${count} users`);
    } else {
      console.log("All users already have subscribedTags field");
    }

    return { success: true, migrated: count };
  } catch (error) {
    console.error("Migration error:", error);
    return { success: false, error, migrated: 0 };
  }
}

/**
 * Check if a user needs migration
 */
export async function checkUserNeedsMigration(userId: string): Promise<boolean> {
  try {
    const userRef = doc(db, "users", userId);
    const userDoc = await getDocs(userRef as any);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return !userData.subscribedTags;
    }
    
    return false;
  } catch (error) {
    console.error("Error checking user migration status:", error);
    return false;
  }
}

/**
 * Migrate a single user
 */
export async function migrateSingleUser(userId: string) {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      subscribedTags: []
    });
    
    console.log(`User ${userId} migrated successfully`);
    return { success: true };
  } catch (error) {
    console.error(`Error migrating user ${userId}:`, error);
    return { success: false, error };
  }
}