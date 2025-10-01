# 2. Project Scope and Integration Strategy

## Project Overview

- **Project Type:** New Product Development
- **Scope:** Building the complete Version 1.0 of the **Shelf Help Assistant**, including data ingestion, enrichment, a full AI learning loop, and reporting features.
- **Integration Impact:** Major. This is a full system build.

## Integration Approach

- **Code Integration Strategy:** All backend logic will be implemented as distinct, single-responsibility Supabase Edge Functions using TypeScript. A shared types package will ensure type safety across all functions.
- **Database Integration:** All functions will communicate with the single Postgres database via the official Supabase client library. Direct database access from outside the Supabase ecosystem will be prohibited.
- **API Integration:** The system is primarily driven by two external APIs: the **Telegram Bot API** for user interaction and the **Google Gemini API** for AI capabilities. All external API calls will be made from within Edge Functions.
- **UI Integration:** The Telegram bot is the sole UI. It will interact with the system via a single, secure webhook endpoint managed by the **`grammY` framework**, which then routes to the main orchestration Edge Function.

## Compatibility Requirements

- **Database Schema Compatibility:** The new database schema must be designed to accommodate the data from the initial `classifications.yaml`, `recommendation-sources.yaml`, and the one-time **CSV historical backfill**.
- **UI/UX Consistency:** All bot interactions must align with the personality of an **expert, data-driven assistant** with an **enthusiastic, friendly, and casual tone**, as defined in the PRD.
- **Performance Impact:** All operations must be designed to fit within the Supabase free tier's performance and execution limits.

---
