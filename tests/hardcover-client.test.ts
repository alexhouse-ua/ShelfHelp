/**
 * Unit tests for HardcoverClient
 * Tests rate limiting, caching, error handling, query builders, and public methods
 */

import { assertEquals, assertExists, assertRejects } from "jsr:@std/assert";
import {
  HardcoverClient,
  HardcoverQueries,
} from "../supabase/functions/_shared/hardcover-client.ts";

// Mock fetch for testing
let mockFetchResponses: Array<{ status: number; body: unknown }> = [];
let fetchCallCount = 0;
let fetchCalls: Array<{ url: string; options: RequestInit }> = [];

const originalFetch = globalThis.fetch;

function setupMockFetch(responses: Array<{ status: number; body: unknown }>): void {
  mockFetchResponses = responses;
  fetchCallCount = 0;
  fetchCalls = [];

  globalThis.fetch = ((url: string | URL | Request, options?: RequestInit) => {
    const callIndex = fetchCallCount++;
    fetchCalls.push({
      url: url.toString(),
      options: options || {},
    });

    if (callIndex >= mockFetchResponses.length) {
      throw new Error(`Unexpected fetch call #${callIndex + 1}`);
    }

    const mockResponse = mockFetchResponses[callIndex];

    return Promise.resolve(
      new Response(JSON.stringify(mockResponse.body), {
        status: mockResponse.status,
        headers: { "content-type": "application/json" },
      }),
    );
  }) as typeof fetch;
}

function restoreFetch(): void {
  globalThis.fetch = originalFetch;
}

// Test data
const mockBook = {
  id: 12345,
  title: "Test Book",
  pages: 300,
  release_date: "2023-01-01",
  description: "A test book",
  isbn_10: "1234567890",
  isbn_13: "9781234567890",
  moods: ["adventurous"],
  content_warnings: [],
  users_count: 100,
  ratings_count: 50,
  lists_count: 10,
  series_name: "Test Series",
  series_position: 1,
  genres: [{ name: "Fiction" }],
  authors: [{ name: "Test Author" }],
};

Deno.test("HardcoverClient - constructor validates API token", () => {
  // Save original env
  const originalToken = Deno.env.get("HARDCOVER_API_TOKEN");

  // Remove token
  Deno.env.delete("HARDCOVER_API_TOKEN");

  let errorThrown = false;
  try {
    new HardcoverClient();
  } catch (error) {
    errorThrown = true;
    assertEquals((error as Error).message, "HARDCOVER_API_TOKEN environment variable is required");
  }

  assertEquals(errorThrown, true, "Expected constructor to throw error");

  // Restore token
  if (originalToken) {
    Deno.env.set("HARDCOVER_API_TOKEN", originalToken);
  }
});

Deno.test("HardcoverClient - fetchBook success with cache", async () => {
  setupMockFetch([
    {
      status: 200,
      body: { data: { books: [mockBook] } },
    },
  ]);

  const client = new HardcoverClient("test-token");
  const book = await client.fetchBook(12345);

  assertEquals(book.id, 12345);
  assertEquals(book.title, "Test Book");
  assertEquals(fetchCallCount, 1);

  // Verify auth header (NO "Bearer" prefix!)
  const headers = fetchCalls[0].options.headers as Record<string, string>;
  assertEquals(headers?.["authorization"], "test-token");

  // Second call should use cache
  const book2 = await client.fetchBook(12345);
  assertEquals(book2.id, 12345);
  assertEquals(fetchCallCount, 1); // No additional fetch

  restoreFetch();
});

Deno.test("HardcoverClient - fetchBook 404 error", async () => {
  setupMockFetch([
    {
      status: 404,
      body: {},
    },
  ]);

  const client = new HardcoverClient("test-token");

  await assertRejects(
    async () => {
      await client.fetchBook(99999);
    },
    Error,
    "HARDCOVER_API_ERROR:404",
  );

  restoreFetch();
});

Deno.test("HardcoverClient - 401 token expired error", async () => {
  setupMockFetch([
    {
      status: 401,
      body: {},
    },
  ]);

  const client = new HardcoverClient("test-token");

  await assertRejects(
    async () => {
      await client.fetchBook(12345);
    },
    Error,
    "HARDCOVER_TOKEN_EXPIRED",
  );

  restoreFetch();
});

Deno.test("HardcoverClient - 403 access denied error", async () => {
  setupMockFetch([
    {
      status: 403,
      body: {},
    },
  ]);

  const client = new HardcoverClient("test-token");

  await assertRejects(
    async () => {
      await client.fetchBook(12345);
    },
    Error,
    "HARDCOVER_API_ERROR:403",
  );

  restoreFetch();
});

Deno.test("HardcoverClient - 500 server error", async () => {
  setupMockFetch([
    {
      status: 500,
      body: {},
    },
  ]);

  const client = new HardcoverClient("test-token");

  await assertRejects(
    async () => {
      await client.fetchBook(12345);
    },
    Error,
    "HARDCOVER_API_ERROR:500",
  );

  restoreFetch();
});

Deno.test("HardcoverClient - 429 rate limit with exponential backoff", async () => {
  // Mock 429 twice, then success
  setupMockFetch([
    { status: 429, body: {} },
    { status: 429, body: {} },
    { status: 200, body: { data: { books: [mockBook] } } },
  ]);

  const client = new HardcoverClient("test-token");
  const startTime = Date.now();

  const book = await client.fetchBook(12345);

  const duration = Date.now() - startTime;

  assertEquals(book.id, 12345);
  assertEquals(fetchCallCount, 3);

  // Should have waited ~6s total (2s + 4s backoff)
  // Allow some tolerance for test execution time
  assertEquals(duration >= 6000, true, `Expected duration >= 6000ms, got ${duration}ms`);

  restoreFetch();
});

Deno.test("HardcoverClient - 429 max retries exhausted", async () => {
  // Mock 429 three times (max retries)
  setupMockFetch([
    { status: 429, body: {} },
    { status: 429, body: {} },
    { status: 429, body: {} },
  ]);

  const client = new HardcoverClient("test-token");

  await assertRejects(
    async () => {
      await client.fetchBook(12345);
    },
    Error,
    "HARDCOVER_RATE_LIMITED",
  );

  assertEquals(fetchCallCount, 3);

  restoreFetch();
});

Deno.test("HardcoverClient - GraphQL errors with 200 status", async () => {
  setupMockFetch([
    {
      status: 200,
      body: {
        data: { books: [mockBook] },
        errors: [{ message: "Warning: deprecated field used" }],
      },
    },
  ]);

  const client = new HardcoverClient("test-token");

  // Should succeed despite errors (GraphQL behavior)
  const book = await client.fetchBook(12345);
  assertEquals(book.id, 12345);

  restoreFetch();
});

Deno.test("HardcoverClient - cache TTL expiration", async () => {
  setupMockFetch([
    { status: 200, body: { data: { books: [mockBook] } } },
    { status: 200, body: { data: { books: [{ ...mockBook, title: "Updated Book" }] } } },
  ]);

  // Create client with very short cache TTL (1ms for books)
  const client = new HardcoverClient("test-token", {
    books: { ttl: 1 },
    activities: { ttl: 1 },
    lists: { ttl: 1 },
    user: { ttl: 1 },
  });

  const book1 = await client.fetchBook(12345);
  assertEquals(book1.title, "Test Book");
  assertEquals(fetchCallCount, 1);

  // Wait for cache to expire
  await new Promise((resolve) => setTimeout(resolve, 10));

  const book2 = await client.fetchBook(12345);
  assertEquals(book2.title, "Updated Book");
  assertEquals(fetchCallCount, 2); // Cache expired, new fetch

  restoreFetch();
});

Deno.test("HardcoverClient - skipCache option", async () => {
  setupMockFetch([
    { status: 200, body: { data: { books: [mockBook] } } },
    { status: 200, body: { data: { books: [{ ...mockBook, title: "Bypassed Cache" }] } } },
  ]);

  const client = new HardcoverClient("test-token");

  const book1 = await client.fetchBook(12345);
  assertEquals(book1.title, "Test Book");
  assertEquals(fetchCallCount, 1);

  // Skip cache on second call
  const book2 = await client.fetchBook(12345, { skipCache: true });
  assertEquals(book2.title, "Bypassed Cache");
  assertEquals(fetchCallCount, 2); // Cache bypassed

  restoreFetch();
});

Deno.test("HardcoverQueries - getBook query structure", () => {
  const { query, variables } = HardcoverQueries.getBook(12345);

  assertExists(query);
  assertEquals(variables.id, 12345);
  assertEquals(query.includes("query GetBook"), true);
  assertEquals(query.includes("books(where: {id: {_eq: $id}})"), true);
  assertEquals(query.includes("title"), true);
  assertEquals(query.includes("authors"), true);
});

Deno.test("HardcoverQueries - getUserActivities query structure", () => {
  const since = new Date("2023-01-01T00:00:00Z");
  const { query, variables } = HardcoverQueries.getUserActivities("user123", since);

  assertExists(query);
  assertEquals(variables.userId, "user123");
  assertEquals(variables.since, since.toISOString());
  assertEquals(query.includes("query GetUserActivities"), true);
  assertEquals(query.includes("activities"), true);
  assertEquals(query.includes("order_by: {created_at: asc}"), true);
});

Deno.test("HardcoverQueries - getUserLists query structure", () => {
  const { query, variables } = HardcoverQueries.getUserLists("user123");

  assertExists(query);
  assertEquals(variables.userId, "user123");
  assertEquals(query.includes("query GetUserLists"), true);
  assertEquals(query.includes("lists"), true);
  assertEquals(query.includes("list_books"), true);
});

Deno.test("HardcoverQueries - getEditions query structure", () => {
  const { query, variables } = HardcoverQueries.getEditions("Test Book");

  assertExists(query);
  assertEquals(variables.title, "Test Book");
  assertEquals(query.includes("query GetEditions"), true);
  assertEquals(query.includes("editions"), true);
  assertEquals(query.includes("isbn_10"), true);
});

Deno.test("HardcoverQueries - getAuthors query structure", () => {
  const { query, variables } = HardcoverQueries.getAuthors({ name: "Test Author" });

  assertExists(query);
  const where = variables.where as { name: { _iregex: string } };
  assertEquals(where.name._iregex, "Test Author");
  assertEquals(query.includes("query GetAuthors"), true);
  assertEquals(query.includes("authors"), true);
  assertEquals(query.includes("biography"), true);
});

Deno.test("HardcoverQueries - getMe query structure", () => {
  const { query, variables } = HardcoverQueries.getMe();

  assertExists(query);
  assertEquals(Object.keys(variables).length, 0);
  assertEquals(query.includes("query GetMe"), true);
  assertEquals(query.includes("me {"), true);
  assertEquals(query.includes("username"), true);
});

Deno.test("HardcoverClient - fetchUserActivities", async () => {
  const mockActivities = [
    {
      id: "act1",
      book_id: 12345,
      event: "UserBookActivity",
      created_at: "2023-01-01T00:00:00Z",
      data: { page: 100 },
    },
  ];

  setupMockFetch([
    {
      status: 200,
      body: { data: { activities: mockActivities } },
    },
  ]);

  const client = new HardcoverClient("test-token");
  const since = new Date("2023-01-01");
  const activities = await client.fetchUserActivities("user123", since);

  assertEquals(activities.length, 1);
  assertEquals(activities[0].id, "act1");
  assertEquals(activities[0].book_id, 12345);

  restoreFetch();
});

Deno.test("HardcoverClient - fetchUserLists", async () => {
  const mockLists = [
    {
      id: "list1",
      name: "My Reading List",
      description: "Books I want to read",
      privacy: "public",
      books_count: 10,
      list_books: [{ book_id: 12345, position: 1, date_added: "2023-01-01" }],
    },
  ];

  setupMockFetch([
    {
      status: 200,
      body: { data: { lists: mockLists } },
    },
  ]);

  const client = new HardcoverClient("test-token");
  const lists = await client.fetchUserLists("user123");

  assertEquals(lists.length, 1);
  assertEquals(lists[0].id, "list1");
  assertEquals(lists[0].name, "My Reading List");

  restoreFetch();
});

Deno.test("HardcoverClient - fetchEditions", async () => {
  const mockEditions = [
    {
      id: 1,
      book_id: 12345,
      isbn_10: "1234567890",
      isbn_13: "9781234567890",
      physical_format: "Hardcover",
      pages: 300,
      publisher_id: 100,
      release_date: "2023-01-01",
      asin: "B0XXXXXX",
    },
  ];

  setupMockFetch([
    {
      status: 200,
      body: { data: { editions: mockEditions } },
    },
  ]);

  const client = new HardcoverClient("test-token");
  const editions = await client.fetchEditions("Test Book");

  assertEquals(editions.length, 1);
  assertEquals(editions[0].id, 1);
  assertEquals(editions[0].isbn_10, "1234567890");

  restoreFetch();
});

Deno.test("HardcoverClient - fetchAuthors", async () => {
  const mockAuthors = [
    {
      id: 1,
      name: "Test Author",
      biography: "A test author",
      born_year: 1980,
      books_count: 10,
    },
  ];

  setupMockFetch([
    {
      status: 200,
      body: { data: { authors: mockAuthors } },
    },
  ]);

  const client = new HardcoverClient("test-token");
  const authors = await client.fetchAuthors({ name: "Test Author" });

  assertEquals(authors.length, 1);
  assertEquals(authors[0].id, 1);
  assertEquals(authors[0].name, "Test Author");

  restoreFetch();
});

Deno.test("HardcoverClient - fetchMe", async () => {
  const mockUser = {
    id: "user123",
    username: "testuser",
    location: "Test City",
    pronouns: "they/them",
    books_count: 50,
    followers_count: 100,
  };

  setupMockFetch([
    {
      status: 200,
      body: { data: { me: mockUser } },
    },
  ]);

  const client = new HardcoverClient("test-token");
  const user = await client.fetchMe();

  assertEquals(user.id, "user123");
  assertEquals(user.username, "testuser");
  assertEquals(user.books_count, 50);

  restoreFetch();
});

Deno.test("HardcoverClient - rate limiter allows initial burst", async () => {
  // Mock 3 successful responses
  const responses = Array.from({ length: 3 }, () => ({
    status: 200,
    body: { data: { books: [mockBook] } },
  }));

  setupMockFetch(responses);

  const client = new HardcoverClient("test-token");

  // Make 3 rapid requests (should succeed quickly due to token bucket)
  const promises = Array.from(
    { length: 3 },
    (_, i) => client.fetchBook(12345 + i, { skipCache: true }),
  );

  await Promise.all(promises);

  // Verify all requests succeeded
  assertEquals(fetchCallCount, 3);

  restoreFetch();
});
