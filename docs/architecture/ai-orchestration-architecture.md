# 7. AI Orchestration Architecture

## LangChain + LangGraph Integration Strategy

The AI system leverages **LangChain** for LLM integration and **LangGraph** for complex, stateful AI workflows. This provides a modular design where complex tasks like post-read reflection are managed as state machines.

## AI Model Selection Strategy

- **Gemini 1.5 Flash Usage**: For quick, low-cost tasks like intent classification, simple recommendations, and basic data extraction.
- **Gemini 1.5 Pro Usage**: For complex, high-reasoning tasks like post-read reflection analysis, metadata enrichment, and detailed report generation.

### Embeddings Model (Baseline)

- **Text Embeddings:** Gemini `text-embedding-004` (768 dimensions)
- **Used by:** Mood-based recommendations (Story 2.2), hybrid search ranking, metadata enrichment signals
- **Reference:** See External API details in [External API Integration → Gemini Embeddings](./external-api-integration.md#gemini-embeddings-production-baseline)

## Adoption Policy (New)

### Why LangChain + LangGraph?

**Decision rationale:**

- **Agentic workflows**: LangGraph provides state machine orchestration for complex multi-turn conversations (Story 2.3)
- **RAG utilities**: LangChain offers retrieval abstractions (optional; SQL Hybrid Search is default)
- **Supabase alignment**: Official LangChain × Supabase integration available
- **Ecosystem maturity**: Well-documented, actively maintained, Deno-compatible via npm specifiers

**Alternatives considered:**

- Pure Gemini API calls: Lacks stateful workflow management
- Custom orchestration: Reinvents solved problems (retry logic, state persistence, tool calling)
- Alternative frameworks (Haystack, Semantic Kernel): Limited Deno/Edge support

### When to Use LangChain/LangGraph

| Story                         | LangChain Usage | LangGraph Usage | Rationale                                                                                       |
| ----------------------------- | --------------- | --------------- | ----------------------------------------------------------------------------------------------- |
| **2.1: Queue Prioritization** | ❌ Not required | ❌ Not required | Deterministic scoring logic; no LLM orchestration needed                                        |
| **2.2: Mood Recommendations** | ⚠️ Optional     | ❌ Not required | Start with SQL Hybrid Search; optionally add LC `SupabaseVectorStore` retriever for abstraction |
| **2.3: Reflection Workflow**  | ✅ Recommended  | ✅ Required     | Stateful conversation graph with retries, branching logic, and state persistence                |
| **2.4: Rating Analysis**      | ⚠️ Optional     | ❌ Not required | Batch Gemini calls for analysis; optional LC structured output parsing                          |

### Performance Guidance

**Bundle size optimization:**

```typescript
// ❌ BAD: Imports entire library
import * as langchain from "@langchain/core";

// ✅ GOOD: Tree-shake specific imports
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
```

**Edge Function isolation:**

- **Principle**: Keep hot-path functions framework-light
- **Pattern**: Isolate LC/LG usage to dedicated Edge Functions
  - Example: `recommendation-engine` function uses LangChain; `queue-update` does NOT

**Cold start mitigation:**

```typescript
// Lazy-load heavy modules
let model: ChatGoogleGenerativeAI | null = null;

async function getModel() {
  if (!model) {
    const { ChatGoogleGenerativeAI } = await import("@langchain/google-genai");
    model = new ChatGoogleGenerativeAI({/* config */});
  }
  return model;
}
```

**Performance SLOs:**

- Cold start: <3s for user-facing functions
- Warm invocation: <500ms
- Bundle size alert threshold: >1MB compressed

### Observability

**Structured logging (always required):**

```typescript
import { createLogger } from "../_shared/logger.ts";

const logger = createLogger(requestId);
logger.info("LangChain invocation", {
  operation: "mood_recommendation",
  model: "gemini-1.5-flash",
  inputTokens: 120,
});
```

**LangSmith tracing (enable selectively):**

```typescript
// Only enable for debugging complex workflows
const enableTracing = Deno.env.get("LANGCHAIN_TRACING_V2") === "true";

if (enableTracing) {
  // LangSmith auto-instruments LangChain/LangGraph calls
  process.env.LANGSMITH_API_KEY = Deno.env.get("LANGSMITH_API_KEY");
}
```

**When to enable tracing:**

- ✅ Story 2.3 (Reflection): Debug multi-step state machine
- ✅ Complex retrieval pipelines with multiple steps
- ❌ Simple deterministic flows (Story 2.1)
- ❌ Production (use structured logs instead)

### Hybrid Search Strategy

> Note: Embedding dimensionality must match your database vector type. We standardize on `text-embedding-004` with 768 dimensions, and the `books.embedding` column is `VECTOR(768)`. See [External API Integration → Gemini Embeddings](./external-api-integration.md#gemini-embeddings-production-baseline).

**Default: SQL-based Hybrid Search**

```sql
-- Supabase RPC function combining vector similarity + keyword match
CREATE FUNCTION hybrid_search(
  query_embedding VECTOR(768),
  query_text TEXT,
  match_threshold FLOAT DEFAULT 0.7,
  limit_count INT DEFAULT 10
)
RETURNS TABLE (id UUID, title TEXT, similarity FLOAT, keyword_rank INT)
AS $$
  SELECT
    id,
    title,
    1 - (embedding <=> query_embedding) AS similarity,
    ts_rank(to_tsvector('english', title || ' ' || COALESCE(ai_summary, '')),
            plainto_tsquery('english', query_text)) AS keyword_rank
  FROM books
  WHERE 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY (similarity * 0.7 + keyword_rank * 0.3) DESC
  LIMIT limit_count;
$$ LANGUAGE sql;
```

**Optional: LangChain SupabaseVectorStore**

```typescript
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";

const vectorStore = new SupabaseVectorStore(embeddings, {
  client: supabase,
  tableName: "books",
  queryName: "hybrid_search",
});

const results = await vectorStore.similaritySearch(query, 10);
```

**Decision criteria:**

- Use SQL when: Performance critical, custom ranking logic, minimal abstraction
- Use LangChain when: Building RAG chains, need retriever interface, integrating with LangGraph

## AI Workflow Examples

### Mood-Based Recommendation (Simple)

```mermaid
graph LR
    A[User: "I want something uplifting"] --> B[Flash: Intent Detection]
    B --> C[SQL Hybrid Search: Books DB]
    C --> D[Flash: Generate Recommendation]
    D --> E[Response to User]
```

### Post-Read Reflection (Complex LangGraph)

```mermaid
graph TD
    A[User: "Finished reading X"] --> B[Start Reflection Workflow]
    B --> C[Flash: Generate Initial Questions]
    C --> D[Gather User Responses]
    D --> E{More Questions?}
    E -->|Yes| C
    E -->|No| F[Pro: Deep Analysis]
    F --> G[Update Preference Model]
    G --> H[Pro: Generate AI Rating]
    H --> I[Store Results & Complete]
```
