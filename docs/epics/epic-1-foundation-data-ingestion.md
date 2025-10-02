# Epic 1: Foundation & Data Ingestion

## Epic Overview

**ID:** Epic 1
**Status:** In Progress
**Priority:** P0 (Foundation)

## Epic Goal

To build a fully functional, automated data pipeline and a basic bot that can ingest and manage the reading list, proving the end-to-end architecture works.

## Stories

### 1.1: Minimal Bot & Database Setup

**Status:** Done
**Description:** Establish the core Telegram bot connection (`grammY`) and the initial PostgreSQL database schema (`Supabase`).

### 1.2: Conversational Book Addition

**Status:** Done
**Description:** Implement the simplest user-facing feature: adding a new book via a conversational command.

### 1.3: Foundational CI/CD & Testing

**Status:** Done
**Description:** With a working feature in place, build the simplified CI/CD pipeline (`GitHub Actions`) and the lean testing framework (`Deno Test Runner`, `Husky`).

### 1.4: Basic RSS Ingestion

**Status:** Done
**Description:** Implement the first automated data source: ingesting the Goodreads RSS feed.

### 1.5: Historical Backfill & Data Enrichment

**Status:** Done
**Description:** Implement the one-time CSV backfill and the proactive web scraping service for enriching metadata.

### 1.6: Core Error Handling & Logging

**Status:** Done
**Description:** Add robust, centralized error handling and logging to the now-functional application.

### 1.7: Production Deployment

**Status:** Draft
**Description:** Deploy all Edge Functions to production, seed lookup tables, execute historical backfill, and activate RSS ingestion cron job with real data sources.

**Acceptance Criteria:**

1. Production environment variables and secrets are configured in Supabase (GOODREADS_RSS_FEED_URL_READ, GEMINI_API_KEY, etc.)
2. All Edge Functions (telegram-webhook, seed-lookup-data, csv-backfill, enrich-metadata, rss-ingestion) are deployed to production using `supabase functions deploy`
3. Lookup tables in production database are seeded with data from YAML files (classifications.yaml, recommendation-sources.yaml)
4. Historical books from goodreads_read_history.csv are imported into production books table (one-time operation)
5. RSS ingestion pg_cron job is active and running daily in production to fetch new books from actual Goodreads RSS feed
6. Production deployment includes verification tests to confirm all functions are accessible and responding correctly
7. Production deployment is documented with step-by-step instructions including rollback procedures
8. Post-deployment validation confirms data is correctly loaded and RSS ingestion is functioning

## Story Progress

- **Total Stories:** 7
- **Completed:** 6
- **In Progress:** 0
- **Not Started:** 1

## Dependencies

- None (Foundation epic)

## Success Criteria

- [x] Telegram bot successfully connects and responds
- [x] Database schema created and accessible
- [x] Basic book addition workflow functional
- [x] CI/CD pipeline operational with automated tests
- [x] RSS feed ingestion working automatically
- [x] Historical data imported and enriched
- [x] Error handling and logging implemented across all features
- [ ] All Edge Functions deployed to production with real data sources
- [ ] Production deployment documented with rollback procedures
- [ ] Post-deployment validation confirms system functioning correctly

## Notes

This epic establishes the foundational architecture and proves the end-to-end system works. All subsequent epics depend on this foundation.

**Implementation vs Execution Status:**

- Stories 1.4 and 1.5 are marked "Done" because the **implementation is complete** (Edge Functions deployed, tested, and merged)
- However, the **operational execution** has not yet occurred:
  - RSS feed ingestion cron job has not been verified to run automatically in production
  - Historical CSV backfill has not been executed (manual one-time operation pending)
  - Metadata enrichment has not been run on the imported books
  - Lookup tables have not been seeded with YAML data
- These operational tasks are deferred until Story 1.6 (Error Handling & Logging) is complete to ensure robust monitoring before processing production data
