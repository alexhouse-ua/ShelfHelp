# AI Reading Sommelier - Product Requirements Document (PRD)

This document provides the detailed requirements and development plan for the Shelf Help Assistant project.

## 1. Introduction

### Project Overview

- **Analysis Source:** This analysis is based on the finalized `docs/project-brief.md`.
- **Current Project State:** This is a new, greenfield project initiative to build the **Shelf Help Assistant** application from scratch based on the approved technology stack.

### Scope Definition

- **Project Type:** New Product Development
- **Description:** This project entails building the complete Version 1.0 of the Shelf Help Assistant on a Supabase-centric stack, including all features defined in the project brief.

### Goals and Background Context

- **Goals:**
  - Deliver a Stable, Performant, and Cost-Effective Platform.
  - Automate and Simplify the User's Reading Workflow.
  - Provide Intelligent and Personalized Recommendations.
  - Deliver Actionable and Engaging User Insights.
- **Background Context:** The primary motivation for this project is to solve the data-centric challenges and limitations of existing static reading management tools. The goal is to move beyond reactive, manual tools and create an intelligent, proactive assistant that can provide deep, personalized insights into the user's reading habits.

## 2. Requirements

### Functional Requirements

- **FR1:** The system must automatically ingest data from multiple sources, including the Goodreads RSS feed and other specified web locations.
- **FR2:** The system must automatically enrich newly added book data with additional metadata by sourcing it from the web.
- **FR3:** The system must allow the user to add new books to their list via simple, natural language conversational commands.
- **FR4:** The system must initiate a proactive, multi-step reflection workflow when the user marks a book as 'Finished'.
- **FR5:** The system must analyze the user's reflection responses to capture the detailed nuances of the feedback (e.g., likes and dislikes regarding plot, pacing, or writing style). It will use this analysis to generate its own objective numerical score and update the user's preference model, ensuring the system's understanding of the user's tastes becomes more sophisticated and knowledgeable over time.
- **FR6:** The system must provide mood-based book recommendations by querying its knowledge base.
- **FR7:** The system must implement the business logic for scoring and prioritizing the "To Be Read" queue.
- **FR8:** The system must generate and deliver automated, text-based weekly and monthly summary reports.
- **FR9:** The system must support stateful, multi-step conversational workflows to guide the user through various predefined tasks.
- **FR10:** The system must be able to understand and answer ad-hoc, free-form natural language questions from the user by analyzing its entire knowledge base.

### Non-Functional Requirements

- **NFR1:** The entire V1 application stack must operate at zero monthly cost.
- **NFR2:** The system must be designed and secured for a single user only.
- **NFR3:** The primary and sole interface for V1 must be a Telegram Bot.
- **NFR4:** The architecture must be maintainable by a solo developer with simplified CI/CD processes that prioritize essential functionality over enterprise complexity.
- **NFR5:** The system must be built on the approved Supabase-centric technology stack.

### Foundational Data & Logic Requirements

- **DR1:** The new system must be able to import and use the initial data from the `classifications.yaml` and `recommendation-sources.yaml` files.
- **DR2:** The system must implement the core business logic for queue prioritization and deadline conflict scoring.

## 3. User Interface Goals

- **Core Principles:** The new conversational UI will be built on a set of core principles, including leveraging rich components (buttons, quick replies) to minimize typing, using a clear and concise tone, and maintaining consistent formatting for readability.
- **Key Interactions:** The V1 chatbot must support key conversational flows for welcoming the user, adding a book, presenting recommendations, guiding reflections, and delivering reports.
- **Personality:** The bot's personality should be that of an **expert, data-driven assistant**. Its tone should remain **enthusiastic, friendly, and casual**, avoiding robotic or overly agreeable responses. The goal is to be a helpful and insightful partner.

## 4. Technical Constraints and Integration Requirements

- **Technology Stack:** The project will be built on TypeScript, Supabase (Postgres, Edge Functions, Cron), LangChain for AI integration, and LangGraph for complex stateful AI workflows.
- **Integration & Deployment:** The project uses a **streamlined CI/CD pipeline** (GitHub Actions) optimized for single-developer productivity. Simplified quality gates focus on essential checks (linting, testing, basic validation).
- **Standards:** The project enforces Conventional Commits and a PR-based workflow. To ensure code quality efficiently, **Husky will be used to manage pre-commit hooks** for formatting and linting, and a **pre-push hook will run a quick suite of unit tests** to catch functional bugs before code reaches the CI/CD pipeline.

## 5. Epic and Story Roadmap

### Epic 1: Foundation & Data Ingestion

- **Epic Goal:** To build a fully functional, automated data pipeline and a basic bot that can ingest and manage the reading list, proving the end-to-end architecture works.
- **Stories (Re-sequenced for early value):**
  - **1.1: Minimal Bot & Database Setup**: Establish the core Telegram bot connection (`grammY`) and the initial PostgreSQL database schema (`Supabase`).
  - **1.2: Conversational Book Addition**: Implement the simplest user-facing feature: adding a new book via a conversational command.
  - **1.3: Foundational CI/CD & Testing**: With a working feature in place, build the simplified CI/CD pipeline (`GitHub Actions`) and the lean testing framework (`Deno Test Runner`, `Husky`).
  - **1.4: Basic RSS Ingestion**: Implement the first automated data source: ingesting the Goodreads RSS feed.
  - **1.5: Historical Backfill & Data Enrichment**: Implement the one-time CSV backfill and the proactive web scraping service for enriching metadata.
  - **1.6: Core Error Handling & Logging**: Add robust, centralized error handling and logging to the now-functional application.

### Epic 2: AI Intelligence & User Interaction

- **Epic Goal:** To make the bot "smart" by implementing the core AI learning loop, reflections, and personalized recommendation features.
- **Stories:**
  - **2.1: TBR Queue Prioritization**: Implement the business logic for scoring and dynamically prioritizing the "To Be Read" queue.
  - **2.2: Mood-Based Recommendation**: Implement the core RAG pipeline for providing mood-based book recommendations.
  - **2.3: Post-Read Reflection**: Implement the proactive, multi-step conversational workflow for post-read reflections.
  - **2.4: AI Ratings & Preference Updates**: Implement the AI analysis of reflection responses to generate objective ratings and update the user's preference model.

### Epic 3: Insights & Production Readiness

- **Epic Goal:** To deliver valuable insights back to the user through automated reports and to validate and launch the complete, production-ready system.
- **Stories:**
  - **3.1: Automated Insight Reports**: Implement the automated generation and delivery of weekly and monthly summary reports.
  - **3.2: End-to-End System Validation**: Perform a full validation of all user flows and data pipelines.
  - **3.3: Production Readiness & Launch**: Complete final production environment checks and officially launch the bot.
