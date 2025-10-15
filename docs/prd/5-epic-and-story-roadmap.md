# 5. Epic and Story Roadmap

## Epic 1: Foundation & Data Ingestion

- **Epic Goal:** To build a fully functional, automated data pipeline and a basic bot that can ingest and manage the reading list, proving the end-to-end architecture works.
- **Epic Status:** ✅ COMPLETE - All 7 stories delivered to production (2025-10-02)
- **Stories (Re-sequenced for early value):**
  - **1.1: Minimal Bot & Database Setup** ✅ Done - Established core Telegram bot connection (`grammY`) and initial PostgreSQL database schema (`Supabase`). QA: PASS
  - **1.2: Conversational Book Addition** ✅ Done - Implemented user-facing feature for adding books via conversational command with multi-source API integration. QA: PASS (95/100)
  - **1.3: Foundational CI/CD & Testing** ✅ Done - Built CI/CD pipeline (`GitHub Actions`) and lean testing framework (`Deno Test Runner`, `Husky`). QA: PASS (environmental concern noted, non-blocking)
  - **1.4: Basic RSS Ingestion** ✅ Done - Implemented automated RSS feed ingestion from Goodreads "read" shelf with pg_cron scheduling. QA: PASS
  - **1.5: Historical Backfill & Data Enrichment** ✅ Done - Implemented CSV backfill (421 books imported), YAML lookup table seeding (324 records), and AI-powered metadata enrichment service. QA: PASS (100/100)
  - **1.6: Core Error Handling & Logging** ✅ Done - Added centralized error handling and structured logging framework across all Edge Functions. QA: PASS (eliminated 140 lines of duplicated code)
  - **1.7: Production Deployment** ✅ Done - Deployed all 5 Edge Functions to production, seeded lookup tables, executed historical backfill (521 total books), activated RSS ingestion cron job. QA: PASS (90/100, all CodeRabbitAI fixes applied)

## Epic 1.5: Hardcover Migration

- **Epic Goal:** Migrate from Goodreads/Kindle to Hardcover.app/KOReader/Calibre stack, unlocking 26+ features including actual reading speed, content warnings, and community signals.
- **Epic Status:** Approved (Phase 1 - BLOCKING)
- **Timeline:** 2.8 weeks
- **Stories:**
  - **1.5.1: Hardcover API Client** (3d) - Rate-limited GraphQL client with caching, error handling, exponential backoff
  - **1.5.2: Data Ingestion & Book Matching** (5d) - Historical data import, book matching (ISBN → title → fuzzy), session reconstruction
  - **1.5.3: Database Schema Migration** (4d) - 6 migrations: +8 bk fields, 3 new tables (reading_sessions, book_activities, hardcover_lists)
  - **1.5.4: Activate Hardcover Sync** (2d) - pg_cron jobs (5min activities, daily full), disable RSS, rate limit monitoring

## Epic 2: AI Intelligence & User Interaction

- **Epic Goal:** To make the bot "smart" by implementing the core AI learning loop, reflections, and personalized recommendation features.
- **Stories:**
  - **2.0: CI/CD Confidence Net** ✅ Approved - Fast, reliable CI/CD with automated testing guardrails
  - **2.1: TBR Queue Prioritization** ✅ Done - Business logic for scoring and dynamically prioritizing TBR queue
  - **2.2: Mood-Based Recommendation** ✅ Done - Core RAG pipeline for mood-based recommendations
  - **2.3: Post-Read Reflection** - Proactive, multi-step conversational workflow for post-read reflections
  - **2.4: AI Ratings & Preference Updates** ⏸️ HOLD - Redesign required (Story 2.4.1 Phase 3: Hardcover rating + AI hybrid)
  - **2.5: AI-Powered Book Discovery** ⏸️ HOLD - Redesign required (Story 2.5.1 Phase 3: Hardcover GraphQL vs web scraping)
  - **2.6: Reading Session Import** (3d) - Import sessions from Hardcover Activities API, calculate actual reading speeds
  - **2.7: Priority Scoring with Actual Speed** (2d) - Update queue scoring to use actual speeds, community signals, content warnings

## Epic 3: Insights & Production Readiness

- **Epic Goal:** To deliver valuable insights back to the user through automated reports and to validate and launch the complete, production-ready system.
- **Stories:**
  - **3.1: Automated Insight Reports**: Implement the automated generation and delivery of weekly and monthly summary reports.
  - **3.2: End-to-End System Validation**: Perform a full validation of all user flows and data pipelines.
  - **3.3: Production Readiness & Launch**: Complete final production environment checks and officially launch the bot.
