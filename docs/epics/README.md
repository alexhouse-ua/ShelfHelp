# Shelf Help Assistant - Epic Roadmap

This directory contains the epic tracking documents for the Shelf Help Assistant project development.

## Epic Overview

### Epic 1: Foundation & Data Ingestion (P0)

**Status:** Not Started
**Stories:** 6
**Goal:** Build fully functional data pipeline and basic bot

[📄 Epic 1 Details](./epic-1-foundation-data-ingestion.md)

**Stories:**

- 1.1: Minimal Bot & Database Setup
- 1.2: Conversational Book Addition
- 1.3: Foundational CI/CD & Testing
- 1.4: Basic RSS Ingestion
- 1.5: Historical Backfill & Data Enrichment
- 1.6: Core Error Handling & Logging

---

### Epic 2: AI Intelligence & User Interaction (P1)

**Status:** Not Started (Depends on Epic 1)
**Stories:** 4
**Goal:** Implement AI learning loop and personalized recommendations

[📄 Epic 2 Details](./epic-2-ai-intelligence-user-interaction.md)

**Stories:**

- 2.1: TBR Queue Prioritization
- 2.2: Mood-Based Recommendation
- 2.3: Post-Read Reflection
- 2.4: AI Ratings & Preference Updates

---

### Epic 3: Insights & Production Readiness (P2)

**Status:** Not Started (Depends on Epic 1 & 2)
**Stories:** 3
**Goal:** Deliver automated insights and launch production system

[📄 Epic 3 Details](./epic-3-insights-production-readiness.md)

**Stories:**

- 3.1: Automated Insight Reports
- 3.2: End-to-End System Validation
- 3.3: Production Readiness & Launch

---

## Development Workflow

Following the greenfield-service workflow:

1. **SM (Scrum Master)**: Creates detailed user stories from epics using `*draft` command
2. **Dev**: Implements approved stories
3. **QA**: Reviews implementation (optional)
4. **Repeat**: Continue cycle for all stories in epic
5. **PO**: Epic retrospective (optional)

## Progress Tracking

| Epic      | Stories | Completed | In Progress | Not Started |
| --------- | ------- | --------- | ----------- | ----------- |
| Epic 1    | 6       | 0         | 0           | 6           |
| Epic 2    | 4       | 0         | 0           | 4           |
| Epic 3    | 3       | 0         | 0           | 3           |
| **Total** | **13**  | **0**     | **0**       | **13**      |

## Reference

- **PRD**: `project-specs/prd.md`
- **PRD Shards**: `docs/prd/`
- **Architecture**: `docs/architecture/`
- **Workflow**: `.bmad-core/workflows/greenfield-service.yaml`
