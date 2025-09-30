# Project Brief: Shelf Help Assistant

This document outlines the vision, scope, and plan for the development of the Shelf Help Assistant project.

## 1. Executive Summary

The Shelf Help Assistant is a personal AI assistant designed to transform the management of a personal reading list into an intelligent, automated, and personalized experience. The project's core mission is to create a learning chatbot on a zero-cost, maintainable technology stack (centered on Supabase) that provides proactive, mood-based recommendations and deep insights into one's reading habits.

## 2. Problem Statement

### The Core Challenge: Limitations of Static Tools and Superficial Data

The user, a prolific reader, faces challenges that stem from the unsophisticated nature of existing reading management tools. These tools provide a static, high-effort experience, leading to tangible negative outcomes like **decision fatigue**. The fundamental problems to be solved are technical and data-centric:

- **Superficial Analysis:** Current tools offer only surface-level analytics (e.g., genre totals) and fail to provide the **deep, actionable insights** needed for meaningful habit analysis.
- **Flawed Preference Modeling:** Reliance on simple star ratings is inconsistent and leads to incorrect assumptions. For example, a low rating for a book with a specific trope might be misinterpreted as a dislike for the trope itself, rather than a nuanced reaction to poor writing or a specific plot point. The system needs to understand the **"why" behind a user's preferences**.
- **Static Queue Management:** A simple "To Be Read" list is inefficient. The queue should be **dynamic**, automatically re-prioritizing based on multiple factors like the user's current reading speed, upcoming deadlines (e.g., book clubs), and external signals like the hype around new releases.
- **Incomplete Data:** A single source like Goodreads provides a limited dataset. The system must solve the problem of **insufficient metadata** by actively and automatically enriching book data from across the web.
- **Lack of Continuous Learning:** Existing tools are not intelligent. The core problem is the absence of a system that is **always learning and refining** its understanding of the user's specific and evolving reading habits.

## 3. Proposed Solution

### Core Concept and Approach

The solution is a serverless, event-driven application built on a Supabase-centric stack. It operates via two core data flows: a user-initiated reactive loop and a system-initiated proactive loop.

- **User Interface: Telegram**
  The bot will operate exclusively within the Telegram messaging app.
- **Bot Logic: Supabase Edge Functions with grammY**
  The application's logic will be hosted as serverless Supabase Edge Functions. The `grammY` framework will be used to handle all interactions with the Telegram Bot API.
- **Database & Knowledge Base: Supabase PostgreSQL with `pgvector`**
  A Supabase PostgreSQL instance will store all book and user data. The `pgvector` extension is the foundation for the AI's semantic search and learning capabilities.
- **AI Orchestration: LangChain**
  The LangChain framework will be run directly within the Edge Functions to handle all AI-related tasks, including natural language understanding, querying the knowledge base, and generating responses.
- **Data Ingestion & Enrichment**
  The system will handle data intake from multiple sources. This includes ongoing, automated ingestion from **RSS feeds**, a one-time **historical data backfill from a CSV file**, and the ability for the AI agent to proactively **search the web to enrich book data** with additional metadata and find new recommendations.
- **Scheduling & Proactive Triggers: `pg_cron`**
  The native `pg_cron` extension within Supabase will be used to trigger all scheduled and proactive tasks.

### Key Differentiators and Rationale for Success

- **Unified & Simplified Architecture:** By running all components within the integrated Supabase platform, we dramatically reduce complexity and maintenance overhead.
- **Direct AI Integration:** Running LangChain logic directly within Edge Functions eliminates external network calls for AI processing, which reduces latency and simplifies the production architecture.
- **Cost Resilience:** The entire stack is designed to operate within the generous and stable free tiers of Supabase and the chosen LLM provider.

### High-Level Vision

The vision remains to create a proactive and intelligent personal reading advisor. This refined technical foundation provides a robust and maintainable path to achieving that vision.

## 4. Goals & Success Metrics

- **1. Goal: Deliver a Stable, Performant, and Cost-Effective Platform**
  - **Success Metric:** The application achieves 99.9% uptime and processes all user commands and scheduled tasks with a zero-error rate for core functions.
  - **Success Metric:** The project operates at a **$0 monthly cost**, as verified by the Supabase and AI model provider billing dashboards.

- **2. Goal: Automate and Simplify the User's Reading Workflow**
  - **Success Metric:** Reduce the time the user spends choosing their next book to **less than 5 minutes per session**.
  - **Success Metric:** The user actively uses the bot as their primary tool for managing their reading list for **at least four consecutive weeks**.

- **3. Goal: Provide Intelligent and Personalized Recommendations**
  - **Success Metric:** The AI-driven "tone-variety guard-rail" is successfully implemented, ensuring no more than two books of the same primary genre are recommended consecutively.
  - **Success Metric:** The user accepts an AI-generated, mood-based recommendation **at least 50% of the time** it is offered.

- **4. Goal: Deliver Actionable and Engaging User Insights**
  - **Success Metric:** The system successfully generates and delivers automated weekly and monthly summary reports containing data-driven insights about the user's reading habits.
  - **Success Metric:** The user rates the insights provided in these reports as 'useful' or 'very useful' in at least 3 out of 4 instances.

## 5. Target Users

Based on our conversations, the primary and sole user for this application can be described by the following persona:

- **Persona: The Prolific Reader & Self-Tracker**
  - **Description:** A highly engaged, data-driven reader who consumes a large volume of books across a wide variety of genres. They are not just a casual reader; they are an active manager of their reading life and are motivated by the desire to find patterns and insights within their own habits.
  - **Behaviors & Motivations:**
    - Maintains a large and ever-growing "To Be Read" (TBR) list.
    - Enjoys tracking personal data to optimize their experiences and make better decisions.
    - Is tech-savvy and comfortable interacting with a conversational AI or chatbot interface.
    - Is motivated by efficiency and wants to minimize time spent on administrative tasks.
    - **Operates as an active, in-the-loop collaborator during the development process. Expects to perform manual tasks and provide explicit clarification, requiring development to pause until their input is received. The AI agent must not make assumptions about preferences or proceed without explicit user confirmation.**
  - **Needs & Pain Points:**
    - Needs a tool that can intelligently navigate their complex TBR list based on their current mood and priorities.
    - Needs a system that can provide objective, data-driven insights into their reading patterns over time.
    - Needs a solution that is "always on" and proactive, reducing the mental load of managing their reading life.
    - Needs the entire solution to operate at zero cost.

## 6. Version 1.0 Scope

The scope for Version 1.0 is to build a fully functional, end-to-end application that delivers on the core promise of being an intelligent, learning reading assistant.

- **The following features are IN SCOPE for Version 1.0:**
  - **Multi-Source Data Ingestion & Enrichment:** The system will automatically ingest data from sources like the Goodreads RSS feed and enrich it with metadata from the web.
  - **Historical Data Backfill:** A one-time ingestion of historical reading data from a user-provided file to populate the initial knowledge base.
  - **Conversational Data Entry:** The user can add new books via simple natural language commands to the chatbot.
  - **Post-Read Reflection Workflow:** When a book is marked as 'Finished', the system will automatically guide the user through a series of reflection questions.
  - **AI-Generated Ratings & Inferred Preferences:** The system will analyze the user's reflection responses to generate an objective, AI-determined rating for the book and update the user's underlying preference model, enabling the agent to learn and adapt over time.
  - **Core Recommendation Engine:** Implementation of a basic RAG pipeline to provide mood-based book recommendations based on the learned preferences.
  - **Queue Management & Prioritization:** The system will include the core business logic for scoring and prioritizing the "To Be Read" queue.
  - **Automated Insights:** The system will automatically generate and deliver text-based weekly and monthly summary reports.
  - **Conversational Interface:** The sole user interface will be a Telegram Bot.

- **The following features are explicitly OUT OF SCOPE for Version 1.0:**
  - **Additional Interfaces:** Support for any interface other than Telegram is not included.
  - **Advanced UI for Data Entry:** A graphical user interface (GUI) with forms for adding or editing books is not included.
  - **Advanced AI Models:** Any work on fine-tuning a custom Large Language Model is out of scope.
  - **Graphical Dashboards:** All reports and insights will be delivered in a text-based format.
  - **Paid Features:** Any feature or component that cannot be run reliably on a zero-cost plan is out of scope.

## 7. Anti-Goals (What This Project Is Not)

- **This is NOT a generic book discovery platform.**
- **This project will not prioritize a graphical dashboard over the core conversational experience in Version 1.0.**
- **This is NOT a multi-user application.**
- **This is NOT a brittle, over-engineered technical showcase.**

## 8. Constraints & Assumptions

- **Constraints (Facts we must adhere to):**
  - **Zero-Cost Operation:** The entire technology stack for Version 1.0 must operate within stable, free service tiers.
  - **Single-User Focus:** The architecture is to be designed exclusively for a single user.
  - **Telegram-Only Interface:** The only conversational interface for V1 will be a Telegram Bot.
  - **Mandatory Data Sources:** The system must be built to ingest data from three primary sources: the user's Goodreads RSS feed, a one-time historical CSV backfill, and proactive web scraping for metadata enrichment.
  - **Human-in-the-Loop Development:** The AI developer agent **must not** make assumptions on user preferences or technical direction. Development must pause at designated points until the user provides explicit clarification, confirmation, or completes a required manual task.

- **Assumptions (Beliefs we accept as true):**
  - **Free Tier Sufficiency:** We assume the free tiers of Supabase and our chosen LLM provider are sufficient for the V1 scope.
  - **Data Source Reliability:** We assume external data sources (like Goodreads and web pages for scraping) will be consistently available.
  - **User Engagement:** We assume the user will consistently engage with the final product's reflection workflow.
  - **API Stability:** We assume external APIs will remain stable during V1 development.
  - **User Availability for Development:** We assume the user will be reasonably available to provide the necessary feedback and complete manual tasks required by the "Human-in-the-Loop" constraint to prevent prolonged development stalls.

## 9. Risks & Open Questions

- **Key Project Risks & Mitigation Strategies**
  - **Risk 1: Free Tier Policy Change (High Impact):** Mitigation includes designing a modular architecture to make it easier to swap services.
  - **Risk 2: Data Source Instability (Medium Impact):** Mitigation includes robust error handling and using conversational entry as a manual backup.
  - **Risk 3: Subjective Success of AI (Medium Impact):** Mitigation includes implementing a simple user feedback mechanism (e.g., thumbs up/down) to gather quantitative data.
  - **Risk 4: V1 Scope Complexity (Medium Impact):** Mitigation includes breaking down the scope into smaller user stories and delivering the simplest end-to-end version first.
  - **Risk 5: Over-engineering the Development Process (High Impact):** Previous attempts were hindered by an overly complex, enterprise-grade testing and CI/CD pipeline that was not maintainable for a solo developer. **Mitigation:** The project will adopt a **lean but effective** testing and deployment strategy.
  - **Risk 6: AI-Generated Code Quality (High Impact):** Past attempts were affected by the AI developer agent generating incorrect or outdated code. **Mitigation:** The AI developer agent **must** verify its implementation against the proper syntax and patterns found in current, official documentation, either provided in context or via direct links.

- **Key Pre-Development Decisions**
  - **LLM Selection:** The current choice is the Google Gemini API, as it offers a sufficient free tier. However, the architecture should remain flexible to accommodate a switch to a viable, free, non-cloud-hosted model should one become available in the future.
  - **Enrichment Strategy:** A robust and respectful web scraping/API strategy needs to be designed.

## 10. Technical Considerations

- **Platform Strategy:** Integrated PaaS (**Supabase**).
- **Backend Architecture:** Serverless (**Supabase Edge Functions**).
- **Database:** Unified PostgreSQL with the **`pgvector`** extension.
- **Scheduling:** Database-Native Cron (**`pg_cron`**).
- **AI Orchestration:** **LangChain** and **LangGraph** frameworks.
- **Interface:** **Telegram Bot API** managed via the **`grammY`** framework.

## 11. Post-V1 Vision

- **Graphical Insights Dashboard:** Build a web-based front-end for graphical analytics.
- **"Curator" & Sharing Features:** Introduce features to export and share reading data.
- **Advanced Recommendation Engine:** Evolve the AI to analyze deeper literary elements like narrative structure and prose style.
- **Interactive Preference Dashboard:** Create a screen for users to visualize and manually fine-tune the AI's learned preferences.
- **Personal Literary Journal:** Evolve the assistant into a tool that helps the user write and archive detailed book reviews.
- **Expanded Data Sources & Proactive Behavior:** Integrate with more data sources and enhance the AI to be more proactive.
