# Project Setup & Deployment Guide

This document is a step-by-step guide to setting up your project environment and deploying the application. Follow these instructions precisely to ensure a successful build.

## Step 1: Firebase Project Setup

1. **Create a New Firebase Project:** Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.

2. **Add a Web App:** In your new project, click the "Web" icon (`</>`) to add a web app. Register the app and copy the Firebase configuration object.

3. **Enable Services:** Navigate to the "Build" section in the Firebase console and enable the following services:

   * **Authentication:** Enable the email/password, Google, and GitHub providers.

   * **Firestore Database:** Create a new database in "production mode" and choose a location close to you.

   * **Cloud Storage:** Create a new bucket.

   * **Cloud Functions:** This will be enabled later when you deploy your first function.

4. **Install Firebase CLI:** If you don't have it installed globally, open your terminal and run `npm install -g firebase-tools`. Log in with `firebase login`.

## Step 2: Google Cloud Setup

1. **Link Projects:** Ensure your Firebase project is linked to a Google Cloud project (it should be by default).

2. **Enable APIs:** In the Google Cloud Console, enable the following APIs:

   * Cloud Run API

   * Cloud Pub/Sub API

   * Cloud Secret Manager API

   * IAM (Identity and Access Management) API

3. **Create a Service Account:** Create a dedicated service account for your Cloud Run service. This account will be used to access the Firestore database and other services.

4. **Manage Secrets:** Go to the **Secret Manager** and store your Stability AI API key. Grant your new service account permission to access this secret.

## Step 3: Local Development Setup

1. **Initialize the Project with Vite:**

   * Run `npm create vite@latest` and follow the prompts to create a React/JavaScript project.

   * Install Firebase, Tailwind, and other necessary dependencies.

2. **Create Environment Files:**

   * Create a `.env.local` file in your project root for local development secrets.

   * Create a `.env.production` file for production secrets (though Secret Manager is the primary method for this).

3. **Set Up Firebase Functions:**

   * Run `firebase init functions` and choose JavaScript/TypeScript as the language.

   * Update your Firebase configuration to ensure it uses the correct environment variables.

## Step 4: Prompting and Building

The following is a detailed plan for when to give Claude Code each prompt. **Do not run a prompt until the previous step is complete and verified.**

### Phase 1: The Core Messaging Platform

* **Prompt 1:** **User Authentication & Profile**

  * `Expected Outcome:` A complete and functional login/signup page with social login buttons. A new user account and profile document will be created in Firebase.

  * `How to Test:`

    1. Create a new account with email/password. Verify the user is created in Firebase Auth and their profile exists in Firestore.

    2. Test Google and GitHub social logins. Verify the user is created.

    3. Ensure the UI is responsive and styled correctly.

* **Prompt 2:** **Core UI Layout & Presence System**

  * `Expected Outcome:` The main home screen is rendered with the three sidebars and a dynamic central Action Window. The user's status updates in real-time.

  * `How to Test:`

    1. Log in and verify the layout. Check the neo-brutalism styling.

    2. Observe your user icon's dot color. It should change instantly when you manually set a status.

    3. Wait for a set period. A user's status should change from "Online" to "Idle" or "Away" via the Cloud Function.

* **Prompt 3:** **Server/Room Management & Roles**

  * `Expected Outcome:` A functional server creation modal and server deletion logic. Owners can manage roles in a server settings modal.

  * `How to Test:`

    1. Create a new server. Verify a `#General` room is created automatically and you are the owner.

    2. Invite another user with the server code. Verify they join as a "member."

    3. As the owner, change the member's role to "admin." Verify the change in Firestore.

    4. Delete the server. Verify that all associated rooms, messages, and member data are removed.

* **Prompt 4:** **Basic Chat & Message Deletion**

  * `Expected Outcome:` A functional text-only message box. Messages are displayed in real time, and users can delete messages according to their roles.

  * `How to Test:`

    1. Send messages as two different users. Verify they appear in real time and are aligned correctly.

    2. Verify the message grouping and timestamp logic.

    3. As a member, try to delete another user's message (it should fail).

    4. As an admin, try to delete a member's message (it should succeed).

* **Prompt 5:** **Friends List & Direct Messaging**

  * `Expected Outcome:` A functional Friends list with search, friend requests, and one-on-one DMs.

  * `How to Test:`

    1. Send a friend request to another user. Verify the other user receives it and can accept it.

    2. Start a DM with a new friend. Verify messages are sent and received in real-time.

    3. Test the search functionality to find users.

### Phase 2: Social & AI Agent Integration

* **Prompt 1:** **Advanced Messaging & Link Embedding**

* **Prompt 2:** **AI Agent Backend Service**

* **Prompt 3:** **AI Agent UI & Interaction**

* **Prompt 4:** **Social Feed & AI Posts**

### Phase 3: Collaborative Generative AI

* **Prompt 1:** **Gen AI Backend & Queueing System**

* **Prompt 2:** **Gen AI Rooms & Credits**

* **Prompt 3:** **Gen AI Radio Feature**

## Step 5: Deployment

Once all phases are complete, you will use the following commands to deploy your application:

1. **Deploy Firebase Hosting and Functions:** `firebase deploy`. This will deploy the web app and all your Cloud Functions.

2. **Deploy Cloud Run Service:** Navigate to your backend service directory and run `gcloud run deploy [service-name] --source .`

This guide, along with the detailed `ARCHITECTURE.md` and `UIUX.md` files, gives you a clear and structured path from a blank project to a fully deployed MVP.