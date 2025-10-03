/**
 * Story 2.2: Unit tests for mood-based recommendation service
 * Tests embedding generation, search formatting, and edge cases
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  type BookSearchResult,
  formatRecommendations,
  generateMoodEmbedding,
} from "./mood-recommendation.ts";

// Mock test data
const mockSearchResults: BookSearchResult[] = [
  {
    book_id: "test-uuid-1",
    title: "Test Book 1",
    author: "Test Author 1",
    ai_summary: "This is a test summary for book 1.",
    similarity_score: 0.85,
    keyword_rank: 0.6,
    combined_score: 0.775,
  },
  {
    book_id: "test-uuid-2",
    title: "Test Book 2",
    author: "Test Author 2",
    ai_summary: null, // Test null summary handling
    similarity_score: 0.7,
    keyword_rank: 0.5,
    combined_score: 0.64,
  },
  {
    book_id: "test-uuid-3",
    title: "Test Book 3",
    author: "Test Author 3",
    ai_summary: "",
    similarity_score: 0.65,
    keyword_rank: 0.4,
    combined_score: 0.575,
  },
];

Deno.test("formatRecommendations - formats search results correctly", () => {
  const formatted = formatRecommendations(mockSearchResults);

  assertEquals(formatted.length, 3);

  // Check first result
  assertEquals(formatted[0].bookId, "test-uuid-1");
  assertEquals(formatted[0].title, "Test Book 1");
  assertEquals(formatted[0].author, "Test Author 1");
  assertEquals(formatted[0].summary, "This is a test summary for book 1.");
  assertEquals(formatted[0].relevanceScore, 78); // Rounded from 77.5

  // Check second result (null summary)
  assertEquals(formatted[1].summary, "No summary available.");

  // Check third result (empty summary)
  assertEquals(formatted[2].summary, "No summary available.");
});

Deno.test("formatRecommendations - handles empty results array", () => {
  const formatted = formatRecommendations([]);
  assertEquals(formatted.length, 0);
});

Deno.test("formatRecommendations - calculates relevance score correctly", () => {
  const testResults: BookSearchResult[] = [
    {
      book_id: "test-uuid",
      title: "Test",
      author: "Author",
      ai_summary: "Summary",
      similarity_score: 0.5,
      keyword_rank: 0.5,
      combined_score: 0.5, // Should become 50%
    },
  ];

  const formatted = formatRecommendations(testResults);
  assertEquals(formatted[0].relevanceScore, 50);
});

// Integration test for embedding generation (requires API key)
Deno.test({
  name: "generateMoodEmbedding - generates valid embedding vector",
  ignore: !Deno.env.get("GOOGLE_GEMINI_API_KEY"), // Skip if API key not set
  async fn(): Promise<void> {
    const moodText = "something light and funny";
    const requestId = "test-request-id";

    const embedding = await generateMoodEmbedding(moodText, requestId);

    assertExists(embedding);
    assertEquals(Array.isArray(embedding), true);
    assertEquals(embedding.length, 768); // Should be 768 dimensions

    // Check that values are floats in reasonable range
    embedding.forEach((value) => {
      assertEquals(typeof value, "number");
      assertEquals(value >= -1 && value <= 1, true); // Embeddings typically normalized
    });
  },
});

Deno.test("generateMoodEmbedding - rejects empty mood text", async () => {
  const requestId = "test-request-id";

  try {
    await generateMoodEmbedding("", requestId);
    throw new Error("Should have thrown error for empty mood text");
  } catch (error) {
    assertEquals((error as Error).message, "Empty mood text provided");
  }
});

Deno.test("generateMoodEmbedding - rejects whitespace-only mood text", async () => {
  const requestId = "test-request-id";

  try {
    await generateMoodEmbedding("   ", requestId);
    throw new Error("Should have thrown error for whitespace mood text");
  } catch (error) {
    assertEquals((error as Error).message, "Empty mood text provided");
  }
});
