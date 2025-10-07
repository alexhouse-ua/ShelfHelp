# Epic 2: AI Intelligence & User Interaction

## Epic Overview

**ID:** Epic 2
**Status:** Not Started
**Priority:** P1 (Core AI Features)

## Epic Goal

To make the bot "smart" by implementing the core AI learning loop, reflections, and personalized recommendation features.

## Stories

### 2.0: Implement CI/CD Confidence Net

**Status:** Approved
**Description:** Establish a fast, reliable CI/CD pipeline with automated testing guardrails to support Epic 2 AI feature development. This foundational story ensures all AI features (2.1-2.5) can be developed with confidence through automated lint, unit tests, and integration tests running in parallel on GitHub Actions.

### 2.1: TBR Queue Prioritization

**Status:** Not Started
**Description:** Implement the business logic for scoring and dynamically prioritizing the "To Be Read" queue.

### 2.2: Mood-Based Recommendation

**Status:** Not Started
**Description:** Implement the core RAG pipeline for providing mood-based book recommendations.

### 2.3: Post-Read Reflection

**Status:** Not Started
**Description:** Implement the proactive, multi-step conversational workflow for post-read reflections.
**Acceptance Criteria:**

1. When a book's status changes to 'finished', the system automatically triggers the reflection workflow.
2. The bot sends a proactive message inviting the user to reflect (e.g., "I see you finished _Book Title_! Would you like to reflect on it?").
3. The workflow is a stateful, multi-step conversation managed by LangGraph, guiding the user through at least 3 distinct reflection questions.
4. User responses are saved to the `reflections` table, linked to the correct book.
5. The conversation state is persisted in the `conversational_state` table, allowing the user to pause and resume.
6. Upon completion, the bot sends a confirmation message summarizing the captured reflections.
7. The workflow must be covered by an automated integration test that passes in the CI pipeline.
8. The LangGraph state machine must include error handling for invalid user inputs or unexpected state transitions.

### 2.4: AI Ratings & Preference Updates

**Status:** Not Started
**Description:** Implement the AI analysis of reflection responses to generate objective ratings and update the user's preference model.
**Acceptance Criteria:**

1. The workflow is triggered automatically after a user successfully completes a post-read reflection (Story 2.3).
2. The system uses Gemini Pro to analyze the reflection text stored in the `reflections` table.
3. The analysis generates an objective `ai_rating` (0-10) for the book, which is then saved to the `books` table.
4. The system updates the `user_preferences` table based on the analysis to refine the user's taste profile (e.g., adjusting scores for specific genres, authors, or tropes).
5. All database updates are performed within a single transaction to ensure data consistency.
6. The entire analysis and update process is covered by an integration test, mocking the Gemini API call but verifying the database operations.
7. The system gracefully handles potential errors during AI analysis or database updates, logging them via the centralized logger.

### 2.5: AI-Powered Book Discovery

**Status:** Not Started
**Description:** Implement AI-powered web search to discover new books from external sources and add them to the TBR queue.
**Acceptance Criteria:**

1. A `/discover` command is available that accepts a natural language query from the user.
2. The system uses Gemini Flash to extract search intent (genres, themes, authors) from the user's query.
3. The system performs a web search against sources defined in the `recommendation_sources` table.
4. The top 5-10 relevant results are parsed, ranked, and presented to the user with an inline keyboard.
5. An "Add to TBR" button for a search result triggers the existing data enrichment and book-saving workflow (from Story 1.5 and 1.2).
6. The system detects if a discovered book already exists in the database to prevent duplicates.
7. The end-to-end `/discover` flow is covered by an integration test, mocking the external web search calls.
8. The system includes robust error handling for failed web searches and API rate limiting.

## Story Progress

- **Total Stories:** 6
- **Completed:** 2 (2.1, 2.2)
- **In Progress:** 0
- **Not Started:** 4 (2.0, 2.3, 2.4, 2.5)

## Dependencies

- **Epic 1** must be completed (requires bot, database, and data pipeline)
- Specifically depends on stories 1.1, 1.2, 1.4, 1.5

## Success Criteria

- [ ] CI/CD pipeline with parallel jobs (lint, unit tests, integration tests) is operational
- [x] TBR queue automatically prioritizes based on business logic
- [x] Mood-based recommendations provide relevant book suggestions
- [ ] AI-powered book discovery finds new books from external sources
- [ ] Post-read reflection workflow captures detailed user feedback
- [ ] AI generates objective ratings from reflection responses
- [ ] User preference model updates dynamically
- [ ] Recommendation accuracy improves over time

## Tooling Decision (New)

### Project-Wide Adoption: LangChain + LangGraph

- **Framework-light policy**: Use LangChain/LangGraph only where they add clear value (agentic workflows, stateful conversations, RAG utilities)
- **Default retrieval path**: SQL-based Hybrid Search via Supabase RPC (embeddings + keyword matching)
- **LangChain SupabaseVectorStore**: Optional abstraction layer; evaluate per-story
- **LangSmith tracing**: Optional for debugging; enable only where needed
- **Performance priority**: Tree-shake imports, isolate LC/LG per function, keep hot paths framework-light

**Story-specific guidance:**

- **2.1 (Queue Prioritization)**: LangChain NOT required; deterministic scoring logic
- **2.2 (Mood Recommendations)**: Start with SQL Hybrid Search; optional LC retriever
- **2.3 (Reflection Workflow)**: Use LangGraph for stateful conversation orchestration
- **2.4 (Rating Analysis)**: Batch Gemini calls; optional LC structured output
- **2.5 (Book Discovery)**: Gemini Flash for intent extraction; direct web search integration

## Notes

This epic transforms the basic bot into an intelligent assistant with learning capabilities. The AI learning loop (reflection → rating → preference update → recommendation) is the core value proposition.

**Technical Foundation**: LangChain + LangGraph adopted project-wide for agentic AI capabilities, with framework-light implementation to maintain Edge Function performance.
