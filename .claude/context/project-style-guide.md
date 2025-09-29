---
created: 2025-09-28T23:39:01Z
last_updated: 2025-09-28T23:39:01Z
version: 1.0
author: Claude Code PM System
---

# Project Style Guide

## Code Style Standards

### TypeScript Conventions

#### Naming Conventions
- **Variables & Functions**: `camelCase` (e.g., `getUserPreferences`, `bookMetadata`)
- **Classes & Interfaces**: `PascalCase` (e.g., `BookService`, `RecommendationEngine`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRY_ATTEMPTS`, `DEFAULT_TIMEOUT`)
- **File Names**: `kebab-case` for files, `PascalCase` for classes (e.g., `book-service.ts`, `BookService`)
- **Database Tables**: `snake_case` (e.g., `user_preferences`, `book_events`)
- **Database Columns**: `snake_case` (e.g., `created_at`, `ai_rating`)

#### Function Structure
```typescript
/**
 * Brief description of function purpose
 * @param paramName - Description of parameter
 * @returns Description of return value
 */
export async function functionName(paramName: Type): Promise<ReturnType> {
  // Implementation
}
```

#### Interface & Type Definitions
```typescript
// Prefix interfaces with 'I' when needed for clarity
interface BookMetadata {
  id: string;
  title: string;
  author: string;
  // ... other properties
}

// Use type unions for controlled values
type BookStatus = 'to_read' | 'reading' | 'finished' | 'abandoned';
```

### File Organization Patterns

#### Directory Structure
```
src/
├── functions/           # Supabase Edge Functions (kebab-case)
│   ├── telegram-webhook/
│   ├── data-ingestion/
│   └── recommendation-engine/
├── types/              # Shared TypeScript definitions
│   ├── book.ts
│   ├── user.ts
│   └── conversation.ts
├── services/           # Business logic (PascalCase classes)
│   ├── BookService.ts
│   ├── RecommendationService.ts
│   └── ConversationService.ts
└── utils/              # Utility functions (camelCase)
    ├── logging.ts
    ├── validation.ts
    └── formatting.ts
```

#### File Naming Patterns
- **Edge Functions**: `kebab-case` directory names
- **Services**: `PascalCase.ts` (e.g., `BookService.ts`)
- **Types**: `camelCase.ts` (e.g., `bookTypes.ts`)
- **Utils**: `camelCase.ts` (e.g., `dateUtils.ts`)
- **Tests**: `*.test.ts` (e.g., `BookService.test.ts`)

### Import & Export Standards

#### Import Order
1. Node.js/Deno built-ins
2. External libraries (Supabase, LangChain)
3. Internal types
4. Internal services
5. Internal utilities

```typescript
// Built-ins
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// External libraries
import { createClient } from "@supabase/supabase-js";
import { ChatOpenAI } from "langchain/chat_models/openai";

// Internal imports
import type { BookMetadata, UserPreferences } from "../types/book.ts";
import { BookService } from "../services/BookService.ts";
import { logger } from "../utils/logging.ts";
```

#### Export Patterns
```typescript
// Named exports preferred for utilities and services
export { BookService } from "./BookService.ts";
export { logger, formatDate } from "./utils.ts";

// Default exports for main function/class per file
export default class RecommendationEngine {
  // Implementation
}
```

## Database Design Standards

### Table Naming
- Use `snake_case` for table and column names
- Singular table names when representing entities (`book`, not `books`)
- Use descriptive, unambiguous names

### Column Standards
- Always include `id` (UUID), `created_at`, `updated_at` for entities
- Use consistent naming patterns across tables
- Foreign keys: `{table_name}_id` (e.g., `book_id`, `user_id`)
- Boolean columns: use positive phrasing (`is_active`, not `is_inactive`)

### Index Naming
```sql
-- Pattern: idx_{table}_{column(s)}_{type}
CREATE INDEX idx_books_status_btree ON books(status);
CREATE INDEX idx_books_title_gin ON books USING gin(to_tsvector('english', title));
```

## API Design Standards

### Edge Function Structure
```typescript
// Standard Edge Function pattern
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req: Request) => {
  try {
    // Validate request
    // Process business logic
    // Return structured response
    return new Response(JSON.stringify({ success: true, data }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    // Structured error handling
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
    });
  }
});
```

### Response Format Standards
```typescript
// Success response
{
  "success": true,
  "data": { ... },
  "metadata"?: { ... }
}

// Error response
{
  "success": false,
  "error": "Human-readable error message",
  "code"?: "ERROR_CODE",
  "details"?: { ... }
}
```

## Logging & Error Handling

### Logging Format
```typescript
// Structured logging with correlation IDs
logger.info("Book recommendation generated", {
  userId: user.id,
  bookId: recommendation.id,
  confidence: recommendation.score,
  requestId: req.headers.get("x-request-id"),
});
```

### Error Handling Patterns
```typescript
// Custom error types
class BookNotFoundError extends Error {
  constructor(bookId: string) {
    super(`Book not found: ${bookId}`);
    this.name = "BookNotFoundError";
  }
}

// Error boundary pattern
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  logger.error("Operation failed", { error: error.message, context });
  throw new ServiceError("User-friendly message", error);
}
```

## Testing Standards

### Test File Structure
```typescript
// BookService.test.ts
import { assertEquals, assertThrows } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { BookService } from "./BookService.ts";

Deno.test("BookService - should create book with valid data", async () => {
  // Arrange
  const bookData = { title: "Test Book", author: "Test Author" };

  // Act
  const result = await BookService.createBook(bookData);

  // Assert
  assertEquals(result.title, bookData.title);
});
```

### Test Naming Convention
- Pattern: `{ClassName/FunctionName} - should {expected behavior} when {condition}`
- Use descriptive test names that explain the scenario
- Group related tests using nested describe blocks when beneficial

## Documentation Standards

### Code Comments
```typescript
/**
 * Generates personalized book recommendations based on user preferences and mood.
 *
 * Uses vector similarity search to find books matching the user's historical
 * preferences and current mood context. Applies variety filtering to prevent
 * consecutive recommendations from the same genre.
 *
 * @param userId - Unique identifier for the user
 * @param moodContext - Current user mood or reading context
 * @param limit - Maximum number of recommendations to return (default: 5)
 * @returns Array of book recommendations with confidence scores
 *
 * @throws {UserNotFoundError} When userId doesn't exist in database
 * @throws {InsufficientDataError} When user has too few preferences for recommendation
 */
```

### README Structure
Each module/service should include:
1. Purpose and overview
2. Key functions/methods
3. Usage examples
4. Configuration requirements
5. Testing instructions

## Git & Version Control

### Commit Message Format
Follow Conventional Commits specification:
```
type(scope): description

[optional body]

[optional footer(s)]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
- `feat(recommendations): add mood-based filtering algorithm`
- `fix(database): resolve connection timeout issues`
- `docs(api): update webhook endpoint documentation`

### Branch Naming
- `feature/description-of-feature`
- `fix/description-of-bug`
- `docs/description-of-update`
- `refactor/description-of-change`

### Pull Request Standards
- Descriptive title following commit message format
- Clear description of changes and rationale
- Link to related issues or tickets
- Request review from relevant team members
- Ensure all CI checks pass before merging

## Configuration Management

### Environment Variables
- Use `UPPER_SNAKE_CASE` for environment variable names
- Prefix with service/component name when needed
- Document all required environment variables

```typescript
// Environment configuration
const config = {
  SUPABASE_URL: Deno.env.get("SUPABASE_URL")!,
  SUPABASE_ANON_KEY: Deno.env.get("SUPABASE_ANON_KEY")!,
  TELEGRAM_BOT_TOKEN: Deno.env.get("TELEGRAM_BOT_TOKEN")!,
  GEMINI_API_KEY: Deno.env.get("GEMINI_API_KEY")!,
};
```

### Constants & Configuration
```typescript
// Application constants
export const APP_CONFIG = {
  MAX_RECOMMENDATIONS: 10,
  DEFAULT_TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  CACHE_TTL: 3600,
} as const;
```

This style guide ensures consistency across the codebase and maintainability for solo development while remaining flexible enough to evolve with the project's needs.