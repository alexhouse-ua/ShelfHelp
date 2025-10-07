/**
 * Integration tests for YAML lookup data seeding
 *
 * Run conditions:
 * - Local Supabase running OR TEST_SEED_LOOKUP_DATA_LIVE=1 set
 *
 * To run:
 * 1. Start Supabase locally: supabase start
 * 2. Run: deno test -A tests/seed_lookup_data_test.ts
 *
 * These tests are OPTIONAL and skipped in CI.
 */
import { assertEquals, assertExists } from "jsr:@std/assert@1";

function shouldRunIntegrationTests(): boolean {
  // Skip in CI unless explicitly enabled
  if (Deno.env.get("CI") === "true" && Deno.env.get("TEST_SEED_LOOKUP_DATA_LIVE") !== "1") {
    return false;
  }

  const liveFlag = Deno.env.get("TEST_SEED_LOOKUP_DATA_LIVE");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const isLocalSupabase = supabaseUrl?.includes("127.0.0.1:54321");

  return liveFlag === "1" || isLocalSupabase === true;
}

Deno.test({
  name: "Seed Lookup Data Integration Tests",
  ignore: !shouldRunIntegrationTests(),
  fn: async (t) => {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      console.log("⏭️  Skipping: Missing environment variables");
      return;
    }

    await t.step("Seed lookup tables from YAML files", async () => {
      const response = await fetch(`${supabaseUrl}/functions/v1/seed-lookup-data`, {
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
      assertExists(result.genresInserted);
      assertExists(result.subgenresInserted);
      assertExists(result.spiceLevelsInserted);
      assertExists(result.tropesInserted);
      assertExists(result.recommendationSourcesInserted);

      console.log(`✅ Lookup data seeded:`, result);
    });

    await t.step("Verify genres table populated", async () => {
      const { createClient } = await import("jsr:@supabase/supabase-js@2");
      const supabase = createClient(supabaseUrl!, supabaseKey!);

      const { data, error } = await supabase.from("genres").select("id, name").limit(5);

      assertEquals(error, null);
      assertExists(data);
      assertEquals(Array.isArray(data), true);
      assertEquals(data!.length > 0, true);
    });

    await t.step("Verify subgenres table populated", async () => {
      const { createClient } = await import("jsr:@supabase/supabase-js@2");
      const supabase = createClient(supabaseUrl!, supabaseKey!);

      const { data, error } = await supabase
        .from("subgenres")
        .select("id, name, genre_id")
        .limit(5);

      assertEquals(error, null);
      assertExists(data);
      assertEquals(data!.length > 0, true);
    });

    await t.step("Verify spice_levels table populated", async () => {
      const { createClient } = await import("jsr:@supabase/supabase-js@2");
      const supabase = createClient(supabaseUrl!, supabaseKey!);

      const { data, error } = await supabase
        .from("spice_levels")
        .select("id, label, description")
        .limit(5);

      assertEquals(error, null);
      assertExists(data);
      assertEquals(data!.length > 0, true);
    });

    await t.step("Verify tropes table populated", async () => {
      const { createClient } = await import("jsr:@supabase/supabase-js@2");
      const supabase = createClient(supabaseUrl!, supabaseKey!);

      const { data, error } = await supabase.from("tropes").select("id, name, genre_id").limit(5);

      assertEquals(error, null);
      assertExists(data);
      assertEquals(data!.length > 0, true);
    });

    await t.step("Verify recommendation_sources table populated", async () => {
      const { createClient } = await import("jsr:@supabase/supabase-js@2");
      const supabase = createClient(supabaseUrl!, supabaseKey!);

      const { data, error } = await supabase
        .from("recommendation_sources")
        .select("id, name, url, scope, categories, priority")
        .limit(5);

      assertEquals(error, null);
      assertExists(data);
      assertEquals(data!.length > 0, true);
    });

    await t.step("Verify idempotency: re-run seeding should not fail", async () => {
      const response = await fetch(`${supabaseUrl}/functions/v1/seed-lookup-data`, {
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

      console.log(`✅ Idempotency verified:`, result);
    });
  },
});
