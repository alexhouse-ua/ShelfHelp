# Epic 2: AI Intelligence & User Interaction

## Epic Overview

**ID:** Epic 2
**Status:** Not Started
**Priority:** P1 (Core AI Features)

## Epic Goal

To make the bot "smart" by implementing the core AI learning loop, reflections, and personalized recommendation features.

## Stories

### 2.1: TBR Queue Prioritization

**Status:** Not Started
**Description:** Implement the business logic for scoring and dynamically prioritizing the "To Be Read" queue.

### 2.2: Mood-Based Recommendation

**Status:** Not Started
**Description:** Implement the core RAG pipeline for providing mood-based book recommendations.

### 2.3: Post-Read Reflection

**Status:** Not Started
**Description:** Implement the proactive, multi-step conversational workflow for post-read reflections.

### 2.4: AI Ratings & Preference Updates

**Status:** Not Started
**Description:** Implement the AI analysis of reflection responses to generate objective ratings and update the user's preference model.

## Story Progress

- **Total Stories:** 4
- **Completed:** 0
- **In Progress:** 0
- **Not Started:** 4

## Dependencies

- **Epic 1** must be completed (requires bot, database, and data pipeline)
- Specifically depends on stories 1.1, 1.2, 1.4, 1.5

## Success Criteria

- [ ] TBR queue automatically prioritizes based on business logic
- [ ] Mood-based recommendations provide relevant book suggestions
- [ ] Post-read reflection workflow captures detailed user feedback
- [ ] AI generates objective ratings from reflection responses
- [ ] User preference model updates dynamically
- [ ] Recommendation accuracy improves over time

## Tooling Decision _(New)_

**Project-Wide Adoption: LangChain + LangGraph**

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

## Notes

This epic transforms the basic bot into an intelligent assistant with learning capabilities. The AI learning loop (reflection → rating → preference update → recommendation) is the core value proposition.

**Technical Foundation**: LangChain + LangGraph adopted project-wide for agentic AI capabilities, with framework-light implementation to maintain Edge Function performance.
