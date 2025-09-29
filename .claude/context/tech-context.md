---
created: 2025-09-28T23:39:01Z
last_updated: 2025-09-28T23:39:01Z
version: 1.0
author: Claude Code PM System
---

# Technology Context

## Core Technology Stack

### Backend Runtime & Platform
- **Deno** - Required runtime for Supabase Edge Functions
- **Supabase** - Integrated platform providing:
  - PostgreSQL database with pgvector extension
  - Edge Functions (serverless backend)
  - Built-in authentication and APIs
  - pg_cron for scheduled tasks

### Programming Language
- **TypeScript** - Primary development language
- Provides type safety across the entire stack
- Compiles to JavaScript for Deno runtime

### Database & Vector Storage
- **PostgreSQL** - Core relational database
- **pgvector** - Vector embeddings for AI semantic search
- **pg_cron** - Native database-level cron scheduling

### AI & Language Processing
- **LangChain** - AI orchestration framework
- **LangGraph** - Stateful AI workflow management
- **Google Gemini API** - Natural language processing
  - Gemini 1.5 Flash: Quick, low-cost tasks
  - Gemini 1.5 Pro: Complex reasoning tasks

### User Interface & Communication
- **Telegram Bot API** - Primary user interface
- **grammY** - TypeScript framework for Telegram bots
- Rich components (buttons, quick replies) for enhanced UX

## Development & Quality Tools

### Package Management
- **npm** - Package manager for development dependencies
- **Node.js LTS** - Required for development toolchain

### Code Quality & Formatting
- **ESLint** - Linting and error detection
- **Prettier** - Code formatting
- **Husky** - Git hooks for automated quality checks

### Testing Framework
- **Deno Test Runner** - Native testing solution
- Unit tests for business logic
- Integration tests for critical user flows

### CI/CD & Deployment
- **GitHub Actions** - Automated deployment pipeline
- **Supabase CLI** - Local development and deployment
- **Docker** - Local environment emulation

## External API Dependencies

### Required Integrations
1. **Telegram Bot API**
   - Purpose: User interaction interface
   - Documentation: https://core.telegram.org/bots/api
   - Integration: Webhook + outbound REST calls

2. **Google Gemini API**
   - Purpose: Natural language understanding and generation
   - Documentation: https://ai.google.dev/docs
   - Integration: REST API via LangChain

### Data Sources (Planned)
- **Goodreads RSS** - Reading list synchronization
- **Web scraping** - Book metadata enrichment
- **CSV import** - Historical data backfill

## Version Strategy

All technology versions will be pinned to specific numbers before development begins to ensure reproducible builds:
- TypeScript: (TBD - latest stable)
- Deno: (TBD - latest stable)
- Supabase CLI: (TBD - latest stable)
- Node.js: LTS version

## Zero-Cost Architecture

The entire stack is designed to operate within free service tiers:
- **Supabase**: Free tier provides sufficient resources
- **Google Gemini API**: Generous free tier for AI processing
- **Telegram Bot API**: Free service
- **GitHub Actions**: Free tier for CI/CD

## Local Development Environment

### Required Tools
- Supabase CLI for local development server
- Docker for database emulation
- Git for version control
- Text editor with TypeScript support

### Environment Setup
- Local Supabase instance mirrors production
- Environment variables for API keys and configuration
- Hot reload for rapid development iteration