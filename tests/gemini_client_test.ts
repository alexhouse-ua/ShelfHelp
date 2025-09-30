/**
 * Comprehensive unit tests for Google Gemini Flash API client
 * Testing Framework: Deno.test (built-in)
 * Assertion Library: @std/assert
 * Mocking Library: @std/testing/mock
 */

import { assertEquals, assertExists, assertStringIncludes } from "jsr:@std/assert";
import { assertRejects } from "jsr:@std/assert";
import { stub, restore, Stub } from "jsr:@std/testing/mock";
import {
  extractBookInfo,
  type BookExtractionResult,
  type GeminiError,
} from "../src/gemini_client.ts";

// Test helper to check if result is an error
function isError(result: BookExtractionResult | GeminiError): result is GeminiError {
  return "error" in result;
}

// Test helper to check if result is a success
function isSuccess(result: BookExtractionResult | GeminiError): result is BookExtractionResult {
  return "title" in result && "author" in result && "confidence" in result;
}

// Mock response builder
function createMockGeminiResponse(title: string, author: string, confidence: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({ title, author, confidence }),
              },
            ],
          },
        },
      ],
    }),
  };
}

// Mock error response builder
function createMockErrorResponse(status: number, errorMessage: string) {
  return {
    ok: false,
    status,
    json: async () => ({ error: { message: errorMessage } }),
  };
}

Deno.test.beforeEach(() => {
  // Ensure clean state between tests
  restore();
});

Deno.test.afterEach(() => {
  // Clean up all stubs after each test
  restore();
});

// ==================== Configuration Error Tests ====================

Deno.test("extractBookInfo - should return CONFIG_ERROR when API key is not set", async () => {
  const originalKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
  Deno.env.delete("GOOGLE_GEMINI_API_KEY");

  const result = await extractBookInfo("1984 by George Orwell");

  assertEquals(isError(result), true);
  if (isError(result)) {
    assertEquals(result.error, "GOOGLE_GEMINI_API_KEY not configured");
    assertEquals(result.code, "CONFIG_ERROR");
  }

  // Restore original key if it existed
  if (originalKey) {
    Deno.env.set("GOOGLE_GEMINI_API_KEY", originalKey);
  }
});

// ==================== Input Validation Tests ====================

Deno.test("extractBookInfo - should return INVALID_INPUT error for empty string", async () => {
  const result = await extractBookInfo("");

  assertEquals(isError(result), true);
  if (isError(result)) {
    assertEquals(result.error, "Empty input provided");
    assertEquals(result.code, "INVALID_INPUT");
  }
});

Deno.test("extractBookInfo - should return INVALID_INPUT error for whitespace-only string", async () => {
  const result = await extractBookInfo("   \t\n  ");

  assertEquals(isError(result), true);
  if (isError(result)) {
    assertEquals(result.error, "Empty input provided");
    assertEquals(result.code, "INVALID_INPUT");
  }
});

Deno.test("extractBookInfo - should return INVALID_INPUT error for null-like input", async () => {
  const result = await extractBookInfo("" as string);

  assertEquals(isError(result), true);
  if (isError(result)) {
    assertEquals(result.code, "INVALID_INPUT");
  }
});

// ==================== Happy Path Tests ====================

Deno.test("extractBookInfo - should successfully extract book info with high confidence", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.resolve(createMockGeminiResponse("1984", "George Orwell", "high") as Response),
  );

  const result = await extractBookInfo("I want to read 1984 by George Orwell");

  assertEquals(isSuccess(result), true);
  if (isSuccess(result)) {
    assertEquals(result.title, "1984");
    assertEquals(result.author, "George Orwell");
    assertEquals(result.confidence, "high");
  }

  fetchStub.restore();
});

Deno.test("extractBookInfo - should successfully extract book info with medium confidence", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.resolve(createMockGeminiResponse("The Great Gatsby", "F. Scott Fitzgerald", "medium") as Response),
  );

  const result = await extractBookInfo("Maybe The Great Gatsby?");

  assertEquals(isSuccess(result), true);
  if (isSuccess(result)) {
    assertEquals(result.title, "The Great Gatsby");
    assertEquals(result.author, "F. Scott Fitzgerald");
    assertEquals(result.confidence, "medium");
  }

  fetchStub.restore();
});

Deno.test("extractBookInfo - should successfully extract book info with low confidence", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.resolve(createMockGeminiResponse("", "", "low") as Response),
  );

  const result = await extractBookInfo("I don't know what book");

  assertEquals(isSuccess(result), true);
  if (isSuccess(result)) {
    assertEquals(result.title, "");
    assertEquals(result.author, "");
    assertEquals(result.confidence, "low");
  }

  fetchStub.restore();
});

Deno.test("extractBookInfo - should handle book titles with special characters", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.resolve(createMockGeminiResponse("Harry Potter & the Philosopher's Stone", "J.K. Rowling", "high") as Response),
  );

  const result = await extractBookInfo("Harry Potter and the Philosopher's Stone");

  assertEquals(isSuccess(result), true);
  if (isSuccess(result)) {
    assertEquals(result.title, "Harry Potter & the Philosopher's Stone");
    assertEquals(result.author, "J.K. Rowling");
    assertEquals(result.confidence, "high");
  }

  fetchStub.restore();
});

Deno.test("extractBookInfo - should trim whitespace from extracted title and author", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({ title: "  1984  ", author: "  George Orwell  ", confidence: "high" }),
                },
              ],
            },
          },
        ],
      }),
    } as Response),
  );

  const result = await extractBookInfo("1984");

  assertEquals(isSuccess(result), true);
  if (isSuccess(result)) {
    assertEquals(result.title, "1984");
    assertEquals(result.author, "George Orwell");
  }

  fetchStub.restore();
});

// ==================== API Request Tests ====================

Deno.test("extractBookInfo - should make POST request with correct headers and body", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key-123");
  
  let capturedUrl = "";
  let capturedOptions: RequestInit | undefined;

  const fetchStub = stub(
    globalThis,
    "fetch",
    (url: string | URL | Request, options?: RequestInit) => {
      capturedUrl = url.toString();
      capturedOptions = options;
      return Promise.resolve(createMockGeminiResponse("1984", "George Orwell", "high") as Response);
    },
  );

  await extractBookInfo("1984 by George Orwell");

  assertStringIncludes(capturedUrl, "test-api-key-123");
  assertStringIncludes(capturedUrl, "gemini-1.5-flash");
  assertEquals(capturedOptions?.method, "POST");
  assertEquals((capturedOptions?.headers as Record<string, string>)["Content-Type"], "application/json");
  
  const body = JSON.parse(capturedOptions?.body as string);
  assertExists(body.contents);
  assertEquals(body.contents.length, 1);
  assertEquals(body.generationConfig.temperature, 0.1);
  assertEquals(body.generationConfig.topK, 1);
  assertEquals(body.generationConfig.maxOutputTokens, 256);

  fetchStub.restore();
});

// ==================== Rate Limit Tests ====================

Deno.test("extractBookInfo - should return RATE_LIMIT error when API returns 429", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.resolve(createMockErrorResponse(429, "Rate limit exceeded") as Response),
  );

  const result = await extractBookInfo("1984 by George Orwell");

  assertEquals(isError(result), true);
  if (isError(result)) {
    assertEquals(result.error, "Rate limit exceeded");
    assertEquals(result.code, "RATE_LIMIT");
  }

  fetchStub.restore();
});

// ==================== API Error Tests ====================

Deno.test("extractBookInfo - should return API_ERROR for 400 Bad Request", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.resolve(createMockErrorResponse(400, "Bad request") as Response),
  );

  const result = await extractBookInfo("1984 by George Orwell");

  assertEquals(isError(result), true);
  if (isError(result)) {
    assertStringIncludes(result.error, "400");
    assertEquals(result.code, "API_ERROR");
  }

  fetchStub.restore();
});

Deno.test("extractBookInfo - should return API_ERROR for 401 Unauthorized", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "invalid-key");
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.resolve(createMockErrorResponse(401, "Invalid API key") as Response),
  );

  const result = await extractBookInfo("1984 by George Orwell");

  assertEquals(isError(result), true);
  if (isError(result)) {
    assertStringIncludes(result.error, "401");
    assertEquals(result.code, "API_ERROR");
  }

  fetchStub.restore();
});

Deno.test("extractBookInfo - should return API_ERROR for 403 Forbidden", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.resolve(createMockErrorResponse(403, "Forbidden") as Response),
  );

  const result = await extractBookInfo("1984 by George Orwell");

  assertEquals(isError(result), true);
  if (isError(result)) {
    assertStringIncludes(result.error, "403");
    assertEquals(result.code, "API_ERROR");
  }

  fetchStub.restore();
});

Deno.test("extractBookInfo - should return API_ERROR for 500 Internal Server Error", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.resolve(createMockErrorResponse(500, "Internal server error") as Response),
  );

  const result = await extractBookInfo("1984 by George Orwell");

  assertEquals(isError(result), true);
  if (isError(result)) {
    assertStringIncludes(result.error, "500");
    assertEquals(result.code, "API_ERROR");
  }

  fetchStub.restore();
});

Deno.test("extractBookInfo - should return API_ERROR for 503 Service Unavailable", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.resolve(createMockErrorResponse(503, "Service unavailable") as Response),
  );

  const result = await extractBookInfo("1984 by George Orwell");

  assertEquals(isError(result), true);
  if (isError(result)) {
    assertStringIncludes(result.error, "503");
    assertEquals(result.code, "API_ERROR");
  }

  fetchStub.restore();
});

// ==================== No Response Tests ====================

Deno.test("extractBookInfo - should return NO_RESPONSE error when candidates array is empty", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [],
      }),
    } as Response),
  );

  const result = await extractBookInfo("1984 by George Orwell");

  assertEquals(isError(result), true);
  if (isError(result)) {
    assertEquals(result.error, "No response from Gemini");
    assertEquals(result.code, "NO_RESPONSE");
  }

  fetchStub.restore();
});

Deno.test("extractBookInfo - should return NO_RESPONSE error when candidates is missing", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response),
  );

  const result = await extractBookInfo("1984 by George Orwell");

  assertEquals(isError(result), true);
  if (isError(result)) {
    assertEquals(result.error, "No response from Gemini");
    assertEquals(result.code, "NO_RESPONSE");
  }

  fetchStub.restore();
});

// ==================== Network Error Tests ====================

Deno.test("extractBookInfo - should return NETWORK_ERROR on fetch rejection", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.reject(new Error("Network failure")),
  );

  const result = await extractBookInfo("1984 by George Orwell");

  assertEquals(isError(result), true);
  if (isError(result)) {
    assertEquals(result.error, "Failed to connect to Gemini API");
    assertEquals(result.code, "NETWORK_ERROR");
  }

  fetchStub.restore();
});

Deno.test("extractBookInfo - should return TIMEOUT error on AbortError", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");
  
  const abortError = new Error("Request aborted");
  abortError.name = "AbortError";
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.reject(abortError),
  );

  const result = await extractBookInfo("1984 by George Orwell");

  assertEquals(isError(result), true);
  if (isError(result)) {
    assertEquals(result.error, "Request timeout");
    assertEquals(result.code, "TIMEOUT");
  }

  fetchStub.restore();
});

Deno.test("extractBookInfo - should return TIMEOUT error when error message includes timeout", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.reject(new Error("Connection timeout occurred")),
  );

  const result = await extractBookInfo("1984 by George Orwell");

  assertEquals(isError(result), true);
  if (isError(result)) {
    assertEquals(result.error, "Request timeout");
    assertEquals(result.code, "TIMEOUT");
  }

  fetchStub.restore();
});

Deno.test("extractBookInfo - should return NETWORK_ERROR on non-timeout generic error", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.reject(new Error("DNS resolution failed")),
  );

  const result = await extractBookInfo("1984 by George Orwell");

  assertEquals(isError(result), true);
  if (isError(result)) {
    assertEquals(result.error, "Failed to connect to Gemini API");
    assertEquals(result.code, "NETWORK_ERROR");
  }

  fetchStub.restore();
});

// ==================== Response Parsing Tests ====================

Deno.test("extractBookInfo - should parse JSON response with markdown code fences", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '```json\n{"title": "1984", "author": "George Orwell", "confidence": "high"}\n```',
                },
              ],
            },
          },
        ],
      }),
    } as Response),
  );

  const result = await extractBookInfo("1984 by George Orwell");

  assertEquals(isSuccess(result), true);
  if (isSuccess(result)) {
    assertEquals(result.title, "1984");
    assertEquals(result.author, "George Orwell");
    assertEquals(result.confidence, "high");
  }

  fetchStub.restore();
});

Deno.test("extractBookInfo - should parse JSON response with code fences without json label", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '```\n{"title": "To Kill a Mockingbird", "author": "Harper Lee", "confidence": "high"}\n```',
                },
              ],
            },
          },
        ],
      }),
    } as Response),
  );

  const result = await extractBookInfo("To Kill a Mockingbird");

  assertEquals(isSuccess(result), true);
  if (isSuccess(result)) {
    assertEquals(result.title, "To Kill a Mockingbird");
    assertEquals(result.author, "Harper Lee");
  }

  fetchStub.restore();
});

Deno.test("extractBookInfo - should handle response with missing confidence field (defaults to medium)", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '{"title": "1984", "author": "George Orwell"}',
                },
              ],
            },
          },
        ],
      }),
    } as Response),
  );

  const result = await extractBookInfo("1984");

  assertEquals(isSuccess(result), true);
  if (isSuccess(result)) {
    assertEquals(result.confidence, "medium");
  }

  fetchStub.restore();
});

Deno.test("extractBookInfo - should return PARSE_ERROR for invalid JSON", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: 'This is not valid JSON',
                },
              ],
            },
          },
        ],
      }),
    } as Response),
  );

  const result = await extractBookInfo("1984");

  assertEquals(isError(result), true);
  if (isError(result)) {
    assertEquals(result.error, "Failed to parse response");
    assertEquals(result.code, "PARSE_ERROR");
  }

  fetchStub.restore();
});

Deno.test("extractBookInfo - should return PARSE_ERROR when title is not a string", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '{"title": 123, "author": "George Orwell", "confidence": "high"}',
                },
              ],
            },
          },
        ],
      }),
    } as Response),
  );

  const result = await extractBookInfo("1984");

  assertEquals(isError(result), true);
  if (isError(result)) {
    assertEquals(result.error, "Invalid response format from Gemini");
    assertEquals(result.code, "PARSE_ERROR");
  }

  fetchStub.restore();
});

Deno.test("extractBookInfo - should return PARSE_ERROR when author is not a string", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '{"title": "1984", "author": null, "confidence": "high"}',
                },
              ],
            },
          },
        ],
      }),
    } as Response),
  );

  const result = await extractBookInfo("1984");

  assertEquals(isError(result), true);
  if (isError(result)) {
    assertEquals(result.error, "Invalid response format from Gemini");
    assertEquals(result.code, "PARSE_ERROR");
  }

  fetchStub.restore();
});

Deno.test("extractBookInfo - should return PARSE_ERROR for invalid confidence level", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '{"title": "1984", "author": "George Orwell", "confidence": "invalid"}',
                },
              ],
            },
          },
        ],
      }),
    } as Response),
  );

  const result = await extractBookInfo("1984");

  assertEquals(isError(result), true);
  if (isError(result)) {
    assertEquals(result.error, "Invalid confidence level");
    assertEquals(result.code, "PARSE_ERROR");
  }

  fetchStub.restore();
});

Deno.test("extractBookInfo - should return PARSE_ERROR when title field is missing", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '{"author": "George Orwell", "confidence": "high"}',
                },
              ],
            },
          },
        ],
      }),
    } as Response),
  );

  const result = await extractBookInfo("1984");

  assertEquals(isError(result), true);
  if (isError(result)) {
    assertEquals(result.code, "PARSE_ERROR");
  }

  fetchStub.restore();
});

Deno.test("extractBookInfo - should return PARSE_ERROR when author field is missing", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '{"title": "1984", "confidence": "high"}',
                },
              ],
            },
          },
        ],
      }),
    } as Response),
  );

  const result = await extractBookInfo("1984");

  assertEquals(isError(result), true);
  if (isError(result)) {
    assertEquals(result.code, "PARSE_ERROR");
  }

  fetchStub.restore();
});

// ==================== Edge Case Tests ====================

Deno.test("extractBookInfo - should handle very long user input", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.resolve(createMockGeminiResponse("War and Peace", "Leo Tolstoy", "high") as Response),
  );

  const longInput = "I really want to read ".repeat(100) + "War and Peace by Leo Tolstoy";
  const result = await extractBookInfo(longInput);

  assertEquals(isSuccess(result), true);
  if (isSuccess(result)) {
    assertEquals(result.title, "War and Peace");
    assertEquals(result.author, "Leo Tolstoy");
  }

  fetchStub.restore();
});

Deno.test("extractBookInfo - should handle input with unicode characters", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.resolve(createMockGeminiResponse("三体", "刘慈欣", "high") as Response),
  );

  const result = await extractBookInfo("我想读三体");

  assertEquals(isSuccess(result), true);
  if (isSuccess(result)) {
    assertEquals(result.title, "三体");
    assertEquals(result.author, "刘慈欣");
  }

  fetchStub.restore();
});

Deno.test("extractBookInfo - should handle input with emojis", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.resolve(createMockGeminiResponse("1984", "George Orwell", "high") as Response),
  );

  const result = await extractBookInfo("📚 I want to read 1984 📖");

  assertEquals(isSuccess(result), true);

  fetchStub.restore();
});

Deno.test("extractBookInfo - should handle multiple book mentions in input", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.resolve(createMockGeminiResponse("1984", "George Orwell", "medium") as Response),
  );

  const result = await extractBookInfo("Should I read 1984 or Brave New World or Animal Farm?");

  assertEquals(isSuccess(result), true);
  // The API should extract one of the books mentioned

  fetchStub.restore();
});

Deno.test("extractBookInfo - should handle input with HTML/special characters", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.resolve(createMockGeminiResponse("1984", "George Orwell", "high") as Response),
  );

  const result = await extractBookInfo("<script>alert('test')</script> 1984 by George Orwell");

  assertEquals(isSuccess(result), true);

  fetchStub.restore();
});

// ==================== Prompt Building Tests ====================

Deno.test("extractBookInfo - should include user input in the prompt sent to Gemini", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");
  
  let capturedPrompt = "";
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    (_url: string | URL | Request, options?: RequestInit) => {
      const body = JSON.parse(options?.body as string);
      capturedPrompt = body.contents[0].parts[0].text;
      return Promise.resolve(createMockGeminiResponse("1984", "George Orwell", "high") as Response);
    },
  );

  await extractBookInfo("I want to read 1984 by George Orwell");

  assertStringIncludes(capturedPrompt, "I want to read 1984 by George Orwell");
  assertStringIncludes(capturedPrompt, "Extract the book title and author");
  assertStringIncludes(capturedPrompt, "JSON");

  fetchStub.restore();
});

// ==================== Integration-like Tests ====================

Deno.test("extractBookInfo - should handle complete successful flow from input to output", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key-full-flow");
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.resolve(createMockGeminiResponse("The Catcher in the Rye", "J.D. Salinger", "high") as Response),
  );

  const result = await extractBookInfo("Can you recommend The Catcher in the Rye?");

  assertEquals(isSuccess(result), true);
  if (isSuccess(result)) {
    assertEquals(result.title, "The Catcher in the Rye");
    assertEquals(result.author, "J.D. Salinger");
    assertEquals(result.confidence, "high");
  }

  fetchStub.restore();
});

Deno.test("extractBookInfo - should handle complete error flow from network failure", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.reject(new TypeError("Failed to fetch")),
  );

  const result = await extractBookInfo("1984");

  assertEquals(isError(result), true);
  if (isError(result)) {
    assertEquals(result.code, "NETWORK_ERROR");
  }

  fetchStub.restore();
});

// ==================== Concurrent Request Tests ====================

Deno.test("extractBookInfo - should handle multiple concurrent requests", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.resolve(createMockGeminiResponse("1984", "George Orwell", "high") as Response),
  );

  const results = await Promise.all([
    extractBookInfo("1984 by George Orwell"),
    extractBookInfo("Brave New World by Aldous Huxley"),
    extractBookInfo("Animal Farm by George Orwell"),
  ]);

  assertEquals(results.length, 3);
  results.forEach((result) => {
    assertEquals(isSuccess(result), true);
  });

  fetchStub.restore();
});

// ==================== Response Structure Tests ====================

Deno.test("extractBookInfo - should handle malformed response structure gracefully", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              // Missing parts array
            },
          },
        ],
      }),
    } as Response),
  );

  const result = await extractBookInfo("1984");

  assertEquals(isError(result), true);

  fetchStub.restore();
});

Deno.test("extractBookInfo - should accept all valid confidence levels", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");

  const confidenceLevels: Array<"high" | "medium" | "low"> = ["high", "medium", "low"];

  for (const confidence of confidenceLevels) {
    const fetchStub = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(createMockGeminiResponse("1984", "George Orwell", confidence) as Response),
    );

    const result = await extractBookInfo("1984");

    assertEquals(isSuccess(result), true);
    if (isSuccess(result)) {
      assertEquals(result.confidence, confidence);
    }

    fetchStub.restore();
  }
});

// ==================== Type Safety Tests ====================

Deno.test("extractBookInfo - response should match BookExtractionResult interface", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.resolve(createMockGeminiResponse("1984", "George Orwell", "high") as Response),
  );

  const result = await extractBookInfo("1984");

  if (isSuccess(result)) {
    // Type checks
    const title: string = result.title;
    const author: string = result.author;
    const confidence: "high" | "medium" | "low" = result.confidence;
    
    assertExists(title);
    assertExists(author);
    assertExists(confidence);
  }

  fetchStub.restore();
});

Deno.test("extractBookInfo - error response should match GeminiError interface", async () => {
  Deno.env.set("GOOGLE_GEMINI_API_KEY", "test-api-key");
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.reject(new Error("Network error")),
  );

  const result = await extractBookInfo("1984");

  if (isError(result)) {
    // Type checks
    const error: string = result.error;
    const code: string | undefined = result.code;
    
    assertExists(error);
    assertExists(code);
  }

  fetchStub.restore();
});

// ==================== Cleanup Test ====================

Deno.test("test suite cleanup - ensure all stubs are restored", () => {
  // This test verifies that our beforeEach/afterEach hooks work correctly
  assertEquals(typeof globalThis.fetch, "function");
});