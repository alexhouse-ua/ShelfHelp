/**
 * Test utilities for ShelfHelp unit and integration tests
 * Provides standardized helper functions for mocking, seeding, and cleanup
 */

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

/**
 * Test data structure for seeding integration tests
 */
export interface TestData {
  books?: Array<{
    id?: string;
    title: string;
    author: string;
    goodreads_id?: number;
    status?: string;
    user_shelves?: string[];
    user_rating?: number;
    page_count?: number;
    isbn?: string;
    genres_primary?: string[];
    genres_secondary?: string[];
    ai_summary?: string;
    cover_image_url?: string;
  }>;
  reflections?: Array<{
    id?: string;
    book_id: string;
    content: string;
    reflection_type?: string;
    page_reference?: number;
  }>;
  conversational_state?: Array<{
    id?: string;
    chat_id: number;
    current_context?: string;
    last_book_id?: string;
    state_data?: Record<string, unknown>;
  }>;
  user_preferences?: Array<{
    id?: string;
    preference_key: string;
    preference_value: Record<string, unknown>;
  }>;
}

/**
 * Creates a mock Supabase client for unit tests
 * Returns a minimal mock object implementing the SupabaseClient interface
 * Use this for unit tests that need to mock database interactions
 *
 * @returns A mock SupabaseClient with stub methods that track calls for assertions
 *
 * @example
 * ```typescript
 * const mockClient = createMockSupabaseClient();
 * const result = await myFunction(mockClient);
 * assertEquals(mockClient.from.calls.length, 1);
 * ```
 */
export function createMockSupabaseClient(): SupabaseClient & {
  _callLog: {
    from: string[];
    select: string[];
    insert: unknown[];
    update: unknown[];
    delete: string[];
  };
} {
  const callLog = {
    from: [] as string[],
    select: [] as string[],
    insert: [] as unknown[],
    update: [] as unknown[],
    delete: [] as string[],
  };

  // Create a chainable mock query builder
  const createMockQueryBuilder = (tableName: string) => {
    const builder = {
      select: (columns = "*") => {
        callLog.select.push(columns);
        return {
          ...builder,
          eq: (_column: string, _value: unknown) => ({
            ...builder,
            data: null,
            error: null,
          }),
          single: () => ({
            data: null,
            error: null,
          }),
          limit: (_count: number) => ({
            ...builder,
            data: [],
            error: null,
          }),
        };
      },
      insert: (data: unknown) => {
        callLog.insert.push(data);
        return {
          ...builder,
          select: () => ({
            single: () => ({
              data: null,
              error: null,
            }),
            data: null,
            error: null,
          }),
          data: null,
          error: null,
        };
      },
      update: (data: unknown) => {
        callLog.update.push(data);
        return {
          ...builder,
          eq: (_column: string, _value: unknown) => ({
            data: null,
            error: null,
          }),
          data: null,
          error: null,
        };
      },
      delete: () => {
        callLog.delete.push(tableName);
        return {
          eq: (_column: string, _value: unknown) => ({
            data: null,
            error: null,
          }),
          data: null,
          error: null,
        };
      },
    };
    return builder;
  };

  const mockClient = {
    from: (tableName: string) => {
      callLog.from.push(tableName);
      return createMockQueryBuilder(tableName);
    },
    _callLog: callLog,
  } as unknown as SupabaseClient & {
    _callLog: typeof callLog;
  };

  return mockClient;
}

/**
 * Seeds test data into the local Supabase instance for integration tests
 * Inserts data in the correct order to respect foreign key constraints
 *
 * @param client - Real Supabase client connected to local test instance
 * @param data - Test data object containing books, reflections, conversational_state, etc.
 *
 * @example
 * ```typescript
 * await seedTestData(supabase, {
 *   books: [
 *     { id: "book-1", title: "Test Book", author: "Test Author", status: "to_read" }
 *   ],
 *   reflections: [
 *     { book_id: "book-1", content: "Great book!", reflection_type: "thought" }
 *   ]
 * });
 * ```
 */
export async function seedTestData(client: SupabaseClient, data: TestData): Promise<void> {
  try {
    // Insert books first (no dependencies)
    if (data.books && data.books.length > 0) {
      const { error: booksError } = await client.from("books").insert(data.books);
      if (booksError) {
        throw new Error(`Failed to seed books: ${booksError.message}`);
      }
    }

    // Insert reflections (depends on books)
    if (data.reflections && data.reflections.length > 0) {
      const { error: reflectionsError } = await client.from("reflections").insert(data.reflections);
      if (reflectionsError) {
        throw new Error(`Failed to seed reflections: ${reflectionsError.message}`);
      }
    }

    // Insert conversational state (can reference books via last_book_id)
    if (data.conversational_state && data.conversational_state.length > 0) {
      const { error: stateError } = await client
        .from("conversational_state")
        .insert(data.conversational_state);
      if (stateError) {
        throw new Error(`Failed to seed conversational_state: ${stateError.message}`);
      }
    }

    // Insert user preferences (no dependencies)
    if (data.user_preferences && data.user_preferences.length > 0) {
      const { error: prefsError } = await client
        .from("user_preferences")
        .insert(data.user_preferences);
      if (prefsError) {
        throw new Error(`Failed to seed user_preferences: ${prefsError.message}`);
      }
    }
  } catch (error) {
    throw new Error(
      `Test data seeding failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Cleans up all test data from the local Supabase instance
 * Deletes data in reverse order of foreign key dependencies
 * Should be called in afterEach() or afterAll() hooks
 *
 * @param client - Real Supabase client connected to local test instance
 * @param options - Optional configuration for selective cleanup
 *
 * @example
 * ```typescript
 * Deno.test({
 *   name: "My integration test",
 *   async fn() {
 *     // ... test code ...
 *   },
 *   sanitizeOps: false,
 *   sanitizeResources: false,
 * });
 *
 * // In afterEach or afterAll:
 * await cleanupTestData(supabase);
 * ```
 */
export async function cleanupTestData(
  client: SupabaseClient,
  options: {
    tables?: Array<"reflections" | "conversational_state" | "user_preferences" | "books">;
    testPrefix?: string;
  } = {},
): Promise<void> {
  const tablesToClean = options.tables ?? [
    "reflections",
    "conversational_state",
    "user_preferences",
    "books",
  ];

  try {
    // Delete in reverse order of dependencies
    for (const table of tablesToClean) {
      // If a test prefix is provided, only delete rows with IDs starting with that prefix
      if (options.testPrefix && table !== "conversational_state") {
        const { error } = await client.from(table).delete().like("id", `${options.testPrefix}%`);
        if (error) {
          console.warn(`Warning: Failed to clean up ${table}: ${error.message}`);
        }
      } else {
        // For conversational_state, use chat_id filter if needed, otherwise delete all test data
        const { error } = await client.from(table).delete().neq("id", "");
        if (error) {
          console.warn(`Warning: Failed to clean up ${table}: ${error.message}`);
        }
      }
    }
  } catch (error) {
    console.warn(
      `Test cleanup encountered an error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Waits for a condition to be true with exponential backoff retry logic
 * Useful for integration tests that need to wait for async operations to complete
 *
 * @param conditionFn - Function that returns true when the condition is met
 * @param options - Retry configuration
 *
 * @example
 * ```typescript
 * await waitForCondition(
 *   async () => {
 *     const { data } = await supabase.from("books").select("*").eq("id", bookId).single();
 *     return data?.status === "enriched";
 *   },
 *   { timeoutMs: 5000, intervalMs: 100 }
 * );
 * ```
 */
export async function waitForCondition(
  conditionFn: () => Promise<boolean> | boolean,
  options: {
    timeoutMs?: number;
    intervalMs?: number;
    maxAttempts?: number;
  } = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 5000;
  const intervalMs = options.intervalMs ?? 100;
  const maxAttempts = options.maxAttempts ?? Math.ceil(timeoutMs / intervalMs);

  let attempts = 0;
  const startTime = Date.now();

  while (attempts < maxAttempts && Date.now() - startTime < timeoutMs) {
    const result = await conditionFn();
    if (result) {
      return;
    }
    attempts++;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Condition not met within ${timeoutMs}ms (${attempts} attempts)`);
}
