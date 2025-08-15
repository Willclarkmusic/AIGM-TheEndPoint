# AI & GenAI Implementation Plan

This document outlines the detailed architectural and technical plan for implementing the platform's native AI agents and collaborative generative AI features.

## 1. The Backend is Non-Negotiable
All API calls to generative models will be handled by a secure backend service. The frontend will never directly call an external API. This is a critical security measure to protect API keys and manage costs.

* **Frontend:** Sends a user request to our backend service (via a Firebase Cloud Function).
* **Backend:** Receives the request, validates the user's credits, and then makes the secure API call to the external service (e.g., Stability AI).
* **Security:** This approach protects your API keys from being stolen and prevents users from running up a bill on your account.

## 2. AI Agent Implementation
Our AI agents will be implemented using **LangGraph** within a Python backend service hosted on **Google Cloud Run**.

* **Agent Definition:** An agent's behavior is defined by its `personality rules` and `gen rules`. These rules are stored as text prompts in Firestore and are passed to the backend service with each request.
* **Agent Calls:** A user mentions an AI in a chat (`@ai`). This triggers a Firebase Cloud Function, which in turn calls our Cloud Run service's API endpoint.
* **Scalability & Upgrades:** The LangGraph framework is designed for this. We can easily add new "nodes" to the graph for more powerful models, integrate new tools (like MCPs), or create multi-agent systems in a later phase without a complete architectural overhaul.

## 3. The Universal Credit System
A robust, two-tiered credit system will be implemented to control costs and provide a flexible experience for users.

* **Credit Types:**
    * **Chat Credits:** Used for conversational AI interactions with agents.
    * **Gen AI Credits:** Used for generating images, music, and other media.
* **Free Tier:** All new users will receive **25 Chat Credits** per month and **10 Gen AI Credits** per month to start.
* **Upgrades & Payments:** For the MVP, we will implement the UI for purchasing credits and subscriptions, but we will not build out the full payment processing with a service like Stripe. Instead, we can use a placeholder function that simulates a purchase. This allows us to get the credit system working and collect user feedback before integrating a complex payment gateway.

## 4. GenAI Radio & Media Player
The GenAI room and its features are a powerful example of our platform's capabilities.

* **Song and Image Generation:** The `Edit` tab of the GenAI room will trigger a call to our backend service. The backend will use **Stability AI** APIs to generate music and images, and then store the final output in Firebase Cloud Storage.
* **Universal Media Player:** The media player at the bottom of the `InfoBar` will be implemented as a global component using React Context. This will ensure that a single, centralized state manages all audio playback, providing a seamless user experience.
* **Broadcast vs. Free Play:** This setting will directly affect the universal media player's functionality. For a "Broadcast," the controls will be disabled, forcing the user to listen to the curated playlist.