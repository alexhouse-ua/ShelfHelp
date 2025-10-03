/**
 * Story 2.2: Mood-based recommendation service
 * Provides functions for generating embeddings and searching books by mood/preference
 * @module mood-recommendation
 */

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { createLogger } from "./logger.ts";

const GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
const GEMINI_EMBEDDING_MODEL = "gemini-embedding-001";
const GEMINI_EMBEDDING_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBEDDING_MODEL}:embedContent`;
const EMBEDDING_DIMENSIONS = 768;

/**
 * Book search result from hybrid search RPC
 */
export interface BookSearchResult {
  book_id: string;
  title: string;
  author: string;
  ai_summary: string | null;
  similarity_score: number;
  keyword_rank: number;
  combined_score: number;
}

/**
 * Formatted recommendation for display
 */
export interface FormattedRecommendation {
  bookId: string;
  title: string;
  author: string;
  summary: string;
  relevanceScore: number;
}

/**
 * Generate embedding vector for mood/preference text using Gemini API
 * Includes exponential backoff for rate limiting and timeout handling
 * @param moodText - User's mood or preference description
 * @param requestId - Request ID for logging
 * @returns 768-dimensional embedding vector
 * @throws Error if API call fails or returns invalid data
 */
export async function generateMoodEmbedding(
  moodText: string,
  requestId: string,
): Promise<number[]> {
  const logger = createLogger(requestId);
  const startTime = Date.now();

  // Validate input first to provide consistent error regardless of env setup
  if (!moodText || moodText.trim().length === 0) {
    logger.error("Empty mood text provided", {
      operation: "generate_embedding",
    });
    throw new Error("Empty mood text provided");
  }

  if (!GEMINI_API_KEY) {
    logger.error("Gemini API key not configured", {
      operation: "generate_embedding",
    });
    throw new Error("GOOGLE_GEMINI_API_KEY not configured");
  }

  logger.info("Generating embedding for mood query", {
    operation: "generate_embedding",
    moodTextLength: moodText.length,
  });

  // Exponential backoff configuration for rate limiting
  const maxRetries = 3;
  const baseDelayMs = 1000; // 1 second

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${GEMINI_EMBEDDING_URL}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: {
            parts: [{ text: moodText }],
          },
          task_type: "SEMANTIC_SIMILARITY",
          output_dimensionality: EMBEDDING_DIMENSIONS,
        }),
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logger.error("Gemini embedding API error", {
          operation: "generate_embedding",
          status: response.status,
          attempt,
          error: errorData,
        });

        if (response.status === 429) {
          // Rate limited - exponential backoff retry
          if (attempt < maxRetries) {
            const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
            logger.info("Rate limited, retrying with exponential backoff", {
              operation: "generate_embedding",
              attempt,
              delayMs,
            });
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            continue; // Retry
          }
          throw new Error("RATE_LIMIT");
        }

        throw new Error(`API_ERROR: ${response.status}`);
      }

      const data = await response.json();

      if (!data.embedding || !data.embedding.values) {
        logger.error("Invalid response from Gemini embedding API", {
          operation: "generate_embedding",
          response: data,
        });
        throw new Error("Invalid embedding response");
      }

      const embedding = data.embedding.values;

      if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
        logger.error("Invalid embedding dimensions", {
          operation: "generate_embedding",
          expectedDimensions: EMBEDDING_DIMENSIONS,
          actualDimensions: embedding.length,
        });
        throw new Error("Invalid embedding dimensions");
      }

      const durationMs = Date.now() - startTime;
      logger.info("Embedding generation complete", {
        operation: "generate_embedding",
        durationMs,
        dimensions: embedding.length,
        attempt,
      });

      return embedding;
    } catch (error) {
      const durationMs = Date.now() - startTime;

      if (error instanceof Error) {
        if (error.name === "AbortError" || error.name === "TimeoutError") {
          logger.error("Request timeout", {
            operation: "generate_embedding",
            durationMs,
            attempt,
          });
          throw new Error("TIMEOUT");
        }

        if (error.message === "RATE_LIMIT" && attempt === maxRetries) {
          logger.error("Rate limit exceeded after retries", {
            operation: "generate_embedding",
            durationMs,
            attempt,
          });
          throw error;
        }

        if (error.message.startsWith("API_ERROR")) {
          throw error; // Don't retry on other API errors
        }
      }

      // Network/connection error - retry once after delay
      if (attempt < maxRetries) {
        const delayMs = 2000; // 2 second delay for network errors
        logger.warn("Network error, retrying", {
          operation: "generate_embedding",
          attempt,
          delayMs,
          error: error instanceof Error ? error.message : String(error),
        });
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue; // Retry
      }

      logger.error("Failed to generate embedding after all retries", {
        operation: "generate_embedding",
        durationMs,
        attempt,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new Error("NETWORK_ERROR");
    }
  }

  // This should never be reached due to the loop structure
  throw new Error("NETWORK_ERROR");
}

/**
 * Search books by mood using hybrid search (vector + keyword)
 * @param supabase - Supabase client instance
 * @param moodText - User's mood or preference description
 * @param embedding - Pre-generated embedding vector
 * @param requestId - Request ID for logging
 * @param limit - Maximum number of results (default: 10)
 * @param matchThreshold - Minimum similarity score (default: 0.7)
 * @returns Array of matching books with relevance scores
 */
export async function searchByMood(
  supabase: SupabaseClient,
  moodText: string,
  embedding: number[],
  requestId: string,
  limit = 10,
  matchThreshold = 0.7,
): Promise<BookSearchResult[]> {
  const logger = createLogger(requestId);
  const startTime = Date.now();

  logger.info("Executing hybrid search", {
    operation: "hybrid_search",
    moodTextLength: moodText.length,
    limit,
    matchThreshold,
  });

  try {
    const { data, error } = await supabase.rpc("hybrid_search_books", {
      query_embedding: embedding,
      query_text: moodText,
      match_threshold: matchThreshold,
      limit_count: limit,
    });

    if (error) {
      logger.error("Hybrid search RPC failed", {
        operation: "hybrid_search",
        error: error.message,
        code: error.code,
      });
      throw error;
    }

    const durationMs = Date.now() - startTime;
    logger.info("Hybrid search complete", {
      operation: "hybrid_search",
      durationMs,
      resultCount: data?.length || 0,
    });

    return data || [];
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error("Hybrid search failed", {
      operation: "hybrid_search",
      durationMs,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Search books using keyword-only search (fallback when embedding generation fails)
 * @param supabase - Supabase client instance
 * @param moodText - User's mood or preference description
 * @param requestId - Request ID for logging
 * @param limit - Maximum number of results (default: 10)
 * @returns Array of matching books with keyword-based scores
 */
export async function searchByKeywordsOnly(
  supabase: SupabaseClient,
  moodText: string,
  requestId: string,
  limit = 10,
): Promise<BookSearchResult[]> {
  const logger = createLogger(requestId);
  const startTime = Date.now();

  logger.info("Executing keyword-only search fallback", {
    operation: "keyword_search",
    moodTextLength: moodText.length,
    limit,
  });

  try {
    // Use text search across title, ai_summary, and genre fields
    const { data, error } = await supabase
      .from("books")
      .select(`
        id, 
        title, 
        author, 
        ai_summary,
        genres_primary,
        themes,
        tone,
        pacing
      `)
      .eq("status", "to_read")
      .textSearch("title", moodText, { type: "websearch" })
      .limit(limit);

    if (error) {
      logger.error("Keyword search failed", {
        operation: "keyword_search",
        error: error.message,
      });

      // Fallback to simple LIKE search if text search fails
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("books")
        .select(`
          id, 
          title, 
          author, 
          ai_summary
        `)
        .eq("status", "to_read")
        .or(`title.ilike.%${moodText}%,ai_summary.ilike.%${moodText}%`)
        .limit(limit);

      if (fallbackError) {
        logger.error("Fallback keyword search failed", {
          operation: "keyword_search_fallback",
          error: fallbackError.message,
        });
        throw fallbackError;
      }

      const durationMs = Date.now() - startTime;
      logger.info("Keyword search fallback complete", {
        operation: "keyword_search_fallback",
        durationMs,
        resultCount: fallbackData?.length || 0,
      });

      // Convert to BookSearchResult format
      return (fallbackData || []).map((book) => ({
        book_id: book.id,
        title: book.title,
        author: book.author,
        ai_summary: book.ai_summary,
        similarity_score: 0, // No vector similarity in keyword-only
        keyword_rank: 0.5, // Assign default keyword rank
        combined_score: 0.5, // Default combined score
      }));
    }

    const durationMs = Date.now() - startTime;
    logger.info("Keyword search complete", {
      operation: "keyword_search",
      durationMs,
      resultCount: data?.length || 0,
    });

    // Convert to BookSearchResult format
    return (data || []).map((book) => ({
      book_id: book.id,
      title: book.title,
      author: book.author,
      ai_summary: book.ai_summary,
      similarity_score: 0, // No vector similarity in keyword-only
      keyword_rank: 0.7, // Higher keyword rank since this matched
      combined_score: 0.7, // Keyword-only combined score
    }));
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error("Keyword search failed", {
      operation: "keyword_search",
      durationMs,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Format search results into user-friendly recommendation display
 * @param results - Raw search results from hybrid_search_books RPC
 * @returns Formatted recommendations for display
 */
export function formatRecommendations(
  results: BookSearchResult[],
): FormattedRecommendation[] {
  return results.map((result) => ({
    bookId: result.book_id,
    title: result.title,
    author: result.author,
    summary: result.ai_summary || "No summary available.",
    relevanceScore: Math.round(result.combined_score * 100),
  }));
}
