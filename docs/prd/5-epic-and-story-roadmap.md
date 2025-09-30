# 5. Epic and Story Roadmap

## Epic 1: Foundation & Data Ingestion

- **Epic Goal:** To build a fully functional, automated data pipeline and a basic bot that can ingest and manage the reading list, proving the end-to-end architecture works.
- **Stories (Re-sequenced for early value):**
  - **1.1: Minimal Bot & Database Setup**: Establish the core Telegram bot connection (`grammY`) and the initial PostgreSQL database schema (`Supabase`).
  - **1.2: Conversational Book Addition**: Implement the simplest user-facing feature: adding a new book via a conversational command.
  - **1.3: Foundational CI/CD & Testing**: With a working feature in place, build the simplified CI/CD pipeline (`GitHub Actions`) and the lean testing framework (`Deno Test Runner`, `Husky`).
  - **1.4: Basic RSS Ingestion**: Implement the first automated data source: ingesting the Goodreads RSS feed.
  - **1.5: Historical Backfill & Data Enrichment**: Implement the one-time CSV backfill and the proactive web scraping service for enriching metadata.
  - **1.6: Core Error Handling & Logging**: Add robust, centralized error handling and logging to the now-functional application.

## Epic 2: AI Intelligence & User Interaction

- **Epic Goal:** To make the bot "smart" by implementing the core AI learning loop, reflections, and personalized recommendation features.
- **Stories:**
  - **2.1: TBR Queue Prioritization**: Implement the business logic for scoring and dynamically prioritizing the "To Be Read" queue.
  - **2.2: Mood-Based Recommendation**: Implement the core RAG pipeline for providing mood-based book recommendations.
  - **2.3: Post-Read Reflection**: Implement the proactive, multi-step conversational workflow for post-read reflections.
  - **2.4: AI Ratings & Preference Updates**: Implement the AI analysis of reflection responses to generate objective ratings and update the user's preference model.

## Epic 3: Insights & Production Readiness

- **Epic Goal:** To deliver valuable insights back to the user through automated reports and to validate and launch the complete, production-ready system.
- **Stories:**
  - **3.1: Automated Insight Reports**: Implement the automated generation and delivery of weekly and monthly summary reports.
  - **3.2: End-to-End System Validation**: Perform a full validation of all user flows and data pipelines.
  - **3.3: Production Readiness & Launch**: Complete final production environment checks and officially launch the bot.
