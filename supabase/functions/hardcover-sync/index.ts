// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js@2/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { createLogger, generateRequestId } from "../_shared/logger.ts";
import { HardcoverClient } from "../_shared/hardcover-client.ts";
import type { HardcoverActivity, HardcoverUser } from "../_shared/hardcover-client.ts";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Sync request parameters
 */
interface SyncRequest {
  sync_type: "full" | "activities" | "lists";
  dry_run?: boolean;
}

/**
 * Sync result summary
 */
interface SyncResult {
  sync_type: string;
  dry_run: boolean;
  matched: number;
  unmatched: number;
  manual_review: number;
  activities_imported: number;
  sessions_created: number;
  errors: string[];
  duration_ms: number;
}

/**
 * Book match result
 */
interface BookMatch {
  hardcover_id: number;
  confidence: number;
  match_method: "isbn" | "exact" | "fuzzy";
  book_data?: Record<string, unknown>;
}

/**
 * Activity record for database insertion
 */
interface ActivityRecord {
  id: string;
  book_id: string;
  hardcover_activity_id: string;
  activity_type: string;
  activity_date: Date;
  metadata: Record<string, unknown>;
}

/**
 * Reading session record
 */
interface ReadingSession {
  id: string;
  book_id: string;
  hardcover_activity_id: string | null;
  session_start: Date;
  session_end: Date;
  duration_minutes: number;
  pages_read: number;
  start_page: number;
  end_page: number;
  reading_speed_ppm: number;
  data_source: string;
}

/**
 * Goodreads book data for matching
 */
interface GoodreadsBook {
  id: string;
  goodreads_id?: number;
  isbn?: string;
  title: string;
  author: string;
}

// ============================================================================
// ENVIRONMENT VALIDATION
// ============================================================================

const HARDCOVER_API_TOKEN = Deno.env.get("HARDCOVER_API_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!HARDCOVER_API_TOKEN) {
  throw new Error("Missing required environment variable: HARDCOVER_API_TOKEN");
}
if (!SUPABASE_URL) {
  throw new Error("Missing required environment variable: SUPABASE_URL");
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY");
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================================================
// DRY-RUN MANAGER (Task 2)
// ============================================================================

/**
 * Manages database writes with dry-run support
 */
class DryRunManager {
  constructor(
    private dry_run: boolean,
    private logger: ReturnType<typeof createLogger>,
  ) {}

  async insertActivity(activity: ActivityRecord): Promise<void> {
    if (this.dry_run) {
      this.logger.info("Dry-run: Would insert activity", {
        operation: "dry_run",
        action: "insert_activity",
        table: "book_activities",
        activity_id: activity.hardcover_activity_id,
      });
      return;
    }

    const { error } = await supabase.from("book_activities").insert({
      id: activity.id,
      book_id: activity.book_id,
      hardcover_activity_id: activity.hardcover_activity_id,
      activity_type: activity.activity_type,
      activity_date: activity.activity_date.toISOString(),
      metadata: activity.metadata,
    });

    if (error) {
      throw new Error(`Failed to insert activity: ${error.message}`);
    }

    this.logger.info("Activity inserted", {
      operation: "db_write",
      table: "book_activities",
      row_count: 1,
    });
  }

  async insertSession(session: ReadingSession): Promise<void> {
    if (this.dry_run) {
      this.logger.info("Dry-run: Would insert session", {
        operation: "dry_run",
        action: "insert_session",
        table: "reading_sessions",
        duration_minutes: session.duration_minutes,
        pages_read: session.pages_read,
      });
      return;
    }

    const { error } = await supabase.from("reading_sessions").insert({
      id: session.id,
      book_id: session.book_id,
      hardcover_activity_id: session.hardcover_activity_id,
      session_start: session.session_start.toISOString(),
      session_end: session.session_end.toISOString(),
      duration_minutes: session.duration_minutes,
      pages_read: session.pages_read,
      start_page: session.start_page,
      end_page: session.end_page,
      reading_speed_ppm: session.reading_speed_ppm,
      data_source: session.data_source,
    });

    if (error) {
      throw new Error(`Failed to insert session: ${error.message}`);
    }

    this.logger.info("Session inserted", {
      operation: "db_write",
      table: "reading_sessions",
      row_count: 1,
    });
  }

  async insertMigrationLog(logData: {
    operation: string;
    status: string;
    goodreads_book_id?: number;
    hardcover_book_id?: number;
    match_method?: string;
    confidence?: number;
    fuzzy_matches?: unknown;
    error_message?: string;
  }): Promise<void> {
    if (this.dry_run) {
      this.logger.info("Dry-run: Would insert migration log", {
        operation: "dry_run",
        action: "insert_migration_log",
        table: "migration_log",
        status: logData.status,
      });
      return;
    }

    const { error } = await supabase.from("migration_log").insert(logData);

    if (error) {
      throw new Error(`Failed to insert migration log: ${error.message}`);
    }
  }

  async updateBook(bookId: string, updates: Record<string, unknown>): Promise<void> {
    if (this.dry_run) {
      this.logger.info("Dry-run: Would update book", {
        operation: "dry_run",
        action: "update_book",
        table: "books",
        book_id: bookId,
      });
      return;
    }

    const { error } = await supabase.from("books").update(updates).eq("id", bookId);

    if (error) {
      throw new Error(`Failed to update book: ${error.message}`);
    }

    this.logger.info("Book updated", {
      operation: "db_write",
      table: "books",
      row_count: 1,
    });
  }
}

// ============================================================================
// BOOK MATCHER (Task 3)
// ============================================================================

/**
 * Matches Goodreads books to Hardcover books with priority-based matching
 */
class BookMatcher {
  constructor(
    private logger: ReturnType<typeof createLogger>,
    private dryRunManager: DryRunManager,
  ) {}

  /**
   * Match book using priority order: ISBN → Exact → Fuzzy → Manual Review
   */
  async matchBook(goodreadsBook: GoodreadsBook): Promise<BookMatch | null> {
    // Priority 1: ISBN Match (confidence: 1.0)
    if (goodreadsBook.isbn) {
      const match = await this.matchByISBN(goodreadsBook.isbn);
      if (match) {
        await this.logMatch(goodreadsBook.goodreads_id || 0, match.id, "isbn", 1.0, "success");
        return {
          hardcover_id: match.id,
          confidence: 1.0,
          match_method: "isbn",
        };
      }
    }

    // Priority 2: Exact Title + Author (confidence: 0.95)
    const exactMatch = await this.matchByTitleAuthor(goodreadsBook.title, goodreadsBook.author);
    if (exactMatch) {
      await this.logMatch(goodreadsBook.goodreads_id || 0, exactMatch.id, "exact", 0.95, "success");
      return {
        hardcover_id: exactMatch.id,
        confidence: 0.95,
        match_method: "exact",
      };
    }

    // Priority 3: Fuzzy Match (confidence: calculated)
    const fuzzyMatches = await this.matchByFuzzy(goodreadsBook.title, goodreadsBook.author);
    if (fuzzyMatches.length > 0 && fuzzyMatches[0].score >= 0.7) {
      await this.logMatch(
        goodreadsBook.goodreads_id || 0,
        fuzzyMatches[0].id,
        "fuzzy",
        fuzzyMatches[0].score,
        "success",
      );
      return {
        hardcover_id: fuzzyMatches[0].id,
        confidence: fuzzyMatches[0].score,
        match_method: "fuzzy",
      };
    }

    // Priority 4: Manual Review (confidence: <0.7)
    await this.createManualReviewLog(goodreadsBook, fuzzyMatches);
    return null;
  }

  private async matchByISBN(isbn: string): Promise<{ id: number } | null> {
    const { data, error } = await supabase
      .from("books")
      .select("hardcover_id")
      .or(`isbn_13.eq.${isbn},isbn_10.eq.${isbn}`)
      .not("hardcover_id", "is", null)
      .limit(1)
      .single();

    if (error || !data?.hardcover_id) return null;
    return { id: data.hardcover_id };
  }

  private async matchByTitleAuthor(title: string, author: string): Promise<{ id: number } | null> {
    const normalizedTitle = title.trim().toLowerCase();
    const normalizedAuthor = author.trim().toLowerCase();

    const { data, error } = await supabase
      .from("books")
      .select("hardcover_id")
      .ilike("title", normalizedTitle)
      .ilike("author", normalizedAuthor)
      .not("hardcover_id", "is", null)
      .limit(1)
      .single();

    if (error || !data?.hardcover_id) return null;
    return { id: data.hardcover_id };
  }

  private async matchByFuzzy(
    title: string,
    author: string,
  ): Promise<Array<{ id: number; score: number; title: string }>> {
    const { data, error } = await supabase.rpc("fuzzy_book_match", {
      search_title: title,
      search_author: author,
      match_limit: 5,
    });

    if (error) {
      this.logger.warn("Fuzzy match query failed", {
        operation: "fuzzy_match_error",
        error: error.message,
      });
      return [];
    }

    return data || [];
  }

  private async logMatch(
    goodreadsBookId: number,
    hardcoverBookId: number,
    method: string,
    confidence: number,
    status: string,
  ): Promise<void> {
    await this.dryRunManager.insertMigrationLog({
      operation: "book_match",
      status,
      goodreads_book_id: goodreadsBookId,
      hardcover_book_id: hardcoverBookId,
      match_method: method,
      confidence,
    });

    this.logger.info("Book match logged", {
      operation: "book_match",
      method,
      confidence,
      goodreads_book_id: goodreadsBookId,
      hardcover_book_id: hardcoverBookId,
    });
  }

  private async createManualReviewLog(
    goodreadsBook: GoodreadsBook,
    fuzzyMatches: Array<{ id: number; score: number; title: string }>,
  ): Promise<void> {
    await this.dryRunManager.insertMigrationLog({
      operation: "book_match",
      status: "manual_review",
      goodreads_book_id: goodreadsBook.goodreads_id || 0,
      fuzzy_matches: fuzzyMatches,
    });

    this.logger.info("Manual review required", {
      operation: "manual_review",
      goodreads_book_id: goodreadsBook.goodreads_id,
      top_matches: fuzzyMatches.length,
    });
  }
}

// ============================================================================
// ACTIVITY INGESTER (Task 4)
// ============================================================================

/**
 * Ingests historical activities from Hardcover API
 */
class ActivityIngester {
  constructor(
    private hardcoverClient: HardcoverClient,
    private logger: ReturnType<typeof createLogger>,
    private dryRunManager: DryRunManager,
  ) {}

  async ingestActivities(userId: string): Promise<{
    imported: number;
    skipped: number;
    errors: string[];
  }> {
    const startTime = Date.now();
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    try {
      // Fetch complete activities history
      const since = new Date("1970-01-01");
      const activities = await this.hardcoverClient.fetchUserActivities(userId, since);

      this.logger.info("Fetched activities", {
        operation: "activity_fetch",
        total: activities.length,
      });

      // Process each activity
      for (const activity of activities) {
        try {
          // Check idempotency
          const exists = await this.activityExists(activity.id);
          if (exists) {
            this.logger.info("Activity already exists, skipping", {
              operation: "activity_skip",
              reason: "duplicate",
              activity_id: activity.id,
            });
            skipped++;
            continue;
          }

          // Parse activity data
          const { activity_type, metadata } = this.parseActivityType(activity);

          // TODO: Get book_id from book matching (stubbed for now)
          const bookId = crypto.randomUUID(); // Replace with actual book matching

          // Insert activity
          const activityRecord: ActivityRecord = {
            id: crypto.randomUUID(),
            book_id: bookId,
            hardcover_activity_id: activity.id,
            activity_type,
            activity_date: new Date(activity.created_at),
            metadata,
          };

          await this.dryRunManager.insertActivity(activityRecord);
          imported++;
        } catch (error) {
          const errorMsg = `Failed to process activity ${activity.id}: ${
            error instanceof Error ? error.message : String(error)
          }`;
          this.logger.error("Activity processing failed", {
            operation: "activity_error",
            activity_id: activity.id,
            error: errorMsg,
          });
          errors.push(errorMsg);
        }
      }

      const durationMs = Date.now() - startTime;
      this.logger.info("Activity ingestion complete", {
        operation: "activity_import",
        total: activities.length,
        imported,
        skipped,
        duration_ms: durationMs,
      });

      return { imported, skipped, errors };
    } catch (error) {
      const errorMsg = `Activity ingestion failed: ${
        error instanceof Error ? error.message : String(error)
      }`;
      this.logger.error("Activity ingestion error", {
        operation: "ingestion_error",
        error: errorMsg,
      });
      errors.push(errorMsg);
      return { imported, skipped, errors };
    }
  }

  private async activityExists(activityId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from("book_activities")
      .select("id")
      .eq("hardcover_activity_id", activityId)
      .limit(1)
      .single();

    return !error && !!data;
  }

  private parseActivityType(activity: HardcoverActivity): {
    activity_type: string;
    metadata: Record<string, unknown>;
  } {
    const data = activity.data || {};

    if (data.rating) {
      return {
        activity_type: "rated",
        metadata: { rating_value: data.rating },
      };
    }

    if (data.page_progress !== undefined) {
      return {
        activity_type: "progress_update",
        metadata: { page_progress: data.page_progress },
      };
    }

    if (data.status_update) {
      const typeMap: Record<string, string> = {
        added: "added",
        reading: "started",
        finished: "finished",
        abandoned: "abandoned",
      };
      return {
        activity_type: typeMap[data.status_update as string] || "unknown",
        metadata: { status: data.status_update },
      };
    }

    throw new Error(`Unknown activity data structure: ${JSON.stringify(data)}`);
  }
}

// ============================================================================
// SESSION CALCULATOR (Task 5)
// ============================================================================

/**
 * Calculates reading sessions from activity deltas
 */
class SessionCalculator {
  constructor(
    private logger: ReturnType<typeof createLogger>,
    private dryRunManager: DryRunManager,
  ) {}

  async calculateSessions(bookId: string, activities: ActivityRecord[]): Promise<number> {
    let sessionsCreated = 0;

    // Filter for progress_update activities only
    const progressActivities = activities.filter((a) => a.activity_type === "progress_update");

    // Sort by activity_date ascending
    progressActivities.sort((a, b) => a.activity_date.getTime() - b.activity_date.getTime());

    // Calculate sessions from consecutive pairs
    for (let i = 1; i < progressActivities.length; i++) {
      const prev = progressActivities[i - 1];
      const curr = progressActivities[i];

      const durationMs = curr.activity_date.getTime() - prev.activity_date.getTime();
      const durationMinutes = Math.round(durationMs / 60000);
      const pagesRead = ((curr.metadata.page_progress as number) || 0) -
        ((prev.metadata.page_progress as number) || 0);

      // Validate session (max 4h, positive pages)
      if (durationMinutes > 0 && durationMinutes < 240 && pagesRead > 0) {
        const session: ReadingSession = {
          id: crypto.randomUUID(),
          book_id: bookId,
          hardcover_activity_id: curr.hardcover_activity_id,
          session_start: prev.activity_date,
          session_end: curr.activity_date,
          duration_minutes: durationMinutes,
          pages_read: pagesRead,
          start_page: prev.metadata.page_progress as number,
          end_page: curr.metadata.page_progress as number,
          reading_speed_ppm: parseFloat((pagesRead / durationMinutes).toFixed(2)),
          data_source: "hardcover",
        };

        await this.dryRunManager.insertSession(session);
        sessionsCreated++;

        this.logger.info("Session created", {
          operation: "session_create",
          book_id: bookId,
          duration_minutes: durationMinutes,
          pages_read: pagesRead,
          reading_speed_ppm: session.reading_speed_ppm,
        });
      } else {
        this.logger.warn("Session skipped", {
          operation: "session_skipped",
          reason: durationMinutes > 240 ? "duration_too_long" : "invalid_pages",
          duration_minutes: durationMinutes,
          pages_read: pagesRead,
        });
      }
    }

    return sessionsCreated;
  }
}

// ============================================================================
// SYNC ORCHESTRATOR (Tasks 1, 6, 7)
// ============================================================================

/**
 * Rate limiter for sync operations
 */
const syncLocks = new Map<string, number>();

function acquireSyncLock(userId: string): boolean {
  const now = Date.now();
  const lastSync = syncLocks.get(userId);

  if (lastSync && now - lastSync < 60000) {
    // 1 minute cooldown
    return false;
  }

  syncLocks.set(userId, now);
  return true;
}

/**
 * Main sync orchestrator
 */
async function performSync(
  request: SyncRequest,
  logger: ReturnType<typeof createLogger>,
): Promise<SyncResult> {
  const startTime = Date.now();
  const result: SyncResult = {
    sync_type: request.sync_type,
    dry_run: request.dry_run || false,
    matched: 0,
    unmatched: 0,
    manual_review: 0,
    activities_imported: 0,
    sessions_created: 0,
    errors: [],
    duration_ms: 0,
  };

  try {
    // Initialize components
    const hardcoverClient = new HardcoverClient(HARDCOVER_API_TOKEN);
    const dryRunManager = new DryRunManager(request.dry_run || false, logger);
    const _bookMatcher = new BookMatcher(logger, dryRunManager);
    const activityIngester = new ActivityIngester(hardcoverClient, logger, dryRunManager);
    const _sessionCalculator = new SessionCalculator(logger, dryRunManager);

    logger.info("Sync started", {
      operation: "sync_start",
      sync_type: request.sync_type,
      dry_run: request.dry_run || false,
    });

    // Fetch user ID
    const user: HardcoverUser = await hardcoverClient.fetchMe();
    logger.info("User fetched", {
      operation: "user_fetch",
      user_id: user.id,
    });

    // Sync based on type
    if (request.sync_type === "full" || request.sync_type === "activities") {
      const ingestResult = await activityIngester.ingestActivities(user.id);
      result.activities_imported = ingestResult.imported;
      result.errors.push(...ingestResult.errors);
    }

    // TODO: Implement lists sync for sync_type === "lists"

    result.duration_ms = Date.now() - startTime;

    logger.info("Sync complete", {
      operation: "sync_complete",
      sync_type: request.sync_type,
      ...result,
    });

    return result;
  } catch (error) {
    const errorMsg = `Sync failed: ${error instanceof Error ? error.message : String(error)}`;
    logger.error("Sync error", {
      operation: "sync_error",
      error: errorMsg,
    });
    result.errors.push(errorMsg);
    result.duration_ms = Date.now() - startTime;
    return result;
  }
}

// ============================================================================
// EDGE FUNCTION HANDLER
// ============================================================================

Deno.serve(async (req: Request) => {
  const requestId = generateRequestId();
  const logger = createLogger(requestId);

  try {
    // Validate request method
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const body = await req.json();
    const syncRequest: SyncRequest = body;

    // Input validation
    const validSyncTypes = ["full", "activities", "lists"];
    if (!syncRequest.sync_type || !validSyncTypes.includes(syncRequest.sync_type)) {
      return new Response(
        JSON.stringify({
          error: "Invalid sync_type. Must be 'full', 'activities', or 'lists'",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (syncRequest.dry_run !== undefined && typeof syncRequest.dry_run !== "boolean") {
      return new Response(JSON.stringify({ error: "dry_run must be a boolean" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Rate limiting
    const userId = "default"; // TODO: Extract from auth header when implemented
    if (!acquireSyncLock(userId)) {
      return new Response(
        JSON.stringify({
          error: "Sync already in progress or requested too recently",
        }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      );
    }

    // Perform sync
    const result = await performSync(syncRequest, logger);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error("Request handling failed", {
      operation: "request_error",
      error: error instanceof Error ? error.message : String(error),
    });

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
