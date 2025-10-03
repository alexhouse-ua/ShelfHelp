# 8. External API Integration

## Telegram Bot API

- **Purpose:** To handle all user-facing communication.
- **Documentation:** [https://core.telegram.org/bots/api](https://core.telegram.org/bots/api)
- **Integration Method:** Receive data via a single webhook managed by `grammY`; send data via outbound REST API calls.

## Google Gemini API

- **Purpose:** To provide natural language understanding and generation.
- **Documentation:** [https://ai.google.dev/docs](https://ai.google.dev/docs)
- **Integration Method:** Outbound REST API calls via LangChain integration from Supabase Edge Functions.

---

### Gemini Embeddings (Production Baseline)

- **Model:** `text-embedding-004`
- **Dimensions:** 768
- **Endpoint:**
	- `POST https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=GOOGLE_GEMINI_API_KEY`
- **Request schema (camelCase):**
	- `model`: `models/text-embedding-004` (optional when included in path)
	- `content`: `{ parts: [{ text: string }] }`
	- `taskType`: `SEMANTIC_SIMILARITY`
	- `outputDimensionality`: `768`
- **Response shape:** `{ embedding: { values: number[] } }` (length must be 768)
- **Environment:** requires `GOOGLE_GEMINI_API_KEY`
- **Operational policy:**
	- Timeout: 5s per request
	- Retries: Exponential backoff on HTTP 429 (1s, 2s) up to 3 attempts
	- Error taxonomy: `TIMEOUT`, `RATE_LIMIT`, `API_ERROR:<status>`, `NETWORK_ERROR`
	- Structured logs: `operation=generate_embedding`, `moodTextLength`, `durationMs`, `attempt`
- **Rationale:** Migrated from `gemini-embedding-001` to `text-embedding-004` to align with current Gemini API and request field names (`taskType`, `outputDimensionality`).
