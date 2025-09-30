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
