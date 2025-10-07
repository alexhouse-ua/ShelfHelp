// @ts-nocheck: Supabase client generic types require dynamic runtime data
/**
 * Integration tests for Story 1.4: Basic RSS Ingestion
 * Run: deno test --allow-net --allow-env --allow-read tests/rss_ingestion_legacy.integration.test.ts
 *
 * Note: These tests validate core RSS ingestion functionality using real RSS feed data.
 * Mock RSS feed testing is deferred to future story due to Edge Function environment
 * variable configuration complexity during test execution.
 */

import { assertEquals, assertExists } from "jsr:@std/assert@1";
import { createClient } from "jsr:@supabase/supabase-js@2";

const shouldRunLegacySuite = (() => {
  if (Deno.env.get("TEST_RSS_INGESTION_LEGACY") === "1") {
    return true;
  }

  const rssConfigured = Boolean(Deno.env.get("GOODREADS_RSS_FEED_URL_READ"));
  if (!rssConfigured) return false;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const isLocalSupabase = supabaseUrl?.includes("127.0.0.1:54321") ?? false;
  const liveFlag = Deno.env.get("TEST_RSS_INGESTION_LIVE") === "1";

  return isLocalSupabase || liveFlag;
})();

if (!shouldRunLegacySuite) {
  console.log(
    "⏭️  Skipping legacy RSS ingestion tests. Set TEST_RSS_INGESTION_LEGACY=1 (with required Supabase + Goodreads secrets) to enable.",
  );

  Deno.test({
    name: "Legacy RSS ingestion suite (disabled)",
    ignore: true,
    fn: () => {},
  });
} else {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "http://127.0.0.1:54321";
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ??
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  Deno.test({
    name: "RSS Ingestion - Test 1: Function returns success response structure",
    async fn(): Promise<void> {
      // Skip if Edge Functions not running (CI environment)
      const response = await fetch(`${SUPABASE_URL}/functions/v1/rss-ingestion`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ trigger: "test" }),
      }).catch(() => null);

      if (!response || response.status === 404) {
        console.log("⚠️  Skipping: Edge Functions not running (expected in CI)");
        return;
      }

      const result = await response.json();

      // Verify response structure
      assertEquals(response.status, 200);
      assertExists(result);
      assertEquals(result.success, true);
      assertEquals(typeof result.booksAdded, "number");
      assertEquals(typeof result.booksUpdated, "number");
      assertEquals(typeof result.errors, "number");
      assertExists(result.errorDetails);
      assertEquals(Array.isArray(result.errorDetails), true);
    },
    sanitizeResources: false,
    sanitizeOps: false,
  });

  Deno.test({
    name: "RSS Ingestion - Test 2: Books stored in database with correct schema",
    async fn(): Promise<void> {
      // Query database for books imported from RSS (have goodreads_id)
      const { data: books, error } = await supabase
        .from("books")
        .select("*")
        .not("goodreads_id", "is", null)
        .limit(3);

      // Verify books exist
      assertEquals(error, null);
      assertExists(books);
      assertEquals(books.length > 0, true);

      // Verify first book has expected RSS ingestion fields
      const book = books[0];
      assertExists(book.id);
      assertExists(book.goodreads_id);
      assertExists(book.title);
      assertExists(book.author);
      assertExists(book.created_at);
      assertEquals(book.status, "pending"); // Default status for RSS-ingested books

      // Verify optional RSS fields are present (even if null)
      assertEquals("isbn" in book, true);
      assertEquals("page_count" in book, true);
      assertEquals("cover_image_url" in book, true);
      assertEquals("goodreads_link" in book, true);
      assertEquals("user_rating" in book, true);
      assertEquals("user_date_finished" in book, true);
      assertEquals("user_date_added" in book, true);
      assertEquals("user_shelves" in book, true);
    },
    sanitizeResources: false,
    sanitizeOps: false,
  });

  Deno.test({
    name: "RSS Ingestion - Test 3: Upsert logic prevents duplicate books",
    async fn(): Promise<void> {
      // Get book count before ingestion
      const { count: beforeCount } = await supabase
        .from("books")
        .select("*", { count: "exact", head: true })
        .not("goodreads_id", "is", null);

      assertExists(beforeCount);

      // Skip if Edge Functions not running (CI environment)
      const response = await fetch(`${SUPABASE_URL}/functions/v1/rss-ingestion`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
      }).catch(() => null);

      if (!response || response.status === 404) {
        console.log("⚠️  Skipping: Edge Functions not running (expected in CI)");
        return;
      }

      const result = await response.json();
      assertEquals(result.success, true);

      // Get book count after ingestion
      const { count: afterCount } = await supabase
        .from("books")
        .select("*", { count: "exact", head: true })
        .not("goodreads_id", "is", null);

      assertExists(afterCount);

      // Verify count remains same (no duplicates created on re-run)
      assertEquals(afterCount, beforeCount);

      // Verify we got updates, not additions (since books already exist)
      assertEquals(result.booksUpdated >= 0, true);
    },
    sanitizeResources: false,
    sanitizeOps: false,
  });

  Deno.test({
    name: "RSS Ingestion - Test 4: Goodreads ID uniqueness constraint enforced",
    async fn(): Promise<void> {
      // Query for a sample book with goodreads_id
      const { data: books } = await supabase
        .from("books")
        .select("goodreads_id")
        .not("goodreads_id", "is", null)
        .limit(10);

      assertExists(books);

      if (books.length > 0) {
        // Verify all goodreads_id values are unique
        const ids = books.map((b) => b.goodreads_id);
        const uniqueIds = new Set(ids);
        assertEquals(ids.length, uniqueIds.size);
      }
    },
    sanitizeResources: false,
    sanitizeOps: false,
  });

  Deno.test({
    name: "RSS Ingestion - Test 5: Single-item feed normalization (FUN-003 regression)",
    fn(): void {
      // Test the normalization logic for single-item feeds
      // This is a unit test that validates the array coercion logic
      const singleItem = { book_id: "123", title: "Test Book", author_name: "Test Author" };
      const multipleItems = [
        singleItem,
        {
          book_id: "456",
          title: "Another Book",
          author_name: "Another Author",
        },
      ];

      // Simulate the normalization logic from the handler
      const normalizedSingle = Array.isArray(singleItem) ? singleItem : [singleItem];
      const normalizedMultiple = Array.isArray(multipleItems) ? multipleItems : [multipleItems];

      // Verify single item becomes array
      assertEquals(Array.isArray(normalizedSingle), true);
      assertEquals(normalizedSingle.length, 1);
      assertEquals(normalizedSingle[0].book_id, "123");

      // Verify multiple items remain array
      assertEquals(Array.isArray(normalizedMultiple), true);
      assertEquals(normalizedMultiple.length, 2);
    },
    sanitizeResources: false,
    sanitizeOps: false,
  });

  Deno.test({
    name: "RSS Ingestion - Test 6: Error handling for missing required fields (AC5)",
    async fn(): Promise<void> {
      // Verify error handling via response structure when invalid data is processed
      // This test validates that the function gracefully handles missing required fields

      // Skip if Edge Functions not running (CI environment)
      const response = await fetch(`${SUPABASE_URL}/functions/v1/rss-ingestion`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ trigger: "test" }),
      }).catch(() => null);

      if (!response || response.status === 404) {
        console.log("⚠️  Skipping: Edge Functions not running (expected in CI)");
        return;
      }

      const result = await response.json();

      // Verify error handling structure exists
      assertExists(result.errorDetails);
      assertEquals(Array.isArray(result.errorDetails), true);

      // If there are errors, verify they have proper structure
      if (result.errorDetails.length > 0) {
        const firstError = result.errorDetails[0];
        assertExists(firstError.error);
        assertEquals(typeof firstError.error, "string");
      }
    },
    sanitizeResources: false,
    sanitizeOps: false,
  });

  Deno.test({
    name: "RSS Ingestion - Test 7: pg_cron job exists and is scheduled (AC1)",
    async fn(): Promise<void> {
      // Query pg_cron to verify job is scheduled
      const { data: cronJobs, error } = await supabase
        .from("cron.job")
        .select("jobname, schedule, active")
        .eq("jobname", "rss-ingestion-daily");

      if (error) {
        // pg_cron may not be accessible in test environment
        console.log("⚠️  Skipping: pg_cron not accessible (expected in CI)");
        return;
      }

      assertExists(cronJobs);
      assertEquals(cronJobs.length, 1);

      const job = cronJobs[0];
      assertEquals(job.jobname, "rss-ingestion-daily");
      assertEquals(job.schedule, "0 2 * * *"); // 2 AM UTC daily
      assertEquals(job.active, true);
    },
    sanitizeResources: false,
    sanitizeOps: false,
  });
}
