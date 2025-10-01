// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js@2/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { XMLParser } from "npm:fast-xml-parser@4";

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
 * Generate a unique request ID for traceability
 */
function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Structured logging helper
 */
function log(
  requestId: string,
  level: "info" | "error",
  message: string,
  context?: Record<string, unknown>,
): void {
  const logEntry = {
    requestId,
    level,
    message,
    timestamp: new Date().toISOString(),
    context: context || {},
  };

  if (level === "error") {
    console.error(JSON.stringify(logEntry));
  } else {
    console.log(JSON.stringify(logEntry));
  }
}

/**
 * RSS item structure from Goodreads RSS feed
 */
interface RSSItem {
  book_id?: string;
  title?: string;
  author_name?: string;
  isbn?: string;
  book_published?: string;
  book?: {
    num_pages?: string;
  };
  book_image_url?: string;
  book_large_image_url?: string;
  link?: string;
  user_rating?: string;
  user_read_at?: string;
  user_date_added?: string;
  user_shelves?: string;
  book_description?: string | { __cdata?: string };
  publisher?: string;
}

/**
 * Parse date string from RSS feed to ISO timestamp
 */
function parseRSSDate(dateStr?: string): string | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date.toISOString();
  } catch {
    return null;
  }
}

/**
 * Parse user shelves from comma-separated string to array
 */
function parseUserShelves(shelvesStr?: string): string[] | null {
  if (!shelvesStr) return null;
  return shelvesStr
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Extract CDATA content if present
 */
function extractCDATA(field?: string | { __cdata?: string }): string | null {
  if (!field) return null;
  if (typeof field === "string") return field;
  if (typeof field === "object" && "__cdata" in field) {
    return field.__cdata || null;
  }
  return null;
}

/**
 * Map RSS item to database book record
 */
export function mapRSSItemToBook(item: RSSItem): {
  goodreads_id: number | null;
  title: string | null;
  author: string | null;
  isbn: string | null;
  publication_date: string | null;
  page_count: number | null;
  cover_image_url: string | null;
  goodreads_link: string | null;
  user_rating: number | null;
  user_date_finished: string | null;
  user_date_added: string | null;
  user_shelves: string[] | null;
  ai_summary: string | null;
  publisher: string | null;
  status: "pending";
} {
  const userRating = item.user_rating ? parseInt(item.user_rating, 10) : null;
  const pageCount = item.book?.num_pages ? parseInt(item.book.num_pages, 10) : null;
  const publicationYear = item.book_published ? parseInt(item.book_published, 10) : null;

  return {
    goodreads_id: item.book_id ? parseInt(item.book_id, 10) : null,
    title: item.title || null,
    author: item.author_name || null,
    isbn: item.isbn || null,
    publication_date: publicationYear ? `${publicationYear}-01-01` : null,
    page_count: pageCount,
    cover_image_url: item.book_large_image_url || item.book_image_url || null,
    goodreads_link: item.link || null,
    user_rating: userRating && userRating >= 1 && userRating <= 5 ? userRating : null,
    user_date_finished: parseRSSDate(item.user_read_at),
    user_date_added: parseRSSDate(item.user_date_added),
    user_shelves: parseUserShelves(item.user_shelves),
    ai_summary: extractCDATA(item.book_description),
    publisher: item.publisher || null,
    status: "pending" as const,
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
  requestId: string,
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
      log(requestId, "error", "Database lookup error", {
        error: existingError.message,
        goodreadsId: book.goodreads_id,
      });
    }

    if (existingRecord) {
      existingBeforeUpsert = true;
    }
  } catch (lookupError) {
    const errorMessage = lookupError instanceof Error ? lookupError.message : "Unknown error";
    log(requestId, "error", "Database lookup exception", {
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
      log(requestId, "error", "Database upsert error", { error: error.message, book });
      return { success: false, action: "skipped", error: error.message };
    }

    const action = existingBeforeUpsert ? "updated" : "inserted";

    // Fallback guard: if we expected an insert but Supabase returned no rows, log it for observability
    if (!existingBeforeUpsert && (!data || data.length === 0)) {
      log(requestId, "error", "Upsert returned no rows for expected insert", {
        goodreadsId: book.goodreads_id,
      });
    }

    return { success: true, action };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    log(requestId, "error", "Database upsert exception", { error: errorMessage, book });
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
  log(requestId, "info", "RSS ingestion started");

  try {
    // Get RSS feed URL from environment
    const rssFeedUrl = Deno.env.get("GOODREADS_RSS_FEED_URL_READ");
    if (!rssFeedUrl) {
      log(requestId, "error", "Missing GOODREADS_RSS_FEED_URL_READ environment variable");
      return new Response(JSON.stringify({ error: "RSS feed URL not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      log(requestId, "error", "Missing Supabase credentials");
      return new Response(JSON.stringify({ error: "Supabase credentials not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = deps.createSupabaseClient(supabaseUrl, supabaseServiceKey);

    // Fetch RSS feed
    log(requestId, "info", "Fetching RSS feed");
    const response = await deps.fetchRssFeed(rssFeedUrl);

    if (!response.ok) {
      log(requestId, "error", "Failed to fetch RSS feed", {
        status: response.status,
        statusText: response.statusText,
      });
      return new Response(
        JSON.stringify({ error: `RSS feed fetch failed: ${response.statusText}` }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const xmlText = await response.text();
    log(requestId, "info", "RSS feed fetched successfully", { size: xmlText.length });

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
      log(requestId, "error", "XML parsing failed", { error: errorMessage });
      return new Response(JSON.stringify({ error: `XML parsing failed: ${errorMessage}` }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Extract items from RSS feed (normalize single item to array)
    const rawItems = parsedData?.rss?.channel?.item;
    const items: RSSItem[] = rawItems ? (Array.isArray(rawItems) ? rawItems : [rawItems]) : [];
    log(requestId, "info", `Parsed ${items.length} items from RSS feed`);

    if (items.length === 0) {
      log(requestId, "info", "No items found in RSS feed");
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
      const result = await upsertBook(supabase, book, requestId);

      if (result.success) {
        if (result.action === "inserted") {
          results.booksAdded++;
          log(requestId, "info", "Book inserted", { title: book.title });
        } else if (result.action === "updated") {
          results.booksUpdated++;
          log(requestId, "info", "Book updated", { title: book.title });
        }
      } else {
        results.errors++;
        results.errorDetails.push({
          title: item.title,
          error: result.error || "Unknown error",
        });
      }
    }

    log(requestId, "info", "RSS ingestion completed", {
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
    log(requestId, "error", "RSS ingestion failed", { error: errorMessage });

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * Deno.serve entry point (delegates to handleRSSIngestion)
 */
Deno.serve(async (_req: Request) => {
  return await handleRSSIngestion();
});
