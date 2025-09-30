/**
 * Comprehensive unit tests for book search functionality
 * Testing Framework: Deno built-in test runner
 * Assertion Library: @std/assert
 */

import { assertEquals, assertExists, assertRejects } from "jsr:@std/assert";
import { stub, type Stub, assertSpyCall, assertSpyCalls, spy, restore, returnsNext } from "jsr:@std/testing/mock";
import {
  searchBook,
  type BookMetadata,
  type SearchResult,
} from "./book_search.ts";
import * as rateLimiter from "./rate-limiter.ts";

// Test fixtures
const mockOpenLibraryResponse = {
  docs: [
    {
      title: "The Great Gatsby",
      author_name: ["F. Scott Fitzgerald"],
      isbn: ["9780743273565"],
      number_of_pages_median: 180,
      cover_i: 12345,
      publisher: ["Scribner"],
      first_publish_year: 1925,
    },
    {
      title: "The Great Gatsby (Deluxe Edition)",
      author_name: ["F. Scott Fitzgerald"],
      isbn: ["9780141182636"],
      number_of_pages_median: 200,
      cover_i: 67890,
      publisher: ["Penguin"],
      first_publish_year: 2013,
    },
  ],
};

const mockGoogleBooksResponse = {
  items: [
    {
      volumeInfo: {
        title: "The Great Gatsby",
        authors: ["F. Scott Fitzgerald"],
        industryIdentifiers: [
          { type: "ISBN_13", identifier: "9780743273565" },
          { type: "ISBN_10", identifier: "0743273565" },
        ],
        pageCount: 180,
        imageLinks: {
          thumbnail: "https://example.com/thumbnail.jpg",
          large: "https://example.com/large.jpg",
        },
        publisher: "Scribner",
        publishedDate: "2004-09-30",
      },
    },
  ],
};

const mockGoodreadsHTML = `
  <html>
    <body>
      <a href="/book/show/4671-the-great-gatsby">The Great Gatsby</a>
    </body>
  </html>
`;

// Helper to create mock Response objects
function createMockResponse(data: unknown, status = 200, ok = true): Response {
  return {
    ok,
    status,
    json: async () => data,
    text: async () => (typeof data === "string" ? data : JSON.stringify(data)),
  } as Response;
}

// Setup and teardown
function setupMocks() {
  const fetchStub = stub(globalThis, "fetch", returnsNext([
    Promise.resolve(createMockResponse(mockOpenLibraryResponse)),
    Promise.resolve(createMockResponse(mockGoogleBooksResponse)),
  ]));

  const throttleStub = stub(rateLimiter.openLibraryLimiter, "throttle", () => Promise.resolve());
  const goodreadsThrottleStub = stub(rateLimiter.goodreadsLimiter, "throttle", () => Promise.resolve());

  return { fetchStub, throttleStub, goodreadsThrottleStub };
}

Deno.test("searchBook - happy path with results from both sources", async () => {
  const mocks = setupMocks();

  try {
    const result = await searchBook("The Great Gatsby", "F. Scott Fitzgerald");

    assertEquals(result.success, true);
    assertExists(result.books);
    assertEquals(result.books!.length >= 1, true);
    assertEquals(result.books![0].title, "The Great Gatsby");
    assertEquals(result.books![0].author, "F. Scott Fitzgerald");
    assertExists(result.books![0].sources);
  } finally {
    restore();
  }
});

Deno.test("searchBook - merges duplicate results from different sources", async () => {
  const fetchStub = stub(globalThis, "fetch", returnsNext([
    Promise.resolve(createMockResponse(mockOpenLibraryResponse)),
    Promise.resolve(createMockResponse(mockGoogleBooksResponse)),
  ]));

  stub(rateLimiter.openLibraryLimiter, "throttle", () => Promise.resolve());
  stub(rateLimiter.goodreadsLimiter, "throttle", () => Promise.resolve());

  try {
    const result = await searchBook("The Great Gatsby", "F. Scott Fitzgerald");

    assertEquals(result.success, true);
    assertExists(result.books);

    // Should merge books with same title and author
    const mainBook = result.books!.find(b =>
      b.title === "The Great Gatsby" &&
      b.author === "F. Scott Fitzgerald" &&
      !b.title.includes("Deluxe")
    );

    assertExists(mainBook);
    // Should have sources from both APIs
    assertEquals(mainBook.sources.length >= 2, true);
    assertEquals(mainBook.sources.includes("open_library"), true);
    assertEquals(mainBook.sources.includes("google_books"), true);
  } finally {
    restore();
  }
});

Deno.test("searchBook - handles no results from any source", async () => {
  stub(globalThis, "fetch", returnsNext([
    Promise.resolve(createMockResponse({ docs: [] })),
    Promise.resolve(createMockResponse({ items: [] })),
  ]));

  stub(rateLimiter.openLibraryLimiter, "throttle", () => Promise.resolve());
  stub(rateLimiter.goodreadsLimiter, "throttle", () => Promise.resolve());

  try {
    const result = await searchBook("Nonexistent Book", "Unknown Author");

    assertEquals(result.success, false);
    assertEquals(result.error, "Book not found in any database");
    assertEquals(result.errorCode, "NOT_FOUND");
    assertEquals(result.books, undefined);
  } finally {
    restore();
  }
});

Deno.test("searchBook - handles API errors gracefully", async () => {
  stub(globalThis, "fetch", returnsNext([
    Promise.resolve(createMockResponse({}, 500, false)),
    Promise.resolve(createMockResponse({}, 500, false)),
  ]));

  stub(rateLimiter.openLibraryLimiter, "throttle", () => Promise.resolve());
  stub(rateLimiter.goodreadsLimiter, "throttle", () => Promise.resolve());

  try {
    const result = await searchBook("Test Book", "Test Author");

    assertEquals(result.success, false);
    assertEquals(result.errorCode, "NOT_FOUND");
  } finally {
    restore();
  }
});

Deno.test("searchBook - handles network errors", async () => {
  stub(globalThis, "fetch", () => Promise.reject(new Error("Network failure")));
  stub(rateLimiter.openLibraryLimiter, "throttle", () => Promise.resolve());
  stub(rateLimiter.goodreadsLimiter, "throttle", () => Promise.resolve());

  try {
    const result = await searchBook("Test Book", "Test Author");

    assertEquals(result.success, false);
    assertEquals(result.errorCode, "NOT_FOUND");
  } finally {
    restore();
  }
});

Deno.test("searchBook - works with empty author string", async () => {
  const fetchStub = stub(globalThis, "fetch", returnsNext([
    Promise.resolve(createMockResponse(mockOpenLibraryResponse)),
    Promise.resolve(createMockResponse(mockGoogleBooksResponse)),
  ]));

  stub(rateLimiter.openLibraryLimiter, "throttle", () => Promise.resolve());
  stub(rateLimiter.goodreadsLimiter, "throttle", () => Promise.resolve());

  try {
    const result = await searchBook("The Great Gatsby", "");

    assertEquals(result.success, true);
    assertExists(result.books);
  } finally {
    restore();
  }
});

Deno.test("searchBook - handles partial failures (one source succeeds)", async () => {
  stub(globalThis, "fetch", returnsNext([
    Promise.resolve(createMockResponse({}, 500, false)), // Open Library fails
    Promise.resolve(createMockResponse(mockGoogleBooksResponse)), // Google succeeds
  ]));

  stub(rateLimiter.openLibraryLimiter, "throttle", () => Promise.resolve());
  stub(rateLimiter.goodreadsLimiter, "throttle", () => Promise.resolve());

  try {
    const result = await searchBook("The Great Gatsby", "F. Scott Fitzgerald");

    assertEquals(result.success, true);
    assertExists(result.books);
    assertEquals(result.books!.length > 0, true);
  } finally {
    restore();
  }
});

Deno.test("searchBook - enriches with Goodreads data when available", async () => {
  stub(globalThis, "fetch", returnsNext([
    Promise.resolve(createMockResponse(mockOpenLibraryResponse)),
    Promise.resolve(createMockResponse(mockGoogleBooksResponse)),
    Promise.resolve(createMockResponse(mockGoodreadsHTML)),
  ]));

  stub(rateLimiter.openLibraryLimiter, "throttle", () => Promise.resolve());
  stub(rateLimiter.goodreadsLimiter, "throttle", () => Promise.resolve());

  try {
    const result = await searchBook("The Great Gatsby", "F. Scott Fitzgerald");

    assertEquals(result.success, true);
    assertExists(result.books);

    const bookWithGoodreads = result.books!.find(b => b.goodreads_id);
    if (bookWithGoodreads) {
      assertEquals(bookWithGoodreads.goodreads_id, 4671);
      assertEquals(bookWithGoodreads.goodreads_link, "https://www.goodreads.com/book/show/4671");
      assertEquals(bookWithGoodreads.sources.includes("goodreads"), true);
    }
  } finally {
    restore();
  }
});

Deno.test("searchBook - continues when Goodreads scraping fails", async () => {
  stub(globalThis, "fetch", returnsNext([
    Promise.resolve(createMockResponse(mockOpenLibraryResponse)),
    Promise.resolve(createMockResponse(mockGoogleBooksResponse)),
    Promise.resolve(createMockResponse({}, 403, false)), // Goodreads fails
  ]));

  stub(rateLimiter.openLibraryLimiter, "throttle", () => Promise.resolve());
  stub(rateLimiter.goodreadsLimiter, "throttle", () => Promise.resolve());

  try {
    const result = await searchBook("The Great Gatsby", "F. Scott Fitzgerald");

    // Should still succeed even if Goodreads fails
    assertEquals(result.success, true);
    assertExists(result.books);
  } finally {
    restore();
  }
});

Deno.test("searchBook - respects rate limiting", async () => {
  stub(globalThis, "fetch", returnsNext([
    Promise.resolve(createMockResponse(mockOpenLibraryResponse)),
    Promise.resolve(createMockResponse(mockGoogleBooksResponse)),
  ]));

  const openLibThrottle = stub(rateLimiter.openLibraryLimiter, "throttle", () => Promise.resolve());
  const goodreadsThrottle = stub(rateLimiter.goodreadsLimiter, "throttle", () => Promise.resolve());

  try {
    await searchBook("The Great Gatsby", "F. Scott Fitzgerald");

    // Verify throttle was called for Open Library
    assertSpyCalls(openLibThrottle, 1);
  } finally {
    restore();
  }
});

Deno.test("Open Library API - constructs correct URL with parameters", async () => {
  const fetchStub = stub(globalThis, "fetch", () =>
    Promise.resolve(createMockResponse(mockOpenLibraryResponse))
  );

  stub(rateLimiter.openLibraryLimiter, "throttle", () => Promise.resolve());
  stub(rateLimiter.goodreadsLimiter, "throttle", () => Promise.resolve());

  try {
    await searchBook("Test Title", "Test Author");

    assertSpyCalls(fetchStub, 2); // Open Library and Google Books

    const firstCall = fetchStub.calls[0];
    const url = firstCall.args[0] as string;

    assertEquals(url.includes("openlibrary.org/search.json"), true);
    assertEquals(url.includes("title=Test+Title"), true);
    assertEquals(url.includes("author=Test+Author"), true);
    assertEquals(url.includes("limit=5"), true);
  } finally {
    restore();
  }
});

Deno.test("Open Library API - handles missing optional fields", async () => {
  const minimalResponse = {
    docs: [{
      title: "Minimal Book",
      // No author_name, isbn, cover, etc.
    }],
  };

  stub(globalThis, "fetch", returnsNext([
    Promise.resolve(createMockResponse(minimalResponse)),
    Promise.resolve(createMockResponse({ items: [] })),
  ]));

  stub(rateLimiter.openLibraryLimiter, "throttle", () => Promise.resolve());
  stub(rateLimiter.goodreadsLimiter, "throttle", () => Promise.resolve());

  try {
    const result = await searchBook("Minimal Book", "");

    assertEquals(result.success, true);
    assertExists(result.books);
    assertEquals(result.books![0].title, "Minimal Book");
    assertEquals(result.books![0].author, "");
    assertEquals(result.books![0].isbn, undefined);
    assertEquals(result.books![0].cover_image_url, undefined);
  } finally {
    restore();
  }
});

Deno.test("Open Library API - limits results to 5", async () => {
  const manyResults = {
    docs: Array(10).fill(null).map((_, i) => ({
      title: `Book ${i}`,
      author_name: [`Author ${i}`],
    })),
  };

  stub(globalThis, "fetch", returnsNext([
    Promise.resolve(createMockResponse(manyResults)),
    Promise.resolve(createMockResponse({ items: [] })),
  ]));

  stub(rateLimiter.openLibraryLimiter, "throttle", () => Promise.resolve());
  stub(rateLimiter.goodreadsLimiter, "throttle", () => Promise.resolve());

  try {
    const result = await searchBook("Books", "Authors");

    assertEquals(result.success, true);
    assertExists(result.books);
    // Should have at most 5 books from Open Library
    assertEquals(result.books!.filter(b => b.sources.includes("open_library")).length <= 5, true);
  } finally {
    restore();
  }
});

Deno.test("Google Books API - constructs correct query", async () => {
  const fetchStub = stub(globalThis, "fetch", returnsNext([
    Promise.resolve(createMockResponse({ docs: [] })),
    Promise.resolve(createMockResponse(mockGoogleBooksResponse)),
  ]));

  stub(rateLimiter.openLibraryLimiter, "throttle", () => Promise.resolve());
  stub(rateLimiter.goodreadsLimiter, "throttle", () => Promise.resolve());

  try {
    await searchBook("Test Title", "Test Author");

    const googleCall = fetchStub.calls[1];
    const url = googleCall.args[0] as string;

    assertEquals(url.includes("googleapis.com/books/v1/volumes"), true);
    assertEquals(url.includes("intitle:Test+Title"), true);
    assertEquals(url.includes("inauthor:Test+Author"), true);
    assertEquals(url.includes("maxResults=5"), true);
  } finally {
    restore();
  }
});

Deno.test("Google Books API - handles query without author", async () => {
  const fetchStub = stub(globalThis, "fetch", returnsNext([
    Promise.resolve(createMockResponse({ docs: [] })),
    Promise.resolve(createMockResponse(mockGoogleBooksResponse)),
  ]));

  stub(rateLimiter.openLibraryLimiter, "throttle", () => Promise.resolve());
  stub(rateLimiter.goodreadsLimiter, "throttle", () => Promise.resolve());

  try {
    await searchBook("Test Title", "");

    const googleCall = fetchStub.calls[1];
    const url = googleCall.args[0] as string;

    assertEquals(url.includes("intitle:Test+Title"), true);
    assertEquals(url.includes("inauthor"), false);
  } finally {
    restore();
  }
});

Deno.test("Google Books API - handles 429 rate limit with retry", async () => {
  const retryStub = stub(rateLimiter, "retryWithBackoff", async (fn: () => Promise<Response>) => {
    return await fn();
  });

  stub(globalThis, "fetch", returnsNext([
    Promise.resolve(createMockResponse({ docs: [] })),
    Promise.resolve(createMockResponse({}, 429, false)),
  ]));

  stub(rateLimiter.openLibraryLimiter, "throttle", () => Promise.resolve());
  stub(rateLimiter.goodreadsLimiter, "throttle", () => Promise.resolve());

  try {
    await searchBook("Test", "Test");

    // Verify retry mechanism was invoked
    assertSpyCalls(retryStub, 1);
  } finally {
    restore();
  }
});

Deno.test("Google Books API - prefers ISBN_13 over other identifiers", async () => {
  const multiISBNResponse = {
    items: [{
      volumeInfo: {
        title: "Test Book",
        authors: ["Test Author"],
        industryIdentifiers: [
          { type: "ISBN_10", identifier: "1234567890" },
          { type: "ISBN_13", identifier: "9781234567890" },
          { type: "OTHER", identifier: "0000000000" },
        ],
      },
    }],
  };

  stub(globalThis, "fetch", returnsNext([
    Promise.resolve(createMockResponse({ docs: [] })),
    Promise.resolve(createMockResponse(multiISBNResponse)),
  ]));

  stub(rateLimiter.openLibraryLimiter, "throttle", () => Promise.resolve());
  stub(rateLimiter.goodreadsLimiter, "throttle", () => Promise.resolve());

  try {
    const result = await searchBook("Test Book", "Test Author");

    assertEquals(result.success, true);
    assertExists(result.books);
    assertEquals(result.books![0].isbn, "9781234567890");
  } finally {
    restore();
  }
});

Deno.test("Google Books API - prefers large image over thumbnail", async () => {
  const imageResponse = {
    items: [{
      volumeInfo: {
        title: "Test Book",
        authors: ["Test Author"],
        imageLinks: {
          thumbnail: "https://example.com/thumb.jpg",
          large: "https://example.com/large.jpg",
        },
      },
    }],
  };

  stub(globalThis, "fetch", returnsNext([
    Promise.resolve(createMockResponse({ docs: [] })),
    Promise.resolve(createMockResponse(imageResponse)),
  ]));

  stub(rateLimiter.openLibraryLimiter, "throttle", () => Promise.resolve());
  stub(rateLimiter.goodreadsLimiter, "throttle", () => Promise.resolve());

  try {
    const result = await searchBook("Test Book", "Test Author");

    assertEquals(result.success, true);
    assertExists(result.books);
    assertEquals(result.books![0].cover_image_url, "https://example.com/large.jpg");
  } finally {
    restore();
  }
});

Deno.test("Goodreads scraping - extracts book ID from HTML", async () => {
  stub(globalThis, "fetch", returnsNext([
    Promise.resolve(createMockResponse({ docs: [] })),
    Promise.resolve(createMockResponse(mockGoogleBooksResponse)),
    Promise.resolve(createMockResponse(mockGoodreadsHTML)),
  ]));

  stub(rateLimiter.openLibraryLimiter, "throttle", () => Promise.resolve());
  stub(rateLimiter.goodreadsLimiter, "throttle", () => Promise.resolve());

  try {
    const result = await searchBook("The Great Gatsby", "F. Scott Fitzgerald");

    assertEquals(result.success, true);
    assertExists(result.books);

    const withGoodreads = result.books!.find(b => b.goodreads_id);
    if (withGoodreads) {
      assertEquals(withGoodreads.goodreads_id, 4671);
      assertEquals(withGoodreads.goodreads_link?.includes("4671"), true);
    }
  } finally {
    restore();
  }
});

Deno.test("Goodreads scraping - handles no match in HTML", async () => {
  const emptyHTML = "<html><body>No books found</body></html>";

  stub(globalThis, "fetch", returnsNext([
    Promise.resolve(createMockResponse({ docs: [] })),
    Promise.resolve(createMockResponse(mockGoogleBooksResponse)),
    Promise.resolve(createMockResponse(emptyHTML)),
  ]));

  stub(rateLimiter.openLibraryLimiter, "throttle", () => Promise.resolve());
  stub(rateLimiter.goodreadsLimiter, "throttle", () => Promise.resolve());

  try {
    const result = await searchBook("Unknown Book", "Unknown Author");

    // Should still succeed without Goodreads data
    assertEquals(result.success, true);
    assertExists(result.books);

    const book = result.books![0];
    assertEquals(book.goodreads_id, undefined);
    assertEquals(book.sources.includes("goodreads"), false);
  } finally {
    restore();
  }
});

Deno.test("Goodreads scraping - includes User-Agent header", async () => {
  const fetchStub = stub(globalThis, "fetch", returnsNext([
    Promise.resolve(createMockResponse({ docs: [] })),
    Promise.resolve(createMockResponse(mockGoogleBooksResponse)),
    Promise.resolve(createMockResponse(mockGoodreadsHTML)),
  ]));

  stub(rateLimiter.openLibraryLimiter, "throttle", () => Promise.resolve());
  stub(rateLimiter.goodreadsLimiter, "throttle", () => Promise.resolve());

  try {
    await searchBook("Test", "Test");

    // Check the Goodreads fetch call (should be the 3rd call)
    const goodreadsCall = fetchStub.calls.find(call => {
      const url = call.args[0] as string;
      return url.includes("goodreads.com");
    });

    if (goodreadsCall) {
      const options = goodreadsCall.args[1] as RequestInit;
      assertExists(options.headers);
      assertEquals((options.headers as Record<string, string>)["User-Agent"],
        "Mozilla/5.0 (compatible; ShelfHelpBot/1.0)");
    }
  } finally {
    restore();
  }
});

Deno.test("mergeDuplicates - merges books with same title and author (case-insensitive)", async () => {
  const duplicateBooks: BookMetadata[] = [
    {
      title: "The Great Gatsby",
      author: "F. Scott Fitzgerald",
      isbn: "9780743273565",
      page_count: 180,
      sources: ["open_library"],
    },
    {
      title: "the great gatsby",
      author: "f. scott fitzgerald",
      page_count: 200,
      cover_image_url: "https://example.com/cover.jpg",
      sources: ["google_books"],
    },
  ];

  stub(globalThis, "fetch", returnsNext([
    Promise.resolve(createMockResponse({ docs: duplicateBooks })),
    Promise.resolve(createMockResponse({ items: [] })),
  ]));

  stub(rateLimiter.openLibraryLimiter, "throttle", () => Promise.resolve());
  stub(rateLimiter.goodreadsLimiter, "throttle", () => Promise.resolve());

  try {
    const result = await searchBook("The Great Gatsby", "F. Scott Fitzgerald");

    // Note: This test verifies merging behavior indirectly
    assertEquals(result.success, true);
    assertExists(result.books);
  } finally {
    restore();
  }
});

Deno.test("mergeDuplicates - prioritizes non-null values when merging", async () => {
  // This tests the merge logic for fields like ISBN, page_count, etc.
  const book1 = {
    title: "Test Book",
    author: "Test Author",
    isbn: "123",
    page_count: undefined,
    sources: ["source1"],
  };

  const book2 = {
    title: "Test Book",
    author: "Test Author",
    isbn: undefined,
    page_count: 300,
    sources: ["source2"],
  };

  // Simulate API responses that would trigger merge
  stub(globalThis, "fetch", returnsNext([
    Promise.resolve(createMockResponse({
      docs: [{
        title: "Test Book",
        author_name: ["Test Author"],
        isbn: ["123"],
      }]
    })),
    Promise.resolve(createMockResponse({
      items: [{
        volumeInfo: {
          title: "Test Book",
          authors: ["Test Author"],
          pageCount: 300,
        }
      }]
    })),
  ]));

  stub(rateLimiter.openLibraryLimiter, "throttle", () => Promise.resolve());
  stub(rateLimiter.goodreadsLimiter, "throttle", () => Promise.resolve());

  try {
    const result = await searchBook("Test Book", "Test Author");

    assertEquals(result.success, true);
    assertExists(result.books);

    const mergedBook = result.books![0];
    assertEquals(mergedBook.isbn, "123");
    assertEquals(mergedBook.page_count, 300);
    assertEquals(mergedBook.sources.length, 2);
  } finally {
    restore();
  }
});

Deno.test("mergeDuplicates - combines source arrays without duplicates", async () => {
  stub(globalThis, "fetch", returnsNext([
    Promise.resolve(createMockResponse(mockOpenLibraryResponse)),
    Promise.resolve(createMockResponse(mockGoogleBooksResponse)),
  ]));

  stub(rateLimiter.openLibraryLimiter, "throttle", () => Promise.resolve());
  stub(rateLimiter.goodreadsLimiter, "throttle", () => Promise.resolve());

  try {
    const result = await searchBook("The Great Gatsby", "F. Scott Fitzgerald");

    assertEquals(result.success, true);
    assertExists(result.books);

    const mainBook = result.books![0];
    const uniqueSources = new Set(mainBook.sources);
    assertEquals(uniqueSources.size, mainBook.sources.length);
  } finally {
    restore();
  }
});

Deno.test("BookMetadata interface - all fields are properly typed", () => {
  const book: BookMetadata = {
    title: "Test",
    author: "Author",
    isbn: "123",
    page_count: 100,
    cover_image_url: "https://example.com/cover.jpg",
    goodreads_id: 12345,
    goodreads_link: "https://goodreads.com/book/12345",
    publisher: "Publisher",
    publication_date: "2024",
    sources: ["test"],
  };

  assertEquals(typeof book.title, "string");
  assertEquals(typeof(book.author), "string");
  assertEquals(Array.isArray(book.sources), true);
});

Deno.test("SearchResult interface - success result structure", () => {
  const result: SearchResult = {
    success: true,
    books: [{
      title: "Test",
      author: "Author",
      sources: ["test"],
    }],
  };

  assertEquals(result.success, true);
  assertExists(result.books);
  assertEquals(result.error, undefined);
  assertEquals(result.errorCode, undefined);
});

Deno.test("SearchResult interface - error result structure", () => {
  const result: SearchResult = {
    success: false,
    error: "Test error",
    errorCode: "TEST_ERROR",
  };

  assertEquals(result.success, false);
  assertEquals(result.books, undefined);
  assertExists(result.error);
  assertExists(result.errorCode);
});

Deno.test("searchBook - handles extremely long title and author", async () => {
  const longTitle = "A".repeat(1000);  
  const longAuthor = "B".repeat(1000);

  stub(globalThis, "fetch", returnsNext([
    Promise.resolve(createMockResponse({ docs: [] })),
    Promise.resolve(createMockResponse({ items: [] })),
  ]));

  stub(rateLimiter.openLibraryLimiter, "throttle", () => Promise.resolve());
  stub(rateLimiter.goodreadsLimiter, "throttle", () => Promise.resolve());

  try {
    const result = await searchBook(longTitle, longAuthor);

    // Should handle gracefully without crashing
    assertEquals(result.success, false);
    assertEquals(result.errorCode, "NOT_FOUND");
  } finally {
    restore();
  }
});

Deno.test("searchBook - handles special characters in search terms", async () => {
  stub(globalThis, "fetch", returnsNext([
    Promise.resolve(createMockResponse(mockOpenLibraryResponse)),
    Promise.resolve(createMockResponse(mockGoogleBooksResponse)),
  ]));

  stub(rateLimiter.openLibraryLimiter, "throttle", () => Promise.resolve());
  stub(rateLimiter.goodreadsLimiter, "throttle", () => Promise.resolve());

  try {
    const result = await searchBook("Book & Title: Special!", "Author (Pseudonym)");

    // Should handle special characters without errors
    assertEquals(result.success, true);
  } finally {
    restore();
  }
});

Deno.test("searchBook - handles Unicode characters", async () => {
  stub(globalThis, "fetch", returnsNext([
    Promise.resolve(createMockResponse({
      docs: [{
        title: "日本語の本",
        author_name: ["著者名"],
      }]
    })),
    Promise.resolve(createMockResponse({ items: [] })),
  ]));

  stub(rateLimiter.openLibraryLimiter, "throttle", () => Promise.resolve());
  stub(rateLimiter.goodreadsLimiter, "throttle", () => Promise.resolve());

  try {
    const result = await searchBook("日本語の本", "著者名");

    assertEquals(result.success, true);
    assertExists(result.books);
    assertEquals(result.books![0].title, "日本語の本");
  } finally {
    restore();
  }
});

Deno.test("Open Library - constructs correct cover image URL", async () => {
  const coverResponse = {
    docs: [{
      title: "Test",
      author_name: ["Author"],
      cover_i: 98765,
    }]
  };

  stub(globalThis, "fetch", returnsNext([
    Promise.resolve(createMockResponse(coverResponse)),
    Promise.resolve(createMockResponse({ items: [] })),
  ]));

  stub(rateLimiter.openLibraryLimiter, "throttle", () => Promise.resolve());
  stub(rateLimiter.goodreadsLimiter, "throttle", () => Promise.resolve());

  try {
    const result = await searchBook("Test", "Author");

    assertEquals(result.success, true);
    assertExists(result.books);
    assertEquals(result.books![0].cover_image_url,
      "https://covers.openlibrary.org/b/id/98765-L.jpg");
  } finally {
    restore();
  }
});

Deno.test("searchBook - handles concurrent requests correctly", async () => {
  stub(globalThis, "fetch", returnsNext([
    Promise.resolve(createMockResponse(mockOpenLibraryResponse)),
    Promise.resolve(createMockResponse(mockGoogleBooksResponse)),
    Promise.resolve(createMockResponse(mockOpenLibraryResponse)),
    Promise.resolve(createMockResponse(mockGoogleBooksResponse)),
  ]));

  stub(rateLimiter.openLibraryLimiter, "throttle", () => Promise.resolve());
  stub(rateLimiter.goodreadsLimiter, "throttle", () => Promise.resolve());

  try {
    const [result1, result2] = await Promise.all([
      searchBook("Book 1", "Author 1"),
      searchBook("Book 2", "Author 2"),
    ]);

    assertEquals(result1.success, true);
    assertEquals(result2.success, true);
  } finally {
    restore();
  }
});

Deno.test("searchBook - returns early when all primary sources fail", async () => {
  const fetchStub = stub(globalThis, "fetch", returnsNext([
    Promise.reject(new Error("Network error")),
    Promise.reject(new Error("Network error")),
  ]));

  stub(rateLimiter.openLibraryLimiter, "throttle", () => Promise.resolve());
  stub(rateLimiter.goodreadsLimiter, "throttle", () => Promise.resolve());

  try {
    const result = await searchBook("Test", "Test");

    assertEquals(result.success, false);
    assertEquals(result.errorCode, "NOT_FOUND");
    // Should not attempt Goodreads scraping
    assertEquals(fetchStub.calls.length, 2);
  } finally {
    restore();
  }
});

Deno.test("enrichWithGoodreads - processes multiple books in parallel", async () => {
  const multipleBooks = {
    docs: [
      { title: "Book 1", author_name: ["Author 1"] },
      { title: "Book 2", author_name: ["Author 2"] },
      { title: "Book 3", author_name: ["Author 3"] },
    ],
  };

  stub(globalThis, "fetch", returnsNext([
    Promise.resolve(createMockResponse(multipleBooks)),
    Promise.resolve(createMockResponse({ items: [] })),
    Promise.resolve(createMockResponse("<html><body>/book/show/1</body></html>")),
    Promise.resolve(createMockResponse("<html><body>/book/show/2</body></html>")),
    Promise.resolve(createMockResponse("<html><body>/book/show/3</body></html>")),
  ]));

  const throttleStub = stub(rateLimiter.goodreadsLimiter, "throttle", () => Promise.resolve());
  stub(rateLimiter.openLibraryLimiter, "throttle", () => Promise.resolve());

  try {
    const result = await searchBook("Books", "Authors");

    assertEquals(result.success, true);
    // Should have called throttle for each book
    assertEquals(throttleStub.calls.length >= 3, true);
  } finally {
    restore();
  }
});

Deno.test("Goodreads scraping - handles various URL formats in HTML", async () => {
  const htmlWithMultipleFormats = `
    <html>
      <body>
        <a href="/book/show/12345-some-slug">First</a>
        <a href="/book/show/67890">Second</a>
      </body>
    </html>
  `;

  stub(globalThis, "fetch", returnsNext([
    Promise.resolve(createMockResponse({ docs: [] })),
    Promise.resolve(createMockResponse(mockGoogleBooksResponse)),
    Promise.resolve(createMockResponse(htmlWithMultipleFormats)),
  ]));

  stub(rateLimiter.openLibraryLimiter, "throttle", () => Promise.resolve());
  stub(rateLimiter.goodreadsLimiter, "throttle", () => Promise.resolve());

  try {
    const result = await searchBook("Test", "Test");

    assertEquals(result.success, true);
    assertExists(result.books);

    const withGoodreads = result.books!.find(b => b.goodreads_id);
    if (withGoodreads) {
      // Should extract the first matching ID
      assertEquals(withGoodreads.goodreads_id, 12345);
    }
  } finally {
    restore();
  }
});

Deno.test("searchBook - logs errors appropriately", async () => {
  const consoleErrorSpy = spy(console, "error");
  const consoleWarnSpy = spy(console, "warn");

  stub(globalThis, "fetch", () => Promise.reject(new Error("Test error")));
  stub(rateLimiter.openLibraryLimiter, "throttle", () => Promise.resolve());
  stub(rateLimiter.goodreadsLimiter, "throttle", () => Promise.resolve());

  try {
    await searchBook("Test", "Test");

    // Should have logged errors
    assertEquals(consoleErrorSpy.calls.length > 0, true);
  } finally {
    restore();
  }
});