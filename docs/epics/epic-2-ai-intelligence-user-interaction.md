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

**Status:** ⏸️ HOLD (Epic 1.5 redesign required)
**Description:** Implement the AI analysis of reflection responses to generate objective ratings and update the user's preference model.

**HOLD Reason:** Story redesign required after Epic 1.5 completion. New approach will integrate Hardcover rating data with AI reflection analysis for hybrid rating system.

**Original Acceptance Criteria (archived):**

1. The workflow is triggered automatically after a user successfully completes a post-read reflection (Story 2.3).
2. The system uses Gemini Pro to analyze the reflection text stored in the `reflections` table.
3. The analysis generates an objective `ai_rating` (0-10) for the book, which is then saved to the `books` table.
4. The system updates the `user_preferences` table based on the analysis to refine the user's taste profile (e.g., adjusting scores for specific genres, authors, or tropes).
5. All database updates are performed within a single transaction to ensure data consistency.
6. The entire analysis and update process is covered by an integration test, mocking the Gemini API call but verifying the database operations.
7. The system gracefully handles potential errors during AI analysis or database updates, logging them via the centralized logger.

**Redesign Notes (Phase 3):**
- Story 2.4.1 will replace this story
- New approach: Hardcover rating + AI reflection analysis → hybrid rating
- Enhanced preference model using Hardcover community signals (users_count, ratings_count)
- Estimated effort: 4 days (Phase 3, Weeks 5-6)

### 2.5: AI-Powered Book Discovery

**Status:** ⏸️ HOLD (Epic 1.5 redesign required)
**Description:** Implement AI-powered web search to discover new books from external sources and add them to the TBR queue.

**HOLD Reason:** Story redesign required after Epic 1.5 completion. New approach will use Hardcover GraphQL API for discovery instead of web scraping, significantly reducing complexity and improving data quality.

**Original Acceptance Criteria (archived):**

1. A `/discover` command is available that accepts a natural language query from the user.
2. The system uses Gemini Flash to extract search intent (genres, themes, authors) from the user's query.
3. The system performs a web search against sources defined in the `recommendation_sources` table.
4. The top 5-10 relevant results are parsed, ranked, and presented to the user with an inline keyboard.
5. An "Add to TBR" button for a search result triggers the existing data enrichment and book-saving workflow (from Story 1.5 and 1.2).
6. The system detects if a discovered book already exists in the database to prevent duplicates.
7. The end-to-end `/discover` flow is covered by an integration test, mocking the external web search calls.
8. The system includes robust error handling for failed web searches and API rate limiting.

**Redesign Notes (Phase 3):**
- Story 2.5.1 will replace this story
- New approach: Hardcover GraphQL API queries (genres, moods, authors filters) vs web scraping
- Leverage native Hardcover features: community ratings, content warnings, mood tags
- Estimated effort: 3 days (Phase 3, Weeks 5-6)

### 2.6: Reading Session Import & Analytics

**Status:** Not Started
**Description:** Import historical and ongoing reading sessions from Hardcover Activities API to enable actual reading speed tracking and session-based analytics.

**Dependencies:** Epic 1.5 must be completed (Hardcover API client + data ingestion)

**Acceptance Criteria:**

1. Query Hardcover Activities API for user's historical progress_update events (all-time import on first run)
2. Parse activity deltas (page_progress changes) to calculate reading sessions with session_start, session_end, duration_minutes, pages_read
3. Calculate reading_speed_ppm (pages per minute) for each session and store in reading_sessions table
4. Filter valid sessions: duration >0 and <240 minutes (4h max), pages_read >0
5. Store sessions with data_source='hardcover' and link to book_id via hardcover_id mapping
6. Implement idempotency: Skip sessions with duplicate hardcover_activity_id (unique constraint)
7. Aggregate session data by book and genre to calculate average reading speeds for priority scoring
8. Create analytics queries: reading_speed by book, by genre, by time_of_day, by session_duration
9. Handle edge cases: books without page counts, incomplete sessions, timezone conversions
10. Integration tests cover: session calculation accuracy, idempotency, aggregation queries, edge cases

**Technical Notes:**

**Session Calculation Logic:**
```typescript
function calculateSessions(activities: Activity[]): ReadingSession[] {
  const sessions = [];
  activities.sort((a, b) => a.created_at - b.created_at); // Chronological order

  for (let i = 1; i < activities.length; i++) {
    const prev = activities[i-1];
    const curr = activities[i];

    const duration_ms = curr.created_at - prev.created_at;
    const duration_minutes = duration_ms / 60000;
    const pages_read = curr.data.page_progress - prev.data.page_progress;

    // Valid session criteria
    if (duration_minutes > 0 && duration_minutes < 240 && pages_read > 0) {
      sessions.push({
        book_id: curr.book_id,
        hardcover_activity_id: curr.id,
        session_start: prev.created_at,
        session_end: curr.created_at,
        duration_minutes: Math.round(duration_minutes),
        pages_read: pages_read,
        start_page: prev.data.page_progress,
        end_page: curr.data.page_progress,
        reading_speed_ppm: parseFloat((pages_read / duration_minutes).toFixed(2)),
        data_source: 'hardcover'
      });
    }
  }
  return sessions;
}
```

**Analytics Queries:**
```sql
-- Average reading speed by book
SELECT
  b.title,
  b.genre,
  AVG(rs.reading_speed_ppm) as avg_speed_ppm,
  SUM(rs.duration_minutes) as total_minutes,
  SUM(rs.pages_read) as total_pages,
  COUNT(*) as session_count
FROM reading_sessions rs
JOIN books b ON rs.book_id = b.id
WHERE rs.reading_speed_ppm IS NOT NULL
GROUP BY b.id, b.title, b.genre
ORDER BY avg_speed_ppm DESC;

-- Average reading speed by genre (for priority scoring)
SELECT
  b.genre,
  AVG(rs.reading_speed_ppm) as avg_speed_ppm,
  COUNT(DISTINCT rs.book_id) as books_count
FROM reading_sessions rs
JOIN books b ON rs.book_id = b.id
WHERE rs.reading_speed_ppm IS NOT NULL
GROUP BY b.genre
ORDER BY avg_speed_ppm DESC;
```

**Estimated Effort:** 3 days

### 2.7: Priority Scoring with Actual Reading Speed

**Status:** Not Started
**Description:** Update TBR queue priority scoring algorithm to use actual reading speeds from session data instead of estimates, improving time-to-completion accuracy.

**Dependencies:**
- Story 2.6 (Reading Session Import)
- Epic 1.5 (Hardcover migration)

**Acceptance Criteria:**

1. Update priority scoring formula to replace estimated reading speeds with actual speeds from reading_sessions table
2. Calculate book-specific reading speed when available (avg of sessions for that book)
3. Fallback to genre-average speed when book-specific data unavailable
4. Fallback to global user average speed when genre data unavailable
5. Final fallback to system default (1 page/min) for new users with no session data
6. Integrate community signals into scoring: users_count (popularity), ratings_count (validation)
7. Integrate content warnings into scoring: Flag books with warnings matching user sensitivity preferences
8. Update priority_score calculation to include: actual_time_to_complete, community_validation_bonus, content_warning_penalty
9. Create comparison report: old priority scores (estimated) vs new scores (actual) for user's current TBR queue
10. Integration tests cover: all fallback scenarios, scoring formula accuracy, edge cases (no sessions, new genres)

**Updated Priority Scoring Formula:**

**Original (Story 2.1):**
```typescript
priority_score = (
  (desire_to_read * 0.4) +
  (estimated_completion_time * 0.2) + // CHANGED
  (thematic_fit * 0.2) +
  (recency_boost * 0.1) +
  (series_continuity * 0.1)
)
```

**Updated (Story 2.7):**
```typescript
// Step 1: Get actual reading speed (cascading fallback)
const actual_speed_ppm =
  getBookAverageSpeed(book_id) ||           // Book-specific avg
  getGenreAverageSpeed(book.genre) ||       // Genre avg
  getUserGlobalAverageSpeed(user_id) ||     // User's global avg
  1.0;                                       // System default

// Step 2: Calculate actual time to complete
const actual_time_to_complete = book.pages / actual_speed_ppm; // minutes

// Step 3: Community validation bonus
const community_bonus = Math.min(
  (book.users_count / 1000) * 0.05,  // 0.05 bonus per 1k users, max 0.25
  0.25
);

// Step 4: Content warning penalty
const content_warning_penalty =
  hasMatchingContentWarnings(book.content_warnings, user.sensitivity_prefs)
    ? -0.15
    : 0;

// Step 5: Final score
priority_score = (
  (desire_to_read * 0.35) +                  // Slightly reduced weight
  (actual_time_to_complete_score * 0.25) +   // Increased weight (more accurate)
  (thematic_fit * 0.2) +
  (recency_boost * 0.1) +
  (series_continuity * 0.1) +
  community_bonus +                          // NEW
  content_warning_penalty                    // NEW
);
```

**Reading Speed Fallback Logic:**
```sql
-- Get book-specific average speed
SELECT AVG(reading_speed_ppm) as book_avg_speed
FROM reading_sessions
WHERE book_id = $book_id AND reading_speed_ppm IS NOT NULL;

-- Get genre-average speed (fallback 1)
SELECT AVG(rs.reading_speed_ppm) as genre_avg_speed
FROM reading_sessions rs
JOIN books b ON rs.book_id = b.id
WHERE b.genre = $genre AND rs.reading_speed_ppm IS NOT NULL;

-- Get user global average speed (fallback 2)
SELECT AVG(reading_speed_ppm) as user_avg_speed
FROM reading_sessions
WHERE reading_speed_ppm IS NOT NULL;

-- System default (fallback 3): 1.0 ppm
```

**Comparison Report:**
```typescript
interface PriorityComparison {
  book_id: string;
  title: string;
  old_priority: number;  // Using estimated speed
  new_priority: number;  // Using actual speed
  delta: number;         // new - old
  speed_source: 'book' | 'genre' | 'user' | 'default';
  estimated_speed_ppm: number;
  actual_speed_ppm: number;
  rank_change: number;   // Position shift in queue
}
```

**Estimated Effort:** 2 days

## Story Progress

- **Total Stories:** 8
- **Completed:** 2 (2.1, 2.2)
- **In Progress:** 0
- **On Hold:** 2 (2.4, 2.5 - Epic 1.5 redesign required)
- **Not Started:** 4 (2.0, 2.3, 2.6, 2.7)

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
