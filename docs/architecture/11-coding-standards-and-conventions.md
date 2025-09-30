# 11. Coding Standards and Conventions

## Existing Standards Compliance

- **Code Style:** Enforced by ESLint & Prettier.
- **Linting Rules:** A strict ESLint configuration will be used.
- **Testing Patterns:** All new code will be accompanied by tests written with the Deno Test Runner.
- **Documentation Style:** All functions and complex types will be documented using TSDoc comments.

## Critical Integration Rules

- **Database Integration:** All database access must go through the Supabase client.
- **Error Handling:** A standardized error handling and logging framework will be used (to be defined during implementation).
- **Logging Consistency:** All logs should be structured (JSON) and include a request ID.

---
