# 5. Epic and Story Roadmap

## Epic 1: Foundation & Data Ingestion

- **Epic Goal:** To build a fully functional, automated data pipeline and a basic bot that can ingest and manage the reading list, proving the end-to-end architecture works.
- **Epic Status:** 🔄 IN PROGRESS - 6 of 7 stories delivered
- **Stories (Re-sequenced for early value):**
  - **1.1: Minimal Bot & Database Setup** ✅ Done - Established core Telegram bot connection (`grammY`) and initial PostgreSQL database schema (`Supabase`). QA: PASS
  - **1.2: Conversational Book Addition** ✅ Done - Implemented user-facing feature for adding books via conversational command with multi-source API integration. QA: PASS (95/100)
  - **1.3: Foundational CI/CD & Testing** ✅ Done - Built CI/CD pipeline (`GitHub Actions`) and lean testing framework (`Deno Test Runner`, `Husky`). QA: PASS (environmental concern noted, non-blocking)
  - **1.4: Basic RSS Ingestion** ✅ Done - Implemented automated RSS feed ingestion from Goodreads "read" shelf with pg_cron scheduling. QA: PASS
  - **1.5: Historical Backfill & Data Enrichment** ✅ Done - Implemented CSV backfill (611 books imported), YAML lookup table seeding, and AI-powered metadata enrichment service. QA: PASS (100/100)
  - **1.6: Core Error Handling & Logging** ✅ Done - Added centralized error handling and structured logging framework across all Edge Functions. QA: PASS (eliminated 140 lines of duplicated code)
  - **1.7: Production Deployment** 📋 Draft - Deploy all Edge Functions to production, seed lookup tables, execute historical backfill, and activate RSS ingestion cron job with real data sources

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
