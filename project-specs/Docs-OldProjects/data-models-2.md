# Data Models

## `books` Table (Final Version)

- **Core Identifiers**
  - `id`, `goodreads_id`, `isbn`, `created_at`
- **Bibliographic Data**
  - `title`, `author`, `page_count`, `publisher`, `publication_date`, `series_name`, `series_number`, `cover_image_url`, `goodreads_link`
- **User Data (from Goodreads RSS)**
  - `user_shelves`, `user_rating`, `user_date_added`, `user_date_finished`
- **Classification & Thematic Data (Enriched)**
  - `genres_primary`, `genres_secondary`, `tropes`, `themes`, `keywords`, `target_audience`
- **Stylistic & Structural Data (Enriched)**
  - `pacing`, `tone`, `writing_style`, `pov_type`, `pov_gender`, `spice_level`
- **System & AI-Generated Data**
  - `status`, `queue_position`, `availability`, `hype_flag`, `ai_summary`, `ai_rating`, `embedding`

## Other Tables

- `reflections`, `user_preferences`, `conversational_state`, `book_events`
