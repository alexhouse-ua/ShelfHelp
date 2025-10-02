// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js@2/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Papa from "npm:papaparse@5";
import { createLogger, generateRequestId } from "../_shared/logger.ts";
import { internalError } from "../_shared/error-handler.ts";

/**
 * CSV row structure (from Goodreads export)
 */
interface GoodreadsCSVRow {
  "Book Id": string;
  Title: string;
  Author: string;
  ISBN: string;
  ISBN13: string;
  "My Rating": string;
  "Average Rating": string;
  Publisher: string;
  Binding: string;
  "Number of Pages": string;
  "Year Published": string;
  "Original Publication Year": string;
  "Date Read": string;
  "Date Added": string;
  Status: string;
}

/**
 * Parse date in MM/DD/YY format to ISO timestamp
 */
function parseGoodreadsDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === "") {
    return null;
  }

  try {
    // Format: MM/DD/YY (e.g., "9/20/25")
    const parts = dateStr.trim().split("/");
    if (parts.length !== 3) {
      return null;
    }

    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);

    // Convert 2-digit year to 4-digit year
    // Assume years 00-49 are 2000-2049, and 50-99 are 1950-1999
    if (year >= 0 && year <= 49) {
      year += 2000;
    } else if (year >= 50 && year <= 99) {
      year += 1900;
    }

    // Create ISO date string
    const isoDate = new Date(year, month - 1, day).toISOString();
    return isoDate;
  } catch {
    return null;
  }
}

/**
 * Parse series information from book title
 * Examples:
 *   "The Good Girl Effect (Salacious Legacy, #1)" → {title: "The Good Girl Effect", series: "Salacious Legacy", number: 1}
 *   "Stand Alone Book" → {title: "Stand Alone Book", series: null, number: null}
 */
function parseSeriesFromTitle(fullTitle: string): {
  title: string;
  series_name: string | null;
  series_number: number | null;
} {
  // Pattern: "Book Title (Series Name, #N)" or "Book Title (Series Name #N)"
  const seriesPattern = /^(.+?)\s*\(([^,)]+?),?\s*#(\d+(?:\.\d+)?)\)\s*$/;
  const match = fullTitle.match(seriesPattern);

  if (match) {
    return {
      title: match[1].trim(),
      series_name: match[2].trim(),
      series_number: parseFloat(match[3]),
    };
  }

  // No series information found
  return {
    title: fullTitle.trim(),
    series_name: null,
    series_number: null,
  };
}

/**
 * Construct Goodreads book URL from book ID
 */
function constructGoodreadsLink(goodreadsId: number): string {
  return `https://www.goodreads.com/book/show/${goodreadsId}`;
}

/**
 * Check if book should be imported (only "read" status)
 */
function shouldImportBook(status: string): boolean {
  return status.toLowerCase().trim() === "read";
}

/**
 * Map CSV row to database book record
 */
function mapCSVRowToBook(row: GoodreadsCSVRow): Record<string, unknown> | null {
  // Filter: Only import books with status "read"
  if (!shouldImportBook(row["Status"])) {
    return null;
  }

  const goodreadsId = row["Book Id"] ? parseInt(row["Book Id"], 10) : null;
  if (!goodreadsId) {
    return null;
  }

  const isbn = row["ISBN13"] || row["ISBN"] || null;
  const userRating = row["My Rating"] ? parseInt(row["My Rating"], 10) : null;
  const pageCount = row["Number of Pages"] ? parseInt(row["Number of Pages"], 10) : null;
  const publicationYear = row["Year Published"] ? parseInt(row["Year Published"], 10) : null;

  // Parse series information from title
  const { title, series_name, series_number } = parseSeriesFromTitle(row["Title"] || "");

  const book: Record<string, unknown> = {
    goodreads_id: goodreadsId,
    isbn: isbn,
    title: title,
    author: row["Author"] || null,
    page_count: pageCount,
    publisher: row["Publisher"] || null,
    publication_date: publicationYear ? `${publicationYear}-01-01` : null,
    series_name: series_name,
    series_number: series_number,
    goodreads_link: constructGoodreadsLink(goodreadsId),
    user_rating: userRating,
    user_date_added: parseGoodreadsDate(row["Date Added"]),
    user_date_finished: parseGoodreadsDate(row["Date Read"]),
    status: "finished", // All imported CSV books are "read" → "finished"
  };

  return book;
}

/**
 * Main handler
 */
Deno.serve(async (_req: Request) => {
  const requestId = generateRequestId();
  const logger = createLogger(requestId);

  logger.info("CSV backfill function invoked");

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Read CSV file
    logger.info("Reading CSV file");
    const csvPath = "./project-specs/goodreads_read_history.csv";
    const csvText = await Deno.readTextFile(csvPath);

    // Parse CSV
    logger.info("Parsing CSV file");
    const parseResult = Papa.parse<GoodreadsCSVRow>(csvText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false, // Keep all as strings for manual parsing
    });

    if (parseResult.errors.length > 0) {
      logger.error("CSV parsing errors encountered", {
        errors: parseResult.errors,
      });
    }

    const rows = parseResult.data;
    logger.info(`Parsed ${rows.length} rows from CSV`);

    let booksImported = 0;
    let booksUpdated = 0;
    let booksFiltered = 0;
    let errors = 0;

    // Process each row
    for (const row of rows) {
      try {
        const bookData = mapCSVRowToBook(row);

        // Skip if filtered out (not "read" status) or invalid
        if (!bookData) {
          booksFiltered++;
          continue;
        }

        // Check if book already exists
        const { data: existingBook, error: fetchError } = await supabase
          .from("books")
          .select("id")
          .eq("goodreads_id", bookData.goodreads_id)
          .maybeSingle();

        if (fetchError) {
          logger.error("Failed to check existing book", {
            error: fetchError,
            goodreads_id: bookData.goodreads_id,
          });
          errors++;
          continue;
        }

        if (existingBook) {
          // Update existing book
          const { error: updateError } = await supabase
            .from("books")
            .update(bookData)
            .eq("goodreads_id", bookData.goodreads_id);

          if (updateError) {
            logger.error("Failed to update book", {
              error: updateError,
              goodreads_id: bookData.goodreads_id,
            });
            errors++;
          } else {
            booksUpdated++;
          }
        } else {
          // Insert new book
          const { error: insertError } = await supabase.from("books").insert(bookData);

          if (insertError) {
            logger.error("Failed to insert book", {
              error: insertError,
              goodreads_id: bookData.goodreads_id,
            });
            errors++;
          } else {
            booksImported++;
          }
        }
      } catch (error) {
        logger.error("Error processing CSV row", {
          error: String(error),
          row,
        });
        errors++;
      }
    }

    // Return summary
    const summary = {
      success: true,
      booksImported,
      booksUpdated,
      booksFiltered,
      errors,
      totalRows: rows.length,
    };

    logger.info("CSV backfill completed", summary);

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error("CSV backfill failed", { error: String(error) });

    return internalError(
      error instanceof Error ? error.message : String(error),
      requestId,
    );
  }
});
