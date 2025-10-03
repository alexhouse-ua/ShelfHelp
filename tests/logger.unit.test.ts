/**
 * Unit tests for centralized logger utility
 */
import { assertEquals, assertMatch } from "jsr:@std/assert@1";
import { assertSpyCalls, spy } from "jsr:@std/testing@1/mock";
import { createLogger, generateRequestId } from "../supabase/functions/_shared/logger.ts";

Deno.test("Logger - generateRequestId returns valid UUID format", () => {
  const requestId = generateRequestId();

  // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  assertMatch(requestId, uuidRegex);
});

Deno.test("Logger - createLogger returns logger instance with correct requestId", () => {
  const requestId = "test-request-123";
  const logger = createLogger(requestId);

  assertEquals(typeof logger.info, "function");
  assertEquals(typeof logger.warn, "function");
  assertEquals(typeof logger.error, "function");
  assertEquals(typeof logger.debug, "function");
});

Deno.test("Logger - info() outputs correct structured JSON format", () => {
  const requestId = "test-request-info";
  const logger = createLogger(requestId);

  // Spy on console.log
  const logSpy = spy(console, "log");

  try {
    logger.info("Test info message", { key: "value" });

    // Verify console.log was called once
    assertSpyCalls(logSpy, 1);

    // Parse the logged output
    const loggedOutput = logSpy.calls[0].args[0];
    const parsed = JSON.parse(loggedOutput);

    assertEquals(parsed.requestId, requestId);
    assertEquals(parsed.level, "info");
    assertEquals(parsed.message, "Test info message");
    assertEquals(parsed.context.key, "value");
    assertEquals(typeof parsed.timestamp, "string");
  } finally {
    logSpy.restore();
  }
});

Deno.test("Logger - error() outputs correct structured JSON format", () => {
  const requestId = "test-request-error";
  const logger = createLogger(requestId);

  // Spy on console.error
  const errorSpy = spy(console, "error");

  try {
    logger.error("Test error message", { errorCode: 500 });

    // Verify console.error was called once
    assertSpyCalls(errorSpy, 1);

    // Parse the logged output
    const loggedOutput = errorSpy.calls[0].args[0];
    const parsed = JSON.parse(loggedOutput);

    assertEquals(parsed.requestId, requestId);
    assertEquals(parsed.level, "error");
    assertEquals(parsed.message, "Test error message");
    assertEquals(parsed.context.errorCode, 500);
    assertEquals(typeof parsed.timestamp, "string");
  } finally {
    errorSpy.restore();
  }
});

Deno.test("Logger - warn() outputs correct structured JSON format", () => {
  const requestId = "test-request-warn";
  const logger = createLogger(requestId);

  // Spy on console.warn
  const warnSpy = spy(console, "warn");

  try {
    logger.warn("Test warning message");

    // Verify console.warn was called once
    assertSpyCalls(warnSpy, 1);

    // Parse the logged output
    const loggedOutput = warnSpy.calls[0].args[0];
    const parsed = JSON.parse(loggedOutput);

    assertEquals(parsed.requestId, requestId);
    assertEquals(parsed.level, "warn");
    assertEquals(parsed.message, "Test warning message");
    assertEquals(parsed.context, {});
    assertEquals(typeof parsed.timestamp, "string");
  } finally {
    warnSpy.restore();
  }
});

Deno.test("Logger - debug() outputs correct structured JSON format", () => {
  const requestId = "test-request-debug";
  const logger = createLogger(requestId);

  // Spy on console.debug
  const debugSpy = spy(console, "debug");

  try {
    logger.debug("Test debug message", { debugInfo: "details" });

    // Verify console.debug was called once
    assertSpyCalls(debugSpy, 1);

    // Parse the logged output
    const loggedOutput = debugSpy.calls[0].args[0];
    const parsed = JSON.parse(loggedOutput);

    assertEquals(parsed.requestId, requestId);
    assertEquals(parsed.level, "debug");
    assertEquals(parsed.message, "Test debug message");
    assertEquals(parsed.context.debugInfo, "details");
    assertEquals(typeof parsed.timestamp, "string");
  } finally {
    debugSpy.restore();
  }
});

Deno.test("Logger - context object is properly included in log output", () => {
  const requestId = "test-request-context";
  const logger = createLogger(requestId);

  const logSpy = spy(console, "log");

  try {
    const complexContext = {
      userId: 123,
      action: "book_addition",
      metadata: {
        bookId: "abc",
        source: "telegram",
      },
    };

    logger.info("Complex context test", complexContext);

    assertSpyCalls(logSpy, 1);

    const loggedOutput = logSpy.calls[0].args[0];
    const parsed = JSON.parse(loggedOutput);

    assertEquals(parsed.context.userId, 123);
    assertEquals(parsed.context.action, "book_addition");
    assertEquals(parsed.context.metadata.bookId, "abc");
    assertEquals(parsed.context.metadata.source, "telegram");
  } finally {
    logSpy.restore();
  }
});
