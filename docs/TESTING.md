# Testing Strategy: The Confidence Net

## Philosophy

ShelfHelp uses a **"Confidence Net"** testing strategy—a three-layer safety system that catches issues early and ensures every change is shipped with confidence:

1. **Local Hooks (Pre-commit/Pre-push)**: Fast local checks (lint, format, unit tests) run automatically via Husky before you commit or push code.
2. **CI (Continuous Integration)**: Parallel GitHub Actions jobs run the full test suite (unit + integration) on every PR and push to `main`.
3. **Manual Sanity Check**: Quick smoke test in production or staging after deployment to verify critical user flows.

This layered approach balances speed and thoroughness: catch syntax errors and logic bugs instantly, validate integration points in CI, and confirm real-world behavior manually.

---

## Unit Tests (`*.unit.test.ts`)

**Purpose**: Unit tests validate isolated business logic without external dependencies (no database, no API calls, no network). They are fast, deterministic, and run in milliseconds.

**When to use**:

- Pure functions (scoring algorithms, data transformations, parsers)
- Utility functions (date formatters, string helpers)
- Mocked database interactions (testing error handling without real DB calls)

**Naming convention**: `<feature_name>.unit.test.ts` (e.g., `scoring_logic.unit.test.ts`)

**Example**:

```typescript
// Example: tests/scoring_logic.unit.test.ts
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { calculateBookScore } from "../supabase/functions/_shared/scoring.ts";

Deno.test("calculateBookScore - returns higher score for recent additions", () => {
  const recentBook = {
    added_at: new Date().toISOString(),
    genre: "fiction",
    page_count: 300,
  };

  const oldBook = {
    added_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
    genre: "fiction",
    page_count: 300,
  };

  const recentScore = calculateBookScore(recentBook);
  const oldScore = calculateBookScore(oldBook);

  assertEquals(recentScore > oldScore, true);
});
```

---

## Integration Tests (`*.integration.test.ts`)

**Purpose**: Integration tests validate that components work together correctly with a real local Supabase instance. They test the interaction between your code and the database, ensuring schema compliance, constraint validation, and correct data persistence.

**When to use**:

- Database CRUD operations (insert, update, delete, select)
- Edge Function handlers that interact with the database
- Testing foreign key constraints, triggers, and RLS policies
- End-to-end workflows (e.g., adding a book → enriching metadata → saving to DB)

**Naming convention**: `<feature_name>.integration.test.ts` (e.g., `book_addition.integration.test.ts`)

**Requirements**:

- A local Supabase instance must be running (`supabase start`)
- Tests must clean up their data using `cleanupTestData()` to avoid test pollution

**Example**:

```typescript
// Example: tests/book_addition.integration.test.ts
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cleanupTestData, seedTestData } from "./_test_utils.ts";

Deno.test("addBook - saves book with enriched metadata to database", async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Seed test user
  await seedTestData(supabase, {
    users: [{ id: "test-user-1", telegram_id: 12345 }],
  });

  // Test book addition
  const { data, error } = await supabase
    .from("books")
    .insert({
      user_id: "test-user-1",
      title: "Test Book",
      author: "Test Author",
      status: "to_read",
    })
    .select()
    .single();

  assertEquals(error, null);
  assertEquals(data?.title, "Test Book");

  // Cleanup
  await cleanupTestData(supabase);
});
```

---

## CI Configuration

The CI pipeline runs three parallel jobs on every PR and push to `main`:

1. **`lint-and-format`**: Runs `deno lint` and `deno fmt --check` to enforce code style consistency.
2. **`unit-tests`**: Runs all `*.unit.test.ts` files (fast, no database required).
3. **`integration-tests`**: Starts a local Supabase instance and runs all `*.integration.test.ts` files (slower, requires database).

**Why parallel jobs?**

- **Speed**: Unit tests and linting run in ~10-20 seconds, while integration tests take 2-3 minutes (Supabase startup + Docker images). Running them in parallel saves time.
- **Fast Feedback**: If lint or unit tests fail, you know immediately without waiting for integration tests to complete.
- **Resource Efficiency**: Integration tests use Docker and more resources, so isolating them allows better CI resource management.

**Caching**:

- Deno dependencies are cached based on `deno.lock` to speed up subsequent runs.
- Supabase Docker images are cached to avoid re-downloading on every CI run, reducing integration test startup time from ~2 minutes to ~30 seconds.

**Branch Protection**:
All three jobs must pass before a PR can be merged to `main`. This ensures no broken code is shipped to production.

---

## Test Utilities (`tests/_test_utils.ts`)

The `_test_utils.ts` file provides standardized helper functions for setting up and tearing down test data:

- **`createMockSupabaseClient()`**: Returns a mock Supabase client for unit tests that need to simulate database interactions without a real DB.
- **`seedTestData(client, data)`**: Inserts test data (users, books, reflections) into the local Supabase instance for integration tests.
- **`cleanupTestData(client)`**: Deletes all test data from the local Supabase instance after integration tests complete.

**Why helpers?**

- **Consistency**: All tests use the same data setup and teardown logic.
- **Maintainability**: If the database schema changes, you only update the helpers once.
- **Readability**: Tests focus on "what" they're testing, not "how" to set up data.

---

## Running Tests Locally

```bash
# Run all tests (unit + integration)
deno test -A

# Run only unit tests (fast, no database required)
deno test -A --ignore=**/*.integration.test.ts

# Run only integration tests (requires local Supabase)
supabase start
deno test -A --ignore=**/*.unit.test.ts

# Run a specific test file
deno test -A tests/book_addition.integration.test.ts
```

---

## Best Practices

1. **Write unit tests first**: They're faster to write and run, and catch logic bugs early.
2. **Use integration tests for critical paths**: Focus on workflows that interact with the database or external APIs.
3. **Always clean up test data**: Use `cleanupTestData()` in `afterEach()` or `afterAll()` hooks to avoid test pollution.
4. **Mock external APIs**: Use mocks for third-party APIs (Telegram, Goodreads, Gemini) in unit tests to avoid flakiness and rate limits.
5. **Keep tests focused**: Each test should validate one behavior or scenario. Avoid "mega tests" that test multiple things at once.
6. **Run tests before pushing**: Local hooks will catch most issues, but always run the full suite (`deno test -A`) before creating a PR.

---

## FAQ

**Q: When should I write a unit test vs. an integration test?**
A: If your code doesn't need a database or external dependency, write a unit test. If it interacts with the database, write an integration test.

**Q: Do I need to run `supabase start` for unit tests?**
A: No. Unit tests run without a database. Only integration tests require `supabase start`.

**Q: How do I debug a failing integration test?**
A: Check the Supabase logs (`supabase status` to get the logs URL), inspect the database state manually (`psql` or Supabase Studio), and ensure your test cleanup is working correctly.

**Q: Can I run integration tests in parallel?**
A: Yes, but be careful with test data conflicts. Use unique IDs or test-specific prefixes to avoid collisions.

---

**The Confidence Net is your safety net. Use it wisely, and ship with confidence.**
