/**
 * Integration tests for Story 1.2: Conversational Book Addition
 * Run: deno test --allow-net --allow-env --allow-read tests/book_addition_test.ts
 */

import { assertEquals, assertExists } from "jsr:@std/assert@1";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { extractBookInfo } from "../supabase/functions/_shared/gemini-client.ts";
import { searchBook } from "../supabase/functions/_shared/book-search.ts";
import { validateBookInput } from "../supabase/functions/_shared/input-validator.ts";
import {
  cleanupState,
  getState,
  saveState,
} from "../supabase/functions/_shared/conversational-state.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "http://127.0.0.1:54321";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Test 1: Input Validation
Deno.test("Input Validation - Valid title and author", () => {
  const result = validateBookInput("The Name of the Wind", "Patrick Rothfuss");
  assertEquals(result.valid, true);
  assertExists(result.sanitized);
  assertEquals(result.sanitized.title, "The Name of the Wind");
  assertEquals(result.sanitized.author, "Patrick Rothfuss");
});

Deno.test("Input Validation - Empty title", () => {
  const result = validateBookInput("", "Patrick Rothfuss");
  assertEquals(result.valid, false);
  assertExists(result.error);
});

Deno.test("Input Validation - Title too long", () => {
  const longTitle = "A".repeat(501);
  const result = validateBookInput(longTitle, "Author");
  assertEquals(result.valid, false);
  assertExists(result.error);
});

Deno.test("Input Validation - Author too long", () => {
  const longAuthor = "A".repeat(201);
  const result = validateBookInput("Title", longAuthor);
  assertEquals(result.valid, false);
  assertExists(result.error);
});

// Test 2: Gemini Flash Intent Parser
Deno.test("Gemini Intent Parser - Extract book info", async () => {
  const result = await extractBookInfo("Add The Name of the Wind by Patrick Rothfuss");

  if ("error" in result) {
    console.log("⚠️  Gemini API unavailable, skipping test");
    return;
  }

  assertExists(result.title);
  assertExists(result.author);
  assertEquals(typeof result.confidence, "string");
});

Deno.test("Gemini Intent Parser - Handle empty input", async () => {
  const result = await extractBookInfo("");
  assertEquals("error" in result, true);
});

// Test 3: Multi-Source Book Search
Deno.test("Book Search - Search Open Library for known book", async () => {
  const result = await searchBook("The Hobbit", "J.R.R. Tolkien");

  assertEquals(result.success, true);
  assertExists(result.books);
  assertEquals(result.books!.length > 0, true);

  const book = result.books![0];
  assertExists(book.title);
  assertExists(book.author);
  assertEquals(book.sources.includes("open_library"), true);
});

Deno.test("Book Search - Handle non-existent book", async () => {
  const result = await searchBook("Nonexistent Book Title 123456789", "Unknown Author");

  assertEquals(result.success, false);
  assertExists(result.errorCode);
});

// Test 4: Conversational State Management
Deno.test("Conversational State - Save and retrieve state", async () => {
  const testChatId = 999999999;

  // Save state
  const saveResult = await saveState(
    supabase,
    testChatId,
    {
      workflow: "add_book",
      step: "selecting_book",
      extracted_title: "Test Book",
      extracted_author: "Test Author",
    },
    "test_context",
  );

  assertEquals(saveResult.success, true);

  // Retrieve state
  const state = await getState(supabase, testChatId);
  assertExists(state);
  assertEquals(state!.chat_id, testChatId);
  assertEquals(state!.state_data.workflow, "add_book");
  assertEquals(state!.state_data.extracted_title, "Test Book");

  // Cleanup
  const cleanupResult = await cleanupState(supabase, testChatId);
  assertEquals(cleanupResult.success, true);

  // Verify cleanup
  const stateAfterCleanup = await getState(supabase, testChatId);
  assertEquals(stateAfterCleanup, null);
});

Deno.test("Conversational State - Handle invalid state data", async () => {
  const testChatId = 999999998;

  const saveResult = await saveState(supabase, testChatId, null as unknown);
  assertEquals(saveResult.success, false);
  assertExists(saveResult.error);
});

// Test 5: Database Persistence
Deno.test("Database - Insert book with all fields", async () => {
  const testBook = {
    title: "Test Book for Integration Test",
    author: "Test Author",
    isbn: "1234567890123",
    page_count: 300,
    cover_image_url: "https://example.com/cover.jpg",
    goodreads_id: 12345,
    goodreads_link: "https://goodreads.com/book/show/12345",
    status: "pending",
    user_shelves: ["to-read"],
    user_date_added: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("books").insert(testBook).select().single();

  assertEquals(error, null);
  assertExists(data);
  assertEquals(data.title, testBook.title);
  assertEquals(data.author, testBook.author);
  assertEquals(data.isbn, testBook.isbn);
  assertEquals(data.goodreads_id, testBook.goodreads_id);

  // Cleanup
  if (data) {
    await supabase.from("books").delete().eq("id", data.id);
  }
});

Deno.test("Database - Lookup tables populated", async () => {
  // Test genres table
  const { data: genres, error: genresError } = await supabase.from("genres").select("*").limit(5);

  assertEquals(genresError, null);
  assertExists(genres);
  assertEquals(genres!.length > 0, true);

  // Test subgenres table
  const { data: subgenres, error: subgenresError } = await supabase
    .from("subgenres")
    .select("*")
    .limit(5);

  assertEquals(subgenresError, null);
  assertExists(subgenres);
  assertEquals(subgenres!.length > 0, true);

  // Test spice_levels table
  const { data: spiceLevels, error: spiceError } = await supabase.from("spice_levels").select("*");

  assertEquals(spiceError, null);
  assertExists(spiceLevels);
  assertEquals(spiceLevels!.length, 5); // Should have exactly 5 spice levels

  // Test recommendation_sources table
  const { data: sources, error: sourcesError } = await supabase
    .from("recommendation_sources")
    .select("*")
    .limit(5);

  assertEquals(sourcesError, null);
  assertExists(sources);
  assertEquals(sources!.length > 0, true);
});

console.log("✅ All integration tests defined");
