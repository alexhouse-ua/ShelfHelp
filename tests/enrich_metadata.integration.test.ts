/**
 * Integration tests for book metadata enrichment
 *
 * Run conditions:
 * - Local Supabase running OR TEST_ENRICH_METADATA_LIVE=1 set
 * - GOOGLE_GEMINI_API_KEY set
 *
 * To run:
 * 1. Start Supabase locally: supabase start
 * 2. Set GOOGLE_GEMINI_API_KEY in supabase/.env.local
 * 3. Run: deno test -A tests/enrich_metadata.integration.test.ts
 *
 * These tests are OPTIONAL and skipped in CI.
 */
import { assertEquals, assertExists } from "jsr:@std/assert@1";

function shouldRunIntegrationTests(): boolean {
  // Skip in CI unless explicitly enabled
  if (Deno.env.get("CI") === "true" && Deno.env.get("TEST_ENRICH_METADATA_LIVE") !== "1") {
    return false;
  }

  const liveFlag = Deno.env.get("TEST_ENRICH_METADATA_LIVE");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const geminiApiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
  const isLocalSupabase = supabaseUrl?.includes("127.0.0.1:54321");

  return (liveFlag === "1" || isLocalSupabase === true) && !!geminiApiKey;
}

Deno.test({
  name: "Enrich Metadata Integration Tests",
  ignore: !shouldRunIntegrationTests(),
  fn: async (t) => {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      console.log("⏭️  Skipping: Missing environment variables");
      return;
    }

    const { createClient } = await import("jsr:@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl!, supabaseKey!);

    let testBookId: string | null = null;

    await t.step("Create test book for enrichment", async () => {
      const { data, error } = await supabase
        .from("books")
        .insert({
          title: "Pride and Prejudice",
          author: "Jane Austen",
          status: "pending",
        })
        .select("id")
        .single();

      assertEquals(error, null);
      assertExists(data);
      testBookId = data!.id;

      console.log(`✅ Test book created with ID: ${testBookId}`);
    });

    await t.step("Enrich book metadata via API", async () => {
      const response = await fetch(`${supabaseUrl}/functions/v1/enrich-metadata`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ book_id: testBookId }),
      });

      const result = await response.json();

      assertEquals(response.status, 200);
      assertEquals(result.success, true);
      assertExists(result.enrichmentData);
      assertExists(result.enrichmentData.genres_primary);
      assertExists(result.enrichmentData.tropes);
      assertExists(result.enrichmentData.themes);

      console.log(`✅ Book enriched:`, result.enrichmentData);
    });

    await t.step("Verify enrichment fields updated in database", async () => {
      const { data, error } = await supabase
        .from("books")
        .select(
          "id, title, genres_primary, genres_secondary, tropes, themes, pacing, tone, writing_style, pov_type, pov_gender, spice_level, status",
        )
        .eq("id", testBookId)
        .single();

      assertEquals(error, null);
      assertExists(data);
      assertEquals(data!.status, "enriched");
      assertExists(data!.genres_primary);
      assertEquals(Array.isArray(data!.genres_primary), true);
      assertEquals(data!.genres_primary!.length > 0, true);
      assertExists(data!.tropes);
      assertEquals(Array.isArray(data!.tropes), true);
      assertExists(data!.themes);
      assertEquals(Array.isArray(data!.themes), true);

      console.log(`✅ Database updated with enrichment data:`, data);
    });

    await t.step("Verify enrichment handles missing book gracefully", async () => {
      const fakeBookId = "00000000-0000-0000-0000-000000000000";

      const response = await fetch(`${supabaseUrl}/functions/v1/enrich-metadata`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ book_id: fakeBookId }),
      });

      const result = await response.json();

      assertEquals(response.status, 404);
      assertEquals(result.success, false);
      assertEquals(result.error, "Book not found");
    });

    await t.step("Clean up test book", async () => {
      const { error } = await supabase.from("books").delete().eq("id", testBookId);

      assertEquals(error, null);
      console.log(`✅ Test book cleaned up`);
    });
  },
});
