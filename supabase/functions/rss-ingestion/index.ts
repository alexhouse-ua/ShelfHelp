// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js@2/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { XMLParser } from "npm:fast-xml-parser@4";
import { createLogger, generateRequestId } from "../_shared/logger.ts";
import { badRequest, createErrorResponse, internalError } from "../_shared/error-handler.ts";

/**
 * Default RSS feed fetcher (thin wrapper around fetch for testability)
 */
export async function fetchRssFeed(url: string): Promise<Response> {
  return await fetch(url);
}

/**
 * Default Supabase client factory (for testability)
 */
export function createSupabaseClient(url: string, key: string): SupabaseClient {
  return createClient(url, key);
}

/**
 * RSS item structure from Goodreads RSS feed
 * Fields may be strings or CDATA objects from XML parser
 */
interface RSSItem {
  book_id?: string;
  title?: string | { __cdata: string };
  author_name?: string;
  isbn?: string;
  book_published?: string;
  book?: {
    num_pages?: string;
  };
  book_image_url?: string | { __cdata: string };
  book_large_image_url?: string | { __cdata: string };
  link?: string | { __cdata: string };
  user_rating?: string;
  user_read_at?: string | { __cdata: string };
  user_date_added?: string | { __cdata: string };
  publisher?: string;
}

/**
 * Parse date string from RSS feed to ISO timestamp
 * Handles both string dates and CDATA-wrapped dates
 */
function parseRSSDate(dateValue?: string | { __cdata: string }): string | null {
  if (!dateValue) return null;

  // Extract string from CDATA wrapper if present
  let dateStr: string;
  if (typeof dateValue === "string") {
    dateStr = dateValue;
  } else if (typeof dateValue === "object" && "__cdata" in dateValue) {
    dateStr = dateValue.__cdata;
  } else {
    return null;
  }

  try {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date.toISOString();
  } catch {
    return null;
  }
}

/**
 * Parse series number from string (handles decimals and ranges)
 * For ranges like "1-1.5" or "0.1-0.5", takes the first number
 */
function parseSeriesNumber(numStr: string): number | null {
  if (!numStr) return null;

  // Handle ranges: take the first number
  if (numStr.includes("-")) {
    numStr = numStr.split("-")[0];
  }

  const parsed = parseFloat(numStr);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse series information from book title
 * Handles multiple Goodreads series formats:
 * - "Title (Series, #N)" → Standard with comma
 * - "Title (Series #N)" → Without comma
 * - "Title (Series Book N)" → "Book" keyword variant
 * - "Title (Series)" → Series name only, no number
 * - "Title (Series, #0.1-0.5)" → Range numbers (takes first)
 *
 * Examples:
 *   "The Good Girl Effect (Salacious Legacy, #1)" → {title: "The Good Girl Effect", series: "Salacious Legacy", number: 1}
 *   "Flock (The Ravenhood Book 1)" → {title: "Flock", series: "The Ravenhood", number: 1}
 *   "Audacity (Seraph)" → {title: "Audacity", series: "Seraph", number: null}
 *   "Stand Alone Book" → {title: "Stand Alone Book", series: null, number: null}
 */
function parseSeriesFromTitle(fullTitle: string): {
  title: string;
  series_name: string | null;
  series_number: number | null;
} {
  // Ensure fullTitle is a string (defensive against [object Object])
  const titleStr = String(fullTitle || "");

  // Pattern 1: Standard format with comma and hash: "Title (Series Name, #N)"
  const pattern1 = /^(.+?)\s*\(([^,)]+?),?\s*#([\d.]+(?:-[\d.]+)?)\)\s*$/;

  // Pattern 2: "Book N" format: "Title (Series Name Book N)"
  const pattern2 = /^(.+?)\s*\((.+?)\s+Book\s+(\d+(?:\.\d+)?)\)\s*$/i;

  // Pattern 3: Hash without comma: "Title (Series Name #N)"
  const pattern3 = /^(.+?)\s*\(([^)]+?)\s+#([\d.]+(?:-[\d.]+)?)\)\s*$/;

  // Pattern 4: Series name only (no number): "Title (Series Name)"
  const pattern4 = /^(.+?)\s*\(([^)]+)\)\s*$/;

  // Try patterns in order of specificity
  let match = titleStr.match(pattern1);
  if (match) {
    return {
      title: match[1].trim(),
      series_name: match[2].trim(),
      series_number: parseSeriesNumber(match[3]),
    };
  }

  match = titleStr.match(pattern2);
  if (match) {
    return {
      title: match[1].trim(),
      series_name: match[2].trim(),
      series_number: parseSeriesNumber(match[3]),
    };
  }

  match = titleStr.match(pattern3);
  if (match) {
    return {
      title: match[1].trim(),
      series_name: match[2].trim(),
      series_number: parseSeriesNumber(match[3]),
    };
  }

  match = titleStr.match(pattern4);
  if (match) {
    // Series name only, no number
    return {
      title: match[1].trim(),
      series_name: match[2].trim(),
      series_number: null,
    };
  }

  // No series information found
  return {
    title: titleStr.trim(),
    series_name: null,
    series_number: null,
  };
}

/**
 * Extract string from potential CDATA wrapper object
 * Handles both plain strings and XML CDATA objects like {"__cdata":"value"}
 */
function extractString(value: unknown): string | null {
  if (!value) return null;

  // If it's already a string, return it
  if (typeof value === "string") {
    return value;
  }

  // If it's an object with __cdata property (XML CDATA wrapper)
  if (typeof value === "object" && value !== null && "__cdata" in value) {
    const cdataValue = (value as { __cdata: unknown }).__cdata;
    return typeof cdataValue === "string" ? cdataValue : null;
  }

  // Try to stringify if it's some other object (defensive)
  return String(value);
}

/**
 * Extract URL from potential CDATA wrapper object
 * Alias for extractString for URL-specific usage
 */
function extractUrl(value: unknown): string | null {
  return extractString(value);
}

/**
 * Map RSS item to database book record
 */
export function mapRSSItemToBook(item: RSSItem): {
  goodreads_id: number | null;
  title: string | null;
  author: string | null;
  isbn: string | null;
  publication_year: number | null;
  publication_date: string | null;
  page_count: number | null;
  series_name: string | null;
  series_number: number | null;
  cover_image_url: string | null;
  goodreads_link: string | null;
  user_rating: number | null;
  user_date_finished: string | null;
  user_date_added: string | null;
  publisher: string | null;
  status: "finished";
  ingestion_source: "rss";
} {
  const userRating = item.user_rating ? parseInt(item.user_rating, 10) : null;
  const pageCount = item.book?.num_pages ? parseInt(item.book.num_pages, 10) : null;
  const publicationYear = item.book_published ? parseInt(item.book_published, 10) : null;

  // Extract title from potential CDATA wrapper before parsing series
  const rawTitle = extractString(item.title) || "";

  // Parse series information from title
  const { title, series_name, series_number } = parseSeriesFromTitle(rawTitle);

  return {
    goodreads_id: item.book_id ? parseInt(item.book_id, 10) : null,
    title: title,
    author: item.author_name || null,
    isbn: item.isbn || null,
    publication_year: publicationYear, // Changed from publication_date
    publication_date: null, // To be enriched by AI later
    page_count: pageCount,
    series_name: series_name,
    series_number: series_number,
    cover_image_url: extractUrl(item.book_large_image_url) || extractUrl(item.book_image_url) ||
      null, // Handle CDATA
    goodreads_link: extractUrl(item.link) || null, // Handle CDATA
    user_rating: userRating && userRating >= 1 && userRating <= 5 ? userRating : null,
    user_date_finished: parseRSSDate(item.user_read_at),
    user_date_added: parseRSSDate(item.user_date_added),
    publisher: item.publisher || null,
    status: "finished" as const, // RSS feed pulls from "read" shelf
    ingestion_source: "rss" as const, // Track source for debugging
  };
}

/**
 * Dependency injection interface for handler
 */
export interface HandlerDeps {
  fetchRssFeed: (url: string) => Promise<Response>;
  createSupabaseClient: (url: string, key: string) => SupabaseClient;
}

/**
 * Upsert book to database (insert if new, update if exists by goodreads_id)
 */
async function upsertBook(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  book: ReturnType<typeof mapRSSItemToBook>,
  logger: ReturnType<typeof createLogger>,
): Promise<{ success: boolean; action: "inserted" | "updated" | "skipped"; error?: string }> {
  if (!book.goodreads_id || !book.title || !book.author) {
    return {
      success: false,
      action: "skipped",
      error: "Missing required fields (goodreads_id, title, or author)",
    };
  }

  let existingBeforeUpsert = false;

  try {
    const { data: existingRecord, error: existingError } = await supabase
      .from("books")
      .select("id")
      .eq("goodreads_id", book.goodreads_id)
      .maybeSingle();

    if (existingError && existingError.code !== "PGRST116") {
      logger.error("Database lookup error", {
        error: existingError.message,
        goodreadsId: book.goodreads_id,
      });
    }

    if (existingRecord) {
      existingBeforeUpsert = true;
    }
  } catch (lookupError) {
    const errorMessage = lookupError instanceof Error ? lookupError.message : "Unknown error";
    logger.error("Database lookup exception", {
      error: errorMessage,
      goodreadsId: book.goodreads_id,
    });
  }

  try {
    const { data, error } = await supabase
      .from("books")
      .upsert(book, {
        onConflict: "goodreads_id",
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      logger.error("Database upsert error", { error: error.message, book });
      return { success: false, action: "skipped", error: error.message };
    }

    const action = existingBeforeUpsert ? "updated" : "inserted";

    // Fallback guard: if we expected an insert but Supabase returned no rows, log it for observability
    if (!existingBeforeUpsert && (!data || data.length === 0)) {
      logger.error("Upsert returned no rows for expected insert", {
        goodreadsId: book.goodreads_id,
      });
    }

    return { success: true, action };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("Database upsert exception", { error: errorMessage, book });
    return { success: false, action: "skipped", error: errorMessage };
  }
}

/**
 * Core handler logic (extracted for testability)
 */
export async function handleRSSIngestion(
  deps: HandlerDeps = { fetchRssFeed, createSupabaseClient },
): Promise<Response> {
  const requestId = generateRequestId();
  const logger = createLogger(requestId);
  logger.info("RSS ingestion started");

  try {
    // Get RSS feed URL from environment
    const rssFeedUrl = Deno.env.get("GOODREADS_RSS_FEED_URL_READ");
    if (!rssFeedUrl) {
      logger.error("Missing GOODREADS_RSS_FEED_URL_READ environment variable");
      return internalError("RSS feed URL not configured", requestId);
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      logger.error("Missing Supabase credentials");
      return internalError("Supabase credentials not configured", requestId);
    }

    const supabase = deps.createSupabaseClient(supabaseUrl, supabaseServiceKey);

    // Fetch RSS feed
    logger.info("Fetching RSS feed");
    const response = await deps.fetchRssFeed(rssFeedUrl);

    if (!response.ok) {
      logger.error("Failed to fetch RSS feed", {
        status: response.status,
        statusText: response.statusText,
      });
      return createErrorResponse(`RSS feed fetch failed: ${response.statusText}`, requestId, 502, {
        status: response.status,
      });
    }

    const xmlText = await response.text();
    logger.info("RSS feed fetched successfully", { size: xmlText.length });

    // Parse XML
    const parser = new XMLParser({
      ignoreAttributes: false,
      cdataPropName: "__cdata",
    });

    let parsedData;
    try {
      parsedData = parser.parse(xmlText);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown parsing error";
      logger.error("XML parsing failed", { error: errorMessage });
      return badRequest(`XML parsing failed: ${errorMessage}`, requestId);
    }

    // Extract items from RSS feed (normalize single item to array)
    const rawItems = parsedData?.rss?.channel?.item;
    const items: RSSItem[] = rawItems ? (Array.isArray(rawItems) ? rawItems : [rawItems]) : [];
    logger.info(`Parsed ${items.length} items from RSS feed`);

    if (items.length === 0) {
      logger.info("No items found in RSS feed");
      return new Response(
        JSON.stringify({
          success: true,
          booksAdded: 0,
          booksUpdated: 0,
          errors: 0,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // Process each item
    const results = {
      booksAdded: 0,
      booksUpdated: 0,
      errors: 0,
      errorDetails: [] as Array<{ title?: string; error: string }>,
    };

    for (const item of items) {
      const book = mapRSSItemToBook(item);
      const result = await upsertBook(supabase, book, logger);

      if (result.success) {
        if (result.action === "inserted") {
          results.booksAdded++;
          logger.info("Book inserted", { title: book.title });
        } else if (result.action === "updated") {
          results.booksUpdated++;
          logger.info("Book updated", { title: book.title });
        }
      } else {
        results.errors++;
        results.errorDetails.push({
          title: extractString(item.title) || undefined,
          error: result.error || "Unknown error",
        });
      }
    }

    logger.info("RSS ingestion completed", {
      booksAdded: results.booksAdded,
      booksUpdated: results.booksUpdated,
      errors: results.errors,
    });

    return new Response(
      JSON.stringify({
        success: true,
        booksAdded: results.booksAdded,
        booksUpdated: results.booksUpdated,
        errors: results.errors,
        errorDetails: results.errorDetails,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("RSS ingestion failed", { error: errorMessage });
    return internalError(errorMessage, requestId);
  }
}

/**
 * Deno.serve entry point (delegates to handleRSSIngestion)
 */
Deno.serve(async (_req: Request) => {
  return await handleRSSIngestion();
});
