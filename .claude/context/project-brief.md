---
created: 2025-09-28T23:39:01Z
last_updated: 2025-09-28T23:47:24Z
version: 1.1
author: Claude Code PM System
---

# Project Brief: Shelf Help Assistant

## Executive Summary

The **Shelf Help Assistant** is a personal AI reading assistant designed to transform static reading list management into an intelligent, automated, and personalized experience. Built on a zero-cost, maintainable Supabase-centric technology stack, it provides proactive, mood-based recommendations and deep insights into reading habits through a conversational Telegram bot interface.

## Mission Statement

Create a learning chatbot that eliminates decision fatigue and provides actionable insights by understanding the "why" behind reading preferences, automatically managing dynamic reading queues, and continuously learning from user feedback.

## Core Problem Being Solved

### Current Challenges
- **Decision Fatigue**: Overwhelming choice from large TBR lists without intelligent prioritization
- **Superficial Analysis**: Existing tools provide only surface-level analytics (genre totals)
- **Static Management**: Simple "To Be Read" lists that don't adapt to preferences or priorities
- **Incomplete Data**: Limited metadata from single sources like Goodreads
- **No Learning System**: Tools don't improve understanding of user preferences over time

### Technical Solution
A serverless, event-driven application operating via two core data flows:
- **Reactive Loop**: User-initiated interactions through Telegram
- **Proactive Loop**: System-initiated tasks through scheduled functions

## Technology Foundation

### Core Stack
- **Platform**: Supabase (PostgreSQL + Edge Functions + pg_cron)
- **Runtime**: Deno (required for Supabase Edge Functions)
- **Language**: TypeScript for type safety across stack
- **AI Orchestration**: LangChain + LangGraph for complex workflows
- **Interface**: Telegram Bot API managed via grammY framework
- **AI Provider**: Google Gemini API (free tier sufficient)

### Key Architectural Decisions
- **Unified Platform**: Single Supabase deployment reduces complexity
- **Direct AI Integration**: LangChain runs within Edge Functions (no external calls)
- **Vector Search**: pgvector extension enables semantic book recommendations
- **Zero-Cost Design**: Operates entirely within free service tiers

## Project Scope & Success Criteria

### Version 1.0 Scope (IN SCOPE)
- ✅ Multi-source data ingestion (Goodreads RSS, CSV import, manual entry)
- ✅ Automated book metadata enrichment via web scraping
- ✅ Conversational book addition through natural language
- ✅ Post-read reflection workflow with AI analysis
- ✅ AI-generated ratings and preference model updates
- ✅ Mood-based recommendation engine using RAG pipeline
- ✅ Dynamic TBR queue prioritization and scoring
- ✅ Automated weekly and monthly insight reports
- ✅ Complete Telegram bot interface

### Explicitly OUT OF SCOPE for V1
- ❌ Additional interfaces beyond Telegram
- ❌ Graphical user interfaces or dashboards
- ❌ Multi-user support
- ❌ Custom LLM fine-tuning
- ❌ Any paid service dependencies

### Success Metrics
1. **Platform Stability**: 99.9% uptime, zero-error core functions, $0 monthly cost
2. **User Efficiency**: <5 minutes book selection time, 4+ weeks active usage
3. **AI Quality**: 50%+ recommendation acceptance, smart variety management
4. **Insight Value**: 75%+ "useful" rating for automated reports

## Target User

### Primary Persona: Prolific Reader & Self-Tracker
- **Profile**: Data-driven reader consuming high volume across diverse genres
- **Motivation**: Seeks efficiency, optimization, and objective insights
- **Behavior**: Maintains large TBR lists, comfortable with AI interaction
- **Constraint**: Operates as active collaborator during development (human-in-the-loop)

## Development Approach

### Epic Roadmap
0. **Epic 0**: Installation & Configuration (NEW - prerequisite)
1. **Epic 1**: Foundation & Data Ingestion (6 stories)
2. **Epic 2**: AI Intelligence & User Interaction (4 stories)
3. **Epic 3**: Insights & Production Readiness (3 stories)

### Quality Strategy
- **Local Quality Gates**: Husky-managed pre-commit/pre-push hooks
- **Lean Testing**: Confidence over coverage with Deno Test Runner
- **Simplified CI/CD**: GitHub Actions for automated deployment
- **Solo-Developer Optimized**: Maintainable without enterprise complexity

## Risk Management

### High-Impact Risks & Mitigations
- **Free Tier Changes**: Modular architecture enables service swapping
- **AI Code Quality**: Verify implementation against current official documentation
- **Scope Complexity**: Deliver simplest end-to-end version first
- **Over-engineering**: Adopt lean but effective development practices

### Technical Constraints
- **Zero-Cost Operation**: Must operate within stable free service tiers
- **Single-User Focus**: Architecture designed exclusively for one user
- **Telegram-Only Interface**: V1 limited to bot interactions
- **Human-in-the-Loop**: Development pauses for user clarification/confirmation

## Strategic Vision (Post-V1)

### Future Enhancements
- **Visual Analytics**: Web-based dashboard for graphical insights
- **Social Features**: Export and sharing capabilities for reading data
- **Advanced AI**: Literary analysis of prose style and narrative structure
- **Interactive Preferences**: Visual preference tuning and calibration
- **Literary Journal**: Detailed review writing and archiving tools

## Key Differentiators

1. **Integrated Intelligence**: AI learning embedded in daily reading workflow
2. **Zero-Cost Sustainability**: Designed for permanent free operation
3. **Conversational UX**: Natural language interaction reduces friction
4. **Proactive Insights**: System anticipates needs rather than waiting for requests
5. **Learning-Centric**: Every interaction improves recommendation quality

## Success Definition

The project succeeds when the user consistently chooses the AI assistant over manual reading list management, spends less time deciding what to read next, and gains actionable insights that improve their reading experience and habit formation.