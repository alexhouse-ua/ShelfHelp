/**
 * Integration tests for RSS ingestion (requires local Supabase instance)
 *
 * Run conditions:
 * - Local Supabase running at http://127.0.0.1:54321 OR
 * - TEST_RSS_INGESTION_LIVE=1 environment variable set
 *
 * To run:
 * 1. Start Supabase locally: supabase start
 * 2. Set environment variables in supabase/.env.local:
 *    - GOODREADS_RSS_FEED_URL_READ=<your RSS feed URL>
 *    - SUPABASE_URL=http://127.0.0.1:54321
 *    - SUPABASE_SERVICE_ROLE_KEY=<local service role key>
 * 3. Run: deno test -A tests/rss_ingestion.integration.test.ts
 *
 * These tests are OPTIONAL and skipped in CI environments.
 */
import { assertEquals } from "jsr:@std/assert@1";

/**
 * Check if integration tests should run
 */
function shouldRunIntegrationTests(): boolean {
  const liveFlag = Deno.env.get("TEST_RSS_INGESTION_LIVE");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const isLocalSupabase = supabaseUrl?.includes("127.0.0.1:54321");

  return liveFlag === "1" || isLocalSupabase === true;
}

Deno.test({
  name: "RSS Ingestion Integration Tests",
  ignore: !shouldRunIntegrationTests(),
  fn: async (t) => {
    if (!shouldRunIntegrationTests()) {
      console.log(
        "⏭️  Skipping integration tests: Start local Supabase (supabase start) or set TEST_RSS_INGESTION_LIVE=1",
      );
      return;
    }

    const rssFeedUrl = Deno.env.get("GOODREADS_RSS_FEED_URL_READ");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!rssFeedUrl || !supabaseUrl || !supabaseKey) {
      console.error(
        "❌ Missing required environment variables for integration tests:",
      );
      console.error(
        "   - GOODREADS_RSS_FEED_URL_READ, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY",
      );
      throw new Error("Integration test environment not configured");
    }

    await t.step("End-to-end: Fetch real RSS feed and insert into database", async () => {
      // Call the Edge Function endpoint
      const response = await fetch(`${supabaseUrl}/functions/v1/rss-ingestion`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ trigger: "test" }),
      });

      const result = await response.json();

      // Verify response structure
      assertEquals(response.status, 200);
      assertEquals(result.success, true);
      assertEquals(typeof result.booksAdded, "number");
      assertEquals(typeof result.booksUpdated, "number");
      assertEquals(typeof result.errors, "number");

      console.log(`✅ Integration test passed:`, {
        booksAdded: result.booksAdded,
        booksUpdated: result.booksUpdated,
        errors: result.errors,
      });
    });

    await t.step("Verify books exist in database after ingestion", async () => {
      const { createClient } = await import("jsr:@supabase/supabase-js@2");
      const supabase = createClient(supabaseUrl!, supabaseKey!);

      const { data, error } = await supabase
        .from("books")
        .select("id, title, author, goodreads_id")
        .limit(5);

      assertEquals(error, null);
      assertEquals(Array.isArray(data), true);
      assertEquals(data!.length > 0, true);

      console.log(`✅ Found ${data!.length} books in database`);
    });
  },
});
