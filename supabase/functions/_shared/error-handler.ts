/**
 * Centralized error handling utility for Supabase Edge Functions
 * Provides consistent error response formatting with HTTP status codes
 */

/**
 * Standard error response format
 */
export interface ErrorResponse {
  error: string;
  requestId: string;
  details?: unknown;
}

/**
 * Creates a standardized error Response object
 * @param error - Error message string
 * @param requestId - Request ID for traceability
 * @param status - HTTP status code (default: 500)
 * @param details - Optional additional error details
 * @returns Response object with JSON error body
 */
export function createErrorResponse(
  error: string,
  requestId: string,
  status = 500,
  details?: unknown,
): Response {
  const body: ErrorResponse = {
    error,
    requestId,
  };

  if (details !== undefined) {
    body.details = details;
  }

  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Creates a 400 Bad Request error response
 * @param message - Error message
 * @param requestId - Request ID for traceability
 * @param details - Optional additional error details
 * @returns Response with 400 status
 */
export function badRequest(
  message: string,
  requestId: string,
  details?: unknown,
): Response {
  return createErrorResponse(message, requestId, 400, details);
}

/**
 * Creates a 401 Unauthorized error response
 * @param message - Error message
 * @param requestId - Request ID for traceability
 * @param details - Optional additional error details
 * @returns Response with 401 status
 */
export function unauthorized(
  message: string,
  requestId: string,
  details?: unknown,
): Response {
  return createErrorResponse(message, requestId, 401, details);
}

/**
 * Creates a 403 Forbidden error response
 * @param message - Error message
 * @param requestId - Request ID for traceability
 * @param details - Optional additional error details
 * @returns Response with 403 status
 */
export function forbidden(
  message: string,
  requestId: string,
  details?: unknown,
): Response {
  return createErrorResponse(message, requestId, 403, details);
}

/**
 * Creates a 404 Not Found error response
 * @param message - Error message
 * @param requestId - Request ID for traceability
 * @param details - Optional additional error details
 * @returns Response with 404 status
 */
export function notFound(
  message: string,
  requestId: string,
  details?: unknown,
): Response {
  return createErrorResponse(message, requestId, 404, details);
}

/**
 * Creates a 500 Internal Server Error response
 * @param message - Error message
 * @param requestId - Request ID for traceability
 * @param details - Optional additional error details
 * @returns Response with 500 status
 */
export function internalError(
  message: string,
  requestId: string,
  details?: unknown,
): Response {
  return createErrorResponse(message, requestId, 500, details);
}
