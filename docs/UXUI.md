# MVP UI/UX Plan

This document outlines the detailed user interface and user experience design for the messaging platform MVP, adhering to a neo-brutalism style.

## 1. Login and Signup

The initial screen is the login form, featuring fields for username/email and password. Below the form are buttons for Google and GitHub social logins. A link to "Create an Account" navigates to a signup form that requires an email, username, password, and confirmation. Social sign-up buttons are also present on this screen.

## 2. Home Screen Layout

The main application screen is a dynamic page composed of three main sections:
* **Server Bar (Far Left):** A fixed, thin sidebar for navigating between servers and home.
* **Info Bar (Next to Server Bar):** A resizable sidebar that displays a list of rooms, friends, or social feed subscriptions.
* **Action Window (Middle/Right):** The main content area, which changes dynamically based on the user's selection in the Info Bar.

## 3. Server Bar (Far Left Sidebar)

This is a fixed sidebar with a neo-brutalism style. All icons will be a bold, simple design with a thick black drop shadow.

* **Top Icon:** An icon to navigate to the "Home" page, which houses the friends list and social feed.
* **Server Icons:** A scrollable list of circular icons representing the servers the user has joined. Each icon will have a small, colored dot in the bottom-right corner representing the user's status within that server (Online, Idle, etc.). A small pop-up with the server's name appears on hover.
* **Bottom Icons:**
    * **Plus Button:** Opens a modal for either creating a new server or joining an existing one with a 5-digit code.
    * **Settings Icon:** Clicking this reveals a small popup menu with a **Dark/Light Mode** toggle and a **More Settings** button. The "More Settings" button opens a full settings page in the Action Window.
    * **User Profile Icon:** A button displaying the user's profile picture or initial. Clicking it opens a popup next to the icon with user information, a status selector, and a link to their profile settings.
        * **Status Options:** Online (green), Idle (yellow), Away (red), and Custom. A custom status allows the user to title their status and select a custom color, which appears as a dot on their icon throughout the app.

When a server is created, a default room named `#General` is automatically created, and the owner is the only member. The owner cannot leave this room unless they delete the server. Deleting a server will trigger a Cloud Function to remove all associated data.

## 4. Info Bar (Second Sidebar)

This sidebar is horizontally resizable with a click-and-drag handle. Its content is context-aware.

* **When a Server is Selected:**
    * **Title:** The top of the `InfoBar` will simply display the server's name. A settings icon button will be aligned right, and clicking it will open the `ServerSettings.tsx` component in the `ActionWindow`.
    * **Server Settings (Role-Based View):** This component will have different views based on the user's role.
        * **Owner View:**
            * A top section with editable server info (name, icon, color).
            * A `Rooms` section with a scrollable list of all rooms. Each room has rename and settings buttons. A button to "Add Room" is at the top of the list.
            * A `Members` section with a scrollable list of all users, a search bar, and an edit button next to each user to manage their role or kick them.
            * A `Delete Server` button at the very bottom.
        * **Admin View:** Similar to the owner's view, but server info is read-only, and the "Delete Server" button is absent.
        * **Member View:**
            * Server info is read-only.
            * In the `Rooms` list, each room has a toggle to show/hide it from the `InfoBar`.
            * In the `Members` list, each user has an "Add Friend" button instead of an "Edit" button.
    * **Room List:** Below the title, a foldable list of rooms, identified by unique icons for each room type (`chat`, `genai`, `ai-agent`). Only rooms a user has joined are visible, unless they are the owner. Servers will have a limit of **3 Gen AI rooms** and **3 AI agent design rooms** for the MVP.
* **When "Home" is Selected:**
    * Two tabs are available at the top: **Friends** and **Social Feed**.

### a. Friends Tab (in Info Bar)

* **Title:** "Friends" with a button to **Add Friend**.
* **Add Friend Functionality:** Clicking the add friend button changes the **Action Window** to a search bar. This search bar queries all users in the database by username or email. A button next to each result allows a user to send a friend request.
* **Categories:** The main section below the title contains foldable categories for Direct Recent Messages (top 5), and friends categorized by their status (Online, Idle, Away). A friend can appear in both the Direct Messages list and a status category.
* **User Popups:** Clicking a friend's icon opens a popup window displaying their name, custom link, and status dot, with a button to send them a message.

### b. Social Feed Tab (in Info Bar)

* **Title:** A title for the feed with a button to create a new post.
* **Search Bar:** A dual-purpose search bar for searching by user or tag. Users can subscribe to either.
* **Public Rooms Area:** An area to browse public rooms.
* **Subscription Feed:** A scrollable list of posts from subscribed users and tags.

## 5. Right Sidebar

A final, foldable sidebar on the far right will be added to house AI agent features and context-aware content. The toggle button for this sidebar will be located in the top bar of the Action Window. When opened, it will push the `ActionWindow` over.

* **AI Agent Management:** This sidebar will display the agents you have "hired" from servers you are a member of, allowing you to `Recruit` (Adopt) them to your team of AI agents. A user can only have up to 10 AI agents in their team at a time. The sidebar will also have a media bucket that contains all your personal media.

## 6. Action Window (Middle Area)

This is the main dynamic content area. Its content adapts to the user's selections.

* **Message Box:** The primary view for chat rooms and DMs.
* **Add Friend Search:** Displayed when the "Add Friend" button is clicked.
* **Settings Page:** Displayed when "More Settings" is selected.
* **Social Feed Scroll:** Displayed by default when the Home icon is selected.

The top bar of the Action Window will have a dynamic title corresponding to the selected room or DM.

## 7. Message Box Functionality

* **Message Composer:** A rich text editor will be used for the message composer, supporting bold, italics, underline, strikethrough, quotes, mentions, code blocks, bullet points (formatted correctly), H1/H2/P sizing, text color, highlight color, and advanced emojis. A Giphy library will be integrated if easy and free.
* **Message Log:**
    * **Alignment:** Messages from the current user are aligned to the right. Messages from others are aligned to the left. On wide screens, all message bubbles are centered within a `1000px` max width container.
    * **Real-time:** Messages will appear in real time for all users in the room using Firestore's real-time listeners.
    * **Deletion:** Users can delete their own messages. Owners and admins can delete any message in a server they manage.
    * **Grouping:** Messages are grouped by user. A user's name and profile picture appear next to their messages only if they are the first in a new block of messages or if a gap of 2+ hours has passed since their last message.
    * **Infinite Scroll:** The chat will initially load the most recent 50 "user changes" (a continuous block of messages from one user is a single change). A button at the top of the chat log will load the next 50 previous changes.
    * **Reactions:** Hovering over a message will reveal an option to react with an emoji.
    * **Reply Threads (Future):** We will implement reply threads by adding a `replyTo` field to the message document in Firestore.

* **File Uploads and Links:**
    * **Files:** Users can upload images up to a size limit of **2MB**. These files will be stored in Firebase Cloud Storage. No video files will be allowed, only links to video content.
    * **External Links:** Links will be scraped to display an embedded card with the site's description and thumbnail. If the link is to YouTube or Vimeo, a video player will be embedded directly in the chat. Long URLs will be truncated to the first 50 characters in the message log.

* **Gen AI Radio Rooms:** When an audio file is generated using credits, a user will be able to either manually upload album art or generate it using an additional credit. The song will then be added to a room's playlist. From there, the playlist can be shared to the social feed as a radio station, featuring a post with the album art and playback controls.

## 8. Neo-Brutalism Style

The entire UI will be designed with a neo-brutalism aesthetic:
* **Colors:** Bright, vibrant, and contrasting colors.
* **Typography:** Bold, blocky, retro-style fonts.
* **Geometry:** Squared, sharp corners on all elements.
* **Shadows:** Thick, prominent black drop shadows on all buttons, cards, and UI elements to give a 3D, "bouncy" effect.
* **Spacing:** Ample whitespace around elements to emphasize the shadows and visual weight.