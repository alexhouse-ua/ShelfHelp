/**
 * Priority scoring algorithm for TBR queue prioritization
 * Calculates priority scores based on multiple weighted factors
 */

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

/**
 * Configuration object for scoring algorithm weights
 * All weights should sum to 1.0 for normalized scoring
 */
export interface ScoringWeights {
  /** Weight for reading speed factor (0.10) */
  readingSpeed: number;
  /** Weight for deadline urgency factor (0.40) */
  deadlineUrgency: number;
  /** Weight for hype signal factor (0.25) */
  hypeSignal: number;
  /** Weight for preference alignment factor (0.25) */
  preferenceAlignment: number;
}

/**
 * Default scoring weights as specified in story requirements
 */
export const DEFAULT_WEIGHTS: ScoringWeights = {
  readingSpeed: 0.1,
  deadlineUrgency: 0.4,
  hypeSignal: 0.25,
  preferenceAlignment: 0.25,
};

/**
 * Input data for priority score calculation
 */
export interface BookScoringData {
  bookId: string;
  pageCount: number | null;
  hypeFlag: boolean;
  genre: string | null;
  author: string | null;
}

/**
 * Result of priority score calculation
 */
export interface ScoringResult {
  bookId: string;
  priorityScore: number;
  factors: {
    readingSpeed: number;
    deadlineUrgency: number;
    hypeSignal: number;
    preferenceAlignment: number;
  };
}

/**
 * Calculates reading speed factor based on page count and historical reading pace
 * Formula: 1 - (page_count / (avg_pace × 30 days))
 * Higher score = faster to read (shorter books prioritized when time-constrained)
 *
 * @param pageCount - Number of pages in the book
 * @param avgPagesPerDay - Average pages per day from user preferences
 * @returns Reading speed factor score (0-1)
 */
export function calculateReadingSpeedFactor(
  pageCount: number | null,
  avgPagesPerDay: number,
): number {
  if (!pageCount || pageCount <= 0 || avgPagesPerDay <= 0) {
    return 0.5; // Neutral score if data unavailable
  }

  const daysToComplete = pageCount / avgPagesPerDay;
  const thirtyDayNorm = daysToComplete / 30;
  const score = Math.max(0, 1 - thirtyDayNorm);

  return Math.min(1, score); // Clamp to [0, 1]
}

/**
 * Calculates deadline urgency factor based on nearest active deadline
 * Formula: max(0, 1 - (days_until_deadline / 30))
 * Higher score = more urgent (books due soon prioritized)
 *
 * @param deadlineDate - Date of the nearest active deadline (null if none)
 * @returns Deadline urgency factor score (0-1)
 */
export function calculateDeadlineUrgencyFactor(deadlineDate: Date | null): number {
  if (!deadlineDate) {
    return 0; // No deadline = no urgency
  }

  const now = new Date();
  const daysUntilDeadline = (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  if (daysUntilDeadline < 0) {
    return 1; // Past deadline = maximum urgency
  }

  const score = Math.max(0, 1 - daysUntilDeadline / 30);
  return score;
}

/**
 * Calculates hype signal factor based on hype flag
 * Formula: If hype_flag=true → 1.0; else → 0.0
 * Binary signal for trending/popular books
 *
 * @param hypeFlag - Boolean indicating if book is trending/hyped
 * @returns Hype signal factor score (0 or 1)
 */
export function calculateHypeSignalFactor(hypeFlag: boolean): number {
  return hypeFlag ? 1.0 : 0.0;
}

/**
 * Calculates preference alignment factor based on AI ratings of similar READ books
 * Formula:
 * 1. Find READ books with matching genre OR author
 * 2. Calculate avg_ai_rating from those books
 * 3. Score = avg_ai_rating / 10
 * 4. Fallback (no similar READ books): Score = 0.5 (neutral)
 *
 * @param supabase - Supabase client for database queries
 * @param bookId - ID of the book being scored
 * @param genre - Genre of the book
 * @param author - Author of the book
 * @returns Preference alignment factor score (0-1)
 */
export async function calculatePreferenceAlignmentFactor(
  supabase: SupabaseClient,
  _bookId: string,
  genre: string | null,
  author: string | null,
): Promise<number> {
  if (!genre && !author) {
    return 0.5; // Neutral score if no genre/author data
  }

  // Query for READ books with matching genre or author
  let query = supabase
    .from("books")
    .select("ai_rating")
    .eq("status", "read")
    .not("ai_rating", "is", null);

  // Build genre/author filter
  if (genre && author) {
    query = query.or(`genres_primary.eq.${genre},author.eq.${author}`);
  } else if (genre) {
    query = query.eq("genres_primary", genre);
  } else if (author) {
    query = query.eq("author", author);
  }

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    return 0.5; // Fallback to neutral if no similar books found
  }

  // Calculate average AI rating
  const ratings = data.map((book) => book.ai_rating as number);
  const avgRating = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;

  // Normalize to [0, 1] scale
  return avgRating / 10;
}

/**
 * Fetches user's average reading pace from user_preferences table
 * Returns avg_pages_per_day from preference_value JSONB
 *
 * @param supabase - Supabase client for database queries
 * @param userId - ID of the user (default: 'default_user' for single-user system)
 * @returns Average pages per day, or default of 50 if not found
 */
export async function fetchUserReadingPace(
  supabase: SupabaseClient,
  userId = "default_user",
): Promise<number> {
  const { data, error } = await supabase
    .from("user_preferences")
    .select("preference_value")
    .eq("preference_key", "reading_pace")
    .eq("user_id", userId)
    .single();

  if (error || !data || !data.preference_value) {
    return 50; // Default: 50 pages per day
  }

  const preferenceValue = data.preference_value as { avg_pages_per_day?: number };
  return preferenceValue.avg_pages_per_day || 50;
}

/**
 * Fetches the nearest active deadline for a book
 * Returns the earliest deadline_date from deadlines table
 *
 * @param supabase - Supabase client for database queries
 * @param bookId - ID of the book
 * @returns Date of nearest deadline, or null if none
 */
export async function fetchNearestDeadline(
  supabase: SupabaseClient,
  bookId: string,
): Promise<Date | null> {
  const { data, error } = await supabase
    .from("deadlines")
    .select("deadline_date")
    .eq("book_id", bookId)
    .eq("status", "active")
    .order("deadline_date", { ascending: true })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return new Date(data.deadline_date);
}

/**
 * Calculates the priority score for a book based on multiple weighted factors
 * Formula: Priority Score = (W1 × Reading Speed) + (W2 × Deadline Urgency) + (W3 × Hype Signal) + (W4 × Preference Alignment)
 *
 * @param supabase - Supabase client for database queries
 * @param bookData - Book data for scoring
 * @param weights - Scoring weights configuration (defaults to DEFAULT_WEIGHTS)
 * @returns ScoringResult with total score and individual factor scores
 */
export async function calculatePriorityScore(
  supabase: SupabaseClient,
  bookData: BookScoringData,
  weights: ScoringWeights = DEFAULT_WEIGHTS,
): Promise<ScoringResult> {
  // Fetch supporting data
  const avgPagesPerDay = await fetchUserReadingPace(supabase);
  const nearestDeadline = await fetchNearestDeadline(supabase, bookData.bookId);

  // Calculate individual factor scores
  const readingSpeedScore = calculateReadingSpeedFactor(bookData.pageCount, avgPagesPerDay);
  const deadlineUrgencyScore = calculateDeadlineUrgencyFactor(nearestDeadline);
  const hypeSignalScore = calculateHypeSignalFactor(bookData.hypeFlag);
  const preferenceAlignmentScore = await calculatePreferenceAlignmentFactor(
    supabase,
    bookData.bookId,
    bookData.genre,
    bookData.author,
  );

  // Calculate weighted total score
  const priorityScore = weights.readingSpeed * readingSpeedScore +
    weights.deadlineUrgency * deadlineUrgencyScore +
    weights.hypeSignal * hypeSignalScore +
    weights.preferenceAlignment * preferenceAlignmentScore;

  return {
    bookId: bookData.bookId,
    priorityScore: Math.min(1, Math.max(0, priorityScore)), // Clamp to [0, 1]
    factors: {
      readingSpeed: readingSpeedScore,
      deadlineUrgency: deadlineUrgencyScore,
      hypeSignal: hypeSignalScore,
      preferenceAlignment: preferenceAlignmentScore,
    },
  };
}
