# Universal Credit System Plan

This document details the universal credit system, including its structure, implementation, and a high-level plan for future payment integration.

## 1. Credit Types & Pricing
Our system will use two distinct types of credits. The user's balance for each will be stored in their Firestore document.

* **Chat Credits (CC):**
    * **Purpose:** To make API calls to conversational AI agents.
    * **Cost:** 1 CC per user message that a published AI agent responds to.
    * **Free Tier:** 25 CC per month.
* **Gen AI Credits (GAC):**
    * **Purpose:** To make API calls to generative AI models.
    * **Cost:**
        * Image generation: 1 GAC
        * Music generation (up to 3 mins): 2 GAC
        * Album art generation: 1 GAC
    * **Free Tier:** 10 GAC per month.

## 2. Credit Management
All credit checks and decrements will happen on the backend. This is crucial for security, as it prevents users from manipulating their credit balance on the client side.

* **Credit Check:** When a user initiates a credit-consuming action (e.g., sends a message to an AI, starts an image generation), the backend will first check their Firestore document to ensure they have a sufficient balance.
* **Credit Decrement:** Upon successful completion of the action, the backend will perform a Firestore transaction to safely decrement the user's credit balance.

## 3. Payment & Subscription Implementation (MVP)
For the MVP, we will build the UI for purchasing credits and subscriptions, but we will not integrate with a live payment gateway.

* **Purchase Modal:** A UI will be implemented that allows a user to purchase a single pack of credits (e.g., 50 Gen AI Credits for a simulated price) or upgrade their monthly subscription.
* **Simulated Purchase:** The "purchase" button will trigger a backend function that simply adds the purchased credits to the user's account. This allows us to test the entire credit flow without handling real financial transactions.
* **Future Upgrades:** Once the MVP is live, we can integrate a payment provider like Stripe to handle real subscriptions and one-time purchases. This will be a phased upgrade.