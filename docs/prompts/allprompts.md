Markdown

# Project Prompts

This document contains the complete, detailed prompts for building all three phases of the MVP, along with the expected outcome and testing instructions for each.

## Phase 1: The Core Messaging Platform

The prompts in this phase focus on establishing the foundational, user-facing parts of the application.

### Prompt 1: User Authentication & Profile

**Prompt to give Claude Code:**

You are an expert full-stack developer with extensive experience in React, Tailwind CSS, and Firebase. Your task is to build a user authentication system for a messaging and social platform. Your goal is to create the login, signup, and profile creation flow based on the project documents.

Please read the following documents to understand the project's requirements:

@/docs/CLAUDE.md

@/docs/WORKFLOW.md

@/docs/ARCHITECTURE.md

@/docs/UIUX.md

Task: Build the Authentication System
Setup & Dependencies: Initialize a new React project using Vite in the /frontend directory. Install all necessary dependencies for Firebase (Authentication, Firestore), React, and Tailwind CSS. Ensure a .env.local file is created for local Firebase configuration.

Login Component: Create a LoginPage.tsx component in the /frontend directory. It should have fields for email and password, a link to the signup page, and buttons for Google and GitHub social logins. The UI must strictly follow the neo-brutalism style described in @/docs/UIUX.md.

Signup Component: Create a SignupPage.tsx component in the /frontend directory with fields for email, username, password, and confirm password. It should also have buttons for Google and GitHub social logins.

Firebase Integration:

Implement Firebase Authentication for email/password, Google, and GitHub providers.

Upon successful user creation, automatically create a new document in the users Firestore collection with the user's uid, name, email, and an initial credits value of 10.

Routing: Implement basic React Router to switch between the login and signup pages.

Final Output: Provide a single, complete file with all the code for the project, including the Firebase initialization, components, and styling. The code must be production-ready and fully commented. Assume the firebase.js configuration file is in the root and is accessible.


**Expected Outcome:**
A complete, self-contained React application with two pages: a login form and a signup form. Both forms will be visually consistent with the neo-brutalism style and will have functional buttons for email/password and social logins. New users will be successfully created in Firebase Authentication and a corresponding user document will appear in the Firestore `users` collection.

**How to Test:**
1. Open the app in your browser. The login page should appear.
2. Navigate to the signup page. Create a new user with an email and password.
3. Check the Firebase Console. A new user should be listed under "Authentication," and a new document should be created in the "Firestore Database" under the `users` collection with the correct fields and initial `credits` value.
4. Try logging in with the new user. It should navigate you to a blank home page.
5. Test the Google and GitHub login buttons to ensure they work correctly and also create a user and Firestore document.
6. Verify all buttons have the thick black drop shadow and bouncy-style feel.

---

### Prompt 2: Core UI Layout & Presence System

**Prompt to give Claude Code:**

You are an expert full-stack developer continuing to build a messaging platform. Your task is to create the core layout for the home screen and implement the hybrid real-time presence system.

Please read the following documents to understand the project's requirements:

@/docs/CLAUDE.md

@/docs/WORKFLOW.md

@/docs/ARCHITECTURE.md

@/docs/UIUX.md

Task: Build the Core Layout and Presence System
Home Screen Layout: Create a HomeScreen.tsx component. It should render the entire three-column layout: the ServerBar, InfoBar, and ActionWindow. The layout should be responsive and styled with Tailwind CSS to match the neo-brutalism design. The ServerBar and InfoBar should be fixed sidebars, and the ActionWindow should take up the remaining space.

User Status UI: Implement the UI for displaying the user's status in the ServerBar as a colored dot on their profile icon. This status should be selectable via a pop-up menu that appears when the profile icon is clicked.

Presence System Logic:

Implement a hybrid presence system:

On the client side, use a Firestore listener to update a lastSeen timestamp in the current user's document in the users collection whenever the user is active (e.g., on a mouse move or keyboard event).

The client should also update the status field to "Online" when active.

Create a Firebase Cloud Function (in the /functions directory) that is triggered on a schedule (e.g., every 5 minutes). This function should check all user documents in the users collection. If a user's lastSeen timestamp is older than 10 minutes, the function should update their status to "Idle" and then "Away" after an additional 10 minutes.

Final Output: Provide the complete and updated React components, along with the Firebase Cloud Function code. The code must be production-ready, fully commented, and styled according to the UI/UX document.


**Expected Outcome:**
The home page will now display the complete layout described in the UIUX document. The user's profile icon in the bottom-left corner will show a colored dot. When the user is active, the dot will be green. After a period of inactivity, the dot will turn yellow and then red, managed by the Cloud Function. The UI for selecting a custom status will also be present.

**How to Test:**
1. Log in to the app and verify the three-column layout is correct and follows the neo-brutalism style.
2. Observe the colored dot on your profile icon. It should be green ("Online").
3. Leave the app tab open but idle for 5-10 minutes. Check the Firestore document for your user; the `status` should change to "Idle."
4. Leave the tab idle for another 10 minutes. The `status` should change to "Away."
5. Click on the profile icon, select a different status, and verify that it updates in Firestore.

---

### Prompt 3: Server/Room Management & Roles

**Prompt to give Claude Code:**

You are an expert full-stack developer continuing to build a messaging platform. Your task is to implement the server and room management system, including the crucial server role and deletion logic.

Please read the following documents to understand the project's requirements:

@/docs/CLAUDE.md

@/docs/WORKFLOW.md

@/docs/ARCHITECTURE.md

@/docs/UIUX.md

Task: Implement Server/Room Management & Roles
Create Server Modal: Build a modal that is triggered by the "+" button in the ServerBar. This modal should contain a form for creating a new server with a name and a button to join an existing server with a 5-digit code.

Server Creation Logic:

When a user creates a new server, a new document should be created in the servers collection.

Automatically create a subcollection members with the creator as the first member and a role of "owner."

Automatically create a subcollection chat_rooms with a single document for the #General room.

The server should have a ownerIds field as an array containing the creator's UID. The limit for owners should be set to 3 for the MVP.

Server Settings Modal & Roles:

Create a server settings modal that is accessible via a button in the InfoBar.

This modal should have a "Roles" tab that is only visible to users with an "owner" role.

The "Roles" tab should contain a search bar that filters through all server members and allows the owner to change the role of any member.

Server Deletion Logic (Cloud Function):

Create a Firebase Cloud Function (in the /functions directory) that is triggered by the deletion of a document in the servers collection.

This function must programmatically perform a cascading delete, removing all associated members, chat_rooms, and all messages subcollections. It should also remove the server's ID from all user profiles.

Final Output: Provide the complete and updated React components, along with the Firebase Cloud Function code and any necessary Firestore security rules to enforce the owner/admin/member roles. The code must be production-ready and fully commented.


**Expected Outcome:**
The "+" button will open a modal that allows users to create or join servers. Server owners can access a roles management tab in the settings modal. Most critically, the server deletion process will be handled safely and completely by a Cloud Function.

**How to Test:**
1. Click the "+" button and create a new server. Verify it appears in your `ServerBar` and that a new document and subcollections are created in Firestore.
2. Have another user join the server using the invite code. Verify they are added to the `members` subcollection with a `role` of "member."
3. As the owner, open the server settings, navigate to the "Roles" tab, and change the other user's role to "admin." Verify the change is reflected in Firestore.
4. As the owner, delete the server. Verify that all server-related data is completely removed from the database.

---

### Prompt 4: Basic Chat & Message Deletion

**Prompt to give Claude Code:**

You are an expert full-stack developer continuing to build a messaging platform. Your task is to implement the core chat functionality and message deletion based on user roles.

Please read the following documents to understand the project's requirements:

@/docs/CLAUDE.md

@/docs/WORKFLOW.md

@/docs/ARCHITECTURE.md

@/docs/UIUX.md

Task: Build the Basic Chat & Message Deletion
Message Log & Real-time: In the ActionWindow, create the MessageLog.tsx component. This component should display messages from a messages subcollection in a Firestore room, using a real-time listener to show new messages instantly.

Message Composer: Create a basic, text-only MessageComposer.tsx component with an input field and a send button.

UI Logic:

Align messages from the current user to the right and all other messages to the left.

Implement message grouping and timestamps as specified in the UIUX.md (new block of messages, or gap of >2 hours).

Display a button to delete a message on hover.

Message Deletion Logic:

Implement the logic for a user to delete their own messages.

Implement a separate function that allows a user with an "owner" or "admin" role to delete any message in the server. This should be enforced by Firestore security rules.

Final Output: Provide the complete and updated React components, along with the necessary Firestore security rules. The code must be production-ready, fully commented, and styled according to the UI/UX document.


**Expected Outcome:**
The Action Window will now function as a real-time chat room. Messages will be sent, received, and displayed with correct alignment and grouping. Users will be able to delete messages according to their roles.

**How to Test:**
1. Log in with two different users in the same room. Send messages from each account and verify they appear in real-time.
2. Verify the message grouping and timestamp logic (send multiple messages in a row, then have the other user send one).
3. As a member, try to delete another user's message. It should fail.
4. As a member, delete your own message. It should succeed.
5. Log in as an admin, and try to delete any message in the room. It should succeed.

---

### Prompt 4.5: Emoji System Implementation

**Prompt to give Claude Code:**

You are an expert full-stack developer continuing to build a messaging platform. Your task is to implement a fully featured emoji system in the message composer and log, including a custom emoji picker and dynamic resizing of emoji-only messages.

Please read the following documents to understand the project's requirements:

@/docs/CLAUDE.md

@/docs/WORKFLOW.md

@/docs/ARCHITECTURE.md

@/docs/UIUX.md

Task: Build the Emoji System
Emoji Picker UI: In the MessageComposer.tsx component, add a button that opens a pop-up emoji picker. The picker should be a clean, user-friendly UI for selecting and inserting emojis into the text composer.

Emoji Message Logic:

The MessageComposer should now insert the selected emoji text into the message.

In the MessageLog.tsx component, implement logic to check if a message consists of only emoji characters.

If a message contains only emojis and is less than 6 characters long, increase the font size of those emojis to 4x their normal size using a Tailwind CSS class.

Final Output: Provide the complete and updated React components, along with any necessary CSS or utility functions. The code must be production-ready, fully commented, and styled according to the UI/UX document.


**Expected Outcome:**
The message composer will now have an emoji picker button. Users can click this button to select and insert emojis into their messages. Emojis will display correctly in the message log, and any message consisting of fewer than 6 emojis and no other text will be displayed in a larger, 4x size.

**How to Test:**
1. In a chat room, click the new emoji button in the composer. An emoji picker should pop up.
2. Select one or more emojis and send a message. Verify that the emojis appear correctly in the message log.
3. Send a message that contains only 1-5 emojis. Verify that these emojis are displayed at a significantly larger size.
4. Send a message with 6 or more emojis, or a message with a mix of emojis and text. Verify that the emojis are displayed at the normal size.

---

### Prompt 5: Friends List & Direct Messaging

**Prompt to give Claude Code:**

You are an expert full-stack developer continuing to build a messaging platform. Your task is to implement the "Friends" tab, including user search, friend requests, and direct messaging functionality.

Please read the following documents to understand the project's requirements:

@/docs/CLAUDE.md

@/docs/WORKFLOW.md

@/docs/ARCHITECTURE.md

@/docs/UIUX.md

Task: Build Friends List & Direct Messaging
Friends Tab UI: In the InfoBar, create the "Friends" tab UI. This should include a search bar, a button to "Add Friend," and a section for a list of friends.

Add Friend Search:

When the "Add Friend" button is clicked, the ActionWindow should become a search interface.

Implement a search functionality that queries the users Firestore collection for users matching the input (by username or email).

Display the search results with a button to send a friend request.

Friend Request Logic: Implement a system for sending and accepting friend requests. A new collection, friend_requests, could be used for this.

Direct Messaging Logic:

When a user clicks on a friend, a new or existing private_messages room should open in the ActionWindow.

This room should support up to 20 participants for the MVP so there should be a add friend button at the top that opens a modal for adding one or more users from your friends list with a search bar.

Use a Firestore subcollection for the messages within this room, similar to the regular chat rooms.

Final Output: Provide the complete and updated React components and Firebase logic. The code must be production-ready, fully commented, and styled according to the UI/UX document.


**Expected Outcome:**
The "Friends" tab will be fully functional, allowing users to find and send friend requests to others. Once accepted, friends will appear in the list. Users can also engage in direct messages with friends.

**How to Test:**
1. Log in with one user, go to the "Friends" tab, click "Add Friend," and search for a second user.
2. Send a friend request. Log in with the second user and verify they can accept the request.
3. Verify that both users now appear in each other's friends lists.
4. Start a DM with the new friend. Send messages and verify they are received in real-time.

---

## Phase 2: The Social & AI Foundations

### Prompt 1: The Right Sidebar & Personal Media Bucket

**Prompt to give Claude Code:**

You are an expert full-stack developer beginning Phase 2 of the MVP. Your task is to build the right-hand sidebar and the Personal Media Bucket, which will be the foundation for all future AI and GenAI features.

Please read the following documents to understand the project's requirements:

@/docs/CLAUDE.md

@/docs/WORKFLOW.md

@/docs/ARCHITECTURE.md

@/docs/UIUX.md

@/docs/AI_IMPLEMENTATION.md

@/docs/TOKENSYSTEM.md

Task: Build the Right Sidebar and Personal Media Bucket
Right Sidebar UI: Create a foldable sidebar on the far right of the screen. This sidebar should "push" the ActionWindow over when it's open, not overlap it. It should be resizable horizontally, similar to the InfoBar.

AI Team Section: At the top of the sidebar, create a scrollable section that displays a grid of icons for the user's "hired" AI agents. A user can only have a maximum of 10 AI agents on their team at a time.

Personal Media Bucket: Below the AI Team section, create the Personal Media Bucket. This should be an accordion-style component with sections for each media type: images, audio, and files.

Each accordion section should display a list of files that belong to the user.

Implement a drag-and-drop feature so that users can drag files from their computer into this section to upload them to Firebase Cloud Storage.

Final Output: Provide the complete and updated React components for the right sidebar and its contents. Ensure the code is production-ready, fully commented, and styled according to the UI/UX document.


**Expected Outcome:**
A new, foldable sidebar will be available on the right. It will contain an "AI Team" section and a "Personal Media Bucket" with accordion sections for different media types. The drag-and-drop upload functionality will be working for the media bucket.

**How to Test:**
1. Log in and click the button to open the right sidebar. Verify that it pushes the `ActionWindow` over and that it can be resized.
2. In the "Personal Media Bucket" section, drag an image file from your computer and drop it into the images accordion. Verify that the file is uploaded to Firebase Cloud Storage and appears in the list.
3. Verify that the accordion sections for images, audio, and files work correctly.

---

### Prompt 2: The Social Feed & Post Creation

**Prompt to give Claude Code:**

You are an expert full-stack developer continuing to build a messaging platform. Your task is to implement the "Social Feed" feature with infinite scrolling and a new post creation UI.

Please read the following documents to understand the project's requirements:

@/docs/CLAUDE.md

@/docs/WORKFLOW.md

@/docs/ARCHITECTURE.md

@/docs/UIUX.md

@/docs/AI_IMPLEMENTATION.md

@/docs/TOKENSYSTEM.md

Task: Build the Social Feed
Social Feed UI: In the InfoBar, find the "Social Feed" tab. When selected, the ActionWindow should display the feed, which is a continuously loading list of posts.

Infinite Scroll: Implement the infinite scroll feature using a Firestore query with a limit and startAfter cursor. The feed should initially show a mix of posts from a user's subscribed tags and the most recent posts from those tags.

Post Composer:

At the top of the scrollable area, create an accordion-style component labeled "Create Post."

When unfolded, this component should contain a rich text input area for the post's content.

It should also have an area for adding tags and buttons to attach media (images, links, etc.).

Post Display & Embeds:

Design the UI for a post. Posts should display the author, a timestamp, and the post's content.

Implement logic to detect links and embed previews for websites and playable video players for YouTube/Vimeo.

Display an uploaded image directly below the text.

All tags on a post should be clickable, taking the user to a filtered feed of posts with that tag.

Final Output: Provide the complete and updated React components, along with any necessary Firestore logic for creating and querying posts. The code must be production-ready, fully commented, and styled according to the UI/UX document.


**Expected Outcome:**
A fully functional social feed with infinite scrolling will be implemented. A user can create a post with text, images, and embedded links. Clicking on a tag will filter the feed, providing a new viewing experience.

**How to Test:**
1. Navigate to the "Social Feed" tab. A scrollable list of posts should appear.
2. Scroll to the bottom of the feed. Verify that new posts load automatically.
3. Use the new post composer to create a post with an image and a link. Verify that the post is created correctly, with the image and a link preview embedded.
4. Click on a tag in a post. Verify that the feed reloads to show only posts with that tag.

---

### Prompt 3: AI Agent Backend & Front-End Integration

**Prompt to give Claude Code:**

You are an expert full-stack developer building the core AI backend for a messaging platform. Your task is to create a secure, scalable, and self-contained Google Cloud Run service that orchestrates AI agents, and a front-end UI for managing agents.

Please read the following documents to understand the project's requirements:

@/docs/CLAUDE.md

@/docs/WORKFLOW.md

@/docs/ARCHITECTURE.md

@/docs/UIUX.md

@/docs/AI_IMPLEMENTATION.md

@/docs/TOKENSYSTEM.md

Task: Build the AI Agent Backend & UI
Backend Docker & Python Environment: Create a Dockerfile and requirements.txt in a dedicated directory (e.g., /ai-service) to set up a Python environment with LangGraph and other necessary dependencies.

API Key Management: Assume the Stability AI API key is stored in Google Cloud Secret Manager. Write the code to securely retrieve this key at runtime.

LangGraph Integration: Implement the core LangGraph logic for a single, generic AI agent. This agent should be able to receive a user's prompt and a list of personality prompts.

Backend API: Create a simple API endpoint (e.g., /agent-response) that accepts a JSON payload containing the user's message, the agent's ID, and the chat context. This endpoint will use the LangGraph agent to generate a response and return it.

Right Sidebar UI for Agents: In the RightSidebar.tsx, create the "AI Team" section. This scrollable area should display a grid of icons for the user's hired AI agents. A user can only have a max of 10 AI agents in their team.

Agent Creation/Editing Modal: Implement a modal for creating a new AI agent with a name, image, and a list of personality prompts. This modal should also handle editing existing agents. The modal should also contain a section for "Gen Rules" that allows for defining rules for generated images.

"Adopt AI" Button: In the AI Chat screen, add a button with the copy "Adopt AI." Clicking this button should add the AI to the user's team in the right sidebar.

@Mention Logic: In the MessageComposer, implement logic to detect when a user types @ followed by the name of an AI agent assigned to that room. When an agent is mentioned, a Firebase Cloud Function should be triggered. This Cloud Function's role is to call the API endpoint of our Cloud Run service, passing the message and the agent's context.

Final Output: Provide all of the necessary, well-commented code, including the Dockerfile, Python application, and React components. The code must be production-ready and styled according to the UI/UX document.


**Expected Outcome:**
The app will have a functional right-hand sidebar for managing AI agents. Users can create, edit, and hire agents. When an agent is mentioned in a chat, a response will be generated by the Cloud Run service and displayed in the chat log.

**How to Test:**
1. In a server you own, create an "AI Agent Design" room.
2. In the "Edit" tab, create a new AI agent with a name and personality prompts.
3. Switch to the "Chat" tab and type `@ai [agent-name]`. Verify that the agent generates a response and sends it to the chat.
4. Click the "Adopt AI" button and verify the agent appears in your right-hand sidebar.
5. Edit the agent's personality rules and verify that the agent's responses change.

---

### Prompt 4: AI and GenAI Rooms & UI

**Prompt to give Claude Code:**
You are an expert full-stack developer continuing to build a messaging platform. Your task is to implement the front-end for AI and GenAI rooms, and the corresponding user roles and settings.

Please read the following documents to understand the project's requirements:

@/docs/CLAUDE.md

@/docs/WORKFLOW.md

@/docs/ARCHITECTURE.md

@/docs/UIUX.md

@/docs/AI_IMPLEMENTATION.md

@/docs/TOKENSYSTEM.md

Task: Build AI and GenAI Rooms
Room Type Creation & Icons: Update the "Add Room" modal (from the server settings) to include options for creating three room types: a regular chat room, a genai-radio room, or an ai-agent-design room. Each room type should have a unique icon.

AI Room UI:

Create a dynamic AIRoom.tsx component that displays two tabs: "Edit" and "Chat."

"Edit" Tab: This tab should contain a scrollable area for personality and gen rules, a chat box for testing the AI, a placeholder for MCP servers, and an area to edit the AI's profile info (image, name, description, model type). It should also include a "Publish" button.

"Chat" Tab: This tab is a real-time messaging window where the AI responds to user messages.

GenAI Room UI:

Create a dynamic GenAIRoom.tsx component with two tabs: "Listen" and "Edit."

"Listen" Tab: This tab should have a fixed play button and a centered image display for the current song's album art.

"Edit" Tab: This tab should have scrollable lists for a "radio playlist" and a "song bucket." It should also include a prompt area for music generation, an area for image generation, and options to upload or generate album art. A "Publish" button will have two options: "Free Play" and "Broadcast."

Room Permissions & Settings: Update the room settings modal to be role-based. Admins and owners should be able to edit the AI's settings, add/remove users, and configure usage.

Final Output: Provide the complete and updated React components for all new room types. Ensure the code is production-ready, fully commented, and styled according to the UI/UX document.


**Expected Outcome:**
The app will have new room types with unique icons. The AI and GenAI rooms will have a functional two-tab UI for editing and using the features.

**How to Test:**
1. As a server owner, create a new `genai-radio` room and an `ai-agent-design` room. Verify that the correct icons appear.
2. Navigate to the AI room and verify that the "Edit" and "Chat" tabs are present.
3. Navigate to the GenAI room and verify that the "Listen" and "Edit" tabs are present.

---

### Prompt 5: Media Controls & GenAI Logic

**Prompt to give Claude Code:**
You are an expert full-stack developer completing the final features for the MVP. Your task is to implement the universal media controls, the GenAI generation logic, and the "Radio" sharing feature.

Please read the following documents to understand the project's requirements:

@/docs/CLAUDE.md

@/docs/WORKFLOW.md

@/docs/ARCHITECTURE.md

@/docs/UIUX.md

@/docs/AI_IMPLEMENTATION.md

@/docs/TOKENSYSTEM.md

Task: Build Media Controls & GenAI Logic
Universal Media Controls: Create a fixed MediaControls.tsx component at the bottom of the InfoBar. It should include play/pause/stop, next/prev, a progress bar, and a volume control. The next, prev, and progress bar should be grayed out when listening to a "Broadcast" radio.

GenAI Generation Logic:

In the GenAIRoom.tsx "Edit" tab, implement the logic to call the GenAI backend service when a user submits a prompt for music or images.

Use the universal credit system and the Stability AI API endpoints to handle these requests.

After an audio generation is complete, prompt the user to add an image (either uploaded or generated using a credit).

Playlist Management:

Implement the logic to move songs from the "song bucket" to the "radio playlist."

Implement the logic to share the radio playlist to the social feed as a post.

Social Radio Post UI: Design a dedicated UI for a shared radio post on the social feed. This post should display the album art, the song title, and functional playback controls that use the new MediaControls component.

Final Output: Provide the complete and updated React components and Firebase logic to handle the universal media controls, the GenAI generation flow, and the social radio post feature. The code must be production-ready, fully commented, and styled according to the UI/UX document.


**Expected Outcome:**
The MVP will be complete. All GenAI features will be working, including the credit system and the universal media controls. Users can generate music and images, curate a playlist, and share it to the social feed as a "radio station."

**How to Test:**
1. In a `genai-radio` room, generate a song and an image. Verify that your credit balance is correctly decremented.
2. Add the song to the radio playlist.
3. Click the "Share" button and verify that a new post is created in the social feed with the correct UI and functional playback controls.
4. Play the radio station and verify that the universal media controls at the bottom of the `InfoBar` are working correctly.
5. Try to generate a song when you have insufficient credits. Verify that a clear error message is displayed and the request fails.
</immersive>