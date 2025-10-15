# 2. Requirements

## Functional Requirements

- **FR1:** The system must automatically ingest data from Hardcover.app via GraphQL API, including books, activities, reading sessions, and user lists.
- **FR2:** The system must automatically enrich newly added book data with additional metadata by sourcing it from the web.
- **FR3:** The system must allow the user to add new books to their list via simple, natural language conversational commands.
- **FR4:** The system must initiate a proactive, multi-step reflection workflow when the user marks a book as 'Finished'.
- **FR5:** The system must analyze the user's reflection responses to capture the detailed nuances of the feedback (e.g., likes and dislikes regarding plot, pacing, or writing style). It will use this analysis to generate its own objective numerical score and update the user's preference model, ensuring the system's understanding of the user's tastes becomes more sophisticated and knowledgeable over time.
- **FR6:** The system must provide mood-based book recommendations by querying its knowledge base.
- **FR7:** The system must implement the business logic for scoring and prioritizing the "To Be Read" queue.
- **FR8:** The system must generate and deliver automated, text-based weekly and monthly summary reports.
- **FR9:** The system must support stateful, multi-step conversational workflows to guide the user through various predefined tasks.
- **FR10:** The system must be able to understand and answer ad-hoc, free-form natural language questions from the user by analyzing its entire knowledge base.
- **FR11:** The system must sync reading sessions from KOReader (via Hardcover plugin) to calculate actual reading speeds per book and genre.
- **FR12:** The system must display content warnings from Hardcover for books and allow filtering based on user sensitivity preferences.
- **FR13:** The system must use actual reading speeds (not estimates) for TBR queue time-to-completion calculations.
- **FR14:** The system must support multiple dynamic TBR queues via bidirectional sync with Hardcover lists.
- **FR15:** The system must incorporate community signals (users_count, ratings_count) into recommendation scoring.

## Non-Functional Requirements

- **NFR1:** The entire V1 application stack must operate at zero monthly cost.
- **NFR2:** The system must be designed and secured for a single user only.
- **NFR3:** The primary and sole interface for V1 must be a Telegram Bot.
- **NFR4:** The architecture must be maintainable by a solo developer with simplified CI/CD processes that prioritize essential functionality over enterprise complexity.
- **NFR5:** The system must be built on the approved Supabase-centric technology stack.

## Foundational Data & Logic Requirements

- **DR1:** The new system must be able to import and use the initial data from the `classifications.yaml` and `recommendation-sources.yaml` files.
- **DR2:** The system must implement the core business logic for queue prioritization and deadline conflict scoring.
