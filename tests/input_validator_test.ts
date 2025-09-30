/**
 * Comprehensive unit tests for input validation and sanitization utilities
 * @module input-validator-test
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import {
  validateBookInput,
  sanitizeErrorMessage,
  type ValidationResult,
} from "../src/input_validator.ts";

// ============================================================================
// validateBookInput() Tests
// ============================================================================

Deno.test("validateBookInput - happy path with valid title and author", () => {
  const result = validateBookInput("The Great Gatsby", "F. Scott Fitzgerald");
  
  assertEquals(result.valid, true);
  assertExists(result.sanitized);
  assertEquals(result.sanitized.title, "The Great Gatsby");
  assertEquals(result.sanitized.author, "F. Scott Fitzgerald");
  assertEquals(result.error, undefined);
});

Deno.test("validateBookInput - valid title with empty author", () => {
  const result = validateBookInput("1984", "");
  
  assertEquals(result.valid, true);
  assertExists(result.sanitized);
  assertEquals(result.sanitized.title, "1984");
  assertEquals(result.sanitized.author, "");
  assertEquals(result.error, undefined);
});

Deno.test("validateBookInput - trims whitespace from title", () => {
  const result = validateBookInput("  Clean Code  ", "Robert C. Martin");
  
  assertEquals(result.valid, true);
  assertExists(result.sanitized);
  assertEquals(result.sanitized.title, "Clean Code");
  assertEquals(result.sanitized.author, "Robert C. Martin");
});

Deno.test("validateBookInput - trims whitespace from author", () => {
  const result = validateBookInput("Design Patterns", "  Gang of Four  ");
  
  assertEquals(result.valid, true);
  assertExists(result.sanitized);
  assertEquals(result.sanitized.title, "Design Patterns");
  assertEquals(result.sanitized.author, "Gang of Four");
});

Deno.test("validateBookInput - trims whitespace from both title and author", () => {
  const result = validateBookInput("  The Pragmatic Programmer  ", "  Andrew Hunt  ");
  
  assertEquals(result.valid, true);
  assertExists(result.sanitized);
  assertEquals(result.sanitized.title, "The Pragmatic Programmer");
  assertEquals(result.sanitized.author, "Andrew Hunt");
});

Deno.test("validateBookInput - removes control characters from title", () => {
  const result = validateBookInput("Test\x00Book\x1FTitle", "Author Name");
  
  assertEquals(result.valid, true);
  assertExists(result.sanitized);
  assertEquals(result.sanitized.title, "TestBookTitle");
  assertEquals(result.sanitized.author, "Author Name");
});

Deno.test("validateBookInput - removes control characters from author", () => {
  const result = validateBookInput("Book Title", "Auth\x00or\x7FName");
  
  assertEquals(result.valid, true);
  assertExists(result.sanitized);
  assertEquals(result.sanitized.title, "Book Title");
  assertEquals(result.sanitized.author, "AuthorName");
});

Deno.test("validateBookInput - normalizes multiple spaces to single space in title", () => {
  const result = validateBookInput("The    Book    With    Spaces", "Author");
  
  assertEquals(result.valid, true);
  assertExists(result.sanitized);
  assertEquals(result.sanitized.title, "The Book With Spaces");
});

Deno.test("validateBookInput - normalizes multiple spaces to single space in author", () => {
  const result = validateBookInput("Book", "John    Doe    Smith");
  
  assertEquals(result.valid, true);
  assertExists(result.sanitized);
  assertEquals(result.sanitized.author, "John Doe Smith");
});

Deno.test("validateBookInput - normalizes tabs and newlines to single space", () => {
  const result = validateBookInput("Book\t\nWith\nTabs", "Author\t\tName");
  
  assertEquals(result.valid, true);
  assertExists(result.sanitized);
  assertEquals(result.sanitized.title, "Book With Tabs");
  assertEquals(result.sanitized.author, "Author Name");
});

Deno.test("validateBookInput - preserves valid punctuation in title", () => {
  const result = validateBookInput("Harry Potter & the Philosopher's Stone\\!", "J.K. Rowling");
  
  assertEquals(result.valid, true);
  assertExists(result.sanitized);
  assertEquals(result.sanitized.title, "Harry Potter & the Philosopher's Stone\\!");
  assertEquals(result.sanitized.author, "J.K. Rowling");
});

Deno.test("validateBookInput - handles unicode characters correctly", () => {
  const result = validateBookInput("Les Misérables", "Victor Hugo");
  
  assertEquals(result.valid, true);
  assertExists(result.sanitized);
  assertEquals(result.sanitized.title, "Les Misérables");
  assertEquals(result.sanitized.author, "Victor Hugo");
});

Deno.test("validateBookInput - handles emojis in title", () => {
  const result = validateBookInput("The Book 📚 of Knowledge", "Smart Author");
  
  assertEquals(result.valid, true);
  assertExists(result.sanitized);
  assertEquals(result.sanitized.title, "The Book 📚 of Knowledge");
});

Deno.test("validateBookInput - handles special characters in author names", () => {
  const result = validateBookInput("Book Title", "O'Brien-Smith, Jr.");
  
  assertEquals(result.valid, true);
  assertExists(result.sanitized);
  assertEquals(result.sanitized.author, "O'Brien-Smith, Jr.");
});

// Edge Cases - Empty/Null/Whitespace Title
Deno.test("validateBookInput - rejects empty string title", () => {
  const result = validateBookInput("", "Author Name");
  
  assertEquals(result.valid, false);
  assertEquals(result.error, "Title is required");
  assertEquals(result.sanitized, undefined);
});

Deno.test("validateBookInput - rejects whitespace-only title", () => {
  const result = validateBookInput("   ", "Author Name");
  
  assertEquals(result.valid, false);
  assertEquals(result.error, "Title is required");
  assertEquals(result.sanitized, undefined);
});

Deno.test("validateBookInput - rejects title with only tabs and newlines", () => {
  const result = validateBookInput("\t\n\r", "Author Name");
  
  assertEquals(result.valid, false);
  assertEquals(result.error, "Title is required");
  assertEquals(result.sanitized, undefined);
});

Deno.test("validateBookInput - rejects title with only control characters", () => {
  const result = validateBookInput("\x00\x01\x1F", "Author Name");
  
  assertEquals(result.valid, false);
  assertEquals(result.error, "Title is required");
  assertEquals(result.sanitized, undefined);
});

// Length Validation Tests
Deno.test("validateBookInput - accepts title at max length (500 chars)", () => {
  const maxLengthTitle = "A".repeat(500);
  const result = validateBookInput(maxLengthTitle, "Author");
  
  assertEquals(result.valid, true);
  assertExists(result.sanitized);
  assertEquals(result.sanitized.title.length, 500);
});

Deno.test("validateBookInput - rejects title over max length (501 chars)", () => {
  const tooLongTitle = "A".repeat(501);
  const result = validateBookInput(tooLongTitle, "Author");
  
  assertEquals(result.valid, false);
  assertEquals(result.error, "Title too long (max 500 characters)");
  assertEquals(result.sanitized, undefined);
});

Deno.test("validateBookInput - rejects title over max length after trimming", () => {
  const tooLongTitle = "  " + "A".repeat(501) + "  ";
  const result = validateBookInput(tooLongTitle, "Author");
  
  assertEquals(result.valid, false);
  assertEquals(result.error, "Title too long (max 500 characters)");
});

Deno.test("validateBookInput - accepts title at boundary (499 chars)", () => {
  const boundaryTitle = "A".repeat(499);
  const result = validateBookInput(boundaryTitle, "Author");
  
  assertEquals(result.valid, true);
  assertExists(result.sanitized);
});

Deno.test("validateBookInput - accepts author at max length (200 chars)", () => {
  const maxLengthAuthor = "B".repeat(200);
  const result = validateBookInput("Title", maxLengthAuthor);
  
  assertEquals(result.valid, true);
  assertExists(result.sanitized);
  assertEquals(result.sanitized.author.length, 200);
});

Deno.test("validateBookInput - rejects author over max length (201 chars)", () => {
  const tooLongAuthor = "B".repeat(201);
  const result = validateBookInput("Title", tooLongAuthor);
  
  assertEquals(result.valid, false);
  assertEquals(result.error, "Author name too long (max 200 characters)");
  assertEquals(result.sanitized, undefined);
});

Deno.test("validateBookInput - rejects author over max length after trimming", () => {
  const tooLongAuthor = "  " + "B".repeat(201) + "  ";
  const result = validateBookInput("Title", tooLongAuthor);
  
  assertEquals(result.valid, false);
  assertEquals(result.error, "Author name too long (max 200 characters)");
});

Deno.test("validateBookInput - accepts author at boundary (199 chars)", () => {
  const boundaryAuthor = "B".repeat(199);
  const result = validateBookInput("Title", boundaryAuthor);
  
  assertEquals(result.valid, true);
  assertExists(result.sanitized);
});

// Author Edge Cases
Deno.test("validateBookInput - handles null author gracefully", () => {
  const result = validateBookInput("Book Title", null as any);
  
  assertEquals(result.valid, true);
  assertExists(result.sanitized);
  assertEquals(result.sanitized.author, "");
});

Deno.test("validateBookInput - handles undefined author gracefully", () => {
  const result = validateBookInput("Book Title", undefined as any);
  
  assertEquals(result.valid, true);
  assertExists(result.sanitized);
  assertEquals(result.sanitized.author, "");
});

Deno.test("validateBookInput - handles whitespace-only author", () => {
  const result = validateBookInput("Book Title", "   ");
  
  assertEquals(result.valid, true);
  assertExists(result.sanitized);
  assertEquals(result.sanitized.author, "");
});

// Combined Edge Cases
Deno.test("validateBookInput - validates title length before author length", () => {
  const tooLongTitle = "A".repeat(501);
  const tooLongAuthor = "B".repeat(201);
  const result = validateBookInput(tooLongTitle, tooLongAuthor);
  
  // Should fail on title first
  assertEquals(result.valid, false);
  assertEquals(result.error, "Title too long (max 500 characters)");
});

Deno.test("validateBookInput - complex sanitization scenario", () => {
  const dirtyTitle = "  \x00The\t\t  Book\nOf   \x1FKnowledge  ";
  const dirtyAuthor = "  John\x00   \t\nDoe\x7F  ";
  const result = validateBookInput(dirtyTitle, dirtyAuthor);
  
  assertEquals(result.valid, true);
  assertExists(result.sanitized);
  assertEquals(result.sanitized.title, "The Book Of Knowledge");
  assertEquals(result.sanitized.author, "John Doe");
});

Deno.test("validateBookInput - single character title", () => {
  const result = validateBookInput("X", "Author");
  
  assertEquals(result.valid, true);
  assertExists(result.sanitized);
  assertEquals(result.sanitized.title, "X");
});

Deno.test("validateBookInput - single character author", () => {
  const result = validateBookInput("Title", "Y");
  
  assertEquals(result.valid, true);
  assertExists(result.sanitized);
  assertEquals(result.sanitized.author, "Y");
});

Deno.test("validateBookInput - numeric title", () => {
  const result = validateBookInput("1984", "George Orwell");
  
  assertEquals(result.valid, true);
  assertExists(result.sanitized);
  assertEquals(result.sanitized.title, "1984");
});

Deno.test("validateBookInput - title with leading/trailing special characters", () => {
  const result = validateBookInput("...Title...", "Author");
  
  assertEquals(result.valid, true);
  assertExists(result.sanitized);
  assertEquals(result.sanitized.title, "...Title...");
});

// ============================================================================
// sanitizeErrorMessage() Tests
// ============================================================================

Deno.test("sanitizeErrorMessage - sanitizes API key parameter", () => {
  const error = "Request failed: key=abc123def456"; // gitleaks:allow
  const result = sanitizeErrorMessage(error);
  
  assertEquals(result, "Request failed: key=***");
});

Deno.test("sanitizeErrorMessage - sanitizes multiple API keys", () => {
  const error = "Error: key=abc123 and key=xyz789";
  const result = sanitizeErrorMessage(error);
  
  assertEquals(result, "Error: key=*** and key=***");
});

Deno.test("sanitizeErrorMessage - sanitizes case-insensitive key parameter", () => {
  const error = "Failed with KEY=secret123 and Key=another456";
  const result = sanitizeErrorMessage(error);
  
  assertEquals(result, "Failed with KEY=*** and Key=***");
});

Deno.test("sanitizeErrorMessage - sanitizes token parameter", () => {
  const error = "Authentication failed: token=mytoken12345";
  const result = sanitizeErrorMessage(error);
  
  assertEquals(result, "Authentication failed: token=***");
});

Deno.test("sanitizeErrorMessage - sanitizes multiple tokens", () => {
  const error = "token=first123 token=second456";
  const result = sanitizeErrorMessage(error);
  
  assertEquals(result, "token=*** token=***");
});

Deno.test("sanitizeErrorMessage - sanitizes case-insensitive token parameter", () => {
  const error = "TOKEN=secret123 Token=another456";
  const result = sanitizeErrorMessage(error);
  
  assertEquals(result, "TOKEN=*** Token=***");
});

Deno.test("sanitizeErrorMessage - sanitizes Bearer token", () => {
  const error = "Unauthorized: Bearer abc123def456ghi789";
  const result = sanitizeErrorMessage(error);
  
  assertEquals(result, "Unauthorized: Bearer ***");
});

Deno.test("sanitizeErrorMessage - sanitizes multiple Bearer tokens", () => {
  const error = "Bearer token123 and Bearer token456";
  const result = sanitizeErrorMessage(error);
  
  assertEquals(result, "Bearer *** and Bearer ***");
});

Deno.test("sanitizeErrorMessage - sanitizes case-insensitive Bearer token", () => {
  const error = "bearer secret123 BEARER secret456";
  const result = sanitizeErrorMessage(error);
  
  assertEquals(result, "bearer *** BEARER ***");
});

Deno.test("sanitizeErrorMessage - sanitizes generic 32-char API key pattern", () => {
  const error = "API Key: ABCDEFGHIJKLMNOPQRSTUVWXYZ123456";
  const result = sanitizeErrorMessage(error);
  
  assertEquals(result, "API Key: ***");
});

Deno.test("sanitizeErrorMessage - sanitizes longer API key patterns", () => {
  const error = "Key: ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF";
  const result = sanitizeErrorMessage(error);
  
  assertEquals(result, "Key: ***");
});

Deno.test("sanitizeErrorMessage - does not sanitize short alphanumeric strings", () => {
  const error = "Error code: ABC123 (31 chars or less)";
  const result = sanitizeErrorMessage(error);
  
  // Should NOT be sanitized (less than 32 chars)
  assertEquals(result, "Error code: ABC123 (31 chars or less)");
});

Deno.test("sanitizeErrorMessage - sanitizes exactly 32-char API key", () => {
  const apiKey = "A".repeat(32);
  const error = `Failed with key: ${apiKey}`;
  const result = sanitizeErrorMessage(error);
  
  assertEquals(result, "Failed with key: ***");
});

Deno.test("sanitizeErrorMessage - preserves user-friendly error descriptions", () => {
  const error = "Connection timeout: Unable to reach server";
  const result = sanitizeErrorMessage(error);
  
  assertEquals(result, "Connection timeout: Unable to reach server");
});

Deno.test("sanitizeErrorMessage - handles mixed sensitive and safe content", () => {
  const error = "Request to /api/users failed with key=secret123 due to timeout";
  const result = sanitizeErrorMessage(error);
  
  assertEquals(result, "Request to /api/users failed with key=*** due to timeout");
});

Deno.test("sanitizeErrorMessage - sanitizes all sensitive patterns in complex message", () => {
  const error = "Auth failed: key=abc123, token=def456, Bearer ghi789jkl012, API_KEY: MNOPQRSTUVWXYZ1234567890ABCDEF"; // gitleaks:allow
  const result = sanitizeErrorMessage(error);
  
  assertEquals(result, "Auth failed: key=***, token=***, Bearer ***, API_KEY: ***");
});

Deno.test("sanitizeErrorMessage - handles empty string", () => {
  const result = sanitizeErrorMessage("");
  
  assertEquals(result, "");
});

Deno.test("sanitizeErrorMessage - handles string with no sensitive data", () => {
  const error = "Database connection failed";
  const result = sanitizeErrorMessage(error);
  
  assertEquals(result, "Database connection failed");
});

Deno.test("sanitizeErrorMessage - sanitizes key with hyphens", () => {
  const error = "Error: key=abc-123-def-456"; // gitleaks:allow
  const result = sanitizeErrorMessage(error);
  
  assertEquals(result, "Error: key=***");
});

Deno.test("sanitizeErrorMessage - sanitizes token with underscores", () => {
  const error = "token=my_secret_token_123";
  const result = sanitizeErrorMessage(error);
  
  assertEquals(result, "token=***");
});

Deno.test("sanitizeErrorMessage - sanitizes Bearer token with hyphens", () => {
  const error = "Bearer abc-def-123-456";
  const result = sanitizeErrorMessage(error);
  
  assertEquals(result, "Bearer ***");
});

Deno.test("sanitizeErrorMessage - handles newlines in error message", () => {
  const error = "Error on line 1\nkey=secret123\nLine 3";
  const result = sanitizeErrorMessage(error);
  
  assertEquals(result, "Error on line 1\nkey=***\nLine 3");
});

Deno.test("sanitizeErrorMessage - handles special regex characters safely", () => {
  const error = "Error: (key=secret) [token=value] {data}";
  const result = sanitizeErrorMessage(error);
  
  assertEquals(result, "Error: (key=***) [token=***] {data}");
});

Deno.test("sanitizeErrorMessage - does not over-sanitize word boundaries", () => {
  const error = "keyword and keyframe and makeymckey";
  const result = sanitizeErrorMessage(error);
  
  // These should not match as they don't follow key= pattern
  assertEquals(result, "keyword and keyframe and makeymckey");
});

Deno.test("sanitizeErrorMessage - sanitizes mixed case in long API key", () => {
  const error = "Key: AbCdEfGhIjKlMnOpQrStUvWxYz123456";
  const result = sanitizeErrorMessage(error);
  
  assertEquals(result, "Key: ***");
});

Deno.test("sanitizeErrorMessage - handles adjacent sensitive values", () => {
  const error = "key=secret1token=secret2Bearer secret3";
  const result = sanitizeErrorMessage(error);
  
  assertEquals(result, "key=***token=***Bearer ***");
});

Deno.test("sanitizeErrorMessage - preserves error codes and HTTP status", () => {
  const error = "HTTP 401: Unauthorized. key=abc123";
  const result = sanitizeErrorMessage(error);
  
  assertEquals(result, "HTTP 401: Unauthorized. key=***");
});

Deno.test("sanitizeErrorMessage - handles real-world JWT-like Bearer token", () => {
  const error = "Authorization failed: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
  const result = sanitizeErrorMessage(error);
  
  assertEquals(result, "Authorization failed: Bearer ***");
});

// ============================================================================
// ValidationResult Interface Tests
// ============================================================================

Deno.test("ValidationResult - success result has correct structure", () => {
  const result: ValidationResult = validateBookInput("Title", "Author");
  
  assertEquals(typeof result.valid, "boolean");
  assertEquals(result.valid, true);
  assertExists(result.sanitized);
  assertEquals(typeof result.sanitized.title, "string");
  assertEquals(typeof result.sanitized.author, "string");
  assertEquals(result.error, undefined);
});

Deno.test("ValidationResult - failure result has correct structure", () => {
  const result: ValidationResult = validateBookInput("", "Author");
  
  assertEquals(typeof result.valid, "boolean");
  assertEquals(result.valid, false);
  assertEquals(typeof result.error, "string");
  assertEquals(result.sanitized, undefined);
});

Deno.test("ValidationResult - error messages are descriptive", () => {
  const emptyTitleResult = validateBookInput("", "Author");
  assertEquals(emptyTitleResult.error?.includes("Title"), true);
  
  const longTitleResult = validateBookInput("A".repeat(501), "Author");
  assertEquals(longTitleResult.error?.includes("Title"), true);
  assertEquals(longTitleResult.error?.includes("500"), true);
  
  const longAuthorResult = validateBookInput("Title", "B".repeat(201));
  assertEquals(longAuthorResult.error?.includes("Author"), true);
  assertEquals(longAuthorResult.error?.includes("200"), true);
});

// ============================================================================
// Integration and Stress Tests
// ============================================================================

Deno.test("validateBookInput - handles extremely long input efficiently", () => {
  const veryLongTitle = "A".repeat(10000);
  const result = validateBookInput(veryLongTitle, "Author");
  
  assertEquals(result.valid, false);
  assertEquals(result.error, "Title too long (max 500 characters)");
});

Deno.test("sanitizeErrorMessage - handles very long error messages", () => {
  const longError = "Error: " + "key=secret123 ".repeat(100);
  const result = sanitizeErrorMessage(longError);
  
  // All keys should be sanitized
  assertEquals(result.includes("key=secret123"), false);
  assertEquals(result.includes("key=***"), true);
});

Deno.test("validateBookInput - rapid successive calls produce consistent results", () => {
  const results = [];
  for (let i = 0; i < 100; i++) {
    results.push(validateBookInput("Test Title", "Test Author"));
  }
  
  // All results should be identical
  results.forEach((result) => {
    assertEquals(result.valid, true);
    assertEquals(result.sanitized?.title, "Test Title");
    assertEquals(result.sanitized?.author, "Test Author");
  });
});

Deno.test("sanitizeErrorMessage - rapid successive calls produce consistent results", () => {
  const error = "Error: key=secret123 token=abc456";
  const results = [];
  for (let i = 0; i < 100; i++) {
    results.push(sanitizeErrorMessage(error));
  }
  
  // All results should be identical
  results.forEach((result) => {
    assertEquals(result, "Error: key=*** token=***");
  });
});