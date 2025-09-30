# Field Handling Specification

This document defines how each field in the Book interface is populated, transformed, and managed throughout the system lifecycle.

## Overview

The Book interface contains 40+ fields organized into 6 categories, each with distinct data sources and processing requirements:

1. **RSS Source Fields**: Direct extraction from Goodreads RSS feed
2. **Parsed/Transformed Fields**: RSS data requiring format conversion or validation
3. **AI-Enhanced Fields**: Gemini AI classification and enrichment
4. **User-Generated Fields**: Derived from user interactions and reflections
5. **System-Generated Fields**: Timestamps, audit trails, and computed values
6. **Dynamic/Queue Fields**: AI-driven queue management and prioritization

---

## Field Categories by Source & Processing

### 6.1 Identifiers & Metadata

| Field              | Source | Processing Method                          | Validation                                         | Epic Implementation |
| ------------------ | ------ | ------------------------------------------ | -------------------------------------------------- | ------------------- |
| `guid`             | RSS    | Direct extraction from RSS GUID            | Required, unique constraint                        | Epic 2 (Story 2.1)  |
| `goodreads_id`     | RSS    | Parse from Goodreads URL in RSS link field | Numeric validation, optional                       | Epic 2 (Story 2.1)  |
| `isbn`             | RSS/AI | RSS first, AI fallback if missing          | ISBN-10/13 format validation                       | Epic 1 (Story 1.3)  |
| `title`            | RSS    | Direct extraction from RSS title           | Required, max 500 chars                            | Epic 2 (Story 2.1)  |
| `book_title`       | AI     | Gemini parsing to strip series notation    | Clean title extraction                             | Epic 1 (Story 1.3)  |
| `author_name`      | RSS    | Direct extraction from RSS author          | Required, semicolon-separated for multiple         | Epic 2 (Story 2.1)  |
| `link`             | RSS    | Direct extraction from RSS link            | URL validation                                     | Epic 2 (Story 2.1)  |
| `book_image_url`   | RSS    | Direct extraction from RSS image           | URL validation, variants (_small, _medium, _large) | Epic 2 (Story 2.1)  |
| `book_description` | RSS    | Direct extraction from RSS description     | Optional, HTML variant stored separately           | Epic 2 (Story 2.1)  |
| `pubdate`          | RSS    | Direct extraction from RSS pubDate         | ISO-8601 format conversion                         | Epic 2 (Story 2.1)  |
| `book_published`   | AI     | Gemini verification of publication date    | Date validation, cross-reference with pubdate      | Epic 1 (Story 1.3)  |
| `average_rating`   | RSS    | Extract from RSS description or AI         | Numeric 1-5 scale                                  | Epic 1 (Story 1.3)  |
| `updated_at`       | System | Auto-generated on every mutation           | ISO-8601 timestamp                                 | Epic 1 (Story 1.1)  |

### 6.2 Reading Status & Timing

| Field                | Source     | Processing Method                           | Validation                                         | Epic Implementation    |
| -------------------- | ---------- | ------------------------------------------- | -------------------------------------------------- | ---------------------- |
| `status`             | RSS/User   | RSS for 'Finished', user input for others   | Enum validation: TBR/Reading/Finished/DNF/Archived | Epic 2 (Story 2.1)     |
| `user_rating`        | User       | Manual user input via reflection            | Numeric 1-5 scale, optional                        | Epic 1 (Story 1.4-1.8) |
| `user_read_at`       | RSS/System | RSS for finished books, system timestamp    | ISO-8601 format                                    | Epic 2 (Story 2.1)     |
| `user_date_added`    | RSS/System | RSS or system timestamp when added to shelf | ISO-8601 format                                    | Epic 2 (Story 2.1)     |
| `user_date_created`  | RSS        | Historical timestamp from data exports      | ISO-8601 format, optional                          | Epic 2 (Story 2.1)     |
| `reflection_pending` | System     | Auto-set to true for finished books         | Boolean, triggers reflection workflow              | Epic 1 (Story 1.4)     |

### 6.3 Series Information

| Field           | Source | Processing Method                     | Validation                     | Epic Implementation |
| --------------- | ------ | ------------------------------------- | ------------------------------ | ------------------- |
| `series_name`   | AI     | Gemini extraction from title/metadata | String validation, optional    | Epic 1 (Story 1.3)  |
| `series_number` | AI     | Gemini parsing of ordinal position    | Numeric, decimals for novellas | Epic 1 (Story 1.3)  |

### 6.4 Enrichment (Tone, Tropes, etc.)

**AI Classification Fields - Gemini-Driven Enhancement**

| Field               | Source | Processing Method                                              | Validation                                             | Epic Implementation |
| ------------------- | ------ | -------------------------------------------------------------- | ------------------------------------------------------ | ------------------- |
| `tone`              | AI     | Gemini classification from description/reviews                 | Enum: Light/Medium/Heavy/Dark                          | Epic 1 (Story 1.3)  |
| `genre`             | AI     | Gemini fuzzy matching, not constrained to classifications.yaml | String, fuzzy matching allowed                         | Epic 1 (Story 1.3)  |
| `subgenre`          | AI     | Gemini sub-classification within primary genre                 | String, fuzzy matching allowed                         | Epic 1 (Story 1.3)  |
| `tropes`            | AI     | Gemini array of central story tropes                           | String array (enemies-to-lovers, found family, etc.)   | Epic 1 (Story 1.3)  |
| `spice`             | AI     | Gemini heat level classification                               | Numeric 1-5, maps to chili emojis (1=🌶️, 2=🌶️🌶️, etc.) | Epic 1 (Story 1.3)  |
| `pages_source`      | AI/RSS | Gemini verification, RSS fallback                              | Numeric, authoritative catalog preferred               | Epic 1 (Story 1.3)  |
| `next_release_date` | AI     | Gemini research for series continuation                        | ISO-8601 date format                                   | Epic 1 (Story 1.3)  |
| `hype_flag`         | AI     | Gemini assessment of viral/anticipated status                  | Enum: High/Moderate/Backlist/None                      | Epic 1 (Story 1.3)  |

**AI Prompt Strategy** (Epic 1, Story 1.3):

```typescript
// Gemini model: gemini15Flash, temperature: 0.1 for consistency
// Prompt extracts: tone, genre, subgenre, tropes[], spice, hype_flag
// Response parsing: Zod schema validation + conditional field assignment
// Error handling: Non-blocking, preserves book creation flow
```

### 6.5 Availability

| Field                    | Source | Processing Method                                    | Validation      | Epic Implementation |
| ------------------------ | ------ | ---------------------------------------------------- | --------------- | ------------------- |
| `ku_availability`        | AI/Web | Gemini + web research for Kindle Unlimited status    | Boolean         | Future Epic         |
| `ku_expires_on`          | AI/Web | Predicted KU removal based on historical patterns    | ISO-8601 date   | Future Epic         |
| `hoopla_audio_available` | API    | Hoopla API integration                               | Boolean         | Future Epic         |
| `hoopla_ebook_available` | API    | Hoopla API integration                               | Boolean         | Future Epic         |
| `availability_source`    | System | Priority algorithm: Library > KU > Hoopla > Purchase | Enum validation | Future Epic         |

### 6.6 Dynamic Gemini-Assigned Fields

**Queue Management & AI Insights**

| Field              | Source  | Processing Method                                                     | Validation                          | Epic Implementation    |
| ------------------ | ------- | --------------------------------------------------------------------- | ----------------------------------- | ---------------------- |
| `queue_position`   | AI      | Recalculation algorithm (Story 3.1)                                   | Numeric, auto-recalculated          | Epic 3 (Story 3.1)     |
| `queue_priority`   | AI/User | Priority overrides (Book Club > Library Due > New Release > Standard) | Enum + string for custom            | Epic 3 (Story 3.1)     |
| `liked`            | AI      | Extracted from user reflection text                                   | String, positive sentiment analysis | Epic 1 (Story 1.4-1.8) |
| `disliked`         | AI      | Extracted from user reflection text                                   | String, negative sentiment analysis | Epic 1 (Story 1.4-1.8) |
| `notes`            | AI/User | Additional commentary from reflection                                 | String, combined AI + user input    | Epic 1 (Story 1.4-1.8) |
| `rating_scale_tag` | AI      | Qualitative tag inferred from rating (plot-heavy, character-driven)   | String, AI-generated descriptor     | Epic 1 (Story 1.4-1.8) |
| `inferred_score`   | AI      | Gemini-predicted rating independent of user_rating                    | Numeric 1-5 with decimals           | Epic 1 (Story 1.4-1.8) |
| `goal_year`        | System  | Auto-filled from user_read_at or current date                         | Numeric year                        | Epic 1 (Story 1.4-1.8) |

---

## Data Flow Pipelines

### Pipeline 1: RSS Ingestion → Book Creation

**Epic 2, Story 2.1 Implementation**

```mermaid
graph LR
    A[RSS Feed] --> B[xml2js Parser]
    B --> C[Field Extraction]
    C --> D[Duplicate Detection]
    D --> E[Firebase Book Creation]
    E --> F[Trigger enrichBookFlow]
```

**Field Mapping**:

- RSS → Direct fields: guid, title, author_name, link, book_image_url, book_description, pubdate
- RSS → Parsed fields: goodreads_id (from URL), user_read_at (if finished)
- System → Generated fields: updated_at, reflection_pending (true for finished books)

### Pipeline 2: AI Enrichment → Metadata Enhancement

**Epic 1, Story 1.3 Implementation**

```mermaid
graph LR
    A[Book Creation] --> B[enrichBookFlow Trigger]
    B --> C[Gemini AI Call]
    C --> D[Response Parsing]
    D --> E[Field Validation]
    E --> F[Firebase Update]
```

**AI Field Assignment**:

- Input: title, author_name, book_description
- Output: tone, genre, subgenre, tropes[], spice, book_title, series_name, series_number
- Validation: Zod schema + enum constraints
- Error handling: Non-blocking, logs failures, preserves core book data

### Pipeline 3: User Reflection → AI Analysis

**Epic 1, Stories 1.4-1.8 Implementation**

```mermaid
graph LR
    A[User Reflection] --> B[processReflectionFlow]
    B --> C[Sentiment Analysis]
    C --> D[Preference Learning]
    D --> E[Field Updates]
    E --> F[Queue Recalculation Trigger]
```

**Reflection-Derived Fields**:

- Input: reflectionText, user_rating
- AI Processing: liked/disliked extraction, rating_scale_tag generation, inferred_score calculation
- System Processing: goal_year assignment, reflection_pending = false
- Trigger: Calls recalculateQueueFlow (Epic 3, Story 3.1)

### Pipeline 4: Queue Prioritization → Dynamic Ranking

**Epic 3, Story 3.1 Implementation**

```mermaid
graph LR
    A[Data Change Trigger] --> B[recalculateQueueFlow]
    B --> C[Priority Calculation]
    C --> D[Tone-Variety Guard-Rail]
    D --> E[Queue Position Assignment]
    E --> F[Firebase Batch Update]
```

**Queue Algorithm Fields**:

- Input: queue_priority, tone, genre, tropes, user preferences
- Processing: Priority weights + user preference scoring + tone variety analysis
- Output: queue_position (numeric ranking for all TBR books)
- Logging: Complete recalculation results for debugging

---

## Validation Rules & Constraints

### Required Fields

- `guid`: Must be unique across all books
- `title`: Maximum 500 characters
- `author_name`: Required for all books
- `status`: Must be valid enum value
- `updated_at`: Auto-generated, cannot be manually set

### Optional Fields with Validation

- `user_rating`: 1-5 numeric scale when present
- `spice`: 1-5 numeric scale when present
- `tone`: Must match enum values when present
- `queue_position`: Positive integer when present

### AI Field Validation

- Enum fields (tone, hype_flag): Strict validation against allowed values
- Numeric fields (spice, inferred_score): Range validation
- Array fields (tropes): Non-empty arrays when present
- String fields: Length limits and sanitization

---

## Error Handling & Fallback Strategies

### RSS Processing Errors

- **Network failures**: Retry with exponential backoff
- **Parse errors**: Log and skip malformed entries
- **Duplicate detection**: Use fuzzy matching (80% similarity threshold)
- **Field validation**: Accept partial data, flag for manual review

### AI Enrichment Errors

- **API failures**: Non-blocking, preserve book creation
- **Response parsing**: Use default values for invalid responses
- **Rate limiting**: Queue for later processing
- **Model errors**: Log for analysis, continue with partial data

### Database Operation Errors

- **Write failures**: Retry with transaction rollback
- **Validation errors**: Log field-specific issues
- **Constraint violations**: Handle uniqueness conflicts
- **Performance issues**: Batch operations when possible

---

## Performance Considerations

### Field Processing Optimization

- **Batch operations**: Group Firebase updates for efficiency
- **Conditional updates**: Only update fields that have changed
- **Async processing**: AI enrichment runs independently of book creation
- **Caching strategies**: Cache AI responses for duplicate content

### Queue Recalculation Efficiency

- **Incremental updates**: Only recalculate affected books when possible
- **Batch processing**: Update queue_position for all books in single transaction
- **Trigger optimization**: Debounce rapid changes to prevent excessive recalculations
- **Logging efficiency**: Structured logging for debugging without performance impact

---

## Integration Points

### Epic Dependencies

- **Epic 1 → Epic 2**: AI enrichment flows triggered by RSS ingestion
- **Epic 2 → Epic 3**: Queue recalculation triggered by reflection completion
- **Epic 3 → Future**: Recommendation engine uses all populated fields

### External API Integration

- **RSS Feeds**: Goodreads RSS for book discovery
- **Gemini AI**: Google AI models for enrichment and analysis
- **Firebase**: Real-time database and Cloud Functions
- **Future APIs**: Library systems, availability checking, additional book databases

---

## Change Log

| Date       | Version | Description                                        | Author                |
| ---------- | ------- | -------------------------------------------------- | --------------------- |
| 2025-08-01 | 1.0     | Initial comprehensive field handling specification | Sarah (Product Owner) |
