/**
 * Rate limiting utility for external API calls
 * @module rate-limiter
 */

interface RateLimitConfig {
  requestsPerSecond: number;
  burstSize?: number;
}

class RateLimiter {
  private lastRequestTime: number = 0;
  private readonly delayMs: number;

  constructor(config: RateLimitConfig) {
    this.delayMs = 1000 / config.requestsPerSecond;
  }

  /**
   * Wait if necessary to respect rate limit, then proceed
   */
  async throttle(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.delayMs) {
      const waitTime = this.delayMs - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }
}

// Rate limiters for different APIs
export const openLibraryLimiter = new RateLimiter({ requestsPerSecond: 1 });
export const goodreadsLimiter = new RateLimiter({ requestsPerSecond: 0.3 }); // ~2-3 sec delays

/**
 * Retry an asynchronous operation when it fails with an HTTP 429 (rate limit) using exponential backoff.
 *
 * Attempts the provided `fn` up to `maxRetries` times, waiting progressively longer between retries when the error
 * is an HTTP `Response` with status `429`. Non-429 errors are rethrown immediately.
 *
 * @param fn - Function that performs the operation to retry.
 * @param maxRetries - Maximum number of attempts (including the first). Defaults to 3.
 * @param initialDelayMs - Initial backoff delay in milliseconds; each retry doubles the delay. Defaults to 1000.
 * @returns The resolved value from a successful invocation of `fn`.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 1000,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Only retry on rate limit errors
      if (error instanceof Response && error.status === 429) {
        const delay = initialDelayMs * Math.pow(2, attempt);
        console.log(`Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Don't retry other errors
      throw error;
    }
  }

  throw lastError || new Error("Max retries exceeded");
}
