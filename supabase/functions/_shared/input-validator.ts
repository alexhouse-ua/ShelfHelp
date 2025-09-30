/**
 * Input validation and sanitization utilities
 * @module input-validator
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: {
    title: string;
    author: string;
  };
}

const MAX_TITLE_LENGTH = 500;
const MAX_AUTHOR_LENGTH = 200;

/**
 * Validate and sanitize book title and author inputs
 * @param title - Book title
 * @param author - Author name
 * @returns Validation result with sanitized values
 */
export function validateBookInput(title: string, author: string): ValidationResult {
  // Title validation
  if (!title || title.trim().length === 0) {
    return { valid: false, error: "Title is required" };
  }

  const trimmedTitle = title.trim();
  if (trimmedTitle.length > MAX_TITLE_LENGTH) {
    return { valid: false, error: `Title too long (max ${MAX_TITLE_LENGTH} characters)` };
  }

  // Author validation
  const trimmedAuthor = author?.trim() || "";
  if (trimmedAuthor.length > MAX_AUTHOR_LENGTH) {
    return { valid: false, error: `Author name too long (max ${MAX_AUTHOR_LENGTH} characters)` };
  }

  return {
    valid: true,
    sanitized: {
      title: sanitizeText(trimmedTitle),
      author: sanitizeText(trimmedAuthor),
    },
  };
}

/**
 * Sanitize text for use in API calls and URLs
 * - Remove control characters
 * - Normalize whitespace
 * - Preserve valid punctuation
 */
function sanitizeText(text: string): string {
  return (
    text
      // deno-lint-ignore no-control-regex
      .replace(/[\x00-\x1F\x7F]/g, "") // Remove control characters
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim()
  );
}

/**
 * Sanitize error messages before showing to users
 * - Remove API keys, tokens, and internal details
 * - Keep user-friendly error descriptions
 */
export function sanitizeErrorMessage(error: string): string {
  return error
    .replace(/key=[\w-]+/gi, "key=***")
    .replace(/token=[\w-]+/gi, "token=***")
    .replace(/Bearer [\w-]+/gi, "Bearer ***")
    .replace(/\b[A-Z0-9]{32,}\b/g, "***"); // Generic API key pattern
}
