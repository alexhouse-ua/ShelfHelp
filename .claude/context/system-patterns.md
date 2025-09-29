---
created: 2025-09-28T23:39:01Z
last_updated: 2025-09-28T23:39:01Z
version: 1.0
author: Claude Code PM System
---

# System Patterns & Architecture

## Architectural Style

### Serverless Event-Driven Architecture
The system follows a serverless, event-driven pattern built on Supabase:
- **Event Sources**: Telegram webhooks, pg_cron triggers, RSS feeds
- **Processing**: Stateless Edge Functions handle all business logic
- **State Management**: PostgreSQL database maintains all persistent state
- **Communication**: Asynchronous message passing between components

### Single-Responsibility Components
Each Edge Function serves a specific purpose:
- **Webhook Handler**: Processes incoming Telegram messages
- **Command Parser**: Interprets user intent and extracts entities
- **Workflow Manager**: Handles multi-step conversational flows
- **Data Ingestion**: Fetches and enriches book metadata
- **Recommendation Engine**: Generates personalized book suggestions
- **Reporting Service**: Creates automated insight reports

## Design Patterns Identified

### 1. Command Pattern
User interactions are parsed into discrete commands:
```
User Input → Intent Detection → Command Execution → Response
```

### 2. State Machine Pattern (LangGraph)
Complex workflows use state machines for conversation flow:
- Post-read reflection workflow
- Book addition confirmation flows
- Multi-step preference gathering

### 3. Repository Pattern
Database access is abstracted through service layers:
- BookService for book-related operations
- UserPreferenceService for learning system
- ConversationStateService for workflow management

### 4. Observer Pattern
Event-driven updates trigger cascading actions:
- Book status changes → Queue re-prioritization
- Reflection completion → Preference model updates
- New book addition → Metadata enrichment triggers

## Data Flow Architecture

### Reactive Flow (User-Initiated)
```
Telegram → Webhook → Parser → Service → Database → Response
```

### Proactive Flow (System-Initiated)
```
pg_cron → Scheduled Function → External APIs → Database → Telegram
```

### AI Learning Loop
```
User Feedback → Reflection Analysis → Preference Updates → Better Recommendations
```

## Integration Patterns

### API Gateway Pattern
Single webhook endpoint routes all Telegram traffic:
- Security validation via secret token
- Request routing based on message type
- Error handling and response formatting

### Adapter Pattern
External services are wrapped in consistent interfaces:
- Telegram API adapter via grammY
- Gemini API adapter via LangChain
- Web scraping adapters for metadata sources

### Circuit Breaker Pattern
External API calls include failure handling:
- Graceful degradation when APIs are unavailable
- Retry logic with exponential backoff
- Fallback to cached data when possible

## Database Design Patterns

### Single Source of Truth
PostgreSQL database is the authoritative source for all data:
- Books table with comprehensive metadata
- User preferences as learned parameters
- Conversation state for workflow continuity

### Vector Search Pattern
Semantic search using pgvector:
- Book embeddings for similarity matching
- User preference vectors for personalization
- Mood-based recommendation queries

### Audit Trail Pattern
Book events table tracks all changes:
- Status transitions (added → reading → finished)
- Rating updates and preference changes
- System-generated insights and recommendations

## Error Handling Patterns

### Fail-Fast Philosophy
Critical prerequisites checked immediately:
- API key validation on startup
- Database connectivity verification
- Required configuration presence

### Graceful Degradation
Non-critical features degrade gracefully:
- Metadata enrichment failures don't block book addition
- Recommendation engine fallback to simple rules
- Report generation continues with available data

### Centralized Error Logging
Structured error handling across all components:
- JSON-formatted log entries
- Request correlation IDs
- Detailed stack traces for debugging

## Security Patterns

### Zero-Trust Architecture
All requests validated regardless of source:
- Telegram webhook signature verification
- Database access through authenticated clients
- API key rotation and secure storage

### Principle of Least Privilege
Components have minimal required permissions:
- Edge Functions access only necessary database tables
- API keys scoped to required endpoints only
- User data isolated to single-user context

## Performance Patterns

### Lazy Loading
Data loaded only when needed:
- Book metadata enriched on-demand
- Recommendations generated per request
- Reports computed when requested

### Caching Strategy
Strategic caching for performance:
- Book metadata cached after enrichment
- User preference model cached between updates
- Recommendation results cached for session duration

### Batch Processing
Bulk operations where possible:
- RSS feed ingestion processes multiple items
- Database updates batched for efficiency
- Report generation aggregates data efficiently