// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js@2/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { createLogger, generateRequestId } from "../_shared/logger.ts";
import { internalError } from "../_shared/error-handler.ts";
import {
  BookScoringData,
  calculatePriorityScore,
  ScoringResult,
} from "../_shared/priority-scoring.ts";

/**
 * Edge Function: Update TBR Queue
 * Recalculates priority scores for all books with status='to_read'
 * and updates their queue_position based on priority ranking
 */

interface BookRecord {
  id: string;
  page_count: number | null;
  hype_flag: boolean;
  genres_primary: string | null;
  author: string | null;
}

Deno.serve(async (_req: Request) => {
  const requestId = generateRequestId();
  const logger = createLogger(requestId);

  logger.info("📚 TBR queue update started");

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      logger.error("Missing required environment variables");
      return internalError("Server configuration error", requestId);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all books with status='to_read'
    logger.info("Fetching to_read books from database");
    const { data: books, error: fetchError } = await supabase
      .from("books")
      .select("id, page_count, hype_flag, genres_primary, author")
      .eq("status", "to_read");

    if (fetchError) {
      logger.error("Failed to fetch to_read books", { error: fetchError });
      return internalError("Database query failed", requestId, fetchError);
    }

    if (!books || books.length === 0) {
      logger.info("No to_read books found");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No books to process",
          booksProcessed: 0,
          requestId,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    logger.info(`Processing ${books.length} to_read books`);

    // Fetch reading pace once for all books (optimization to avoid N+1 queries)
    const { data: readingPaceData } = await supabase
      .from("user_preferences")
      .select("preference_value")
      .eq("preference_key", "reading_pace")
      .single();

    const cachedReadingPace = readingPaceData?.preference_value?.avg_pages_per_day || 50;

    logger.debug("Fetched reading pace", { avgPagesPerDay: cachedReadingPace });

    // Calculate priority scores for all books
    const scoringResults: ScoringResult[] = [];

    for (const book of books as BookRecord[]) {
      try {
        const bookData: BookScoringData = {
          bookId: book.id,
          pageCount: book.page_count,
          hypeFlag: book.hype_flag || false,
          genre: book.genres_primary,
          author: book.author,
          cachedReadingPace, // Pass cached reading pace to avoid N+1 queries
        };

        const result = await calculatePriorityScore(supabase, bookData);
        scoringResults.push(result);

        logger.debug(`Scored book ${book.id}`, {
          score: result.priorityScore,
          factors: result.factors,
        });
      } catch (error) {
        logger.error(`Failed to score book ${book.id}`, { error });
        // Continue processing other books even if one fails
      }
    }

    // Sort books by priority score (descending - highest priority first)
    scoringResults.sort((a, b) => b.priorityScore - a.priorityScore);

    logger.info("Updating queue positions in database");

    // Update queue_position and priority_score for all books
    const updatePromises = scoringResults.map(async (result, index) => {
      const queuePosition = index + 1; // 1-indexed ranking

      const { error: updateError } = await supabase
        .from("books")
        .update({
          priority_score: result.priorityScore,
          queue_position: queuePosition,
          last_score_calculated: new Date().toISOString(),
        })
        .eq("id", result.bookId);

      if (updateError) {
        logger.error(`Failed to update book ${result.bookId}`, { error: updateError });
        throw updateError;
      }

      return { bookId: result.bookId, queuePosition, priorityScore: result.priorityScore };
    });

    const updateResults = await Promise.all(updatePromises);

    logger.info("TBR queue update completed successfully", {
      booksProcessed: updateResults.length,
      topBook: updateResults[0],
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Queue updated successfully",
        booksProcessed: updateResults.length,
        timestamp: new Date().toISOString(),
        requestId,
        preview: updateResults.slice(0, 5), // Return top 5 for verification
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    logger.error("Unexpected error during queue update", { error });
    return internalError(
      "Failed to update TBR queue",
      requestId,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
});
