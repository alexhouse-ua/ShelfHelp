# Data Models

The following TypeScript interfaces define the core data structures. To optimize for Firebase's shallow queries, the model is kept relatively flat.

```typescript
// packages/shared/src/types.ts

export interface Book {
  // 6.1 Identifiers & Metadata
  guid: string; // Primary key - Unique RSS identifier for de-duplication
  goodreads_id?: string; // Goodreads numeric ID parsed from URLs
  isbn?: string; // ISBN-10 or ISBN-13; nullable if not available
  title: string; // Original full title (may include series notation)
  book_title?: string; // Clean title stripped of series info
  author_name: string; // Primary author; multiple authors separated by semicolon
  link?: string; // Canonical Goodreads (or equivalent) link
  book_image_url?: string; // Default cover image; RSS variants (_small, _medium, _large)
  book_description?: string; // Plain-text synopsis; HTML variant stored in description_html
  pubdate?: string; // Feed's publication date (ISO-8601)
  book_published?: string; // Verified publication date from enrichment
  average_rating?: number; // Crowd rating at last fetch
  updated_at: string; // Timestamp auto-updated on every mutation

  // 6.2 Reading Status & Timing
  status: "TBR" | "Reading" | "Finished" | "DNF" | "Archived";
  user_rating?: number; // Reader's explicit star rating (1-5)
  user_read_at?: string; // Timestamp marking completion
  user_date_added?: string; // When the title entered the user's shelf
  user_date_created?: string; // Original timestamp from historical export
  reflection_pending: boolean; // true until reflection is completed

  // 6.3 Series Information
  series_name?: string; // Series name extracted from metadata or title
  series_number?: number; // Ordinal position within series; decimals for novellas

  // 6.4 Enrichment (Tone, Tropes, etc.)
  tone?: "Light" | "Medium" | "Heavy" | "Dark";
  genre?: string; // Fuzzy matching - not constrained to classifications.yaml
  subgenre?: string; // Fuzzy matching - not constrained to classifications.yaml
  tropes?: string[]; // Central tropes (enemies-to-lovers, found family, etc.)
  spice?: number; // Heat level 1-5 (maps to chili pepper emojis in UI: 1=🌶️, 2=🌶️🌶️, etc.)
  pages_source?: number; // Page count from authoritative catalog
  next_release_date?: string; // Publication date of next series installment
  hype_flag?: "High" | "Moderate" | "Backlist" | "None"; // Viral or anticipated status

  // 6.5 Availability
  ku_availability?: boolean; // true if title is in Kindle Unlimited
  ku_expires_on?: string; // Expected KU removal date
  // library_hold_status variants (6 branches) - implement as needed
  hoopla_audio_available?: boolean; // Hoopla audiobook availability
  hoopla_ebook_available?: boolean; // Hoopla eBook availability
  availability_source?: "Library" | "KU" | "Hoopla" | "Purchase"; // Preferred acquisition

  // 6.6 Dynamic Gemini-Assigned Fields
  queue_position?: number; // Numeric slot in upcoming-reads list
  queue_priority?: "Backlog" | "Book Club" | "Library Due" | string; // Overrides
  liked?: string; // Positive reflections captured from the reader
  disliked?: string; // Negative reflections
  notes?: string; // Additional commentary gathered during reflection
  rating_scale_tag?: string; // Qualitative tag inferred from rating (e.g., plot-heavy)
  inferred_score?: number; // Gemini-predicted rating (1-5 with decimals) independent of user_rating
  goal_year?: number; // Calendar year auto-filled from user_read_at or current date when finished
}

export interface Reflection {
  bookId: string;
  timestamp: number;
  reflectionText: string;
}

export interface UserPreferences {
  userId: "default"; // For single-user model
  genreScores: { [genre: string]: number };
  tropeScores: { [trope: string]: number };
}
```
