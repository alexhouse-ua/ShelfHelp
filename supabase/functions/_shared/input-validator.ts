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
 * Validate and sanitize user-provided book title and author.
 *
 * Performs presence and length checks and returns cleaned values when validation succeeds.
 *
 * @param title - The raw book title provided by the user (may include surrounding whitespace or control characters)
 * @param author - The raw author name provided by the user (may be empty; may include surrounding whitespace or control characters)
 * @returns `ValidationResult` with `valid: true` and `sanitized` containing cleaned `title` and `author` when inputs pass validation; otherwise `valid: false` and an `error` message
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
 * Normalize and clean a text string for safe use in API calls and URLs.
 *
 * Removes control characters, collapses consecutive whitespace into single spaces, and trims surrounding whitespace.
 *
 * @param text - The input string to sanitize
 * @returns The sanitized string with control characters removed, internal whitespace normalized, and trimmed
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
 * Redacts sensitive keys, tokens, and long API-key-like sequences from an error message.
 *
 * @param error - The original error message potentially containing sensitive data
 * @returns The error message with sensitive values replaced by `***`
 */
export function sanitizeErrorMessage(error: string): string {
  return error
    .replace(/key=[\w-]+/gi, "key=***")
    .replace(/token=[\w-]+/gi, "token=***")
    .replace(/Bearer [\w-]+/gi, "Bearer ***")
    .replace(/\b[A-Z0-9]{32,}\b/g, "***"); // Generic API key pattern
}
