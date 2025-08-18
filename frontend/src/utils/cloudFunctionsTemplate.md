# Cloud Functions for Tags Management

This document outlines the Firebase Cloud Functions needed to maintain the tags collection automatically. These functions should be deployed to Firebase Functions to keep the tags collection in sync with posts.

## Required Cloud Functions

### 1. `onPostCreate` - Update tags when a post is created

```typescript
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

export const onPostCreate = onDocumentCreated(
  "social_feed/{postId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const postData = snapshot.data();
    const tags = postData.tags;

    if (!tags || !Array.isArray(tags) || tags.length === 0) return;

    const db = getFirestore();
    const batch = db.batch();
    const timestamp = postData.timestamp || FieldValue.serverTimestamp();

    for (const tag of tags) {
      if (!tag || typeof tag !== 'string') continue;
      
      const normalizedTag = tag.toLowerCase().trim();
      const tagRef = db.collection('tags').doc(normalizedTag);
      
      // Check if tag exists
      const tagDoc = await tagRef.get();
      
      if (tagDoc.exists) {
        // Update existing tag
        batch.update(tagRef, {
          count: FieldValue.increment(1),
          lastUsed: timestamp,
          trendingScore: FieldValue.increment(10) // Boost for new posts
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
            relatedTags: []
          }
        });
      }
    }

    await batch.commit();
  }
);
```

### 2. `onPostUpdate` - Handle tag changes when a post is updated

```typescript
import { onDocumentUpdated } from "firebase-functions/v2/firestore";

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

    const db = getFirestore();
    const batch = db.batch();
    const timestamp = afterData.timestamp || FieldValue.serverTimestamp();

    // Handle added tags
    for (const tag of addedTags) {
      const normalizedTag = tag.toLowerCase().trim();
      const tagRef = db.collection('tags').doc(normalizedTag);
      
      const tagDoc = await tagRef.get();
      if (tagDoc.exists) {
        batch.update(tagRef, {
          count: FieldValue.increment(1),
          lastUsed: timestamp
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
            relatedTags: []
          }
        });
      }
    }

    // Handle removed tags
    for (const tag of removedTags) {
      const normalizedTag = tag.toLowerCase().trim();
      const tagRef = db.collection('tags').doc(normalizedTag);
      
      const tagDoc = await tagRef.get();
      if (tagDoc.exists) {
        const currentCount = tagDoc.data()?.count || 1;
        if (currentCount <= 1) {
          // Delete tag if count would be 0
          batch.delete(tagRef);
        } else {
          batch.update(tagRef, {
            count: FieldValue.increment(-1)
          });
        }
      }
    }

    await batch.commit();
  }
);
```

### 3. `onPostDelete` - Cleanup tags when a post is deleted

```typescript
import { onDocumentDeleted } from "firebase-functions/v2/firestore";

export const onPostDelete = onDocumentDeleted(
  "social_feed/{postId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const postData = snapshot.data();
    const tags = postData.tags;

    if (!tags || !Array.isArray(tags) || tags.length === 0) return;

    const db = getFirestore();
    const batch = db.batch();

    for (const tag of tags) {
      if (!tag || typeof tag !== 'string') continue;
      
      const normalizedTag = tag.toLowerCase().trim();
      const tagRef = db.collection('tags').doc(normalizedTag);
      
      const tagDoc = await tagRef.get();
      if (tagDoc.exists) {
        const currentCount = tagDoc.data()?.count || 1;
        if (currentCount <= 1) {
          // Delete tag if count would be 0
          batch.delete(tagRef);
        } else {
          batch.update(tagRef, {
            count: FieldValue.increment(-1)
          });
        }
      }
    }

    await batch.commit();
  }
);
```

### 4. `updateTrendingScores` - Scheduled function to update trending scores

```typescript
import { onSchedule } from "firebase-functions/v2/scheduler";

export const updateTrendingScores = onSchedule(
  "every 1 hours",
  async () => {
    const db = getFirestore();
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get all posts from the last week
    const recentPostsSnapshot = await db
      .collection('social_feed')
      .where('timestamp', '>=', oneWeekAgo)
      .get();

    // Count tag usage in recent posts
    const tagActivity = new Map<string, { daily: number; weekly: number }>();

    recentPostsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const postDate = data.timestamp?.toDate();
      
      if (data.tags && Array.isArray(data.tags)) {
        data.tags.forEach((tag: string) => {
          const normalizedTag = tag.toLowerCase().trim();
          const activity = tagActivity.get(normalizedTag) || { daily: 0, weekly: 0 };
          
          activity.weekly++;
          if (postDate && postDate >= oneDayAgo) {
            activity.daily++;
          }
          
          tagActivity.set(normalizedTag, activity);
        });
      }
    });

    // Update trending scores
    const batch = db.batch();
    for (const [tagId, activity] of tagActivity) {
      const trendingScore = (activity.daily * 10) + (activity.weekly * 2);
      const tagRef = db.collection('tags').doc(tagId);
      
      batch.update(tagRef, {
        trendingScore: trendingScore
      });
    }

    await batch.commit();
  }
);
```

## Security Rules for Tags Collection

Add these rules to your Firestore security rules:

```javascript
// Allow all authenticated users to read tags
match /tags/{tagId} {
  allow read: if request.auth != null;
  // Only allow Cloud Functions to write to tags
  allow write: if false;
}
```

## Deployment Instructions

1. Create a Firebase Functions project (if not already exists)
2. Install dependencies:
   ```bash
   npm install firebase-admin firebase-functions
   ```
3. Add these functions to your `functions/src/index.ts`
4. Deploy:
   ```bash
   firebase deploy --only functions
   ```

## Testing

After deploying these functions:
1. Create a new post with tags - verify tags collection is updated
2. Edit a post's tags - verify tag counts are adjusted
3. Delete a post - verify tag counts are decremented
4. Check trending scores update hourly

## Monitoring

Monitor your Cloud Functions in the Firebase Console:
- Check function execution logs
- Monitor error rates
- Track function performance
- Set up alerts for failures