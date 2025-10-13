/**
 * Unit Tests for Reflection Workflow
 * Story: 2.3 Post-Read Reflection
 * Task 6: Write unit tests for reflection workflow logic
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  REFLECTION_QUESTIONS,
  ReflectionState,
  sanitizeMarkdown,
  validateReflectionInput,
} from "./reflection-workflow.ts";

/**
 * Test: Reflection questions are defined
 */
Deno.test("REFLECTION_QUESTIONS should have minimum 3 questions", () => {
  assertExists(REFLECTION_QUESTIONS);
  assertEquals(REFLECTION_QUESTIONS.length >= 3, true);
});

/**
 * Test: Validate reflection input - valid input
 */
Deno.test("validateReflectionInput should accept valid input", () => {
  const validInput = "This was a great book with interesting characters.";
  const result = validateReflectionInput(validInput);
  assertEquals(result.valid, true);
  assertEquals(result.error, undefined);
});

/**
 * Test: Validate reflection input - empty input
 */
Deno.test("validateReflectionInput should reject empty input", () => {
  const emptyInput = "";
  const result = validateReflectionInput(emptyInput);
  assertEquals(result.valid, false);
  assertEquals(result.error, "Response cannot be empty");
});

/**
 * Test: Validate reflection input - whitespace only
 */
Deno.test("validateReflectionInput should reject whitespace-only input", () => {
  const whitespaceInput = "   \n\t  ";
  const result = validateReflectionInput(whitespaceInput);
  assertEquals(result.valid, false);
  assertEquals(result.error, "Response cannot be empty");
});

/**
 * Test: Validate reflection input - too long
 */
Deno.test("validateReflectionInput should reject input over 2000 characters", () => {
  const longInput = "a".repeat(2001);
  const result = validateReflectionInput(longInput);
  assertEquals(result.valid, false);
  assertEquals(result.error, "Response too long (max 2000 characters)");
});

/**
 * Test: Validate reflection input - exactly 2000 characters
 */
Deno.test("validateReflectionInput should accept exactly 2000 characters", () => {
  const maxInput = "a".repeat(2000);
  const result = validateReflectionInput(maxInput);
  assertEquals(result.valid, true);
  assertEquals(result.error, undefined);
});

/**
 * Test: Sanitize markdown input
 */
Deno.test("sanitizeMarkdown should escape special characters", () => {
  const input = "This is *bold* and _italic_ with `code` and [link]";
  const sanitized = sanitizeMarkdown(input);
  assertEquals(sanitized, "This is \\*bold\\* and \\_italic\\_ with \\`code\\` and \\[link\\]");
});

/**
 * Test: Sanitize markdown - trim whitespace
 */
Deno.test("sanitizeMarkdown should trim whitespace", () => {
  const input = "  Some text with spaces  \n";
  const sanitized = sanitizeMarkdown(input);
  assertEquals(sanitized, "Some text with spaces");
});

/**
 * Test: ReflectionState annotation structure
 */
Deno.test("ReflectionState should have required fields", () => {
  const stateSpec = ReflectionState.spec;
  assertExists(stateSpec.book_id);
  assertExists(stateSpec.chat_id);
  assertExists(stateSpec.book_title);
  assertExists(stateSpec.book_author);
  assertExists(stateSpec.current_question);
  assertExists(stateSpec.responses);
  assertExists(stateSpec.retry_count);
  assertExists(stateSpec.completed);
  assertExists(stateSpec.error);
});

