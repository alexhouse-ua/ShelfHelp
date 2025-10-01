/**
 * Unit tests for RSS ingestion (deterministic, no external dependencies)
 */
import { assertEquals } from "jsr:@std/assert@1";
import {
  type HandlerDeps,
  handleRSSIngestion,
  mapRSSItemToBook,
} from "../supabase/functions/rss-ingestion/index.ts";

/**
 * Sample RSS feed XML fixture (multi-item)
 */
const SAMPLE_RSS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <book_id>12345</book_id>
      <title>Test Book One</title>
      <author_name>Author One</author_name>
      <isbn>1234567890</isbn>
      <book_published>2020</book_published>
      <book>
        <num_pages>300</num_pages>
      </book>
      <book_large_image_url>https://example.com/cover1.jpg</book_large_image_url>
      <link>https://goodreads.com/book/12345</link>
      <user_rating>4</user_rating>
      <user_read_at>Sun, 01 Jan 2025 00:00:00 -0800</user_read_at>
      <user_date_added>Wed, 15 Dec 2024 10:30:00 -0800</user_date_added>
      <book_description><![CDATA[Description one]]></book_description>
    </item>
    <item>
      <book_id>67890</book_id>
      <title>Test Book Two</title>
      <author_name>Author Two</author_name>
      <isbn></isbn>
      <book_published>2021</book_published>
      <book>
        <num_pages>250</num_pages>
      </book>
      <book_image_url>https://example.com/cover2.jpg</book_image_url>
      <link>https://goodreads.com/book/67890</link>
      <user_rating>5</user_rating>
    </item>
  </channel>
</rss>`;

/**
 * Sample single-item RSS feed XML fixture
 */
const SINGLE_ITEM_RSS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <book_id>11111</book_id>
      <title>Single Book</title>
      <author_name>Single Author</author_name>
      <user_rating>3</user_rating>
    </item>
  </channel>
</rss>`;

/**
 * Malformed RSS XML (missing required fields)
 */
const MALFORMED_RSS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <book_id>99999</book_id>
    </item>
  </channel>
</rss>`;

/**
 * Invalid XML
 */
const INVALID_XML = `<invalid>not closed`;

/**
 * Mock fetch that returns RSS XML
 */
function createMockFetch(xml: string, status = 200): (url: string) => Promise<Response> {
  return (_url: string) => {
    return Promise.resolve(
      new Response(xml, {
        status,
        statusText: status === 200 ? "OK" : "Error",
        headers: { "Content-Type": "application/xml" },
      }),
    );
  };
}

/**
 * Mock Supabase client that records upsert calls
 */
function createMockSupabaseClient(initialGoodreadsIds: number[] = []): {
  // deno-lint-ignore no-explicit-any
  mockClient: any;
  upsertCalls: Array<{ book: unknown; options: unknown; wasExisting: boolean }>;
} {
  const existingIds = new Set(initialGoodreadsIds);
  const upsertCalls: Array<{
    book: unknown;
    options: unknown;
    wasExisting: boolean;
  }> = [];

  const mockClient = {
    from: (_table: string) => ({
      select: (_columns: string) => ({
        eq: (_column: string, value: number) => ({
          maybeSingle: () =>
            Promise.resolve({
              data: existingIds.has(value) ? { id: value } : null,
              error: null,
            }),
        }),
      }),
      upsert: (book: unknown, options: unknown) => {
        const goodreadsId = (book as { goodreads_id?: number }).goodreads_id ?? null;
        const wasExisting = typeof goodreadsId === "number" && existingIds.has(goodreadsId);

        if (typeof goodreadsId === "number") {
          existingIds.add(goodreadsId);
        }

        upsertCalls.push({ book, options, wasExisting });

        return {
          select: () => Promise.resolve({ data: [book], error: null }),
        };
      },
    }),
  };

  return { mockClient, upsertCalls };
}

Deno.test("RSS Ingestion Unit Tests", async (t) => {
  // Store original env vars
  const originalEnv = {
    rssFeedUrl: Deno.env.get("GOODREADS_RSS_FEED_URL_READ"),
    supabaseUrl: Deno.env.get("SUPABASE_URL"),
    supabaseKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  };

  await t.step("Happy path: parses multi-item RSS and counts upserts", async () => {
    // Setup env
    Deno.env.set("GOODREADS_RSS_FEED_URL_READ", "https://example.com/rss");
    Deno.env.set("SUPABASE_URL", "https://test.supabase.co");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-key");

    const { mockClient, upsertCalls } = createMockSupabaseClient();
    const deps: HandlerDeps = {
      fetchRssFeed: createMockFetch(SAMPLE_RSS_XML),
      createSupabaseClient: () => mockClient as never,
    };

    const response = await handleRSSIngestion(deps);
    const result = await response.json();

    assertEquals(response.status, 200);
    assertEquals(result.success, true);
    assertEquals(result.booksAdded, 2);
    assertEquals(result.booksUpdated, 0);
    assertEquals(result.errors, 0);
    assertEquals(upsertCalls.length, 2);
  });

  await t.step("Re-run with existing books counts updates", async () => {
    Deno.env.set("GOODREADS_RSS_FEED_URL_READ", "https://example.com/rss");
    Deno.env.set("SUPABASE_URL", "https://test.supabase.co");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-key");

    const { mockClient } = createMockSupabaseClient();
    const deps: HandlerDeps = {
      fetchRssFeed: createMockFetch(SAMPLE_RSS_XML),
      createSupabaseClient: () => mockClient as never,
    };

    const firstResponse = await handleRSSIngestion(deps);
    const firstResult = await firstResponse.json();
    assertEquals(firstResult.booksAdded, 2);
    assertEquals(firstResult.booksUpdated, 0);

    const secondResponse = await handleRSSIngestion(deps);
    const secondResult = await secondResponse.json();
    assertEquals(secondResult.booksAdded, 0);
    assertEquals(secondResult.booksUpdated, 2);
  });

  await t.step("Single-item feed normalization (regression for FUN-003)", async () => {
    Deno.env.set("GOODREADS_RSS_FEED_URL_READ", "https://example.com/rss");
    Deno.env.set("SUPABASE_URL", "https://test.supabase.co");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-key");

    const { mockClient, upsertCalls } = createMockSupabaseClient();
    const deps: HandlerDeps = {
      fetchRssFeed: createMockFetch(SINGLE_ITEM_RSS_XML),
      createSupabaseClient: () => mockClient as never,
    };

    const response = await handleRSSIngestion(deps);
    const result = await response.json();

    assertEquals(response.status, 200);
    assertEquals(result.success, true);
    assertEquals(upsertCalls.length, 1);
  });

  await t.step("Missing required fields: returns errorDetails (AC5)", async () => {
    Deno.env.set("GOODREADS_RSS_FEED_URL_READ", "https://example.com/rss");
    Deno.env.set("SUPABASE_URL", "https://test.supabase.co");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-key");

    const { mockClient } = createMockSupabaseClient();
    const deps: HandlerDeps = {
      fetchRssFeed: createMockFetch(MALFORMED_RSS_XML),
      createSupabaseClient: () => mockClient as never,
    };

    const response = await handleRSSIngestion(deps);
    const result = await response.json();

    assertEquals(response.status, 200);
    assertEquals(result.success, true);
    assertEquals(result.errors, 1);
    assertEquals(Array.isArray(result.errorDetails), true);
    assertEquals(result.errorDetails.length, 1);
    assertEquals(
      result.errorDetails[0].error,
      "Missing required fields (goodreads_id, title, or author)",
    );
  });

  await t.step("Malformed XML: returns 200 with 0 items (graceful handling)", async () => {
    Deno.env.set("GOODREADS_RSS_FEED_URL_READ", "https://example.com/rss");
    Deno.env.set("SUPABASE_URL", "https://test.supabase.co");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-key");

    const { mockClient } = createMockSupabaseClient();
    const deps: HandlerDeps = {
      fetchRssFeed: createMockFetch(INVALID_XML),
      createSupabaseClient: () => mockClient as never,
    };

    const response = await handleRSSIngestion(deps);
    const result = await response.json();

    // fast-xml-parser handles malformed XML gracefully, returns empty structure
    assertEquals(response.status, 200);
    assertEquals(result.success, true);
    assertEquals(result.booksAdded, 0);
  });

  await t.step("Missing GOODREADS_RSS_FEED_URL_READ: returns 500", async () => {
    Deno.env.delete("GOODREADS_RSS_FEED_URL_READ");
    Deno.env.set("SUPABASE_URL", "https://test.supabase.co");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-key");

    const { mockClient } = createMockSupabaseClient();
    const deps: HandlerDeps = {
      fetchRssFeed: createMockFetch(SAMPLE_RSS_XML),
      createSupabaseClient: () => mockClient as never,
    };

    const response = await handleRSSIngestion(deps);
    const result = await response.json();

    assertEquals(response.status, 500);
    assertEquals(result.error, "RSS feed URL not configured");
  });

  await t.step("Missing Supabase credentials: returns 500", async () => {
    Deno.env.set("GOODREADS_RSS_FEED_URL_READ", "https://example.com/rss");
    Deno.env.delete("SUPABASE_URL");
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");

    const { mockClient } = createMockSupabaseClient();
    const deps: HandlerDeps = {
      fetchRssFeed: createMockFetch(SAMPLE_RSS_XML),
      createSupabaseClient: () => mockClient as never,
    };

    const response = await handleRSSIngestion(deps);
    const result = await response.json();

    assertEquals(response.status, 500);
    assertEquals(result.error, "Supabase credentials not configured");
  });

  await t.step("Network failure (fetch returns non-200): returns 502", async () => {
    Deno.env.set("GOODREADS_RSS_FEED_URL_READ", "https://example.com/rss");
    Deno.env.set("SUPABASE_URL", "https://test.supabase.co");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-key");

    const { mockClient } = createMockSupabaseClient();
    const deps: HandlerDeps = {
      fetchRssFeed: createMockFetch("", 503),
      createSupabaseClient: () => mockClient as never,
    };

    const response = await handleRSSIngestion(deps);
    const result = await response.json();

    assertEquals(response.status, 502);
    assertEquals(typeof result.error, "string");
    assertEquals(result.error.includes("RSS feed fetch failed"), true);
  });

  await t.step("mapRSSItemToBook: correctly maps all fields", () => {
    const item = {
      book_id: "12345",
      title: "Test Book (My Series, #2)",
      author_name: "Test Author",
      isbn: "1234567890",
      book_published: "2020",
      book: { num_pages: "300" },
      book_large_image_url: "https://example.com/cover.jpg",
      link: "https://goodreads.com/book/12345",
      user_rating: "4",
      user_read_at: "Sun, 01 Jan 2025 00:00:00 -0800",
      user_date_added: "Wed, 15 Dec 2024 10:30:00 -0800",
      publisher: "Test Publisher",
    };

    const mapped = mapRSSItemToBook(item);

    assertEquals(mapped.goodreads_id, 12345);
    assertEquals(mapped.title, "Test Book");
    assertEquals(mapped.series_name, "My Series");
    assertEquals(mapped.series_number, 2);
    assertEquals(mapped.author, "Test Author");
    assertEquals(mapped.isbn, "1234567890");
    assertEquals(mapped.publication_date, "2020-01-01");
    assertEquals(mapped.page_count, 300);
    assertEquals(mapped.cover_image_url, "https://example.com/cover.jpg");
    assertEquals(mapped.goodreads_link, "https://goodreads.com/book/12345");
    assertEquals(mapped.user_rating, 4);
    assertEquals(mapped.user_date_finished, "2025-01-01T08:00:00.000Z");
    assertEquals(mapped.user_date_added, "2024-12-15T18:30:00.000Z");
    assertEquals(mapped.publisher, "Test Publisher");
    assertEquals(mapped.status, "to_read");
  });

  // Restore env
  if (originalEnv.rssFeedUrl) {
    Deno.env.set("GOODREADS_RSS_FEED_URL_READ", originalEnv.rssFeedUrl);
  } else {
    Deno.env.delete("GOODREADS_RSS_FEED_URL_READ");
  }
  if (originalEnv.supabaseUrl) {
    Deno.env.set("SUPABASE_URL", originalEnv.supabaseUrl);
  } else {
    Deno.env.delete("SUPABASE_URL");
  }
  if (originalEnv.supabaseKey) {
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", originalEnv.supabaseKey);
  } else {
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  }
});
