Project Prompts
This document contains the complete, detailed prompts for building all three phases of the MVP, along with the expected outcome and testing instructions for each.

Phase 1: The Core Messaging Platform
The prompts in this phase focus on establishing the foundational, user-facing parts of the application.

Prompt 1: User Authentication & Profile
Prompt to give Claude Code:

You are an expert full-stack developer with extensive experience in React, Tailwind CSS, and Firebase. Your task is to build a user authentication system for a messaging and social platform. Your goal is to create the login, signup, and profile creation flow based on the project documents.

Please read the following documents to understand the project's requirements:
- @/CLAUDE.md
- @/ARCHITECTURE.md
- @/UIUX.md

### Task: Build the Authentication System

1.  **Setup & Dependencies:** Initialize a new React project using Vite in the `/frontend` directory. Install all necessary dependencies for Firebase (Authentication, Firestore), React, and Tailwind CSS. Ensure a `.env.local` file is created for local Firebase configuration.
2.  **Login Component:** Create a `LoginPage.tsx` component in the `/frontend` directory. It should have fields for email and password, a link to the signup page, and buttons for Google and GitHub social logins. The UI must strictly follow the neo-brutalism style described in `@/UIUX.md`.
3.  **Signup Component:** Create a `SignupPage.tsx` component in the `/frontend` directory with fields for email, username, password, and confirm password. It should also have buttons for Google and GitHub social logins.
4.  **Firebase Integration:**
    * Implement Firebase Authentication for email/password, Google, and GitHub providers.
    * Upon successful user creation, automatically create a new document in the `users` Firestore collection with the user's `uid`, `name`, `email`, and an initial `credits` value of 10.
5.  **Routing:** Implement basic React Router to switch between the login and signup pages.
6.  **Final Output:** Provide a single, complete file with all the code for the project, including the Firebase initialization, components, and styling. The code must be production-ready and fully commented. Assume the `firebase.js` configuration file is in the root and is accessible.

Expected Outcome:
A complete, self-contained React application with two pages: a login form and a signup form. Both forms will be visually consistent with the neo-brutalism style and will have functional buttons for email/password and social logins. New users will be successfully created in Firebase Authentication and a corresponding user document will appear in the Firestore users collection.

How to Test:

Open the app in your browser. The login page should appear.

Navigate to the signup page. Create a new user with an email and password.

Check the Firebase Console. A new user should be listed under "Authentication," and a new document should be created in the "Firestore Database" under the users collection with the correct fields and initial credits value.

Try logging in with the new user. It should navigate you to a blank home page.

Test the Google and GitHub login buttons to ensure they work correctly and also create a user and Firestore document.

Verify all buttons have the thick black drop shadow and bouncy-style feel.

Prompt 2: Core UI Layout & Presence System
Prompt to give Claude Code:

You are an expert full-stack developer continuing to build a messaging platform. Your task is to create the core layout for the home screen and implement the hybrid real-time presence system.

Please read the following documents to understand the project's requirements:
- @/CLAUDE.md
- @/ARCHITECTURE.md
- @/UIUX.md

### Task: Build the Core Layout and Presence System

1.  **Home Screen Layout:** Create a `HomeScreen.tsx` component. It should render the entire three-column layout: the `ServerBar`, `InfoBar`, and `ActionWindow`. The layout should be responsive and styled with Tailwind CSS to match the neo-brutalism design. The `ServerBar` and `InfoBar` should be fixed sidebars, and the `ActionWindow` should take up the remaining space.
2.  **User Status UI:** Implement the UI for displaying the user's status in the `ServerBar` as a colored dot on their profile icon. This status should be selectable via a pop-up menu that appears when the profile icon is clicked.
3.  **Presence System Logic:**
    * Implement a hybrid presence system:
        * On the client side, use a Firestore listener to update a `lastSeen` timestamp in the current user's document in the `users` collection whenever the user is active (e.g., on a mouse move or keyboard event).
        * The client should also update the `status` field to "Online" when active.
    * Create a Firebase Cloud Function (in the `/functions` directory) that is triggered on a schedule (e.g., every 5 minutes). This function should check all user documents in the `users` collection. If a user's `lastSeen` timestamp is older than 10 minutes, the function should update their `status` to "Idle" and then "Away" after an additional 10 minutes.
4.  **Final Output:** Provide the complete and updated React components, along with the Firebase Cloud Function code. The code must be production-ready, fully commented, and styled according to the UI/UX document.

Expected Outcome:
The home page will now display the complete three-column layout. The user's profile icon in the bottom-left corner will show a colored dot. When the user is active, the dot will be green. After a period of inactivity, the dot will turn yellow and then red, managed by the Cloud Function. The UI for selecting a custom status will also be present.

How to Test:

Log in to the app and verify the three-column layout is correct and follows the neo-brutalism style.

Observe the colored dot on your profile icon. It should be green ("Online").

Leave the app tab open but idle for 5-10 minutes. Check the Firestore document for your user; the status should change to "Idle."

Leave the tab idle for another 10 minutes. The status should change to "Away."

Click on the profile icon, select a different status, and verify that it updates in Firestore.

Prompt 3: Server/Room Management & Roles
Prompt to give Claude Code:

You are an expert full-stack developer continuing to build a messaging platform. Your task is to implement the server and room management system, including the crucial server role and deletion logic.

Please read the following documents to understand the project's requirements:
- @/CLAUDE.md
- @/ARCHITECTURE.md
- @/UIUX.md

### Task: Implement Server/Room Management & Roles

1.  **Create Server Modal:** Build a modal that is triggered by the "+" button in the `ServerBar`. This modal should contain a form for creating a new server with a name and a button to join an existing server with a 5-digit code.
2.  **Server Creation Logic:**
    * When a user creates a new server, a new document should be created in the `servers` collection.
    * Automatically create a subcollection `members` with the creator as the first member and a `role` of "owner."
    * Automatically create a subcollection `chat_rooms` with a single document for the `#General` room.
    * The server should have a `ownerIds` field as an array containing the creator's UID. The limit for owners should be set to 3 for the MVP.
3.  **Server Settings Modal & Roles:**
    * Create a server settings modal that is accessible via a button in the `InfoBar`.
    * This modal should have a "Roles" tab that is only visible to users with an "owner" role.
    * The "Roles" tab should contain a search bar that filters through all server members and allows the owner to change the role of any member.
4.  **Server Deletion Logic (Cloud Function):**
    * Create a Firebase Cloud Function (in the `/functions` directory) that is triggered by the deletion of a document in the `servers` collection.
    * This function **must** programmatically perform a cascading delete, removing all associated `members`, `chat_rooms`, and all `messages` subcollections. It should also remove the server's ID from all user profiles.
5.  **Final Output:** Provide the complete and updated React components, along with the Firebase Cloud Function code and any necessary Firestore security rules to enforce the `owner`/`admin`/`member` roles. The code must be production-ready and fully commented.

Expected Outcome:
The "+" button will open a modal that allows users to create or join servers. Server owners can access a roles management tab in the settings modal. Most critically, the server deletion process will be handled safely and completely by a Cloud Function.

How to Test:

Click the "+" button and create a new server. Verify it appears in your ServerBar and that a new document and subcollections are created in Firestore.

Have another user join the server using the invite code. Verify they are added to the members subcollection with a role of "member."

As the owner, open the server settings, navigate to the "Roles" tab, and change the other user's role to "admin." Verify the change is reflected in Firestore.

As the owner, delete the server. Verify that all server-related data is completely removed from the database.

Prompt 4: Basic Chat & Message Deletion
Prompt to give Claude Code:

You are an expert full-stack developer continuing to build a messaging platform. Your task is to implement the core chat functionality and message deletion based on user roles.

Please read the following documents to understand the project's requirements:
- @/CLAUDE.md
- @/ARCHITECTURE.md
- @/UIUX.md

### Task: Build the Basic Chat & Message Deletion

1.  **Message Log & Real-time:** In the `ActionWindow`, create the `MessageLog.tsx` component. This component should display messages from a `messages` subcollection in a Firestore room, using a real-time listener to show new messages instantly.
2.  **Message Composer:** Create a basic, text-only `MessageComposer.tsx` component with an input field and a send button.
3.  **UI Logic:**
    * Align messages from the current user to the right and all other messages to the left.
    * Implement message grouping and timestamps as specified in the `UIUX.md` (new block of messages, or gap of >2 hours).
    * Display a button to delete a message on hover.
4.  **Message Deletion Logic:**
    * Implement the logic for a user to delete their own messages.
    * Implement a separate function that allows a user with an "owner" or "admin" role to delete any message in the server. This should be enforced by Firestore security rules.
5.  **Final Output:** Provide the complete and updated React components, along with the necessary Firestore security rules. The code must be production-ready, fully commented, and styled according to the UI/UX document.

Expected Outcome:
The Action Window will now function as a real-time chat room. Messages will be sent, received, and displayed with correct alignment and grouping. Users will be able to delete messages according to their roles.

How to Test:

Log in with two different users in the same room. Send messages from each account and verify they appear in real-time.

Verify the message grouping and timestamp logic (send multiple messages in a row, then have the other user send one).

As a member, try to delete another user's message. It should fail.

As a member, delete your own message. It should succeed.

Log in as an admin, and try to delete any message in the room. It should succeed.

Prompt 5: Friends List & Direct Messaging
Prompt to give Claude Code:

You are an expert full-stack developer continuing to build a messaging platform. Your task is to implement the "Friends" tab, including user search, friend requests, and direct messaging functionality.

Please read the following documents to understand the project's requirements:
- @/CLAUDE.md
- @/ARCHITECTURE.md
- @/UIUX.md

### Task: Build Friends List & Direct Messaging

1.  **Friends Tab UI:** In the `InfoBar`, create the "Friends" tab UI. This should include a search bar, a button to "Add Friend," and a section for a list of friends.
2.  **Add Friend Search:**
    * When the "Add Friend" button is clicked, the `ActionWindow` should become a search interface.
    * Implement a search functionality that queries the `users` Firestore collection for users matching the input (by username or email).
    * Display the search results with a button to send a friend request.
3.  **Friend Request Logic:** Implement a system for sending and accepting friend requests. A new collection, `friend_requests`, could be used for this.
4.  **Direct Messaging Logic:**
    * When a user clicks on a friend, a new or existing `private_messages` room should open in the `ActionWindow`.
    * This room should support up to **20 participants** for the MVP.
    * Use a Firestore subcollection for the messages within this room, similar to the regular chat rooms.
5.  **Final Output:** Provide the complete and updated React components and Firebase logic. The code must be production-ready, fully commented, and styled according to the UI/UX document.

Expected Outcome:
The "Friends" tab will be fully functional, allowing users to find and send friend requests to others. Once accepted, friends will appear in the list. Users can also engage in direct messages with friends.

How to Test:

Log in with one user, go to the "Friends" tab, click "Add Friend," and search for a second user.

Send a friend request. Log in with the second user and verify they can accept the request.

Verify that both users now appear in each other's friends lists.

Start a DM with the new friend. Send messages and verify they are received in real-time.

Phase 2: Social & AI Agent Integration
Prompt 1: Advanced Messaging & Link Embedding
Prompt to give Claude Code:

You are an expert full-stack developer continuing to build a messaging platform. Your task is to upgrade the message composer and log to support rich text, file uploads, and link embedding.

Please read the following documents to understand the project's requirements:
- @/CLAUDE.md
- @/ARCHITECTURE.md
- @/UIUX.md

### Task: Upgrade the Messaging Experience

1.  **Rich Text Editor:** Replace the basic text message composer with a rich text editor. This editor should support bold, italics, underline, strikethrough, quotes, code blocks, bullet points, H1/H2/P sizing, text/highlight colors, and emojis.
2.  **File Uploads:**
    * Add a button to the composer to upload files.
    * Implement the logic to upload image files (up to 2MB) to Firebase Cloud Storage.
    * Upon successful upload, a new message should be created in Firestore that includes a link to the file.
3.  **Link Embedding:**
    * Implement logic to detect links in a message.
    * If the link is to YouTube or Vimeo, embed a video player in the message log.
    * For all other links, scrape the metadata (title, description, image) and display it as an embedded card.
    * Truncate the original URL to the first 50 characters in the message log.
4.  **Final Output:** Provide the complete and updated React components, along with the Firebase logic for file uploads. The code must be production-ready, fully commented, and styled according to the UI/UX document.

Expected Outcome:
The message composer will now be a rich text editor. Users can upload images directly to the chat. Links will be automatically embedded as cards or video players, creating a more dynamic chat experience.

How to Test:

In a chat room, use the rich text editor to send a message with bold text, bullet points, and a code block. Verify it is formatted correctly.

Upload an image file from your computer. Verify that the file appears in the chat and is saved in Firebase Cloud Storage.

Paste a link from YouTube and a link from a regular website into the chat. Verify that the YouTube link embeds as a video player and the other link embeds as a card with a preview.

Prompt 2: AI Agent Backend Service
Prompt to give Claude Code:

You are an expert full-stack developer building the core AI backend for a messaging platform. Your task is to create a secure, scalable, and self-contained Google Cloud Run service that orchestrates AI agents.

Please read the following documents to understand the project's requirements:
- @/CLAUDE.md
- @/ARCHITECTURE.md
- @/UIUX.md

### Task: Build the AI Agent Backend Service

1.  **Docker & Python Environment:** Create a `Dockerfile` and `requirements.txt` to set up a Python environment with LangGraph and other necessary dependencies.
2.  **API Key Management:** Assume the Stability AI API key is stored in Google Cloud Secret Manager. Write the code to securely retrieve this key at runtime.
3.  **LangGraph Integration:** Implement the core LangGraph logic for a single, generic AI agent. This agent should be able to receive a user's prompt and a list of personality prompts.
4.  **Backend API:**
    * Create a simple API endpoint (e.g., `/agent-response`) that accepts a JSON payload containing the user's message, the agent's ID, and the chat context.
    * This endpoint will use the LangGraph agent to generate a response based on the agent's personality and the chat history.
    * It will then call the Stability AI API if the prompt is for an image, video or music and return a `200 OK` response with a processing status.
5.  **Final Output:** Provide the complete and well-commented code for the entire Cloud Run service, including the Dockerfile, the Python application, and instructions for local testing and deployment.

Expected Outcome:
A complete Python backend service in a single folder, ready to be deployed to Google Cloud Run. This service will be the brain of our AI agents, capable of receiving requests and generating intelligent responses, as well as initiating generative tasks.

How to Test:

Set up the local environment and run the service.

Use a tool like cURL or Postman to send a test JSON payload to the /agent-response endpoint.

Verify that the service correctly processes the request and returns a valid response.

Prompt 3: AI Agent UI & Interaction
Prompt to give Claude Code:

You are an expert full-stack developer continuing to build a messaging platform. Your task is to create the front-end for managing AI agents and their interactions in chat rooms.

Please read the following documents to understand the project's requirements:
- @/CLAUDE.md
- @/ARCHITECTURE.md
- @/UIUX.md

### Task: Build the AI Agent UI & Interaction

1.  **Right Sidebar UI:** Create the right-hand sidebar UI, which should be foldable. This sidebar will list the user's created AI agents and have a button to search and add agents from other users.
2.  **Agent Creation Modal:** Implement a modal for creating a new AI agent. This modal should have a form for the agent's name and a rich text input for a list of personality prompts.
3.  **@Mention Logic:**
    * In the `MessageComposer`, implement logic to detect when a user types `@` followed by the name of an AI agent in the chat room.
    * When an agent is mentioned, a Firebase Cloud Function (in the `/functions` directory) should be triggered.
    * This Cloud Function's role is to call the API endpoint of our Cloud Run service, passing the message and the agent's context.
4.  **Final Output:** Provide the complete and updated React components, along with the Firebase Cloud Function code. The code must be production-ready, fully commented, and styled according to the UI/UX document.

Expected Outcome:
The app will now have a right-hand sidebar for managing AI agents. Users can create agents and, when an agent is mentioned in a chat, a response will be generated by the Cloud Run service and displayed in the chat log.

How to Test:

In a server you own, open the AI agent sidebar and create a new agent with a name and a personality prompt. Verify it appears in your list.

In a chat room, type @ followed by the agent's name. Verify that the agent generates a response and sends it to the chat.

Open the Firebase Console. A new document should appear in the ai_agents collection with the agent's details.

Prompt 4: Social Feed & AI Posts
Prompt to give Claude Code:

You are an expert full-stack developer continuing to build a messaging platform. Your task is to build the "Social Feed" feature, including the infinite scroll and AI-generated posts.

Please read the following documents to understand the project's requirements:
- @/CLAUDE.md
- @/ARCHITECTURE.md
- @/UIUX.md

### Task: Build the Social Feed & AI Posts

1.  **Social Feed UI:** In the `InfoBar`, create the "Social Feed" tab. The `ActionWindow` should display the feed, which should be an infinitely scrollable list of posts. The UI should match the neo-brutalism design.
2.  **Infinite Scroll Logic:**
    * Implement the infinite scroll feature using a Firestore query with a `limit` and `startAfter` cursor to fetch posts in chunks.
    * The frontend should load the next chunk of posts when the user scrolls near the end of the feed.
3.  **AI-Generated Posts:**
    * Implement a function that triggers a generative image request to our Cloud Run service.
    * Upon completion, a new post with the image and an AI-generated caption should be created in the `social_feed` Firestore collection.
4.  **Post Creation Modal:** Create a simple modal for users to manually create posts, including text and an image.
5.  **Final Output:** Provide the complete and updated React components, along with any necessary Cloud Functions to trigger the AI-generated posts. The code must be production-ready, fully commented, and styled according to the UI/UX document.

Expected Outcome:
The "Social Feed" tab will display an endless scroll of posts. The feed will be populated with both user-created content and AI-generated content.

How to Test:

Navigate to the "Social Feed" tab. A list of posts should appear.

Scroll to the bottom of the feed. New posts should automatically load.

Use the post creation modal to create a new post with text and an image. Verify it appears in the feed.

Manually trigger the AI post generation function (via a button or test script). A new post with an image and caption should appear.

Phase 3: Collaborative Generative AI
Prompt 1: Gen AI Backend & Queueing System
Prompt to give Claude Code:

You are an expert full-stack developer continuing to build a messaging platform. Your task is to implement the backend for collaborative generative AI, including a robust queuing and credit system.

Please read the following documents to understand the project's requirements:
- @/CLAUDE.md
- @/ARCHITECTURE.md
- @/UIUX.md

### Task: Build Gen AI Backend & Queueing System

1.  **Google Cloud Pub/Sub:** Set up a Google Cloud Pub/Sub topic and a subscription.
2.  **Cloud Run Backend Service:**
    * Modify the existing Cloud Run service from Phase 2.
    * The service should subscribe to the Pub/Sub topic and process messages (requests for image, music, or video generation).
3.  **Universal Credit System:**
    * Implement a credit system that decrements a user's credit balance in Firestore based on the type of generation request.
    * The initial pricing is: 2 credits for music (up to 3 minutes), 1 credit for an image.
    * Implement logic to check if a user has enough credits before processing a request.
4.  **Stability AI Integration:**
    * Implement the API calls to the Stability AI APIs for both image and music generation.
    * Ensure the service handles the asynchronous nature of these API calls, sending a "processing" status and then updating the chat with the final output.
5.  **Final Output:** Provide the complete and updated code for the Cloud Run service, including a Dockerfile, the Python application, and any necessary Cloud Function triggers to publish messages to the Pub/Sub topic.

Expected Outcome:
The backend for all generative AI features will be complete. All requests will be queued via Pub/Sub, ensuring no API limits are hit. The credit system will be functional, and the service will generate images and music using the Stability AI APIs.

How to Test:

Manually publish a message to the Pub/Sub topic with a user ID and a generation prompt.

Verify that the Cloud Run service processes the message, checks the user's credits, and calls the Stability AI API.

Check the user's Firestore document to ensure their credit balance has been correctly decremented.

Prompt 2: Gen AI Rooms & Credits
Prompt to give Claude Code:

You are an expert full-stack developer continuing to build a messaging platform. Your task is to implement the front-end for Gen AI rooms and display the user's credit balance.

Please read the following documents to understand the project's requirements:
- @/CLAUDE.md
- @/ARCHITECTURE.md
- @/UIUX.md

### Task: Build Gen AI Rooms & Credits

1.  **Room Type Creation:** In the server settings modal for owners, add an option to create different room types: a regular `chat` room, a `genai-radio` room, or an `ai-agent-design` room. Each type should have a unique icon.
2.  **Room Limits:** Implement the server limits for room types (max 3 Gen AI and 3 AI agent rooms per server).
3.  **Gen AI Room UI:** When a `genai-radio` room is selected, the `ActionWindow` should display a dedicated UI for submitting generation prompts. This UI should have options for generating images and music.
4.  **Credit Display:** In a prominent location (e.g., the user profile pop-up), display the user's current credit balance.
5.  **Generation Trigger:** When a user submits a prompt, a Firebase Cloud Function (in the `/functions` directory) should be triggered to publish the request to the Google Cloud Pub/Sub topic.
6.  **Final Output:** Provide the complete and updated React components, along with any necessary Cloud Functions to trigger the Pub/Sub message. The code must be production-ready, fully commented, and styled according to the UI/UX document.

Expected Outcome:
Server owners can now create different room types, and the genai-radio rooms will have a dedicated UI for submitting prompts. The user's credit balance will be displayed on the front-end.

How to Test:

As a server owner, create a new genai-radio room. Verify it has the correct icon and that you can't create more than three.

In the genai-radio room, verify that the dedicated UI for image and music generation is present.

Check your user profile pop-up to verify that your credit balance is displayed correctly.

Prompt 3: Gen AI Radio Feature
Prompt to give Claude Code:

You are an expert full-stack developer completing the final features for the MVP. Your task is to build the "Radio" feature, including generating album art and sharing a playlist to the social feed.

Please read the following documents to understand the project's requirements:
- @/CLAUDE.md
- @/ARCHITECTURE.md
- @/UIUX.md

### Task: Build the Gen AI Radio Feature

1.  **Album Art Generation/Upload:** In the `genai-radio` room UI, after a song is generated, provide an option for the user to either manually upload an album art image (up to 2MB) or generate one using 1 credit.
2.  **Room Playlist:** Implement the logic to add generated songs to a playlist in the Firestore document of the `genai-radio` room.
3.  **Social Feed Integration:** Add a button to the `genai-radio` room that allows the user to share the playlist to the social feed.
4.  **Social Post UI:** The shared post in the social feed should have a dedicated UI. It should display the album art, the song title, and basic playback controls (play, next, prev).
5.  **Final Output:** Provide the complete and updated React components and Firebase logic to handle the album art, playlist, and social feed post creation. The code must be production-ready, fully commented, and styled according to the UI/UX document.

Expected Outcome:
The MVP will be complete. Users can now generate music, add album art, and share it to the social feed as a "radio station" with playback controls. This final feature brings together all of the core concepts of the app.

How to Test:

In a genai-radio room, generate a song.

After the song is generated, use the UI to either upload or generate album art.

Verify the song and album art are added to the room's playlist.

Share the playlist to the social feed.

Navigate to the social feed and verify that the shared post displays the album art and has functional playback controls.