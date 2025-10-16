/**
 * Hardcover GraphQL API Client
 *
 * Provides a robust, rate-limited client for interacting with the Hardcover API.
 * Features:
 * - Rate limiting: 60 requests/minute with exponential backoff
 * - TTL-based caching (books: 24h, activities: 5min, lists: 1h, user: 1h)
 * - Comprehensive error handling for all HTTP status codes
 * - Structured logging for all operations
 *
 * @module hardcover-client
 */

import { createLogger } from "./logger.ts";

/**
 * Cache configuration with TTL values for different data types
 */
export interface CacheConfig {
  books: { ttl: number }; // 24h - metadata stable
  activities: { ttl: number }; // 5min - progress updates
  lists: { ttl: number }; // 1h - lists change slowly
  user: { ttl: number }; // 1h - profile stable
}

/**
 * Cache types for different data categories
 */
export type CacheType = "books" | "activities" | "lists" | "user";

/**
 * GraphQL response wrapper
 */
export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    extensions?: Record<string, unknown>;
  }>;
}

/**
 * Hardcover Book type
 */
export interface HardcoverBook {
  id: number;
  title: string;
  pages?: number;
  release_date?: string;
  description?: string;
  isbn_10?: string;
  isbn_13?: string;
  moods?: string[];
  content_warnings?: string[];
  users_count?: number;
  ratings_count?: number;
  lists_count?: number;
  series_name?: string;
  series_position?: number;
  genres?: Array<{ name: string }>;
  authors?: Array<{ name: string }>;
}

/**
 * Hardcover Activity type
 */
export interface HardcoverActivity {
  id: string;
  book_id: number;
  event: string;
  created_at: string;
  data?: Record<string, unknown>;
}

/**
 * Hardcover List type
 */
export interface HardcoverList {
  id: string;
  name: string;
  description?: string;
  privacy?: string;
  books_count?: number;
  list_books?: Array<{
    book_id: number;
    position: number;
    date_added: string;
  }>;
}

/**
 * Hardcover Edition type
 */
export interface HardcoverEdition {
  id: number;
  book_id: number;
  isbn_10?: string;
  isbn_13?: string;
  physical_format?: string;
  pages?: number;
  publisher_id?: number;
  release_date?: string;
  asin?: string;
}

/**
 * Hardcover Author type
 */
export interface HardcoverAuthor {
  id: number;
  name: string;
  biography?: string;
  born_date?: string;
  born_year?: number;
  is_bipoc?: boolean;
  is_lgbtq?: boolean;
  books_count?: number;
}

/**
 * Hardcover User type
 */
export interface HardcoverUser {
  id: string;
  username: string;
  location?: string;
  pronouns?: string;
  birthdate?: string;
  books_count?: number;
  followers_count?: number;
}

/**
 * Book search filters
 */
export interface BookFilters {
  title?: string;
  author?: string;
  isbn?: string;
}

/**
 * Author search filters
 */
export interface AuthorFilters {
  name?: string;
}

/**
 * Call options for API requests
 */
export interface CallOptions {
  skipCache?: boolean;
  requestId?: string;
}

/**
 * Cache entry with expiration
 */
interface CacheEntry<T> {
  data: T;
  expiresAt: number; // Date.now() + ttl
}

/**
 * Default cache configuration (TTL values in milliseconds)
 */
const DEFAULT_CACHE_CONFIG: CacheConfig = {
  books: { ttl: 24 * 60 * 60 * 1000 }, // 24 hours
  activities: { ttl: 5 * 60 * 1000 }, // 5 minutes
  lists: { ttl: 60 * 60 * 1000 }, // 1 hour
  user: { ttl: 60 * 60 * 1000 }, // 1 hour
};

/**
 * Cache manager for Hardcover API responses
 */
class CacheManager {
  private cache = new Map<string, CacheEntry<unknown>>();
  private config: CacheConfig;

  constructor(config: CacheConfig = DEFAULT_CACHE_CONFIG) {
    this.config = config;
  }

  /**
   * Generate cache key from query and variables
   */
  private generateKey(query: string, variables: unknown): string {
    const combined = `${query}:${JSON.stringify(variables)}`;
    return `hc:${this.hashString(combined)}`;
  }

  /**
   * Simple string hash function for cache keys
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get cached value if not expired
   */
  get<T>(query: string, variables: unknown, _type: CacheType): T | null {
    const key = this.generateKey(query, variables);
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Store value in cache with TTL
   */
  set<T>(query: string, variables: unknown, type: CacheType, value: T): void {
    const key = this.generateKey(query, variables);
    const ttl = this.config[type].ttl;
    const entry: CacheEntry<T> = {
      data: value,
      expiresAt: Date.now() + ttl,
    };
    this.cache.set(key, entry);
  }

  /**
   * Invalidate specific cache entry
   */
  invalidate(query: string, variables: unknown): void {
    const key = this.generateKey(query, variables);
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries or by type
   */
  clear(_type?: CacheType): void {
    // Type-specific clear not implemented in simple version
    // Would require tracking keys by type
    this.cache.clear();
  }
}

/**
 * Rate limiter with token bucket algorithm
 */
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per millisecond

  constructor(requestsPerMinute: number) {
    this.maxTokens = requestsPerMinute;
    this.tokens = requestsPerMinute;
    this.lastRefill = Date.now();
    this.refillRate = requestsPerMinute / (60 * 1000); // tokens per ms
  }

  /**
   * Refill tokens based on time elapsed
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Queue a request and wait if necessary
   */
  async queueRequest<T>(
    fn: () => Promise<T>,
    logger?: ReturnType<typeof createLogger>,
  ): Promise<T> {
    this.refill();

    if (this.tokens < 1) {
      const waitTime = Math.ceil((1 - this.tokens) / this.refillRate);

      if (logger) {
        logger.info("Rate limit wait", {
          operation: "rate_limit",
          waitTime,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.refill();
    }

    this.tokens -= 1;
    return await fn();
  }
}

/**
 * Hardcover API Client
 *
 * @example
 * ```typescript
 * const client = new HardcoverClient();
 * const book = await client.fetchBook(12345);
 * ```
 */
export class HardcoverClient {
  private readonly apiUrl = "https://api.hardcover.app/v1/graphql";
  private readonly cache: CacheManager;
  private readonly rateLimiter: RateLimiter;
  private readonly apiToken: string;

  constructor(apiToken?: string, cacheConfig?: CacheConfig) {
    // Validate API token
    this.apiToken = apiToken || Deno.env.get("HARDCOVER_API_TOKEN") || "";
    if (!this.apiToken) {
      throw new Error("HARDCOVER_API_TOKEN environment variable is required");
    }

    this.cache = new CacheManager(cacheConfig);
    this.rateLimiter = new RateLimiter(60); // 60 requests per minute
  }

  /**
   * Core API call method with rate limiting, caching, and error handling
   */
  private async callHardcoverAPI<T>(
    query: string,
    variables: Record<string, unknown>,
    cacheType: CacheType,
    options: CallOptions = {},
  ): Promise<T> {
    const requestId = options.requestId || crypto.randomUUID();
    const logger = createLogger(requestId);
    const startTime = Date.now();

    // Check cache first (unless skipCache is true)
    if (!options.skipCache) {
      const cached = this.cache.get<T>(query, variables, cacheType);
      if (cached !== null) {
        logger.info("Cache hit", {
          operation: "cache_check",
          cacheHit: true,
          cacheType,
        });
        return cached;
      }
      logger.info("Cache miss", {
        operation: "cache_check",
        cacheHit: false,
        cacheType,
      });
    }

    // Exponential backoff parameters
    const maxRetries = 3;
    const backoffDelays = [2000, 4000, 8000]; // 2s, 4s, 8s

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info("API call attempt", {
          operation: "hardcover_query",
          cacheType,
          attempt,
        });

        const response = await this.rateLimiter.queueRequest(async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

          try {
            const res = await fetch(this.apiUrl, {
              method: "POST",
              headers: {
                authorization: `Bearer ${this.apiToken}`,
                "content-type": "application/json",
              },
              body: JSON.stringify({ query, variables }),
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
            return res;
          } catch (error) {
            clearTimeout(timeoutId);
            throw error;
          }
        }, logger);

        const durationMs = Date.now() - startTime;

        // Handle different HTTP status codes
        if (response.status === 200) {
          const jsonData = (await response.json()) as GraphQLResponse<T>;

          // GraphQL can return 200 with errors in the body
          if (jsonData.errors && jsonData.errors.length > 0) {
            logger.warn("GraphQL errors in response", {
              operation: "hardcover_query",
              cacheType,
              errors: jsonData.errors,
              attempt,
            });
          }

          if (jsonData.data) {
            // Cache successful response
            this.cache.set(query, variables, cacheType, jsonData.data);

            logger.info("API call success", {
              operation: "hardcover_query",
              cacheType,
              cacheHit: false,
              durationMs,
              status: 200,
              attempt,
            });

            return jsonData.data;
          } else {
            throw new Error("HARDCOVER_API_ERROR: No data in response");
          }
        }

        if (response.status === 401) {
          logger.error("Token expired", {
            operation: "hardcover_error",
            errorType: "HARDCOVER_TOKEN_EXPIRED",
            status: 401,
            attempt,
          });
          throw new Error("HARDCOVER_TOKEN_EXPIRED");
        }

        if (response.status === 403) {
          logger.error("Access denied", {
            operation: "hardcover_error",
            errorType: "HARDCOVER_API_ERROR:403",
            status: 403,
            attempt,
          });
          throw new Error("HARDCOVER_API_ERROR:403");
        }

        if (response.status === 404) {
          logger.error("Not found", {
            operation: "hardcover_error",
            errorType: "HARDCOVER_API_ERROR:404",
            status: 404,
            attempt,
          });
          throw new Error("HARDCOVER_API_ERROR:404");
        }

        if (response.status === 429) {
          // Rate limited - retry with exponential backoff
          if (attempt < maxRetries) {
            const waitTime = backoffDelays[attempt - 1];
            logger.warn("Rate limited, retrying", {
              operation: "rate_limit",
              waitTime,
              attempt,
            });
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            continue; // Retry
          } else {
            logger.error("Rate limit max retries", {
              operation: "hardcover_error",
              errorType: "HARDCOVER_RATE_LIMITED",
              attempt,
              message: "Max retries exhausted",
            });
            throw new Error("HARDCOVER_RATE_LIMITED");
          }
        }

        if (response.status === 500) {
          logger.error("Server error", {
            operation: "hardcover_error",
            errorType: "HARDCOVER_API_ERROR:500",
            status: 500,
            attempt,
          });
          throw new Error("HARDCOVER_API_ERROR:500");
        }

        // Other status codes
        logger.error("Unexpected status", {
          operation: "hardcover_error",
          errorType: `HARDCOVER_API_ERROR:${response.status}`,
          status: response.status,
          attempt,
        });
        throw new Error(`HARDCOVER_API_ERROR:${response.status}`);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          logger.error("Request timeout", {
            operation: "hardcover_error",
            errorType: "HARDCOVER_TIMEOUT",
            attempt,
          });
          throw new Error("HARDCOVER_TIMEOUT");
        }

        // If it's not a rate limit error and we've already logged it, just throw
        if (
          attempt === maxRetries ||
          (error instanceof Error && !error.message.includes("HARDCOVER_RATE_LIMITED"))
        ) {
          throw error;
        }
      }
    }

    // Should not reach here, but TypeScript needs this
    throw new Error("HARDCOVER_API_ERROR: Unexpected error");
  }

  /**
   * Fetch a book by ID
   * @param id - Book ID
   * @param options - Call options (skipCache, requestId)
   * @returns Book data
   */
  async fetchBook(id: number, options?: CallOptions): Promise<HardcoverBook> {
    const { query, variables } = HardcoverQueries.getBook(id);
    const response = await this.callHardcoverAPI<{ books: HardcoverBook[] }>(
      query,
      variables,
      "books",
      options,
    );
    if (!response.books || response.books.length === 0) {
      throw new Error("HARDCOVER_API_ERROR:404");
    }
    return response.books[0];
  }

  /**
   * Fetch user activities (reading sessions) since a given date
   * @param userId - User ID
   * @param since - Date to fetch activities from
   * @param options - Call options
   * @returns Array of activities
   */
  async fetchUserActivities(
    userId: string,
    since: Date,
    options?: CallOptions,
  ): Promise<HardcoverActivity[]> {
    const { query, variables } = HardcoverQueries.getUserActivities(userId, since);
    const response = await this.callHardcoverAPI<{ activities: HardcoverActivity[] }>(
      query,
      variables,
      "activities",
      options,
    );
    return response.activities || [];
  }

  /**
   * Fetch user lists
   * @param userId - User ID
   * @param options - Call options
   * @returns Array of lists
   */
  async fetchUserLists(userId: string, options?: CallOptions): Promise<HardcoverList[]> {
    const { query, variables } = HardcoverQueries.getUserLists(userId);
    const response = await this.callHardcoverAPI<{ lists: HardcoverList[] }>(
      query,
      variables,
      "lists",
      options,
    );
    return response.lists || [];
  }

  /**
   * Fetch book editions by title
   * @param title - Book title
   * @param options - Call options
   * @returns Array of editions
   */
  async fetchEditions(title: string, options?: CallOptions): Promise<HardcoverEdition[]> {
    const { query, variables } = HardcoverQueries.getEditions(title);
    const response = await this.callHardcoverAPI<{ editions: HardcoverEdition[] }>(
      query,
      variables,
      "books",
      options,
    );
    return response.editions || [];
  }

  /**
   * Search authors by filters
   * @param filters - Author search filters
   * @param options - Call options
   * @returns Array of authors
   */
  async fetchAuthors(filters: AuthorFilters, options?: CallOptions): Promise<HardcoverAuthor[]> {
    const { query, variables } = HardcoverQueries.getAuthors(filters);
    const response = await this.callHardcoverAPI<{ authors: HardcoverAuthor[] }>(
      query,
      variables,
      "books",
      options,
    );
    return response.authors || [];
  }

  /**
   * Fetch current user profile
   * @param options - Call options
   * @returns User data
   */
  async fetchMe(options?: CallOptions): Promise<HardcoverUser> {
    const { query, variables } = HardcoverQueries.getMe();
    const response = await this.callHardcoverAPI<{ me: HardcoverUser }>(
      query,
      variables,
      "user",
      options,
    );
    if (!response.me) {
      throw new Error("HARDCOVER_API_ERROR:404");
    }
    return response.me;
  }
}

/**
 * GraphQL query builders for Hardcover API
 * All queries respect 3-level max depth constraint
 */
export const HardcoverQueries = {
  /**
   * Get book by ID
   */
  getBook(id: number): { query: string; variables: Record<string, unknown> } {
    return {
      query: `
        query GetBook($id: Int!) {
          books(where: {id: {_eq: $id}}) {
            id
            title
            pages
            release_date
            description
            isbn_10
            isbn_13
            moods
            content_warnings
            users_count
            ratings_count
            lists_count
            series_name
            series_position
            genres {
              name
            }
            authors {
              name
            }
          }
        }
      `,
      variables: { id },
    };
  },

  /**
   * Search books by filters
   */
  searchBooks(filters: BookFilters): { query: string; variables: Record<string, unknown> } {
    const where: Record<string, unknown> = {};

    if (filters.title) {
      where.title = { _iregex: filters.title };
    }
    if (filters.isbn) {
      where._or = [{ isbn_10: { _eq: filters.isbn } }, { isbn_13: { _eq: filters.isbn } }];
    }

    return {
      query: `
        query SearchBooks($where: books_bool_exp!) {
          books(where: $where, limit: 20) {
            id
            title
            pages
            release_date
            description
            isbn_10
            isbn_13
            moods
            content_warnings
            users_count
            ratings_count
            lists_count
            series_name
            series_position
            genres {
              name
            }
            authors {
              name
            }
          }
        }
      `,
      variables: { where },
    };
  },

  /**
   * Get user activities (reading sessions)
   */
  getUserActivities(
    userId: string,
    since: Date,
  ): { query: string; variables: Record<string, unknown> } {
    return {
      query: `
        query GetUserActivities($userId: String!, $since: timestamptz!) {
          activities(
            where: {
              user_id: {_eq: $userId},
              event: {_eq: "UserBookActivity"},
              created_at: {_gte: $since}
            },
            order_by: {created_at: asc}
          ) {
            id
            book_id
            event
            created_at
            data
          }
        }
      `,
      variables: {
        userId,
        since: since.toISOString(),
      },
    };
  },

  /**
   * Get user lists
   */
  getUserLists(userId: string): { query: string; variables: Record<string, unknown> } {
    return {
      query: `
        query GetUserLists($userId: String!) {
          lists(where: {user_id: {_eq: $userId}}) {
            id
            name
            description
            privacy
            books_count
            list_books {
              book_id
              position
              date_added
            }
          }
        }
      `,
      variables: { userId },
    };
  },

  /**
   * Get book editions by title
   */
  getEditions(title: string): { query: string; variables: Record<string, unknown> } {
    return {
      query: `
        query GetEditions($title: String!) {
          editions(where: {book: {title: {_iregex: $title}}}, limit: 20) {
            id
            book_id
            isbn_10
            isbn_13
            physical_format
            pages
            publisher_id
            release_date
            asin
          }
        }
      `,
      variables: { title },
    };
  },

  /**
   * Get authors by filters
   */
  getAuthors(filters: AuthorFilters): { query: string; variables: Record<string, unknown> } {
    const where: Record<string, unknown> = {};

    if (filters.name) {
      where.name = { _iregex: filters.name };
    }

    return {
      query: `
        query GetAuthors($where: authors_bool_exp!) {
          authors(where: $where, limit: 20) {
            id
            name
            biography
            born_date
            born_year
            is_bipoc
            is_lgbtq
            books_count
          }
        }
      `,
      variables: { where },
    };
  },

  /**
   * Get current user profile (me)
   */
  getMe(): { query: string; variables: Record<string, unknown> } {
    return {
      query: `
        query GetMe {
          me {
            id
            username
            location
            pronouns
            birthdate
            books_count
            followers_count
          }
        }
      `,
      variables: {},
    };
  },
};
