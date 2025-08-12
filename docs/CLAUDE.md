# CLAUDE.md

This file serves as a high-level project brief and a set of instructions for the AI assistant. It provides all the necessary context to build the project successfully and efficiently.

## Project Overview

You are tasked with building a full-stack messaging and social platform MVP called "Your App Name Here." The core features are real-time messaging, native AI agent integration, collaborative generative AI rooms, and a public social feed.

## Cornerstone Files

These documents contain all the critical information and should be referenced before starting any task.

- **@/ARCHITECTURE.md**: This file outlines the complete technical architecture, including the technology stack, database schema, and interactions between all services (Firebase, Cloud Run, Pub/Sub, etc.).
- **@/UIUX.md**: This file is the definitive guide to the application's user interface and user experience, including the neo-brutalism style guide, layout, and specific feature interactions.

## Technology Stack

- **Frontend:** React with Vite, Tailwind CSS, React Icons for iconography.
- **Backend:** Firebase (Authentication, Firestore, Cloud Functions, Cloud Storage), Google Cloud Run (for custom Python services).
- **AI/GenAI:** LangGraph (for agent orchestration), Google Gemini API, Stability AI APIs.
- **Queuing:** Google Cloud Pub/Sub.
- **UI Libraries:** React Icons (react-icons) for all iconography needs.

## Key Development Commands

- `cd frontend && npm run dev`: Starts the local development server from the correct directory.
- `cd frontend && npm run build`: Builds the front-end project for production.
- `cd functions && firebase deploy --only functions`: Deploys only Firebase Cloud Functions.
- `cd [service-folder] && gcloud run deploy [service-name] --source .`: Deploys a Cloud Run service from its specific directory.

## Core Rules - DO NOT VIOLATE

- **Project Structure:** The front-end code is located in the `/frontend` directory. All Firebase Cloud Functions are in a `/functions` directory. Assume a monorepo structure.
- **Architecture First:** Always refer to `@/ARCHITECTURE.md` to ensure your code aligns with the defined structure and services.
- **Style Guide:** All UI components **MUST** strictly adhere to the neo-brutalism style described in `@/UIUX.md`. Use Tailwind CSS classes for styling.
- **No Placeholders:** Do not generate temporary or placeholder code. All code must be production-ready and fully functional.
- **Self-Contained Components:** Each prompt should result in a single, cohesive, and testable feature or component.
- **Cascading Deletes:** For server and room deletion, always implement a Firebase Cloud Function. Do **NOT** try to perform this from the client-side.
- **Security:** Assume all code is for a public-facing app. Never hardcode API keys or other secrets. Always assume Google Cloud Secret Manager will be used in a production environment.
- **Error Handling:** Implement robust `try/catch` blocks and clear error messaging for the user.

## Project Phases

The project is broken into three phases. Do not begin a new phase until the current one is complete and tested.

1.  **Phase 1:** The Core Messaging Platform
2.  **Phase 2:** Social & AI Agent Integration
3.  **Phase 3:** Collaborative Generative AI

I will provide a separate prompt for each step of the project. Your task is to work on one prompt at a time, building upon the previous work.
