/**
 * Multi-source book metadata search
 * Orchestrates searches across Open Library, Google Books, and Goodreads
 * @module book-search
 */

import { goodreadsLimiter, openLibraryLimiter, retryWithBackoff } from "./rate-limiter.ts";

export interface BookMetadata {
  title: string;
  author: string;
  isbn?: string;
  page_count?: number;
  cover_image_url?: string;
  goodreads_id?: number;
  goodreads_link?: string;
  publisher?: string;
  publication_date?: string;
  sources: string[]; // Track which APIs provided data
}

export interface SearchResult {
  success: boolean;
  books?: BookMetadata[];
  error?: string;
  errorCode?: string;
}

/**
 * Orchestrates a book search across Open Library and Google Books, deduplicates results, and attempts optional Goodreads enrichment.
 *
 * @param title - The book title to search for
 * @param author - The book author to narrow the search
 * @returns A SearchResult containing merged, optionally enriched `BookMetadata[]` when `success` is `true`. On failure `success` is `false` and `error`/`errorCode` describe the problem (e.g., `NOT_FOUND` when no primary-source results were found, `SEARCH_ERROR` for unexpected failures).
 */
export async function searchBook(title: string, author: string): Promise<SearchResult> {
  try {
    // Search Open Library and Google Books in parallel
    const [openLibResult, googleResult] = await Promise.allSettled([
      searchOpenLibrary(title, author),
      searchGoogleBooks(title, author),
    ]);

    // Collect successful results
    const allBooks: BookMetadata[] = [];

    if (openLibResult.status === "fulfilled" && openLibResult.value.books) {
      allBooks.push(...openLibResult.value.books);
    }

    if (googleResult.status === "fulfilled" && googleResult.value.books) {
      allBooks.push(...googleResult.value.books);
    }

    // If we have no results from primary sources, return early
    if (allBooks.length === 0) {
      return {
        success: false,
        error: "Book not found in any database",
        errorCode: "NOT_FOUND",
      };
    }

    // Merge duplicate results (same title + author)
    const mergedBooks = mergeDuplicates(allBooks);

    // Attempt Goodreads scraping for each result (optional, can fail)
    const booksWithGoodreads = await enrichWithGoodreads(mergedBooks);

    return {
      success: true,
      books: booksWithGoodreads,
    };
  } catch (error) {
    console.error("Book search error:", error);
    return {
      success: false,
      error: "Search failed",
      errorCode: "SEARCH_ERROR",
    };
  }
}

/**
 * Query Open Library for book metadata matching a title and optional author.
 *
 * @returns A SearchResult containing up to five BookMetadata objects in `books` when successful; on failure `error` and `errorCode` are set. Possible `errorCode` values include `API_ERROR` (non-OK API response), `NOT_FOUND` (no results), and `NETWORK_ERROR` (request/processing failure).
 */
async function searchOpenLibrary(title: string, author: string): Promise<SearchResult> {
  await openLibraryLimiter.throttle();

  try {
    const params = new URLSearchParams();
    params.append("title", title);
    if (author) params.append("author", author);
    params.append("limit", "5");

    const response = await fetch(`https://openlibrary.org/search.json?${params}`);

    if (!response.ok) {
      return { success: false, error: "Open Library API error", errorCode: "API_ERROR" };
    }

    const data = await response.json();

    if (!data.docs || data.docs.length === 0) {
      return { success: false, error: "No results from Open Library", errorCode: "NOT_FOUND" };
    }

    // deno-lint-ignore no-explicit-any
    const books: BookMetadata[] = data.docs.slice(0, 5).map((doc: any) => ({
      title: doc.title || "",
      author: doc.author_name?.[0] || "",
      isbn: doc.isbn?.[0],
      page_count: doc.number_of_pages_median,
      cover_image_url: doc.cover_i
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
        : undefined,
      publisher: doc.publisher?.[0],
      publication_date: doc.first_publish_year?.toString(),
      sources: ["open_library"],
    }));

    return { success: true, books };
  } catch (error) {
    console.error("Open Library search error:", error);
    return { success: false, error: "Network error", errorCode: "NETWORK_ERROR" };
  }
}

/**
 * Search Google Books for volumes matching the provided title and optional author and map results to BookMetadata.
 *
 * Performs a query limited to five results, prefers `ISBN_13` when present, and extracts common volume fields (title, author, ISBN, page count, cover image, publisher, publication date). Returns a `NOT_FOUND` result when no items are found and an `API_ERROR` result for non-OK API responses.
 *
 * @param title - The book title to search for (used as `intitle:` in the query)
 * @param author - Optional author name to narrow the search (used as `inauthor:` in the query)
 * @returns `SearchResult` with `books` containing up to five `BookMetadata` entries on success; on failure `success` is `false` and `errorCode` will be one of `NOT_FOUND`, `API_ERROR`, or `NETWORK_ERROR`
 */
async function searchGoogleBooks(title: string, author: string): Promise<SearchResult> {
  try {
    const query = `intitle:${title}${author ? `+inauthor:${author}` : ""}`;
    const params = new URLSearchParams({ q: query, maxResults: "5" });

    const searchFn = async () => {
      const response = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`);
      if (response.status === 429) throw response; // Trigger retry
      return response;
    };

    const response = await retryWithBackoff(searchFn);

    if (!response.ok) {
      return { success: false, error: "Google Books API error", errorCode: "API_ERROR" };
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      return { success: false, error: "No results from Google Books", errorCode: "NOT_FOUND" };
    }

    // deno-lint-ignore no-explicit-any
    const books: BookMetadata[] = data.items.map((item: any) => {
      const volumeInfo = item.volumeInfo;
      return {
        title: volumeInfo.title || "",
        author: volumeInfo.authors?.[0] || "",
        // deno-lint-ignore no-explicit-any
        isbn: volumeInfo.industryIdentifiers?.find((id: any) =>
          id.type === "ISBN_13"
        )?.identifier ||
          volumeInfo.industryIdentifiers?.[0]?.identifier,
        page_count: volumeInfo.pageCount,
        cover_image_url: volumeInfo.imageLinks?.large || volumeInfo.imageLinks?.thumbnail,
        publisher: volumeInfo.publisher,
        publication_date: volumeInfo.publishedDate,
        sources: ["google_books"],
      };
    });

    return { success: true, books };
  } catch (error) {
    console.error("Google Books search error:", error);
    return { success: false, error: "Network error", errorCode: "NETWORK_ERROR" };
  }
}

/**
 * Enriches each book with Goodreads ID and link when a match is found.
 *
 * For each input book this function attempts to scrape a Goodreads ID/link; failures for individual books are non-fatal and leave that book unchanged. When Goodreads data is attached, `"goodreads"` is appended to the book's `sources`.
 *
 * @param books - Array of book metadata objects to attempt enrichment for
 * @returns A new array of `BookMetadata` where books that matched on Goodreads include `goodreads_id`, `goodreads_link`, and `"goodreads"` in `sources`; other books are unchanged
 */
async function enrichWithGoodreads(books: BookMetadata[]): Promise<BookMetadata[]> {
  const enrichedBooks = await Promise.all(
    books.map(async (book) => {
      try {
        await goodreadsLimiter.throttle();
        const goodreadsData = await scrapeGoodreadsId(book.title, book.author);

        if (goodreadsData) {
          return {
            ...book,
            goodreads_id: goodreadsData.id,
            goodreads_link: goodreadsData.link,
            sources: [...book.sources, "goodreads"],
          };
        }
      } catch (error) {
        console.warn(`Goodreads scraping failed for "${book.title}":`, error);
      }

      return book;
    }),
  );

  return enrichedBooks;
}

/**
 * Attempts to find a Goodreads book ID and direct book link by querying Goodreads search with the provided title and author.
 *
 * @param title - The book title to search for
 * @param author - The book author to search for
 * @returns An object containing the Goodreads numeric `id` and a direct `link` to the book page if found, `null` otherwise.
 */
async function scrapeGoodreadsId(
  title: string,
  author: string,
): Promise<{ id: number; link: string } | null> {
  try {
    const query = `${title} ${author}`.trim();
    const searchUrl = `https://www.goodreads.com/search?q=${encodeURIComponent(query)}`;

    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ShelfHelpBot/1.0)",
      },
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();

    // Look for book URLs in format: /book/show/{id}-{slug}
    const bookUrlPattern = /\/book\/show\/(\d+)/;
    const match = html.match(bookUrlPattern);

    if (match && match[1]) {
      const id = parseInt(match[1], 10);
      return {
        id,
        link: `https://www.goodreads.com/book/show/${id}`,
      };
    }

    return null;
  } catch (error) {
    console.warn("Goodreads scraping error:", error);
    return null;
  }
}

/**
 * Deduplicates and merges book metadata entries by title and author.
 *
 * Merges entries that refer to the same book (case-insensitive title and author). For duplicates, missing fields are filled from other entries when available and source lists are combined without duplicates.
 *
 * @param books - Array of BookMetadata objects to deduplicate and merge
 * @returns An array of merged BookMetadata objects with aggregated sources
 */
function mergeDuplicates(books: BookMetadata[]): BookMetadata[] {
  const bookMap = new Map<string, BookMetadata>();

  for (const book of books) {
    const key = `${book.title.toLowerCase()}|${book.author.toLowerCase()}`;

    if (bookMap.has(key)) {
      // Merge with existing entry, prioritizing non-null values
      const existing = bookMap.get(key)!;
      bookMap.set(key, {
        ...existing,
        isbn: existing.isbn || book.isbn,
        page_count: existing.page_count || book.page_count,
        cover_image_url: existing.cover_image_url || book.cover_image_url,
        goodreads_id: existing.goodreads_id || book.goodreads_id,
        goodreads_link: existing.goodreads_link || book.goodreads_link,
        publisher: existing.publisher || book.publisher,
        publication_date: existing.publication_date || book.publication_date,
        sources: [...new Set([...existing.sources, ...book.sources])],
      });
    } else {
      bookMap.set(key, book);
    }
  }

  return Array.from(bookMap.values());
}
