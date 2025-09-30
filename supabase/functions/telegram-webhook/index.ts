// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js@2/edge-runtime.d.ts";
import { Bot, InlineKeyboard, webhookCallback } from "https://deno.land/x/grammy/mod.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { extractBookInfo } from "../_shared/gemini-client.ts";
import { type BookMetadata, searchBook } from "../_shared/book-search.ts";
import { validateBookInput } from "../_shared/input-validator.ts";
import { cleanupState, getState, saveState } from "../_shared/conversational-state.ts";

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
 * Validate webhook secret token from Telegram
 */
function validateWebhookToken(req: Request, expectedSecret: string, requestId: string): boolean {
  const receivedSecret = req.headers.get("X-Telegram-Bot-Api-Secret-Token");

  if (!receivedSecret) {
    log(requestId, "error", "Missing webhook secret token", {
      operation: "webhook_validation",
    });
    return false;
  }

  if (receivedSecret !== expectedSecret) {
    log(requestId, "error", "Invalid webhook secret token", {
      operation: "webhook_validation",
    });
    return false;
  }

  return true;
}

// Initialize bot
const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is not set");
}
if (!webhookSecret) {
  throw new Error("TELEGRAM_WEBHOOK_SECRET is not set");
}
if (!supabaseUrl) {
  throw new Error("SUPABASE_URL is not set");
}
if (!supabaseServiceKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
}

const bot = new Bot(token);

// Initialize Supabase client
export const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Basic /start command handler
bot.command("start", async (ctx) => {
  const requestId = crypto.randomUUID();

  try {
    log(requestId, "info", "Processing /start command", {
      operation: "start_command",
      chatId: ctx.chat?.id,
    });

    await ctx.reply("Welcome to Shelf Help! 📚\n\nI'm your reading companion assistant.");

    log(requestId, "info", "/start command completed successfully", {
      operation: "start_command",
    });
  } catch (error) {
    log(requestId, "error", "Error in /start command", {
      operation: "start_command",
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
});

// Database connection test command (for development/testing)
bot.command("dbtest", async (ctx) => {
  const requestId = crypto.randomUUID();

  try {
    log(requestId, "info", "Processing /dbtest command", {
      operation: "dbtest_command",
      chatId: ctx.chat?.id,
    });

    await ctx.reply("Testing database connection...");

    // Test write operation
    const testBook = {
      title: "Database Test Book",
      author: "Test Author",
      status: "pending",
    };

    const { data: insertData, error: insertError } = await supabase
      .from("books")
      .insert(testBook)
      .select()
      .single();

    if (insertError) {
      log(requestId, "error", "Database write test failed", {
        operation: "dbtest_write",
        error: insertError.message,
      });
      await ctx.reply(`❌ Database write failed: ${insertError.message}`);
      return;
    }

    log(requestId, "info", "Database write test successful", {
      operation: "dbtest_write",
      bookId: insertData.id,
    });

    // Test read operation
    const { data: readData, error: readError } = await supabase
      .from("books")
      .select("*")
      .eq("id", insertData.id)
      .single();

    if (readError) {
      log(requestId, "error", "Database read test failed", {
        operation: "dbtest_read",
        error: readError.message,
      });
      await ctx.reply(`❌ Database read failed: ${readError.message}`);
      return;
    }

    log(requestId, "info", "Database read test successful", {
      operation: "dbtest_read",
      bookId: readData.id,
    });

    // Clean up test record
    const { error: deleteError } = await supabase.from("books").delete().eq("id", insertData.id);

    if (deleteError) {
      log(requestId, "error", "Database cleanup failed", {
        operation: "dbtest_cleanup",
        error: deleteError.message,
      });
    }

    await ctx.reply(
      `✅ Database connection successful!\n\n` +
        `Write test: ✓\n` +
        `Read test: ✓\n` +
        `Book ID: ${readData.id}`,
    );

    log(requestId, "info", "/dbtest command completed successfully", {
      operation: "dbtest_command",
    });
  } catch (error) {
    log(requestId, "error", "Error in /dbtest command", {
      operation: "dbtest_command",
      error: error.message,
      stack: error.stack,
    });
    await ctx.reply(`❌ Test failed: ${error.message}`);
  }
});

// /addbook command handler
bot.command("addbook", async (ctx) => {
  const requestId = crypto.randomUUID();

  try {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      await ctx.reply("❌ Unable to identify chat session");
      return;
    }

    log(requestId, "info", "Processing /addbook command", {
      operation: "addbook_command",
      chatId,
    });

    const userInput = ctx.match; // Text after /addbook

    if (!userInput || userInput.trim().length === 0) {
      await ctx.reply(
        "Please provide book details! For example:\n" +
          "/addbook The Name of the Wind by Patrick Rothfuss",
      );
      return;
    }

    await processBookAddition(ctx, chatId, userInput as string, requestId);
  } catch (error) {
    log(requestId, "error", "Error in /addbook command", {
      operation: "addbook_command",
      error: error.message,
      stack: error.stack,
    });
    await ctx.reply("Sorry, something went wrong. Please try again.");
  }
});

// Handle callback queries (inline keyboard button clicks)
bot.on("callback_query:data", async (ctx) => {
  const requestId = crypto.randomUUID();

  try {
    const chatId = ctx.chat?.id;
    const data = ctx.callbackQuery.data;

    if (!chatId) {
      await ctx.answerCallbackQuery({ text: "Session error" });
      return;
    }

    log(requestId, "info", "Processing callback query", {
      operation: "callback_query",
      chatId,
      data,
    });

    // Handle book selection from inline keyboard
    if (data.startsWith("select_book_")) {
      const bookIndex = parseInt(data.replace("select_book_", ""), 10);
      await handleBookSelection(ctx, chatId, bookIndex, requestId);
    }

    await ctx.answerCallbackQuery();
  } catch (error) {
    log(requestId, "error", "Error in callback query handler", {
      operation: "callback_query",
      error: error.message,
      stack: error.stack,
    });
  }
});

/**
 * Process book addition from natural language input
 */
async function processBookAddition(
  // deno-lint-ignore no-explicit-any
  ctx: any,
  chatId: number,
  userInput: string,
  requestId: string,
): Promise<void> {
  // Input length validation
  if (userInput.length > 700) {
    await ctx.reply("Input too long. Please keep it under 700 characters.");
    return;
  }

  await ctx.reply("🔍 Searching for your book...");

  // Extract title and author using Gemini
  log(requestId, "info", "Extracting book info with Gemini", { chatId });
  const extraction = await extractBookInfo(userInput);

  if ("error" in extraction) {
    log(requestId, "error", "Gemini extraction failed", {
      chatId,
      error: extraction.error,
      code: extraction.code,
    });
    await ctx.reply(
      "Sorry, I couldn't understand the book information. " +
        "Please try again with format: Title by Author",
    );
    return;
  }

  const { title, author, confidence } = extraction;

  // Validate extracted data
  const validation = validateBookInput(title, author);
  if (!validation.valid) {
    await ctx.reply(`❌ ${validation.error}`);
    return;
  }

  log(requestId, "info", "Book info extracted", {
    chatId,
    title,
    author,
    confidence,
  });

  // Search for book across multiple sources
  const searchResult = await searchBook(title, author);

  if (!searchResult.success || !searchResult.books || searchResult.books.length === 0) {
    log(requestId, "info", "Book not found", {
      chatId,
      title,
      author,
      errorCode: searchResult.errorCode,
    });
    await ctx.reply(
      `I couldn't find "${title}" by ${author}.\n\n` +
        "Try providing more details or check the spelling.",
    );
    return;
  }

  const books = searchResult.books;

  // Single match - save directly
  if (books.length === 1) {
    await saveBookToDatabase(ctx, chatId, books[0], requestId);
    return;
  }

  // Multiple matches - show options
  log(requestId, "info", "Multiple books found, asking for clarification", {
    chatId,
    count: books.length,
  });

  // Save search results to state
  await saveState(
    supabase,
    chatId,
    {
      workflow: "add_book",
      step: "selecting_book",
      extracted_title: title,
      extracted_author: author,
      search_results: books.slice(0, 5).map((b) => ({
        title: b.title,
        author: b.author,
        isbn: b.isbn,
        cover_image_url: b.cover_image_url,
        goodreads_id: b.goodreads_id,
      })),
    },
    "book_selection",
  );

  // Create inline keyboard with options
  const keyboard = new InlineKeyboard();
  books.slice(0, 5).forEach((book, index) => {
    keyboard
      .text(
        `${book.title} by ${book.author}${
          book.publication_date ? ` (${book.publication_date})` : ""
        }`,
        `select_book_${index}`,
      )
      .row();
  });

  await ctx.reply("I found multiple matches. Which one did you mean?", { reply_markup: keyboard });
}

/**
 * Handle user's book selection from inline keyboard
 */
async function handleBookSelection(
  // deno-lint-ignore no-explicit-any
  ctx: any,
  chatId: number,
  bookIndex: number,
  requestId: string,
): Promise<void> {
  // Retrieve state
  const state = await getState(supabase, chatId);

  if (!state || !state.state_data.search_results) {
    await ctx.reply("Session expired. Please try searching again.");
    return;
  }

  const selectedBook = state.state_data.search_results[bookIndex];

  if (!selectedBook) {
    await ctx.reply("Invalid selection. Please try again.");
    return;
  }

  // Clean up state
  await cleanupState(supabase, chatId);

  // Save book to database
  await saveBookToDatabase(ctx, chatId, selectedBook as BookMetadata, requestId);
}

/**
 * Save book to database and send confirmation
 */
async function saveBookToDatabase(
  // deno-lint-ignore no-explicit-any
  ctx: any,
  chatId: number,
  book: BookMetadata,
  requestId: string,
): Promise<void> {
  try {
    log(requestId, "info", "Saving book to database", {
      chatId,
      title: book.title,
      author: book.author,
    });

    const { data, error } = await supabase
      .from("books")
      .insert({
        title: book.title,
        author: book.author,
        isbn: book.isbn,
        page_count: book.page_count,
        cover_image_url: book.cover_image_url,
        goodreads_id: book.goodreads_id,
        goodreads_link: book.goodreads_link,
        publisher: book.publisher,
        publication_date: book.publication_date,
        status: "pending",
        user_shelves: ["to-read"],
        user_date_added: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      log(requestId, "error", "Failed to save book", {
        chatId,
        error: error.message,
      });
      await ctx.reply("❌ Failed to save book. Please try again.");
      return;
    }

    log(requestId, "info", "Book saved successfully", {
      chatId,
      bookId: data.id,
    });

    // Send confirmation with cover image if available
    let message = `✅ Added to your reading list!\n\n📚 **${book.title}**\n👤 ${book.author}`;
    if (book.page_count) message += `\n📖 ${book.page_count} pages`;
    if (book.goodreads_id) message += `\n⭐ Goodreads ID: ${book.goodreads_id}`;

    if (book.cover_image_url) {
      await ctx.replyWithPhoto(book.cover_image_url, { caption: message, parse_mode: "Markdown" });
    } else {
      await ctx.reply(message, { parse_mode: "Markdown" });
    }
  } catch (error) {
    log(requestId, "error", "Error saving book", {
      chatId,
      error: error.message,
      stack: error.stack,
    });
    await ctx.reply("❌ An error occurred while saving the book.");
  }
}

// Create webhook callback handler
const handleUpdate = webhookCallback(bot, "std/http");

// Main request handler
Deno.serve(async (req: Request) => {
  const requestId = generateRequestId();

  try {
    // Validate webhook secret token
    if (!validateWebhookToken(req, webhookSecret, requestId)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    log(requestId, "info", "Webhook request received", {
      operation: "webhook_handler",
      method: req.method,
    });

    // Process the update
    const response = await handleUpdate(req);

    log(requestId, "info", "Webhook request processed successfully", {
      operation: "webhook_handler",
    });

    return response;
  } catch (error) {
    log(requestId, "error", "Error processing webhook request", {
      operation: "webhook_handler",
      error: error.message,
      stack: error.stack,
    });

    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
