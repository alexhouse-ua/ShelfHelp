/**
 * Integration tests for CSV historical backfill
 *
 * Run conditions:
 * - Local Supabase running OR TEST_CSV_BACKFILL_LIVE=1 set
 *
 * To run:
 * 1. Start Supabase locally: supabase start
 * 2. Run: deno test -A tests/csv_backfill.integration.test.ts
 *
 * These tests are OPTIONAL and skipped in CI.
 */
import { assertEquals, assertExists } from "jsr:@std/assert@1";

function shouldRunIntegrationTests(): boolean {
  // Skip in CI unless explicitly enabled
  if (Deno.env.get("CI") === "true" && Deno.env.get("TEST_CSV_BACKFILL_LIVE") !== "1") {
    return false;
  }

  const liveFlag = Deno.env.get("TEST_CSV_BACKFILL_LIVE");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const isLocalSupabase = supabaseUrl?.includes("127.0.0.1:54321");

  return liveFlag === "1" || isLocalSupabase === true;
}

Deno.test({
  name: "CSV Backfill Integration Tests",
  ignore: !shouldRunIntegrationTests(),
  fn: async (t) => {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      console.log("⏭️  Skipping: Missing environment variables");
      return;
    }

    await t.step("Import books from Goodreads CSV", async () => {
      const response = await fetch(`${supabaseUrl}/functions/v1/csv-backfill`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({}),
      });

      const result = await response.json();

      assertEquals(response.status, 200);
      assertEquals(result.success, true);
      assertExists(result.booksImported);
      assertExists(result.booksUpdated);
      assertExists(result.booksFiltered);
      assertExists(result.errors);
      assertExists(result.totalRows);

      console.log(`✅ CSV import completed:`, result);
      console.log(
        `   📊 Imported: ${result.booksImported}, Filtered: ${result.booksFiltered} (non-read books)`,
      );
    });

    await t.step("Verify books imported into database", async () => {
      const { createClient } = await import("jsr:@supabase/supabase-js@2");
      const supabase = createClient(supabaseUrl!, supabaseKey!);

      const { data, error } = await supabase
        .from("books")
        .select(
          "id, title, author, goodreads_id, isbn, user_rating, user_date_finished, series_name, series_number, goodreads_link, status",
        )
        .not("goodreads_id", "is", null)
        .limit(5);

      assertEquals(error, null);
      assertExists(data);
      assertEquals(data!.length > 0, true);

      console.log(`✅ Sample books from database:`, data);
    });

    await t.step("Verify date parsing for user_date_finished", async () => {
      const { createClient } = await import("jsr:@supabase/supabase-js@2");
      const supabase = createClient(supabaseUrl!, supabaseKey!);

      const { data, error } = await supabase
        .from("books")
        .select("title, user_date_finished")
        .not("user_date_finished", "is", null)
        .limit(1)
        .single();

      assertEquals(error, null);
      assertExists(data);
      assertExists(data!.user_date_finished);

      // Verify it's a valid ISO date
      const date = new Date(data!.user_date_finished);
      assertEquals(isNaN(date.getTime()), false);
    });

    await t.step("Verify status is 'finished' for all imported books", async () => {
      const { createClient } = await import("jsr:@supabase/supabase-js@2");
      const supabase = createClient(supabaseUrl!, supabaseKey!);

      const { data, error } = await supabase
        .from("books")
        .select("title, status")
        .not("goodreads_id", "is", null)
        .limit(10);

      assertEquals(error, null);
      // All CSV-imported books should have status "finished" (only "read" books imported)
      if (data && data.length > 0) {
        data.forEach((book) => assertEquals(book.status, "finished"));
      }
    });

    await t.step("Verify series parsing from title", async () => {
      const { createClient } = await import("jsr:@supabase/supabase-js@2");
      const supabase = createClient(supabaseUrl!, supabaseKey!);

      // Look for a book with series information
      const { data, error } = await supabase
        .from("books")
        .select("title, series_name, series_number")
        .not("series_name", "is", null)
        .limit(1)
        .single();

      // Only validate if a series book exists in the CSV
      if (!error && data) {
        assertExists(data.series_name);
        assertExists(data.series_number);
        console.log(`✅ Series parsing example:`, data);
      }
    });

    await t.step("Verify goodreads_link is constructed", async () => {
      const { createClient } = await import("jsr:@supabase/supabase-js@2");
      const supabase = createClient(supabaseUrl!, supabaseKey!);

      const { data, error } = await supabase
        .from("books")
        .select("goodreads_id, goodreads_link")
        .not("goodreads_id", "is", null)
        .limit(1)
        .single();

      assertEquals(error, null);
      assertExists(data);
      assertExists(data.goodreads_link);
      assertEquals(data.goodreads_link, `https://www.goodreads.com/book/show/${data.goodreads_id}`);
    });

    await t.step("Verify idempotency: duplicate goodreads_id handled via UPSERT", async () => {
      const response = await fetch(`${supabaseUrl}/functions/v1/csv-backfill`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({}),
      });

      const result = await response.json();

      assertEquals(response.status, 200);
      assertEquals(result.success, true);

      // Second run should update existing books, not import new ones
      assertEquals(result.booksImported, 0);
      assertEquals(result.booksUpdated > 0, true);

      console.log(`✅ Idempotency verified (UPSERT):`, result);
    });
  },
});
