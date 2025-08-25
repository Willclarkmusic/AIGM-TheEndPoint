import { 
    collection, 
    getDocs, 
    doc, 
    setDoc, 
    writeBatch, 
    serverTimestamp,
    query,
    orderBy 
  } from "firebase/firestore";
  import { db } from "../firebase/config";
  
  interface TagData {
    name: string;
    normalizedName: string;
    count: number;
    firstUsed: any;
    lastUsed: any;
    trendingScore: number;
    metadata: {
      description?: string;
      category?: string;
      relatedTags?: string[];
    };
  }
  
  /**
   * Migration script to create master tags collection from existing posts
   */
  export async function createMasterTagsCollection() {
    console.log("Starting tags collection migration...");
    
    try {
      // Step 1: Get all posts to extract tags
      const postsRef = collection(db, "social_feed");
      const postsQuery = query(postsRef, orderBy("timestamp", "desc"));
      const postsSnapshot = await getDocs(postsQuery);
      
      if (postsSnapshot.empty) {
        console.log("No posts found to extract tags from");
        return { success: true, tagsCreated: 0 };
      }
  
      // Step 2: Process all posts and aggregate tag data
      const tagMap = new Map<string, {
        name: string;
        count: number;
        firstUsed: any;
        lastUsed: any;
        posts: Array<{ id: string; timestamp: any }>;
      }>();
  
      console.log(`Processing ${postsSnapshot.docs.length} posts...`);
      
      postsSnapshot.docs.forEach((postDoc) => {
        const postData = postDoc.data();
        const timestamp = postData.timestamp || postData.createdAt;
        
        if (postData.tags && Array.isArray(postData.tags)) {
          postData.tags.forEach((tag: string) => {
            if (!tag || typeof tag !== 'string') return;
            
            const normalizedTag = tag.toLowerCase().trim();
            if (!normalizedTag) return;
            
            const existing = tagMap.get(normalizedTag);
            
            if (existing) {
              // Update existing tag
              existing.count++;
              existing.posts.push({ id: postDoc.id, timestamp });
              
              // Update timestamps
              if (!existing.firstUsed || (timestamp && timestamp.toDate() < existing.firstUsed.toDate())) {
                existing.firstUsed = timestamp;
              }
              if (!existing.lastUsed || (timestamp && timestamp.toDate() > existing.lastUsed.toDate())) {
                existing.lastUsed = timestamp;
              }
            } else {
              // Create new tag entry
              tagMap.set(normalizedTag, {
                name: tag, // Keep original casing for first occurrence
                count: 1,
                firstUsed: timestamp || serverTimestamp(),
                lastUsed: timestamp || serverTimestamp(),
                posts: [{ id: postDoc.id, timestamp }]
              });
            }
          });
        }
      });
  
      console.log(`Found ${tagMap.size} unique tags`);
  
      // Step 3: Calculate trending scores and create tag documents
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const batch = writeBatch(db);
      let batchCount = 0;
      const BATCH_SIZE = 500;
      
      for (const [normalizedName, tagInfo] of tagMap) {
        // Calculate trending score based on recent activity
        const recentPosts = tagInfo.posts.filter(post => {
          if (!post.timestamp || !post.timestamp.toDate) return false;
          const postDate = post.timestamp.toDate();
          return postDate >= oneDayAgo;
        });
        
        const weeklyPosts = tagInfo.posts.filter(post => {
          if (!post.timestamp || !post.timestamp.toDate) return false;
          const postDate = post.timestamp.toDate();
          return postDate >= oneWeekAgo;
        });
        
        // Trending score: recent activity + total usage
        const trendingScore = (recentPosts.length * 10) + (weeklyPosts.length * 2) + tagInfo.count;
        
        const tagData: TagData = {
          name: tagInfo.name,
          normalizedName,
          count: tagInfo.count,
          firstUsed: tagInfo.firstUsed,
          lastUsed: tagInfo.lastUsed,
          trendingScore,
          metadata: {
            description: null,
            category: null,
            relatedTags: [],
          }
        };
  
        const tagDocRef = doc(db, "tags", normalizedName);
        batch.set(tagDocRef, tagData);
        batchCount++;
  
        // Commit batch if it reaches the limit
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`Committed batch of ${batchCount} tags`);
          batchCount = 0;
        }
      }
  
      // Commit remaining tags
      if (batchCount > 0) {
        await batch.commit();
        console.log(`Committed final batch of ${batchCount} tags`);
      }
  
      console.log(`Migration completed: Created ${tagMap.size} tag documents`);
      return { success: true, tagsCreated: tagMap.size };
      
    } catch (error) {
      console.error("Tags migration error:", error);
      return { success: false, error, tagsCreated: 0 };
    }
  }
  
  /**
   * Update tag counts after migration (maintenance function)
   */
  export async function recalculateTagCounts() {
    console.log("Recalculating tag counts...");
    
    try {
      const tagsRef = collection(db, "tags");
      const tagsSnapshot = await getDocs(tagsRef);
      
      const postsRef = collection(db, "social_feed");
      const postsSnapshot = await getDocs(postsRef);
      
      // Create a map to count tag usage
      const tagCounts = new Map<string, number>();
      
      postsSnapshot.docs.forEach((postDoc) => {
        const postData = postDoc.data();
        if (postData.tags && Array.isArray(postData.tags)) {
          postData.tags.forEach((tag: string) => {
            const normalizedTag = tag.toLowerCase().trim();
            tagCounts.set(normalizedTag, (tagCounts.get(normalizedTag) || 0) + 1);
          });
        }
      });
      
      // Update tag documents with correct counts
      const batch = writeBatch(db);
      let updatedCount = 0;
      
      tagsSnapshot.docs.forEach((tagDoc) => {
        const actualCount = tagCounts.get(tagDoc.id) || 0;
        const currentData = tagDoc.data();
        
        if (currentData.count !== actualCount) {
          batch.update(tagDoc.ref, { count: actualCount });
          updatedCount++;
        }
      });
      
      if (updatedCount > 0) {
        await batch.commit();
        console.log(`Updated ${updatedCount} tag counts`);
      }
      
      return { success: true, updated: updatedCount };
    } catch (error) {
      console.error("Error recalculating tag counts:", error);
      return { success: false, error };
    }
  }
  
  /**
   * Get trending tags based on recent activity
   */
  export async function getTrendingTags(limit: number = 10) {
    try {
      const tagsRef = collection(db, "tags");
      const tagsQuery = query(tagsRef, orderBy("trendingScore", "desc"));
      const snapshot = await getDocs(tagsQuery);
      
      return snapshot.docs
        .slice(0, limit)
        .map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Error getting trending tags:", error);
      return [];
    }
  }
  
  /**
   * Search tags by name
   */
  export async function searchTags(searchQuery: string, limit: number = 20) {
    try {
      const tagsRef = collection(db, "tags");
      const snapshot = await getDocs(tagsRef);
      
      let matchingTags;
      
      if (!searchQuery.trim()) {
        // If no search query, return all tags sorted by popularity
        matchingTags = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => b.count - a.count); // Sort by usage count
      } else {
        // Filter tags that match the search query
        const searchLower = searchQuery.toLowerCase();
        matchingTags = snapshot.docs
          .filter(doc => {
            const tagData = doc.data();
            return tagData.normalizedName.includes(searchLower) || 
                   tagData.name.toLowerCase().includes(searchLower);
          })
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => b.count - a.count); // Sort by usage count
      }
      
      return matchingTags.slice(0, limit);
    } catch (error) {
      console.error("Error searching tags:", error);
      return [];
    }
  }