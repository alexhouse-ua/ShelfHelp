/**
 * Unit tests for centralized error handler utility
 */
import { assertEquals } from "jsr:@std/assert";
import {
  badRequest,
  createErrorResponse,
  forbidden,
  internalError,
  notFound,
  unauthorized,
} from "../supabase/functions/_shared/error-handler.ts";

Deno.test("Error Handler - createErrorResponse returns Response with correct status code", async () => {
  const response = createErrorResponse("Test error", "req-123", 418);

  assertEquals(response.status, 418);
  assertEquals(response.headers.get("Content-Type"), "application/json");

  const body = await response.json();
  assertEquals(body.error, "Test error");
  assertEquals(body.requestId, "req-123");
});

Deno.test("Error Handler - error response body has correct JSON structure", async () => {
  const response = createErrorResponse(
    "Test error message",
    "req-456",
    500,
    { additionalInfo: "Extra details" },
  );

  const body = await response.json();

  assertEquals(typeof body, "object");
  assertEquals(body.error, "Test error message");
  assertEquals(body.requestId, "req-456");
  assertEquals(body.details.additionalInfo, "Extra details");
});

Deno.test("Error Handler - requestId is included in error response", async () => {
  const requestId = "unique-request-789";
  const response = createErrorResponse("Error", requestId, 500);

  const body = await response.json();

  assertEquals(body.requestId, requestId);
});

Deno.test("Error Handler - badRequest helper returns 400 status", async () => {
  const response = badRequest("Invalid input", "req-bad-400");

  assertEquals(response.status, 400);

  const body = await response.json();
  assertEquals(body.error, "Invalid input");
  assertEquals(body.requestId, "req-bad-400");
});

Deno.test("Error Handler - unauthorized helper returns 401 status", async () => {
  const response = unauthorized("Missing credentials", "req-unauth-401");

  assertEquals(response.status, 401);

  const body = await response.json();
  assertEquals(body.error, "Missing credentials");
  assertEquals(body.requestId, "req-unauth-401");
});

Deno.test("Error Handler - forbidden helper returns 403 status", async () => {
  const response = forbidden("Access denied", "req-forbidden-403");

  assertEquals(response.status, 403);

  const body = await response.json();
  assertEquals(body.error, "Access denied");
  assertEquals(body.requestId, "req-forbidden-403");
});

Deno.test("Error Handler - notFound helper returns 404 status", async () => {
  const response = notFound("Resource not found", "req-notfound-404");

  assertEquals(response.status, 404);

  const body = await response.json();
  assertEquals(body.error, "Resource not found");
  assertEquals(body.requestId, "req-notfound-404");
});

Deno.test("Error Handler - internalError helper returns 500 status", async () => {
  const response = internalError("Server error", "req-internal-500");

  assertEquals(response.status, 500);

  const body = await response.json();
  assertEquals(body.error, "Server error");
  assertEquals(body.requestId, "req-internal-500");
});

Deno.test("Error Handler - error response with details field", async () => {
  const details = {
    validationErrors: ["Field 'email' is required", "Field 'name' is too short"],
    timestamp: new Date().toISOString(),
  };

  const response = badRequest("Validation failed", "req-details", details);

  const body = await response.json();

  assertEquals(body.error, "Validation failed");
  assertEquals(body.details.validationErrors.length, 2);
  assertEquals(body.details.validationErrors[0], "Field 'email' is required");
});

Deno.test("Error Handler - error response without details field", async () => {
  const response = notFound("Book not found", "req-no-details");

  const body = await response.json();

  assertEquals(body.error, "Book not found");
  assertEquals(body.requestId, "req-no-details");
  assertEquals(body.details, undefined);
});
