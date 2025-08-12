# MVP Architecture Plan

This document outlines the architectural plan for the MVP of a new messaging platform that integrates native AI agents and collaborative generative AI features.

## 1. High-Level Overview

The application will follow a **microservices-oriented architecture** using Google's cloud ecosystem. The front-end will be a **React application**, while the backend will utilize a combination of **Firebase's BaaS (Backend-as-a-Service) for core features** and **custom backend services for more complex AI-related tasks**. This approach allows for rapid development of the MVP while providing a clear path to scale more computationally intensive features later.

## 2. Technology Stack

* **Frontend:** **React** with **Tailwind CSS** and **React Icons**. This stack is ideal for building a modern, responsive, and component-based user interface with consistent iconography.

* **Database:** **Cloud Firestore** will serve as the primary NoSQL database. Its real-time capabilities are essential for live chat, user presence, and real-time updates in generative AI rooms.

* **Authentication:** **Firebase Authentication** will handle user registration and login securely, supporting email/password and potentially social logins.

* **Core Backend (for AI/GenAI):** **Google Cloud Run** will host custom, serverless Python services deployed via **Docker containers**. This provides a flexible and scalable environment for our AI workloads, allowing us to use specific libraries and control the runtime.

* **API Key Management:** For local development, API keys will be managed via a `.env` file. In production, sensitive keys for services like Stability AI will be stored securely in **Google Cloud Secret Manager**, and the Cloud Run service will be granted the appropriate permissions to access them at runtime.

* **AI Agent Orchestration:** **LangGraph** will be used within our custom Python backend service to define and manage the behavior of AI agents, allowing them to make decisions and use tools.

* **Generative AI APIs:** **Stability AI** APIs will be integrated into the Gen AI backend service, hosted on Cloud Run, for creating images, videos, and music.

* **File Storage:** **Firebase Cloud Storage** will be used to store generated media (images, videos, etc.) and user profile pictures.

## 3. Core MVP Features & Architectural Mapping

### a. User Management and Messaging

* **Authentication:** Firebase Auth handles user sign-up and login.

* **User Data:** User profiles are stored in a Firestore `users` collection. A hybrid real-time presence system will be implemented using a `status` field and a `lastSeen` timestamp in the user's profile document. A Firebase listener will update this in real time, and a Cloud Function will mark inactive users as "Idle" or "Away" after a set period.

* **Servers & Rooms:** Servers and chat rooms are managed in separate Firestore collections (`servers`, `chat_rooms`). The relationships between them will be a one-to-many model (a server has many rooms). Server-specific roles (`owner`, `admin`, `member`) will be stored in a subcollection.

* **Server Deletion:** Unlike a traditional SQL database, Firestore requires custom logic for cascading deletes. A **Cloud Function** will be triggered upon the deletion of a server document. This function will then programmatically delete all associated rooms, messages, and other related data.

* **Public Private Messaging:** A `private_messages` collection in Firestore will manage one-on-one and group chats with up to **20 participants for the MVP**. Each document will contain an array of user IDs and a subcollection of messages.

### b. AI Agent Implementation

* **AI Agent Definition:** A new Firestore collection, `ai_agents`, will store the unique ID, name, and a list of personality prompts for each agent. These prompts define the agent's behavior and personality.

* **Interaction:** A user `@mentions` an AI agent in a chat room. This triggers a **Firebase Cloud Function** that calls our **custom AI Agent Service** hosted on Google Cloud Run. The function passes the agent's personality and the chat context from Firestore.

* **AI Agent Service (Cloud Run):** This service, powered by LangGraph and a large language model, processes the input, generates a response based on the agent's personality, and writes it back to the chat room's message subcollection in Firestore.

### c. Generative AI Rooms

* **Triggering Generation:** A user in a Gen AI room submits a prompt. This request is published to a **Google Cloud Pub/Sub** queue. All users are given **10 free credits per month** for generative tasks.

* **Backend Service:** A dedicated Cloud Run service subscribes to the Pub/Sub topic and processes requests one at a time, implementing a robust queueing system. It calls the Stability AI API and manages credit usage.

* **Credit System:** A universal credit system will be implemented for all paid features, with initial pricing for the MVP set at:
    * Music (up to 3 mins): 2 credits.
    * Photos: 1 credit.
    * Album art for music: 1 credit (or can be manually uploaded for free).

* **Asynchronous Process:** The Gen AI service calls the Stability AI API and immediately returns a "processing" status to the Cloud Function, which updates the Firestore room.

* **Completion & Storage:** When the Stability AI API call is complete, our Generative AI service receives the generated media URL. It then saves this media to **Cloud Storage** and writes a new message to the Firestore room with a link to the generated content.

### d. Social Feed

* **Post Storage:** A simple Firestore collection, `social_feed`, will store each post as a document.

* **AI-Generated Posts:** An AI agent, either on a timed schedule (e.g., via a cron job) or on a user's command, can call a **Cloud Function** that triggers an image generation via the Gen AI service. The generated image and an accompanying caption are then posted to the `social_feed` collection.

* **Infinite Scroll:** The frontend will use a Firestore query with a `limit` and `startAfter` cursor to fetch posts in chunks, enabling infinite scrolling without a performance hit.

## 4. Initial Firestore Data Schema (High-Level)

* `users`: `{ userId: string, name: string, lastSeen: timestamp, status: string, credits: number, ... }`

* `servers`: `{ serverId: string, name: string, ownerIds: array, ... }`
    * `members` (subcollection): `{ userId: string, role: string, ... }`
    * `chat_rooms` (subcollection): `{ roomId: string, name: string, type: string, playlist: array, ... }`
        * `messages` (subcollection): `{ messageId: string, text: string, senderId: string, timestamp: timestamp, replyTo: string, ... }`
    * `private_messages` (subcollection): `{ pmId: string, participants: array, ... }`
        * `messages` (subcollection): `{ messageId: string, text: string, senderId: string, timestamp: timestamp, ... }`

* `ai_agents`: `{ agentId: string, name: string, personalityPrompts: array, ... }`

* `social_feed`: `{ postId: string, author: string, content: string, mediaUrl: string, timestamp: timestamp, ... }`