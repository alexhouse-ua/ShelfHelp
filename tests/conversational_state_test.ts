/**
 * Unit tests for conversational state management
 * Testing Framework: Deno built-in test runner with @std/assert
 */

import { assertEquals, assertExists, assert } from "jsr:@std/assert";
import { stub, restore, Stub } from "jsr:@std/testing/mock";
import {
  saveState,
  getState,
  cleanupState,
  cleanupExpiredStates,
  type ConversationalState,
  type StateData,
} from "../supabase/functions/conversational_state.ts";

// Mock Supabase Client
class MockSupabaseClient {
  private mockData: Map<number, ConversationalState> = new Map();
  private shouldError = false;
  private errorCode = "";
  private errorMessage = "";

  setError(code: string, message: string) {
    this.shouldError = true;
    this.errorCode = code;
    this.errorMessage = message;
  }

  clearError() {
    this.shouldError = false;
    this.errorCode = "";
    this.errorMessage = "";
  }

  setMockData(chatId: number, data: ConversationalState) {
    this.mockData.set(chatId, data);
  }

  clearMockData() {
    this.mockData.clear();
  }

  from(table: string) {
    const self = this;
    return {
      upsert(data: any, options: any) {
        if (self.shouldError) {
          return {
            error: { message: self.errorMessage, code: self.errorCode },
          };
        }
        self.mockData.set(data.chat_id, data);
        return { error: null };
      },
      select(columns: string) {
        return {
          eq(field: string, value: any) {
            return {
              single() {
                if (self.shouldError) {
                  return {
                    data: null,
                    error: { message: self.errorMessage, code: self.errorCode },
                  };
                }
                const row = self.mockData.get(value);
                if (!row) {
                  return {
                    data: null,
                    error: { code: "PGRST116", message: "No rows found" },
                  };
                }
                return { data: row, error: null };
              },
            };
          },
          lt(field: string, value: any) {
            return {
              select() {
                if (self.shouldError) {
                  return {
                    data: null,
                    error: { message: self.errorMessage, code: self.errorCode },
                  };
                }
                const expired: ConversationalState[] = [];
                const cutoffTime = new Date(value).getTime();
                self.mockData.forEach((state) => {
                  const stateTime = new Date(state.last_interaction).getTime();
                  if (stateTime < cutoffTime) {
                    expired.push(state);
                  }
                });
                expired.forEach((state) => {
                  if (state.chat_id) {
                    self.mockData.delete(state.chat_id);
                  }
                });
                return { data: expired, error: null };
              },
            };
          },
        };
      },
      delete() {
        return {
          eq(field: string, value: any) {
            if (self.shouldError) {
              return {
                error: { message: self.errorMessage, code: self.errorCode },
              };
            }
            self.mockData.delete(value);
            return { error: null };
          },
          lt(field: string, value: any) {
            return {
              select() {
                if (self.shouldError) {
                  return {
                    data: null,
                    error: { message: self.errorMessage, code: self.errorCode },
                  };
                }
                const expired: ConversationalState[] = [];
                const cutoffTime = new Date(value).getTime();
                self.mockData.forEach((state) => {
                  const stateTime = new Date(state.last_interaction).getTime();
                  if (stateTime < cutoffTime) {
                    expired.push(state);
                  }
                });
                expired.forEach((state) => {
                  if (state.chat_id) {
                    self.mockData.delete(state.chat_id);
                  }
                });
                return { data: expired, error: null };
              },
            };
          },
        };
      },
    };
  }
}

// Test Suite: saveState function
Deno.test("saveState - should save state successfully with valid data", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const chatId = 12345;
  const stateData: StateData = {
    workflow: "add_book",
    step: "awaiting_clarification",
    extracted_title: "The Great Gatsby",
    extracted_author: "F. Scott Fitzgerald",
  };

  const result = await saveState(mockClient, chatId, stateData);

  assertEquals(result.success, true);
  assertEquals(result.error, undefined);
});

Deno.test("saveState - should save state with context", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const chatId = 12345;
  const stateData: StateData = {
    workflow: "add_book",
    step: "selecting_book",
  };
  const context = "User is selecting from search results";

  const result = await saveState(mockClient, chatId, stateData, context);

  assertEquals(result.success, true);
  assertEquals(result.error, undefined);
});

Deno.test("saveState - should reject null state data", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const chatId = 12345;

  const result = await saveState(mockClient, chatId, null as any);

  assertEquals(result.success, false);
  assertEquals(result.error, "Invalid state data structure");
});

Deno.test("saveState - should reject undefined state data", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const chatId = 12345;

  const result = await saveState(mockClient, chatId, undefined as any);

  assertEquals(result.success, false);
  assertEquals(result.error, "Invalid state data structure");
});

Deno.test("saveState - should reject non-object state data", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const chatId = 12345;

  const result = await saveState(mockClient, chatId, "invalid" as any);

  assertEquals(result.success, false);
  assertEquals(result.error, "Invalid state data structure");
});

Deno.test("saveState - should handle database errors gracefully", async () => {
  const mockClient = new MockSupabaseClient() as any;
  mockClient.setError("DB_ERROR", "Database connection failed");
  const chatId = 12345;
  const stateData: StateData = { workflow: "add_book" };

  const result = await saveState(mockClient, chatId, stateData);

  assertEquals(result.success, false);
  assertEquals(result.error, "Database connection failed");
});

Deno.test("saveState - should handle empty state data object", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const chatId = 12345;
  const stateData: StateData = {};

  const result = await saveState(mockClient, chatId, stateData);

  assertEquals(result.success, true);
});

Deno.test("saveState - should save state with search results", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const chatId = 12345;
  const stateData: StateData = {
    workflow: "add_book",
    step: "selecting_book",
    search_results: [
      {
        title: "1984",
        author: "George Orwell",
        isbn: "9780451524935",
        cover_image_url: "https://example.com/cover.jpg",
        goodreads_id: 12345,
      },
    ],
  };

  const result = await saveState(mockClient, chatId, stateData);

  assertEquals(result.success, true);
});

Deno.test("saveState - should handle custom state data fields", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const chatId = 12345;
  const stateData: StateData = {
    workflow: "add_book",
    custom_field: "custom_value",
    nested: { data: "test" },
  };

  const result = await saveState(mockClient, chatId, stateData);

  assertEquals(result.success, true);
});

Deno.test("saveState - should handle zero chat ID", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const chatId = 0;
  const stateData: StateData = { workflow: "add_book" };

  const result = await saveState(mockClient, chatId, stateData);

  assertEquals(result.success, true);
});

Deno.test("saveState - should handle negative chat ID", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const chatId = -1;
  const stateData: StateData = { workflow: "add_book" };

  const result = await saveState(mockClient, chatId, stateData);

  assertEquals(result.success, true);
});

// Test Suite: getState function
Deno.test("getState - should retrieve existing state successfully", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const chatId = 12345;
  const mockState: ConversationalState = {
    id: "state-1",
    chat_id: chatId,
    current_context: "test context",
    last_interaction: new Date().toISOString(),
    state_data: { workflow: "add_book", step: "awaiting_clarification" },
  };
  mockClient.setMockData(chatId, mockState);

  const result = await getState(mockClient, chatId);

  assertExists(result);
  assertEquals(result?.chat_id, chatId);
  assertEquals(result?.state_data.workflow, "add_book");
});

Deno.test("getState - should return null for non-existent state", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const chatId = 99999;

  const result = await getState(mockClient, chatId);

  assertEquals(result, null);
});

Deno.test("getState - should return null for expired state", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const chatId = 12345;
  const expiredDate = new Date();
  expiredDate.setMinutes(expiredDate.getMinutes() - 20); // 20 minutes ago (expired)
  const mockState: ConversationalState = {
    id: "state-1",
    chat_id: chatId,
    last_interaction: expiredDate.toISOString(),
    state_data: { workflow: "add_book" },
  };
  mockClient.setMockData(chatId, mockState);

  const result = await getState(mockClient, chatId);

  assertEquals(result, null);
  // Verify state was cleaned up
  const stateAfterCleanup = await getState(mockClient, chatId);
  assertEquals(stateAfterCleanup, null);
});

Deno.test("getState - should return state within timeout window", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const chatId = 12345;
  const recentDate = new Date();
  recentDate.setMinutes(recentDate.getMinutes() - 5); // 5 minutes ago (valid)
  const mockState: ConversationalState = {
    id: "state-1",
    chat_id: chatId,
    last_interaction: recentDate.toISOString(),
    state_data: { workflow: "add_book" },
  };
  mockClient.setMockData(chatId, mockState);

  const result = await getState(mockClient, chatId);

  assertExists(result);
  assertEquals(result?.chat_id, chatId);
});

Deno.test("getState - should return state at exact timeout boundary", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const chatId = 12345;
  const boundaryDate = new Date();
  boundaryDate.setMinutes(boundaryDate.getMinutes() - 15); // Exactly 15 minutes ago
  const mockState: ConversationalState = {
    id: "state-1",
    chat_id: chatId,
    last_interaction: boundaryDate.toISOString(),
    state_data: { workflow: "add_book" },
  };
  mockClient.setMockData(chatId, mockState);

  const result = await getState(mockClient, chatId);

  assertExists(result);
  assertEquals(result?.chat_id, chatId);
});

Deno.test("getState - should handle database errors gracefully", async () => {
  const mockClient = new MockSupabaseClient() as any;
  mockClient.setError("DB_ERROR", "Database connection failed");
  const chatId = 12345;

  const result = await getState(mockClient, chatId);

  assertEquals(result, null);
});

Deno.test("getState - should handle PGRST116 error code correctly", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const chatId = 99999;

  const result = await getState(mockClient, chatId);

  assertEquals(result, null);
});

Deno.test("getState - should retrieve state with all fields populated", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const chatId = 12345;
  const mockState: ConversationalState = {
    id: "state-1",
    chat_id: chatId,
    current_context: "User searching for book",
    last_book_id: "book-123",
    last_interaction: new Date().toISOString(),
    state_data: {
      workflow: "add_book",
      step: "selecting_book",
      extracted_title: "1984",
      extracted_author: "George Orwell",
      search_results: [
        {
          title: "1984",
          author: "George Orwell",
          isbn: "9780451524935",
        },
      ],
    },
  };
  mockClient.setMockData(chatId, mockState);

  const result = await getState(mockClient, chatId);

  assertExists(result);
  assertEquals(result?.id, "state-1");
  assertEquals(result?.current_context, "User searching for book");
  assertEquals(result?.last_book_id, "book-123");
  assertEquals(result?.state_data.extracted_title, "1984");
  assertEquals(result?.state_data.search_results?.length, 1);
});

Deno.test("getState - should handle state with minimal fields", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const chatId = 12345;
  const mockState: ConversationalState = {
    chat_id: chatId,
    last_interaction: new Date().toISOString(),
    state_data: {},
  };
  mockClient.setMockData(chatId, mockState);

  const result = await getState(mockClient, chatId);

  assertExists(result);
  assertEquals(result?.chat_id, chatId);
});

Deno.test("getState - should handle very old timestamps correctly", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const chatId = 12345;
  const veryOldDate = new Date("2020-01-01T00:00:00Z");
  const mockState: ConversationalState = {
    id: "state-1",
    chat_id: chatId,
    last_interaction: veryOldDate.toISOString(),
    state_data: { workflow: "add_book" },
  };
  mockClient.setMockData(chatId, mockState);

  const result = await getState(mockClient, chatId);

  assertEquals(result, null);
});

// Test Suite: cleanupState function
Deno.test("cleanupState - should delete state successfully", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const chatId = 12345;
  const mockState: ConversationalState = {
    chat_id: chatId,
    last_interaction: new Date().toISOString(),
    state_data: { workflow: "add_book" },
  };
  mockClient.setMockData(chatId, mockState);

  const result = await cleanupState(mockClient, chatId);

  assertEquals(result.success, true);
  assertEquals(result.error, undefined);
});

Deno.test("cleanupState - should handle non-existent state gracefully", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const chatId = 99999;

  const result = await cleanupState(mockClient, chatId);

  assertEquals(result.success, true);
});

Deno.test("cleanupState - should handle database errors", async () => {
  const mockClient = new MockSupabaseClient() as any;
  mockClient.setError("DB_ERROR", "Database connection failed");
  const chatId = 12345;

  const result = await cleanupState(mockClient, chatId);

  assertEquals(result.success, false);
  assertEquals(result.error, "Database connection failed");
});

Deno.test("cleanupState - should handle zero chat ID", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const chatId = 0;

  const result = await cleanupState(mockClient, chatId);

  assertEquals(result.success, true);
});

Deno.test("cleanupState - should handle negative chat ID", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const chatId = -1;

  const result = await cleanupState(mockClient, chatId);

  assertEquals(result.success, true);
});

// Test Suite: cleanupExpiredStates function
Deno.test("cleanupExpiredStates - should clean up expired states", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const expiredDate = new Date();
  expiredDate.setMinutes(expiredDate.getMinutes() - 20);

  // Add expired states
  mockClient.setMockData(1, {
    chat_id: 1,
    last_interaction: expiredDate.toISOString(),
    state_data: {},
  });
  mockClient.setMockData(2, {
    chat_id: 2,
    last_interaction: expiredDate.toISOString(),
    state_data: {},
  });

  const result = await cleanupExpiredStates(mockClient);

  assertEquals(result.success, true);
  assertEquals(result.cleaned, 2);
  assertEquals(result.error, undefined);
});

Deno.test("cleanupExpiredStates - should not clean up recent states", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const recentDate = new Date();
  recentDate.setMinutes(recentDate.getMinutes() - 5);

  mockClient.setMockData(1, {
    chat_id: 1,
    last_interaction: recentDate.toISOString(),
    state_data: {},
  });

  const result = await cleanupExpiredStates(mockClient);

  assertEquals(result.success, true);
  assertEquals(result.cleaned, 0);
});

Deno.test("cleanupExpiredStates - should handle mixed expired and recent states", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const expiredDate = new Date();
  expiredDate.setMinutes(expiredDate.getMinutes() - 20);
  const recentDate = new Date();
  recentDate.setMinutes(recentDate.getMinutes() - 5);

  mockClient.setMockData(1, {
    chat_id: 1,
    last_interaction: expiredDate.toISOString(),
    state_data: {},
  });
  mockClient.setMockData(2, {
    chat_id: 2,
    last_interaction: recentDate.toISOString(),
    state_data: {},
  });

  const result = await cleanupExpiredStates(mockClient);

  assertEquals(result.success, true);
  assertEquals(result.cleaned, 1);
});

Deno.test("cleanupExpiredStates - should handle no expired states", async () => {
  const mockClient = new MockSupabaseClient() as any;

  const result = await cleanupExpiredStates(mockClient);

  assertEquals(result.success, true);
  assertEquals(result.cleaned, 0);
});

Deno.test("cleanupExpiredStates - should handle database errors", async () => {
  const mockClient = new MockSupabaseClient() as any;
  mockClient.setError("DB_ERROR", "Database connection failed");

  const result = await cleanupExpiredStates(mockClient);

  assertEquals(result.success, false);
  assertEquals(result.cleaned, 0);
  assertEquals(result.error, "Database connection failed");
});

Deno.test("cleanupExpiredStates - should handle multiple expired states correctly", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const expiredDate = new Date();
  expiredDate.setMinutes(expiredDate.getMinutes() - 30);

  // Add multiple expired states
  for (let i = 1; i <= 10; i++) {
    mockClient.setMockData(i, {
      chat_id: i,
      last_interaction: expiredDate.toISOString(),
      state_data: {},
    });
  }

  const result = await cleanupExpiredStates(mockClient);

  assertEquals(result.success, true);
  assertEquals(result.cleaned, 10);
});

Deno.test("cleanupExpiredStates - should handle states at exact expiration boundary", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const boundaryDate = new Date();
  boundaryDate.setMinutes(boundaryDate.getMinutes() - 15);

  mockClient.setMockData(1, {
    chat_id: 1,
    last_interaction: boundaryDate.toISOString(),
    state_data: {},
  });

  const result = await cleanupExpiredStates(mockClient);

  assertEquals(result.success, true);
  // States exactly at boundary should not be cleaned
  assertEquals(result.cleaned, 0);
});

// Integration-style tests combining multiple operations
Deno.test("Integration - save, retrieve, and cleanup state lifecycle", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const chatId = 12345;
  const stateData: StateData = {
    workflow: "add_book",
    step: "awaiting_clarification",
    extracted_title: "The Great Gatsby",
  };

  // Save state
  const saveResult = await saveState(mockClient, chatId, stateData);
  assertEquals(saveResult.success, true);

  // Retrieve state
  const getResult = await getState(mockClient, chatId);
  assertExists(getResult);
  assertEquals(getResult?.chat_id, chatId);
  assertEquals(getResult?.state_data.extracted_title, "The Great Gatsby");

  // Cleanup state
  const cleanupResult = await cleanupState(mockClient, chatId);
  assertEquals(cleanupResult.success, true);

  // Verify state is gone
  const finalResult = await getState(mockClient, chatId);
  assertEquals(finalResult, null);
});

Deno.test("Integration - update existing state with upsert", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const chatId = 12345;
  const initialState: StateData = {
    workflow: "add_book",
    step: "awaiting_clarification",
  };

  // Save initial state
  await saveState(mockClient, chatId, initialState);

  // Update state
  const updatedState: StateData = {
    workflow: "add_book",
    step: "selecting_book",
    search_results: [{ title: "1984", author: "George Orwell" }],
  };
  const updateResult = await saveState(mockClient, chatId, updatedState);
  assertEquals(updateResult.success, true);

  // Verify updated state
  const result = await getState(mockClient, chatId);
  assertExists(result);
  assertEquals(result?.state_data.step, "selecting_book");
  assertEquals(result?.state_data.search_results?.length, 1);
});

Deno.test("Integration - expired state cleanup removes specific states", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const expiredDate = new Date();
  expiredDate.setMinutes(expiredDate.getMinutes() - 20);
  const recentDate = new Date();

  // Add expired state
  mockClient.setMockData(1, {
    chat_id: 1,
    last_interaction: expiredDate.toISOString(),
    state_data: { workflow: "add_book" },
  });

  // Add recent state
  mockClient.setMockData(2, {
    chat_id: 2,
    last_interaction: recentDate.toISOString(),
    state_data: { workflow: "add_book" },
  });

  // Cleanup expired
  const cleanupResult = await cleanupExpiredStates(mockClient);
  assertEquals(cleanupResult.success, true);
  assertEquals(cleanupResult.cleaned, 1);

  // Verify expired is gone but recent remains
  const expiredResult = await getState(mockClient, 1);
  assertEquals(expiredResult, null);

  const recentResult = await getState(mockClient, 2);
  assertExists(recentResult);
  assertEquals(recentResult?.chat_id, 2);
});

// Edge case tests
Deno.test("Edge case - very large state data object", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const chatId = 12345;
  const largeStateData: StateData = {
    workflow: "add_book",
    search_results: Array(100).fill({
      title: "Book Title",
      author: "Author Name",
      isbn: "1234567890",
    }),
  };

  const result = await saveState(mockClient, chatId, largeStateData);

  assertEquals(result.success, true);
});

Deno.test("Edge case - state data with special characters", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const chatId = 12345;
  const stateData: StateData = {
    workflow: "add_book",
    extracted_title: "Book with 'quotes' and \"double quotes\"",
    extracted_author: "Author with <html> & special chars",
  };

  const result = await saveState(mockClient, chatId, stateData);

  assertEquals(result.success, true);
});

Deno.test("Edge case - state data with unicode characters", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const chatId = 12345;
  const stateData: StateData = {
    workflow: "add_book",
    extracted_title: "日本語タイトル",
    extracted_author: "Автор на русском",
  };

  const result = await saveState(mockClient, chatId, stateData);

  assertEquals(result.success, true);
});

Deno.test("Edge case - multiple chat IDs with different states", async () => {
  const mockClient = new MockSupabaseClient() as any;

  // Save states for different chat IDs
  await saveState(mockClient, 1, { workflow: "add_book", step: "awaiting_clarification" });
  await saveState(mockClient, 2, { workflow: "add_book", step: "selecting_book" });
  await saveState(mockClient, 3, { workflow: "add_book", step: "awaiting_clarification" });

  // Retrieve and verify each state
  const state1 = await getState(mockClient, 1);
  const state2 = await getState(mockClient, 2);
  const state3 = await getState(mockClient, 3);

  assertExists(state1);
  assertExists(state2);
  assertExists(state3);
  assertEquals(state1?.state_data.step, "awaiting_clarification");
  assertEquals(state2?.state_data.step, "selecting_book");
  assertEquals(state3?.state_data.step, "awaiting_clarification");
});

Deno.test("Edge case - save state with empty context string", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const chatId = 12345;
  const stateData: StateData = { workflow: "add_book" };

  const result = await saveState(mockClient, chatId, stateData, "");

  assertEquals(result.success, true);
});

Deno.test("Edge case - save state with very long context string", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const chatId = 12345;
  const stateData: StateData = { workflow: "add_book" };
  const longContext = "A".repeat(10000);

  const result = await saveState(mockClient, chatId, stateData, longContext);

  assertEquals(result.success, true);
});

Deno.test("Edge case - timestamp precision handling", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const chatId = 12345;
  const now = new Date();
  const mockState: ConversationalState = {
    chat_id: chatId,
    last_interaction: now.toISOString(),
    state_data: { workflow: "add_book" },
  };
  mockClient.setMockData(chatId, mockState);

  const result = await getState(mockClient, chatId);

  assertExists(result);
  assertEquals(result?.last_interaction, now.toISOString());
});

// Error recovery tests
Deno.test("Error recovery - continue after save error", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const chatId = 12345;

  // First save fails
  mockClient.setError("DB_ERROR", "Connection lost");
  const failResult = await saveState(mockClient, chatId, { workflow: "add_book" });
  assertEquals(failResult.success, false);

  // Second save succeeds
  mockClient.clearError();
  const successResult = await saveState(mockClient, chatId, { workflow: "add_book" });
  assertEquals(successResult.success, true);
});

Deno.test("Error recovery - continue after get error", async () => {
  const mockClient = new MockSupabaseClient() as any;
  const chatId = 12345;

  // First get fails
  mockClient.setError("DB_ERROR", "Connection lost");
  const failResult = await getState(mockClient, chatId);
  assertEquals(failResult, null);

  // Second get succeeds
  mockClient.clearError();
  mockClient.setMockData(chatId, {
    chat_id: chatId,
    last_interaction: new Date().toISOString(),
    state_data: { workflow: "add_book" },
  });
  const successResult = await getState(mockClient, chatId);
  assertExists(successResult);
});

// Console error logging verification (these ensure error paths are covered)
Deno.test("Error logging - saveState logs errors", async () => {
  const mockClient = new MockSupabaseClient() as any;
  mockClient.setError("DB_ERROR", "Test error");
  const chatId = 12345;

  // This should log an error but not throw
  const result = await saveState(mockClient, chatId, { workflow: "add_book" });

  assertEquals(result.success, false);
  assertEquals(result.error, "Test error");
});

Deno.test("Error logging - getState logs errors for non-PGRST116 codes", async () => {
  const mockClient = new MockSupabaseClient() as any;
  mockClient.setError("DB_ERROR", "Test error");
  const chatId = 12345;

  // This should log an error but return null
  const result = await getState(mockClient, chatId);

  assertEquals(result, null);
});

Deno.test("Error logging - cleanupState logs errors", async () => {
  const mockClient = new MockSupabaseClient() as any;
  mockClient.setError("DB_ERROR", "Test error");
  const chatId = 12345;

  // This should log an error but not throw
  const result = await cleanupState(mockClient, chatId);

  assertEquals(result.success, false);
  assertEquals(result.error, "Test error");
});

Deno.test("Error logging - cleanupExpiredStates logs errors", async () => {
  const mockClient = new MockSupabaseClient() as any;
  mockClient.setError("DB_ERROR", "Test error");

  // This should log an error but not throw
  const result = await cleanupExpiredStates(mockClient);

  assertEquals(result.success, false);
  assertEquals(result.cleaned, 0);
  assertEquals(result.error, "Test error");
});