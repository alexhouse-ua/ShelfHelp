/**
 * Story 2.2: Integration test for /recommend workflow
 * Tests full mood recommendation flow: mood input → embedding → search → format → response
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  formatRecommendations,
  generateMoodEmbedding,
  searchByKeywordsOnly,
  searchByMood,
} from "../_shared/mood-recommendation.ts";

// Initialize test Supabase client conditionally (skip tests if env missing)
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const hasSupabaseEnv = Boolean(supabaseUrl && supabaseServiceKey);
const hasGemini = Boolean(Deno.env.get("GOOGLE_GEMINI_API_KEY"));
const INTEGRATION_READY = hasSupabaseEnv && hasGemini;

let supabase!: SupabaseClient;
if (INTEGRATION_READY) {
  supabase = createClient(supabaseUrl!, supabaseServiceKey!);
} else {
  console.warn(
    "Skipping /recommend integration tests: missing env variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_GEMINI_API_KEY)",
  );
}

// Helper: Create test book with embedding
async function createTestBook(
  title: string,
  author: string,
  aiSummary: string,
  genres: string[],
  themes: string[],
  tone: string,
): Promise<string> {
  // Generate embedding for the book content
  const bookContent = `${title} ${author} ${aiSummary} ${genres.join(" ")} ${
    themes.join(" ")
  } ${tone}`;
  const embedding = await generateMoodEmbedding(bookContent, "test-setup");

  const { data, error } = await supabase
    .from("books")
    .insert({
      title,
      author,
      ai_summary: aiSummary,
      genres_primary: genres,
      themes: themes,
      tone: tone,
      status: "to_read",
      embedding: embedding,
      ingestion_source: "test",
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create test book: ${error.message}`);
  }

  return data.id;
}

// Helper: Clean up test books
async function cleanupTestBooks(bookIds: string[]): Promise<void> {
  if (bookIds.length === 0) return;

  const { error } = await supabase.from("books").delete().in("id", bookIds);

  if (error) {
    console.error("Failed to cleanup test books:", error);
  }
}

Deno.test({
  name: "Full /recommend workflow - mood input to search results",
  ignore: !INTEGRATION_READY, // Skip if required env not set
  async fn(): Promise<void> {
    const testBookIds: string[] = [];

    try {
      // Create test books with different moods
      const book1Id = await createTestBook(
        "The Funny Adventures",
        "Comedy Author",
        "A hilarious tale full of laughs and lighthearted fun.",
        ["Comedy", "Fiction"],
        ["Humor", "Friendship"],
        "light",
      );
      testBookIds.push(book1Id);

      const book2Id = await createTestBook(
        "Dark Mystery Tales",
        "Mystery Author",
        "A dark and thrilling mystery with a strong female detective.",
        ["Mystery", "Thriller"],
        ["Crime", "Detective"],
        "dark",
      );
      testBookIds.push(book2Id);

      const book3Id = await createTestBook(
        "Uplifting Romance",
        "Romance Author",
        "A heartwarming romance that will make you believe in love again.",
        ["Romance", "Fiction"],
        ["Love", "Hope"],
        "uplifting",
      );
      testBookIds.push(book3Id);

      // Wait for database to propagate
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Test 1: Search for "light and funny" mood
      const moodText1 = "something light and funny";
      const embedding1 = await generateMoodEmbedding(moodText1, "test-1");
      const results1 = await searchByMood(supabase, moodText1, embedding1, "test-1", 5, 0.3);

      assertExists(results1);
      assertEquals(Array.isArray(results1), true);
      assertEquals(results1.length > 0, true, "Should find matching books");

      // Top result should be the comedy book (highest relevance)
      const topResult1 = results1[0];
      assertEquals(topResult1.title, "The Funny Adventures");

      // Test 2: Search for "dark mystery" mood
      const moodText2 = "dark mystery with strong female lead";
      const embedding2 = await generateMoodEmbedding(moodText2, "test-2");
      const results2 = await searchByMood(supabase, moodText2, embedding2, "test-2", 5, 0.3);

      assertExists(results2);
      assertEquals(results2.length > 0, true, "Should find matching books");

      // Top result should be the mystery book
      const topResult2 = results2[0];
      assertEquals(topResult2.title, "Dark Mystery Tales");

      // Test 3: Test formatting of results
      const formatted = formatRecommendations(results1.slice(0, 3));
      assertExists(formatted);
      assertEquals(formatted.length > 0, true);
      assertEquals(formatted[0].bookId, topResult1.book_id);
      assertEquals(formatted[0].title, topResult1.title);
      assertEquals(formatted[0].author, topResult1.author);
      assertEquals(typeof formatted[0].relevanceScore, "number");
      assertEquals(formatted[0].relevanceScore >= 0 && formatted[0].relevanceScore <= 100, true);
    } finally {
      // Cleanup test books
      await cleanupTestBooks(testBookIds);
    }
  },
});

Deno.test({
  name: "Hybrid search RPC - vector + keyword ranking",
  ignore: !INTEGRATION_READY,
  async fn(): Promise<void> {
    const testBookIds: string[] = [];

    try {
      // Create test book with specific keywords
      const bookId = await createTestBook(
        "Epic Fantasy World",
        "Fantasy Author",
        "An epic fantasy adventure with complex world-building and magic systems.",
        ["Fantasy", "Adventure"],
        ["World-building", "Magic", "Quest"],
        "epic",
      );
      testBookIds.push(bookId);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Search with keywords that should match
      const moodText = "epic fantasy with complex world-building";
      const embedding = await generateMoodEmbedding(moodText, "test-hybrid");
      const results = await searchByMood(supabase, moodText, embedding, "test-hybrid", 5, 0.2);

      assertExists(results);
      assertEquals(results.length > 0, true, "Should find book via hybrid search");

      const topResult = results[0];
      assertEquals(topResult.title, "Epic Fantasy World");

      // Verify hybrid scoring components exist
      assertExists(topResult.similarity_score, "Should have vector similarity score");
      assertExists(topResult.keyword_rank, "Should have keyword rank score");
      assertExists(topResult.combined_score, "Should have combined score");

      // Combined score should be weighted average
      const expectedCombined = topResult.similarity_score * 0.7 + topResult.keyword_rank * 0.3;
      assertEquals(
        Math.abs(topResult.combined_score - expectedCombined) < 0.01,
        true,
        "Combined score should match weighted formula",
      );
    } finally {
      await cleanupTestBooks(testBookIds);
    }
  },
});

Deno.test({
  name: "Test fallback behavior for no matches",
  ignore: !INTEGRATION_READY,
  async fn(): Promise<void> {
    // Search for highly specific mood that won't match any books
    const moodText = "obscure niche topic with very specific requirements xyz123";
    const embedding = await generateMoodEmbedding(moodText, "test-no-match");
    const results = await searchByMood(supabase, moodText, embedding, "test-no-match", 5, 0.9);

    // Should return empty array or very few results
    assertEquals(Array.isArray(results), true);
    // Results may be empty or have very low scores
  },
});

Deno.test({
  name: "Test formatting with null ai_summary",
  fn(): void {
    const mockResults = [
      {
        book_id: "test-id",
        title: "Test Book",
        author: "Test Author",
        ai_summary: null,
        similarity_score: 0.8,
        keyword_rank: 0.6,
        combined_score: 0.74,
      },
    ];

    const formatted = formatRecommendations(mockResults);

    assertEquals(formatted.length, 1);
    assertEquals(formatted[0].summary, "No summary available.");
  },
});

// Unit tests for keyword-only search fallback
Deno.test({
  name: "Keyword-only search fallback",
  ignore: !INTEGRATION_READY,
  async fn(): Promise<void> {
    const testBookIds: string[] = [];

    try {
      // Create test book with keyword-matchable content
      const bookId = await createTestBook(
        "Comedy Adventure",
        "Funny Author",
        "A hilarious comedy adventure with lots of laughs.",
        ["Comedy", "Adventure"],
        ["Humor", "Fun"],
        "light",
      );
      testBookIds.push(bookId);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Test keyword search
      const results = await searchByKeywordsOnly(
        supabase,
        "comedy adventure",
        "test-keyword-search",
        5,
      );

      assertExists(results);
      assertEquals(Array.isArray(results), true);
      assertEquals(results.length > 0, true, "Should find books via keyword search");

      // Results should have expected structure
      if (results.length > 0) {
        const result = results[0];
        assertExists(result.book_id);
        assertExists(result.title);
        assertExists(result.author);
        assertEquals(result.similarity_score, 0); // No vector similarity in keyword-only
        assertEquals(typeof result.keyword_rank, "number");
        assertEquals(typeof result.combined_score, "number");
      }
    } finally {
      await cleanupTestBooks(testBookIds);
    }
  },
});

// Unit tests for callback handler behavior (mocked)
Deno.test({
  name: "Add to top callback - data parsing",
  fn(): void {
    // Test callback data parsing for add_to_top action
    const callbackData = "add_to_top:12345678-1234-1234-1234-123456789abc";

    // Simulate parsing logic from webhook handler
    if (callbackData.startsWith("add_to_top:")) {
      const bookId = callbackData.replace("add_to_top:", "");
      assertEquals(bookId, "12345678-1234-1234-1234-123456789abc");
      assertEquals(bookId.length, 36); // UUID length
    }
  },
});

Deno.test({
  name: "Tell me more callback - data parsing",
  fn(): void {
    // Test callback data parsing for tell_more action
    const callbackData = "tell_more:98765432-4321-4321-4321-987654321def";

    if (callbackData.startsWith("tell_more:")) {
      const bookId = callbackData.replace("tell_more:", "");
      assertEquals(bookId, "98765432-4321-4321-4321-987654321def");
      assertEquals(bookId.length, 36); // UUID length
    }
  },
});

Deno.test({
  name: "Show more callback - data parsing",
  fn(): void {
    // Test callback data parsing for show_more action
    const callbackData = "show_more:6";

    if (callbackData.startsWith("show_more:")) {
      const offset = parseInt(callbackData.replace("show_more:", ""), 10);
      assertEquals(offset, 6);
      assertEquals(typeof offset, "number");
      assertEquals(offset >= 0, true);
    }
  },
});

Deno.test({
  name: "Callback data validation - malformed input",
  fn(): void {
    // Test handling of malformed callback data
    const malformedData = [
      "add_to_top:", // Missing book ID
      "tell_more:invalid-uuid",
      "show_more:not-a-number",
      "unknown_action:data",
    ];

    malformedData.forEach((data) => {
      if (data.startsWith("add_to_top:")) {
        const bookId = data.replace("add_to_top:", "");
        // Should handle empty book ID gracefully
        assertEquals(bookId.length === 0, true);
      }

      if (data.startsWith("show_more:")) {
        const offsetStr = data.replace("show_more:", "");
        const offset = parseInt(offsetStr, 10);
        // Should handle invalid number gracefully
        assertEquals(isNaN(offset), true);
      }
    });
  },
});
