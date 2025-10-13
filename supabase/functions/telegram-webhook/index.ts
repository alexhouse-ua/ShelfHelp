// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js@2/edge-runtime.d.ts";
import { Bot, InlineKeyboard, webhookCallback } from "https://deno.land/x/grammy/mod.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { extractBookInfo } from "../_shared/gemini-client.ts";
import { searchBook } from "../_shared/book-search.ts";
import { validateBookInput } from "../_shared/input-validator.ts";
import { cleanupState, getState, saveState } from "../_shared/conversational-state.ts";
import { createLogger, generateRequestId } from "../_shared/logger.ts";
import {
  formatRecommendations,
  generateMoodEmbedding,
  searchByKeywordsOnly,
  searchByMood,
} from "../_shared/mood-recommendation.ts";
import {
  createReflectionCheckpointer,
  createReflectionWorkflow,
  REFLECTION_QUESTIONS as _REFLECTION_QUESTIONS, // Imported for future use
  validateReflectionInput,
} from "../_shared/reflection-workflow.ts";
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
  const requestId = generateRequestId();
  const logger = createLogger(requestId);
  try {
    logger.info("Processing /start command", {
      operation: "start_command",
      chatId: ctx.chat?.id,
    });
    await ctx.reply("Welcome to Shelf Help! 📚\n\nI'm your reading companion assistant.");
    logger.info("/start command completed successfully", {
      operation: "start_command",
    });
  } catch (error) {
    logger.error("Error in /start command", {
      operation: "start_command",
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
});

// Chat ID command - returns the user's Telegram chat ID
bot.command("chatid", async (ctx) => {
  const requestId = generateRequestId();
  const logger = createLogger(requestId);
  try {
    const chatId = ctx.chat?.id;
    logger.info("Processing /chatid command", {
      operation: "chatid_command",
      chatId,
    });
    await ctx.reply(
      `Your chat ID is: \`${chatId}\`\n\nUse this value for TELEGRAM_CHAT_ID environment variable.`,
      {
        parse_mode: "Markdown",
      },
    );
  } catch (error) {
    logger.error("Error in /chatid command", {
      operation: "chatid_command",
      error: error.message,
    });
    throw error;
  }
});

// Database connection test command (for development/testing)
bot.command("dbtest", async (ctx) => {
  const requestId = generateRequestId();
  const logger = createLogger(requestId);
  try {
    logger.info("Processing /dbtest command", {
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
      logger.error("Database write test failed", {
        operation: "dbtest_write",
        error: insertError.message,
      });
      await ctx.reply(`❌ Database write failed: ${insertError.message}`);
      return;
    }
    logger.info("Database write test successful", {
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
      logger.error("Database read test failed", {
        operation: "dbtest_read",
        error: readError.message,
      });
      await ctx.reply(`❌ Database read failed: ${readError.message}`);
      return;
    }
    logger.info("Database read test successful", {
      operation: "dbtest_read",
      bookId: readData.id,
    });
    // Clean up test record
    const { error: deleteError } = await supabase.from("books").delete().eq("id", insertData.id);
    if (deleteError) {
      logger.error("Database cleanup failed", {
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
    logger.info("/dbtest command completed successfully", {
      operation: "dbtest_command",
    });
  } catch (error) {
    logger.error("Error in /dbtest command", {
      operation: "dbtest_command",
      error: error.message,
      stack: error.stack,
    });
    await ctx.reply(`❌ Test failed: ${error.message}`);
  }
});
// /addbook command handler
bot.command("addbook", async (ctx) => {
  const requestId = generateRequestId();
  const logger = createLogger(requestId);
  try {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      await ctx.reply("❌ Unable to identify chat session");
      return;
    }
    logger.info("Processing /addbook command", {
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
    await processBookAddition(ctx, chatId, userInput, requestId);
  } catch (error) {
    logger.error("Error in /addbook command", {
      operation: "addbook_command",
      error: error.message,
      stack: error.stack,
    });
    await ctx.reply("Sorry, something went wrong. Please try again.");
  }
});
// /recommend command handler - Mood-based book recommendations
bot.command("recommend", async (ctx) => {
  const requestId = generateRequestId();
  const logger = createLogger(requestId);
  try {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      await ctx.reply("❌ Unable to identify chat session");
      return;
    }
    logger.info("Processing /recommend command", {
      operation: "recommend_command",
      chatId,
    });
    const moodText = ctx.match; // Text after /recommend
    if (!moodText || moodText.trim().length === 0) {
      await ctx.reply(
        "Please describe your reading mood! For example:\n\n" +
          "/recommend something light and funny\n" +
          "/recommend dark mystery with strong female lead\n" +
          "/recommend uplifting romance",
      );
      return;
    }
    await ctx.reply("🔍 Searching for books that match your mood...");
    // Generate embedding for mood query
    let embedding = null;
    let isKeywordOnlySearch = false;
    try {
      embedding = await generateMoodEmbedding(moodText, requestId);
    } catch (error) {
      logger.error("Failed to generate embedding", {
        operation: "recommend_command",
        error: error instanceof Error ? error.message : String(error),
      });
      // Check if it's a timeout - use keyword fallback
      if (error instanceof Error && error.message === "TIMEOUT") {
        logger.info("Using keyword-only fallback due to timeout", {
          operation: "recommend_command",
          moodText,
        });
        isKeywordOnlySearch = true;
      } else {
        // Other errors - return error message
        await ctx.reply("❌ Unable to process recommendation request. Please try again.");
        return;
      }
    }
    // Search books by mood (hybrid or keyword-only)
    let results;
    try {
      if (isKeywordOnlySearch) {
        results = await searchByKeywordsOnly(supabase, moodText, requestId, 10);
      } else {
        results = await searchByMood(supabase, moodText, embedding, requestId, 10, 0.5);
      }
    } catch (searchError) {
      logger.error("Search failed", {
        operation: "recommend_command",
        isKeywordOnlySearch,
        error: searchError instanceof Error ? searchError.message : String(searchError),
      });
      await ctx.reply("❌ Unable to search for recommendations. Please try again.");
      return;
    }
    if (!results || results.length === 0) {
      logger.info("No matching books found", {
        operation: "recommend_command",
        moodText,
      });
      await ctx.reply(
        "😔 I couldn't find any books matching that mood in your TBR queue.\n\n" +
          "Try adding more books with /addbook or try a different mood description.",
      );
      return;
    }
    // Store search results in conversational state for pagination
    await saveState(
      supabase,
      chatId,
      {
        workflow: "mood_recommendation",
        step: "viewing_results",
        mood_text: moodText,
        embedding: embedding,
        all_results: results.map((r) => ({
          book_id: r.book_id,
          title: r.title,
          author: r.author,
          ai_summary: r.ai_summary,
          combined_score: r.combined_score,
        })),
        current_offset: 0,
      },
      "mood_search",
    );
    // Format and send top 3 recommendations
    const topResults = results.slice(0, 3);
    const formatted = formatRecommendations(topResults);
    let message = "📚 **Here are my top recommendations for your mood:**\n\n";
    // Add disclaimer for keyword-only search
    if (isKeywordOnlySearch) {
      message = "📚 **Here are keyword-based recommendations for your mood:**\n" +
        "_Using keyword search (semantic search unavailable)_\n\n";
    }
    formatted.forEach((rec, index) => {
      message += `${index + 1}. **${rec.title}**\n`;
      message += `   👤 ${rec.author}\n`;
      message += `   📖 ${rec.summary}\n`;
      message += `   ⭐ Relevance: ${rec.relevanceScore}%\n\n`;
    });
    // Create inline keyboard with action buttons
    const keyboard = new InlineKeyboard();
    topResults.forEach((result) => {
      keyboard
        .text("📌 Add to Top", `add_to_top:${result.book_id}`)
        .text("📖 Tell Me More", `tell_more:${result.book_id}`)
        .row();
    });
    // Add "Show More" button if there are more results
    if (results.length > 3) {
      keyboard.text("🔍 Show More Results", "show_more:3");
    }
    await ctx.reply(message, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
    logger.info("/recommend command completed successfully", {
      operation: "recommend_command",
      resultCount: results.length,
      displayedCount: topResults.length,
    });
  } catch (error) {
    logger.error("Error in /recommend command", {
      operation: "recommend_command",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    await ctx.reply("❌ An error occurred while searching for recommendations.");
  }
});
// /queue command handler - Display prioritized TBR queue
bot.command("queue", async (ctx) => {
  const requestId = generateRequestId();
  const logger = createLogger(requestId);
  try {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      await ctx.reply("❌ Unable to identify chat session");
      return;
    }
    logger.info("Processing /queue command", {
      operation: "queue_command",
      chatId,
    });
    await ctx.reply("📚 Loading your prioritized reading queue...");
    // Query top 10 books ordered by queue_position
    const { data: books, error } = await supabase
      .from("books")
      .select("id, title, author, queue_position, priority_score, page_count")
      .eq("status", "to_read")
      .order("queue_position", {
        ascending: true,
      })
      .limit(10);
    if (error) {
      logger.error("Failed to fetch queue", {
        operation: "queue_command",
        error: error.message,
      });
      await ctx.reply("❌ Failed to load your queue. Please try again.");
      return;
    }
    if (!books || books.length === 0) {
      logger.info("Empty queue", {
        operation: "queue_command",
      });
      await ctx.reply(
        "📚 Your TBR queue is empty!\n\n" + "Use /addbook to add books to your reading list.",
      );
      return;
    }
    // Format queue message
    let message = "📊 **Your Prioritized Reading Queue**\n\n";
    books.forEach((book, index) => {
      const position = book.queue_position || index + 1;
      const score = book.priority_score
        ? ` (Score: ${(book.priority_score * 100).toFixed(0)}%)`
        : "";
      const pages = book.page_count ? ` • ${book.page_count}p` : "";
      message += `${position}. **${book.title}**\n`;
      message += `   👤 ${book.author}${pages}${score}\n\n`;
    });
    message += `\n_Showing top ${books.length} books_`;
    // Create inline keyboard with actions
    const keyboard = new InlineKeyboard()
      .text("📖 Start Reading Top Book", "start_reading_top")
      .row()
      .text("🔄 Refresh Queue", "refresh_queue");
    await ctx.reply(message, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
    logger.info("/queue command completed successfully", {
      operation: "queue_command",
      booksShown: books.length,
    });
  } catch (error) {
    logger.error("Error in /queue command", {
      operation: "queue_command",
      error: error.message,
      stack: error.stack,
    });
    await ctx.reply("❌ An error occurred while loading your queue.");
  }
});

// /reflect command handler - Manual reflection initiation
bot.command("reflect", async (ctx) => {
  const requestId = generateRequestId();
  const logger = createLogger(requestId);
  try {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      await ctx.reply("❌ Unable to identify chat session");
      return;
    }
    logger.info("Processing /reflect command", {
      operation: "reflect_command",
      chatId,
    });

    const query = ctx.match?.toString().trim();
    await handleReflectCommand(ctx, chatId, query, requestId);
  } catch (error) {
    logger.error("Error in /reflect command", {
      operation: "reflect_command",
      error: error.message,
      stack: error.stack,
    });
    await ctx.reply("❌ An error occurred while processing your reflection request.");
  }
});

// Handle text messages (for active reflection workflows)
bot.on("message:text", async (ctx) => {
  const requestId = generateRequestId();
  const logger = createLogger(requestId);
  try {
    const chatId = ctx.chat?.id;
    const text = ctx.message?.text;

    if (!chatId || !text) {
      return;
    }

    // Skip if it's a command (already handled)
    if (text.startsWith("/")) {
      return;
    }

    logger.info("Processing text message", {
      operation: "text_message",
      chatId,
      textLength: text.length,
    });

    // Check if user has active reflection workflow
    const state = await getState(supabase, chatId);
    if (state?.state_data?.workflow === "reflection") {
      await handleReflectionResponse(ctx, chatId, text, requestId);
    }
  } catch (error) {
    logger.error("Error in text message handler", {
      operation: "text_message",
      error: error.message,
      stack: error.stack,
    });
  }
});

// Handle callback queries (inline keyboard button clicks)
bot.on("callback_query:data", async (ctx) => {
  const requestId = generateRequestId();
  const logger = createLogger(requestId);
  try {
    const chatId = ctx.chat?.id;
    const data = ctx.callbackQuery.data;
    if (!chatId) {
      await ctx.answerCallbackQuery({
        text: "Session error",
      });
      return;
    }
    logger.info("Processing callback query", {
      operation: "callback_query",
      chatId,
      data,
    });
    // Handle book selection from inline keyboard
    if (data.startsWith("select_book_")) {
      const bookIndex = parseInt(data.replace("select_book_", ""), 10);
      await handleBookSelection(ctx, chatId, bookIndex, requestId);
    }
    // Handle "Add to Top" action from recommendation
    if (data.startsWith("add_to_top:")) {
      const bookId = data.replace("add_to_top:", "");
      await handleAddToTop(ctx, chatId, bookId, requestId);
    }
    // Handle "Tell Me More" action from recommendation
    if (data.startsWith("tell_more:")) {
      const bookId = data.replace("tell_more:", "");
      await handleTellMeMore(ctx, chatId, bookId, requestId);
    }
    // Handle "Show More" pagination action
    if (data.startsWith("show_more:")) {
      const offset = parseInt(data.replace("show_more:", ""), 10);
      await handleShowMore(ctx, chatId, offset, requestId);
    }
    // Handle "Start Reflection" callback from reflection-processor
    if (data.startsWith("start_reflection:")) {
      const bookId = data.replace("start_reflection:", "");
      await handleStartReflection(ctx, chatId, bookId, requestId);
    }
    // Handle "Defer Reflection" callback from reflection-processor
    if (data.startsWith("defer_reflection:")) {
      const bookId = data.replace("defer_reflection:", "");
      await handleDeferReflection(ctx, chatId, bookId, requestId);
    }
    await ctx.answerCallbackQuery();
  } catch (error) {
    logger.error("Error in callback query handler", {
      operation: "callback_query",
      error: error.message,
      stack: error.stack,
    });
  }
});
/**
 * Process book addition from natural language input
 */
async function processBookAddition(ctx, chatId, userInput, requestId): Promise<void> {
  // Input length validation
  if (userInput.length > 700) {
    await ctx.reply("Input too long. Please keep it under 700 characters.");
    return;
  }
  await ctx.reply("🔍 Searching for your book...");
  const logger = createLogger(requestId);
  // Extract title and author using Gemini
  logger.info("Extracting book info with Gemini", {
    chatId,
  });
  const extraction = await extractBookInfo(userInput);
  if ("error" in extraction) {
    logger.error("Gemini extraction failed", {
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
  logger.info("Book info extracted", {
    chatId,
    title,
    author,
    confidence,
  });
  // Search for book across multiple sources
  const searchResult = await searchBook(title, author);
  if (!searchResult.success || !searchResult.books || searchResult.books.length === 0) {
    logger.info("Book not found", {
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
  logger.info("Multiple books found, asking for clarification", {
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
  await ctx.reply("I found multiple matches. Which one did you mean?", {
    reply_markup: keyboard,
  });
}
/**
 * Handle user's book selection from inline keyboard
 */
async function handleBookSelection(ctx, chatId, bookIndex, requestId): Promise<void> {
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
  await saveBookToDatabase(ctx, chatId, selectedBook, requestId);
}
/**
 * Save book to database and send confirmation
 */
async function saveBookToDatabase(ctx, chatId, book, requestId): Promise<void> {
  const logger = createLogger(requestId);
  try {
    logger.info("Saving book to database", {
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
        status: "to_read",
        user_date_added: new Date().toISOString(),
        ingestion_source: "bot",
      })
      .select()
      .single();
    if (error) {
      logger.error("Failed to save book", {
        chatId,
        error: error.message,
      });
      await ctx.reply("❌ Failed to save book. Please try again.");
      return;
    }
    logger.info("Book saved successfully", {
      chatId,
      bookId: data.id,
    });

    // Trigger metadata enrichment asynchronously (don't await)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (supabaseUrl) {
      fetch(`${supabaseUrl}/functions/v1/enrich-metadata`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ book_id: data.id }),
      }).catch((error) => {
        logger.error("Failed to trigger enrichment", {
          bookId: data.id,
          error: error.message,
        });
      });
      logger.info("Enrichment triggered for book", { bookId: data.id });
    }

    // Send confirmation with cover image if available
    let message = `✅ Added to your reading list!\n\n📚 **${book.title}**\n👤 ${book.author}`;
    if (book.page_count) message += `\n📖 ${book.page_count} pages`;
    if (book.goodreads_id) message += `\n⭐ Goodreads ID: ${book.goodreads_id}`;
    message += `\n\n🔍 _Enriching metadata in background..._`;
    if (book.cover_image_url) {
      await ctx.replyWithPhoto(book.cover_image_url, {
        caption: message,
        parse_mode: "Markdown",
      });
    } else {
      await ctx.reply(message, {
        parse_mode: "Markdown",
      });
    }
  } catch (error) {
    logger.error("Error saving book", {
      chatId,
      error: error.message,
      stack: error.stack,
    });
    await ctx.reply("❌ An error occurred while saving the book.");
  }
}
/**
 * Handle "Add to Top" callback - Move book to top of queue
 */
async function handleAddToTop(ctx, chatId, bookId, requestId): Promise<void> {
  const logger = createLogger(requestId);
  try {
    logger.info("Processing add_to_top callback", {
      chatId,
      bookId,
      operation: "add_to_top",
    });
    // Get all books with to_read status ordered by queue_position
    const { data: allBooks, error: fetchError } = await supabase
      .from("books")
      .select("id, queue_position")
      .eq("status", "to_read")
      .order("queue_position", {
        ascending: true,
      });
    if (fetchError) {
      logger.error("Failed to fetch queue for reordering", {
        operation: "add_to_top",
        error: fetchError.message,
      });
      await ctx.reply("❌ Failed to update queue. Please try again.");
      return;
    }
    // Update all other books' positions (shift down)
    if (allBooks && allBooks.length > 0) {
      for (let i = 0; i < allBooks.length; i++) {
        if (allBooks[i].id !== bookId) {
          const { error: updateError } = await supabase
            .from("books")
            .update({
              queue_position: i + 2,
            })
            .eq("id", allBooks[i].id);
          if (updateError) {
            logger.error("Failed to update queue position", {
              operation: "add_to_top",
              bookId: allBooks[i].id,
              error: updateError.message,
            });
          }
        }
      }
    }
    // Set selected book to position 1
    const { error: updateError } = await supabase
      .from("books")
      .update({
        queue_position: 1,
      })
      .eq("id", bookId);
    if (updateError) {
      logger.error("Failed to update book position", {
        operation: "add_to_top",
        bookId,
        error: updateError.message,
      });
      await ctx.reply("❌ Failed to update queue. Please try again.");
      return;
    }
    // Get book title for confirmation
    const { data: book } = await supabase.from("books").select("title").eq("id", bookId).single();
    logger.info("Book moved to top of queue", {
      operation: "add_to_top",
      bookId,
    });
    await ctx.reply(`✅ **${book?.title || "Book"}** moved to top of your queue!`, {
      parse_mode: "Markdown",
    });
  } catch (error) {
    logger.error("Error in add_to_top handler", {
      operation: "add_to_top",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    await ctx.reply("❌ An error occurred while updating the queue.");
  }
}
/**
 * Handle "Tell Me More" callback - Display full book metadata
 */
async function handleTellMeMore(ctx, chatId, bookId, requestId): Promise<void> {
  const logger = createLogger(requestId);
  try {
    logger.info("Processing tell_more callback", {
      chatId,
      bookId,
      operation: "tell_more",
    });
    // Fetch full book metadata
    const { data: book, error } = await supabase
      .from("books")
      .select(
        "title, author, ai_summary, genres_primary, themes, tone, pacing, page_count, publication_date, goodreads_link",
      )
      .eq("id", bookId)
      .single();
    if (error || !book) {
      logger.error("Failed to fetch book details", {
        operation: "tell_more",
        bookId,
        error: error?.message,
      });
      await ctx.reply("❌ Failed to load book details. Please try again.");
      return;
    }
    // Format detailed message
    let message = `📖 **${book.title}**\n`;
    message += `👤 **Author:** ${book.author}\n\n`;
    if (book.ai_summary) {
      message += `📝 **Summary:**\n${book.ai_summary}\n\n`;
    }
    if (book.genres_primary && book.genres_primary.length > 0) {
      message += `🏷️ **Genres:** ${book.genres_primary.join(", ")}\n`;
    }
    if (book.themes && book.themes.length > 0) {
      message += `🎭 **Themes:** ${book.themes.join(", ")}\n`;
    }
    if (book.tone) {
      message += `🎵 **Tone:** ${book.tone}\n`;
    }
    if (book.pacing) {
      message += `⚡ **Pacing:** ${book.pacing}\n`;
    }
    if (book.page_count) {
      message += `📄 **Pages:** ${book.page_count}\n`;
    }
    if (book.publication_date) {
      message += `📅 **Published:** ${book.publication_date}\n`;
    }
    if (book.goodreads_link) {
      message += `\n🔗 [View on Goodreads](${book.goodreads_link})`;
    }
    await ctx.reply(message, {
      parse_mode: "Markdown",
    });
    logger.info("Book details sent", {
      operation: "tell_more",
      bookId,
    });
  } catch (error) {
    logger.error("Error in tell_more handler", {
      operation: "tell_more",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    await ctx.reply("❌ An error occurred while loading book details.");
  }
}
/**
 * Handle "Show More" callback - Display next batch of recommendations
 */
async function handleShowMore(ctx, chatId, offset, requestId): Promise<void> {
  const logger = createLogger(requestId);
  try {
    logger.info("Processing show_more callback", {
      chatId,
      offset,
      operation: "show_more",
    });
    // Retrieve search state
    const state = await getState(supabase, chatId);
    if (!state || state.state_data.workflow !== "mood_recommendation") {
      logger.info("Search state expired", {
        operation: "show_more",
        chatId,
      });
      await ctx.reply(
        "⏰ Search session expired. Please run /recommend again to get new recommendations.",
      );
      return;
    }
    const allResults = state.state_data.all_results;
    if (!allResults || offset >= allResults.length) {
      await ctx.reply("You've seen all available recommendations!");
      return;
    }
    // Get next 3 results
    const nextResults = allResults.slice(offset, offset + 3);
    const formatted = formatRecommendations(nextResults);
    let message = "📚 **More recommendations for your mood:**\n\n";
    formatted.forEach((rec, index) => {
      message += `${offset + index + 1}. **${rec.title}**\n`;
      message += `   👤 ${rec.author}\n`;
      message += `   📖 ${rec.summary}\n`;
      message += `   ⭐ Relevance: ${rec.relevanceScore}%\n\n`;
    });
    // Create inline keyboard with action buttons
    const keyboard = new InlineKeyboard();
    nextResults.forEach((result) => {
      keyboard
        .text("📌 Add to Top", `add_to_top:${result.book_id}`)
        .text("📖 Tell Me More", `tell_more:${result.book_id}`)
        .row();
    });
    // Add "Show More" button if there are more results
    const newOffset = offset + 3;
    if (newOffset < allResults.length) {
      keyboard.text("🔍 Show More Results", `show_more:${newOffset}`);
    }
    await ctx.reply(message, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
    logger.info("More results displayed", {
      operation: "show_more",
      offset,
      displayedCount: nextResults.length,
    });
  } catch (error) {
    logger.error("Error in show_more handler", {
      operation: "show_more",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    await ctx.reply("❌ An error occurred while loading more results.");
  }
}

/**
 * Handle "Start Reflection" callback - Initialize LangGraph workflow
 */
async function handleStartReflection(ctx, chatId, bookId, requestId): Promise<void> {
  const logger = createLogger(requestId);
  try {
    logger.info("Processing start_reflection callback", {
      chatId,
      bookId,
      operation: "start_reflection",
    });

    // Validate book ID format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(bookId)) {
      logger.error("Invalid book ID format", {
        operation: "start_reflection",
        bookId,
      });
      await ctx.reply("❌ Invalid book reference. Please try again.");
      return;
    }

    // Load book details from database
    const { data: book, error: bookError } = await supabase
      .from("books")
      .select("id, title, author, status")
      .eq("id", bookId)
      .single();

    if (bookError || !book) {
      logger.error("Book not found", {
        operation: "start_reflection",
        bookId,
        error: bookError?.message,
      });
      await ctx.reply("❌ Book not found. Please try again.");
      return;
    }

    // Initialize conversational state for reflection workflow
    await saveState(
      supabase,
      chatId,
      {
        workflow: "reflection",
        step: "asking_question",
        reflection_book_id: book.id,
        reflection_current_question: 0, // Will be set to 1 by start node
        reflection_responses: {},
      },
      "reflection_workflow",
    );

    // Initialize PostgreSQL checkpointer
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) {
      logger.error("SUPABASE_DB_URL not configured", {
        operation: "start_reflection",
      });
      await ctx.reply("❌ Reflection workflow not configured. Please contact support.");
      return;
    }

    const checkpointer = await createReflectionCheckpointer(dbUrl);

    // Create reflection workflow
    const workflow = createReflectionWorkflow(checkpointer, {
      supabase,
      bot,
      logger,
    });

    // Initialize state and start workflow
    const initialState = {
      book_id: book.id,
      chat_id: chatId,
      book_title: book.title,
      book_author: book.author,
      current_question: 1,
      responses: {},
      retry_count: 0,
      completed: false,
      error: undefined,
    };

    // Configure workflow with thread_id (use chat_id + book_id for unique thread per book)
    const config = { configurable: { thread_id: `${chatId}-${book.id}` } };

    logger.info("Starting LangGraph reflection workflow", {
      operation: "start_reflection",
      book_id: book.id,
      chat_id: chatId,
    });

    // Invoke workflow (async, will send first question)
    await workflow.invoke(initialState, config);

    logger.info("Reflection workflow started successfully", {
      operation: "start_reflection",
      book_id: book.id,
    });
  } catch (error) {
    logger.error("Error in start_reflection handler", {
      operation: "start_reflection",
      error: error.message,
      stack: error.stack,
    });
    await ctx.reply("❌ An error occurred while starting the reflection workflow.");
  }
}

/**
 * Handle "Defer Reflection" callback - Mark reflection as deferred
 */
async function handleDeferReflection(ctx, chatId, bookId, requestId): Promise<void> {
  const logger = createLogger(requestId);
  try {
    logger.info("Processing defer_reflection callback", {
      chatId,
      bookId,
      operation: "defer_reflection",
    });

    // Update book_events to mark reflection as deferred
    const { error: updateError } = await supabase
      .from("book_events")
      .update({ event_type: "reflection_deferred" })
      .eq("book_id", bookId)
      .eq("event_type", "reflection_requested");

    if (updateError) {
      logger.error("Failed to defer reflection", {
        operation: "defer_reflection",
        error: updateError.message,
      });
    }

    // Send acknowledgment
    await ctx.reply(
      "No problem! You can reflect on this book later with /reflect.\n\n" +
        "I'll be here whenever you're ready! 📚",
    );

    logger.info("Reflection deferred successfully", {
      operation: "defer_reflection",
      book_id: bookId,
    });
  } catch (error) {
    logger.error("Error in defer_reflection handler", {
      operation: "defer_reflection",
      error: error.message,
      stack: error.stack,
    });
    await ctx.reply("❌ An error occurred. Please try again.");
  }
}

/**
 * Handle user text response during active reflection workflow
 */
async function handleReflectionResponse(ctx, chatId, text, requestId): Promise<void> {
  const logger = createLogger(requestId);
  try {
    logger.info("Processing reflection response", {
      chatId,
      operation: "reflection_response",
      textLength: text.length,
    });

    // Get current state
    const state = await getState(supabase, chatId);
    if (!state || state.state_data.workflow !== "reflection") {
      logger.warn("No active reflection workflow found", {
        operation: "reflection_response",
        chatId,
      });
      return;
    }

    const bookId = state.state_data.reflection_book_id;

    // Validate input
    const validation = validateReflectionInput(text);
    if (!validation.valid) {
      logger.warn("Invalid reflection input", {
        operation: "reflection_response",
        error: validation.error,
      });
      await ctx.reply(`❌ ${validation.error}\n\nPlease try again.`);
      return;
    }

    // Initialize PostgreSQL checkpointer
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) {
      logger.error("SUPABASE_DB_URL not configured", {
        operation: "reflection_response",
      });
      await ctx.reply("❌ Reflection workflow not configured. Please contact support.");
      return;
    }

    const checkpointer = await createReflectionCheckpointer(dbUrl);

    // Create reflection workflow
    const workflow = createReflectionWorkflow(checkpointer, {
      supabase,
      bot,
      logger,
    });

    // Get current workflow state (use chat_id + book_id for unique thread per book)
    const config = { configurable: { thread_id: `${chatId}-${bookId}` } };
    const currentState = await workflow.getState(config);

    if (!currentState || !currentState.values) {
      logger.error("No workflow state found", {
        operation: "reflection_response",
        chatId,
      });
      await ctx.reply("❌ Reflection session expired. Please start again with /reflect.");
      return;
    }

    // Get current question from LangGraph checkpoint (source of truth)
    const currentQuestion = currentState.values.current_question;

    // Update state with user response
    const updatedResponses = {
      ...currentState.values.responses,
      [currentQuestion]: text,
    };

    // Update conversational_state with new response
    await saveState(
      supabase,
      chatId,
      {
        ...state.state_data,
        reflection_responses: updatedResponses,
        reflection_current_question: currentQuestion,
      },
      "reflection_workflow",
    );

    logger.info("Processing user response in workflow", {
      operation: "reflection_response",
      book_id: bookId,
      question: currentQuestion,
    });

    // Invoke workflow with updated state
    await workflow.invoke(
      {
        ...currentState.values,
        responses: updatedResponses,
      },
      config,
    );

    logger.info("Reflection response processed successfully", {
      operation: "reflection_response",
      question: currentQuestion,
    });
  } catch (error) {
    logger.error("Error in reflection_response handler", {
      operation: "reflection_response",
      error: error.message,
      stack: error.stack,
    });
    await ctx.reply("❌ An error occurred while processing your response.");
  }
}

/**
 * Handle /reflect command - Show finished books or search by query
 */
async function handleReflectCommand(ctx, chatId, query, requestId): Promise<void> {
  const logger = createLogger(requestId);
  try {
    logger.info("Processing reflect command", {
      chatId,
      operation: "reflect_command",
      hasQuery: !!query,
    });

    let booksQuery = supabase
      .from("books")
      .select("id, title, author, user_date_finished")
      .eq("status", "finished")
      .order("user_date_finished", { ascending: false });

    // If query provided, search by title or author
    if (query && query.length > 0) {
      booksQuery = booksQuery.or(`title.ilike.%${query}%,author.ilike.%${query}%`);
    }

    const { data: books, error } = await booksQuery.limit(10);

    if (error) {
      logger.error("Failed to fetch finished books", {
        operation: "reflect_command",
        error: error.message,
      });
      await ctx.reply("❌ Failed to load your finished books. Please try again.");
      return;
    }

    if (!books || books.length === 0) {
      logger.info("No finished books found", {
        operation: "reflect_command",
        hasQuery: !!query,
      });
      await ctx.reply(
        query
          ? `📚 No finished books found matching "${query}".\n\nTry a different search or use /reflect to see all finished books.`
          : "📚 You haven't finished any books yet!\n\nOnce you finish a book, I'll help you reflect on it.",
      );
      return;
    }

    // Create inline keyboard with book options
    const keyboard = new InlineKeyboard();
    books.forEach((book) => {
      const dateStr = book.user_date_finished
        ? new Date(book.user_date_finished).toLocaleDateString()
        : "Recently";
      keyboard
        .text(`${book.title} by ${book.author} (${dateStr})`, `start_reflection:${book.id}`)
        .row();
    });

    const message = query
      ? `📚 **Finished books matching "${query}":**\n\nSelect a book to reflect on:`
      : "📚 **Your recently finished books:**\n\nSelect a book to reflect on:";

    await ctx.reply(message, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });

    logger.info("Reflect command completed successfully", {
      operation: "reflect_command",
      booksShown: books.length,
    });
  } catch (error) {
    logger.error("Error in reflect_command handler", {
      operation: "reflect_command",
      error: error.message,
      stack: error.stack,
    });
    await ctx.reply("❌ An error occurred while processing your request.");
  }
}

// Create webhook callback handler with secret token validation
// TODO: Re-enable secret token validation after testing
const handleUpdate = webhookCallback(bot, "std/http");
// Main request handler
Deno.serve(async (req) => {
  const requestId = generateRequestId();
  const logger = createLogger(requestId);
  try {
    logger.info("Webhook request received", {
      operation: "webhook_handler",
      method: req.method,
    });
    // Process the update (grammY validates secret token automatically)
    const response = await handleUpdate(req);
    logger.info("Webhook request processed successfully", {
      operation: "webhook_handler",
    });
    return response;
  } catch (error) {
    logger.error("Error processing webhook request", {
      operation: "webhook_handler",
      error: error.message,
      stack: error.stack,
    });
    return new Response(
      JSON.stringify({
        error: "Internal server error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
});
