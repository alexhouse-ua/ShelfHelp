/**
 * Unit tests for priority scoring algorithm
 */
import { assertEquals, assertExists } from "jsr:@std/assert@1";
import {
  calculateDeadlineUrgencyFactor,
  calculateHypeSignalFactor,
  calculatePriorityScore,
  calculateReadingSpeedFactor,
  DEFAULT_WEIGHTS,
  type ScoringWeights,
} from "./priority-scoring.ts";

Deno.test("calculateReadingSpeedFactor - returns 0.5 for null page count", () => {
  const result = calculateReadingSpeedFactor(null, 50);
  assertEquals(result, 0.5);
});

Deno.test("calculateReadingSpeedFactor - returns 0.5 for zero page count", () => {
  const result = calculateReadingSpeedFactor(0, 50);
  assertEquals(result, 0.5);
});

Deno.test("calculateReadingSpeedFactor - returns 0.5 for zero reading pace", () => {
  const result = calculateReadingSpeedFactor(300, 0);
  assertEquals(result, 0.5);
});

Deno.test("calculateReadingSpeedFactor - fast book (100 pages, 50 pages/day) scores high", () => {
  const result = calculateReadingSpeedFactor(100, 50);
  // 100 pages / 50 pages per day = 2 days
  // 2 days / 30 days = 0.067
  // 1 - 0.067 = 0.933
  assertEquals(Math.round(result * 100) / 100, 0.93);
});

Deno.test("calculateReadingSpeedFactor - slow book (1500 pages, 50 pages/day) scores low", () => {
  const result = calculateReadingSpeedFactor(1500, 50);
  // 1500 pages / 50 pages per day = 30 days
  // 30 days / 30 days = 1.0
  // 1 - 1.0 = 0.0
  assertEquals(result, 0);
});

Deno.test("calculateReadingSpeedFactor - clamps score to [0, 1] range", () => {
  // Very long book should not produce negative score
  const longBook = calculateReadingSpeedFactor(5000, 50);
  assertEquals(longBook, 0);

  // Very short book should not exceed 1.0
  const shortBook = calculateReadingSpeedFactor(10, 50);
  assertEquals(shortBook <= 1.0, true);
});

Deno.test("calculateDeadlineUrgencyFactor - returns 0 for null deadline", () => {
  const result = calculateDeadlineUrgencyFactor(null);
  assertEquals(result, 0);
});

Deno.test("calculateDeadlineUrgencyFactor - returns 1 for past deadline", () => {
  const pastDeadline = new Date();
  pastDeadline.setDate(pastDeadline.getDate() - 5);
  const result = calculateDeadlineUrgencyFactor(pastDeadline);
  assertEquals(result, 1);
});

Deno.test("calculateDeadlineUrgencyFactor - returns high score for near deadline (5 days)", () => {
  const nearDeadline = new Date();
  nearDeadline.setDate(nearDeadline.getDate() + 5);
  const result = calculateDeadlineUrgencyFactor(nearDeadline);
  // 1 - (5 / 30) = 1 - 0.167 = 0.833
  assertEquals(Math.round(result * 100) / 100, 0.83);
});

Deno.test("calculateDeadlineUrgencyFactor - returns low score for far deadline (30+ days)", () => {
  const farDeadline = new Date();
  farDeadline.setDate(farDeadline.getDate() + 35);
  const result = calculateDeadlineUrgencyFactor(farDeadline);
  // 1 - (35 / 30) = 1 - 1.167 = -0.167 → max(0, -0.167) = 0
  assertEquals(result, 0);
});

Deno.test("calculateHypeSignalFactor - returns 1.0 for hyped book", () => {
  const result = calculateHypeSignalFactor(true);
  assertEquals(result, 1.0);
});

Deno.test("calculateHypeSignalFactor - returns 0.0 for non-hyped book", () => {
  const result = calculateHypeSignalFactor(false);
  assertEquals(result, 0.0);
});

Deno.test("calculatePriorityScore - integrates all factors with correct weights", async () => {
  // Mock Supabase client
  // deno-lint-ignore no-explicit-any
  const mockSupabase: any = {
    from: (_table: string) => ({
      select: () => ({
        eq: (_field: string, _value: unknown) => ({
          eq: (_field2: string, _value2: unknown) => ({
            single: () => Promise.resolve({ data: null, error: null }),
            order: () => ({
              limit: () => ({
                single: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          }),
          not: () => ({
            or: () => Promise.resolve({ data: [], error: null }),
          }),
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
  };

  const bookData = {
    bookId: "test-book-1",
    pageCount: 300,
    hypeFlag: true,
    genre: "Mystery",
    author: "Agatha Christie",
  };

  const result = await calculatePriorityScore(mockSupabase, bookData);

  assertExists(result.bookId);
  assertEquals(result.bookId, "test-book-1");
  assertExists(result.priorityScore);
  assertEquals(typeof result.priorityScore, "number");
  assertEquals(result.priorityScore >= 0, true);
  assertEquals(result.priorityScore <= 1, true);
  assertExists(result.factors);
  assertExists(result.factors.readingSpeed);
  assertExists(result.factors.deadlineUrgency);
  assertExists(result.factors.hypeSignal);
  assertExists(result.factors.preferenceAlignment);
});

Deno.test("calculatePriorityScore - uses custom weights correctly", async () => {
  // Mock Supabase client with no deadline, no similar books
  // deno-lint-ignore no-explicit-any
  const mockSupabase: any = {
    from: () => ({
      select: () => ({
        eq: (_field: string, _value: unknown) => ({
          eq: (_field2: string, _value2: unknown) => ({
            single: () => Promise.resolve({ data: null, error: null }),
            order: () => ({
              limit: () => ({
                single: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          }),
          not: () => ({
            or: () => Promise.resolve({ data: [], error: null }),
          }),
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
  };

  const bookData = {
    bookId: "test-book-2",
    pageCount: 100,
    hypeFlag: false,
    genre: "Fiction",
    author: "Test Author",
  };

  // Custom weights heavily favoring reading speed
  const customWeights: ScoringWeights = {
    readingSpeed: 0.7,
    deadlineUrgency: 0.1,
    hypeSignal: 0.1,
    preferenceAlignment: 0.1,
  };

  const result = await calculatePriorityScore(mockSupabase, bookData, customWeights);

  // With no deadline (0), no hype (0), neutral preference (0.5)
  // Reading speed for 100 pages at 50 pages/day ≈ 0.93
  // Score = 0.70 * 0.93 + 0.10 * 0 + 0.10 * 0 + 0.10 * 0.5
  // Score = 0.651 + 0 + 0 + 0.05 = 0.701
  assertEquals(Math.round(result.priorityScore * 100) / 100 >= 0.65, true);
  assertEquals(Math.round(result.priorityScore * 100) / 100 <= 0.75, true);
});

Deno.test("calculatePriorityScore - handles edge case with all zero factors", async () => {
  // Mock Supabase client
  // deno-lint-ignore no-explicit-any
  const mockSupabase: any = {
    from: () => ({
      select: () => ({
        eq: (_field: string, _value: unknown) => ({
          eq: (_field2: string, _value2: unknown) => ({
            single: () => Promise.resolve({ data: null, error: null }),
            order: () => ({
              limit: () => ({
                single: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          }),
          not: () => ({
            or: () => Promise.resolve({ data: [], error: null }),
          }),
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
  };

  const bookData = {
    bookId: "test-book-zero",
    pageCount: null, // Reading speed = 0.5 (neutral)
    hypeFlag: false, // Hype = 0
    genre: null, // Preference = 0.5 (neutral)
    author: null,
  };

  const result = await calculatePriorityScore(mockSupabase, bookData);

  // Score = 0.10 * 0.5 + 0.40 * 0 + 0.25 * 0 + 0.25 * 0.5
  // Score = 0.05 + 0 + 0 + 0.125 = 0.175
  assertEquals(result.priorityScore >= 0, true);
  assertEquals(result.priorityScore <= 1, true);
});

Deno.test("DEFAULT_WEIGHTS - sum to 1.0", () => {
  const sum = DEFAULT_WEIGHTS.readingSpeed +
    DEFAULT_WEIGHTS.deadlineUrgency +
    DEFAULT_WEIGHTS.hypeSignal +
    DEFAULT_WEIGHTS.preferenceAlignment;

  assertEquals(sum, 1.0);
});

Deno.test("DEFAULT_WEIGHTS - values match specification", () => {
  assertEquals(DEFAULT_WEIGHTS.readingSpeed, 0.1);
  assertEquals(DEFAULT_WEIGHTS.deadlineUrgency, 0.4);
  assertEquals(DEFAULT_WEIGHTS.hypeSignal, 0.25);
  assertEquals(DEFAULT_WEIGHTS.preferenceAlignment, 0.25);
});
