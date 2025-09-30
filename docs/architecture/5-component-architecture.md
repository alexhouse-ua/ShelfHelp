# 5. Component Architecture

## New Components

- **`Telegram Webhook Handler`**: The single, secure entry point for all incoming messages from the Telegram Bot API.
- **`Command & Intent Parser`**: Determines the user's intent from raw text and extracts key entities.
- **`Workflow & State Manager`**: Manages the state of all multi-step conversations, like the post-read reflection.
- **`Data Ingestion & Enrichment Service`**: Handles fetching and enriching book data from external sources.
- **`Queue & Recommendation Engine`**: Contains the core logic for prioritizing the TBR queue and generating recommendations.
- **`Reporting Service`**: Generates and delivers the weekly and monthly insight reports.

## Component Interaction Diagram

```mermaid
graph TD
    subgraph "External Services"
        User
        Telegram_API[Telegram API]
        LLM_API[LLM API]
    end

    subgraph "Supabase Platform"
        Webhook[Telegram Webhook Handler]
        Parser[Command & Intent Parser]
        Workflow[Workflow & State Manager]
        Engine[Queue & Recommendation Engine]
        Ingestion[Data Ingestion Service]
        Reporting[Reporting Service]
        DB[(PostgreSQL Database)]
        Cron((pg_cron))
    end

    User --> Telegram_API --> Webhook
    Webhook --> Parser
    Parser -->|Ad-hoc Query| Engine
    Parser -->|Stateful Task| Workflow
    Workflow --> DB
    Engine --> DB
    Engine --> LLM_API
    Cron -- triggers --> Ingestion
    Cron -- triggers --> Reporting
    Ingestion --> DB
    Reporting --> DB
```
