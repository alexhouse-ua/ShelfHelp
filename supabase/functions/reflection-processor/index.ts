// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js@2/edge-runtime.d.ts";
import { Bot, InlineKeyboard } from "https://deno.land/x/grammy/mod.ts";
import { createLogger, generateRequestId } from "../_shared/logger.ts";
import { badRequest, internalError, unauthorized } from "../_shared/error-handler.ts";

/**
 * Reflection Processor Edge Function
 * Story: 2.3 Post-Read Reflection
 * Task 2: Create reflection event processor Edge Function
 *
 * Triggered by Database Webhook when book_events.event_type = 'reflection_requested'
 * Sends proactive Telegram message inviting user to reflect on finished book
 */

// Environment variable validation
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!TELEGRAM_BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN environment variable is required");
}

if (!TELEGRAM_CHAT_ID) {
  throw new Error("TELEGRAM_CHAT_ID environment variable is required (single-user MVP pattern)");
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Supabase environment variables are required");
}

// Initialize Telegram bot
const bot = new Bot(TELEGRAM_BOT_TOKEN);

/**
 * Webhook payload type from Supabase Database Webhooks
 */
interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: {
    id: string;
    book_id: string;
    event_type: string;
    event_data: {
      title: string;
      author: string;
      user_date_finished?: string;
      triggered_at: string;
    };
    created_at: string;
  };
  old_record?: Record<string, unknown>;
}

/**
 * Validates incoming webhook request
 * Checks Authorization header and payload structure
 */
function validateWebhookRequest(req: Request): boolean {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return false;
  }

  // Webhook should include Bearer token (SUPABASE_ANON_KEY or SERVICE_ROLE_KEY)
  // For now, just verify header exists - Supabase handles auth
  return authHeader.startsWith("Bearer ");
}

/**
 * Sends proactive Telegram message inviting user to reflect
 */
async function sendReflectionInvitation(
  bookId: string,
  title: string,
  author: string,
  logger: ReturnType<typeof createLogger>,
): Promise<{ success: boolean; error?: string }> {
  try {
    const chatId = Number(TELEGRAM_CHAT_ID);

    if (isNaN(chatId)) {
      logger.error("Invalid TELEGRAM_CHAT_ID", { chatId: TELEGRAM_CHAT_ID });
      return { success: false, error: "Invalid TELEGRAM_CHAT_ID" };
    }

    // Create inline keyboard with reflection action buttons
    const keyboard = new InlineKeyboard()
      .text("✅ Yes, let's reflect", `start_reflection:${bookId}`)
      .text("⏭️ Maybe later", `defer_reflection:${bookId}`);

    // Send proactive message
    const message =
      `I see you finished *${title}* by ${author}! 📚\n\nWould you like to reflect on it?`;

    await bot.api.sendMessage(chatId, message, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });

    logger.info("Reflection invitation sent", {
      operation: "send_reflection_invitation",
      book_id: bookId,
      chat_id: chatId,
      title,
      author,
    });

    return { success: true };
  } catch (error) {
    logger.error("Failed to send reflection invitation", {
      operation: "send_reflection_invitation",
      book_id: bookId,
      error: error.message,
      stack: error.stack,
    });
    return { success: false, error: error.message };
  }
}

/**
 * Main webhook handler
 */
Deno.serve(async (req) => {
  const requestId = generateRequestId();
  const logger = createLogger(requestId);

  try {
    logger.info("Reflection processor webhook received", {
      operation: "reflection_processor",
      method: req.method,
      url: req.url,
    });

    // Validate request method
    if (req.method !== "POST") {
      logger.warn("Invalid request method", {
        operation: "reflection_processor",
        method: req.method,
      });
      return badRequest("Only POST requests are allowed", requestId);
    }

    // Validate webhook authentication
    if (!validateWebhookRequest(req)) {
      logger.warn("Unauthorized webhook request", {
        operation: "reflection_processor",
      });
      return unauthorized("Invalid webhook authentication", requestId);
    }

    // Parse webhook payload
    let payload: WebhookPayload;
    try {
      payload = await req.json();
    } catch (error) {
      logger.error("Failed to parse webhook payload", {
        operation: "reflection_processor",
        error: error.message,
      });
      return badRequest("Invalid JSON payload", requestId);
    }

    logger.info("Webhook payload parsed", {
      operation: "reflection_processor",
      type: payload.type,
      table: payload.table,
      event_type: payload.record?.event_type,
    });

    // Validate payload structure
    if (!payload.record || !payload.record.book_id || !payload.record.event_data) {
      logger.error("Invalid webhook payload structure", {
        operation: "reflection_processor",
        payload,
      });
      return badRequest("Invalid webhook payload structure", requestId);
    }

    // Extract event data
    const { book_id, event_type, event_data } = payload.record;
    const { title, author } = event_data;

    // Verify event type
    if (event_type !== "reflection_requested") {
      logger.warn("Unexpected event type", {
        operation: "reflection_processor",
        event_type,
      });
      return badRequest(
        `Expected event_type 'reflection_requested', got '${event_type}'`,
        requestId,
      );
    }

    // Validate book data
    if (!title || !author) {
      logger.error("Missing book title or author in event_data", {
        operation: "reflection_processor",
        book_id,
        event_data,
      });
      return badRequest("Missing book title or author", requestId);
    }

    // Send reflection invitation
    const result = await sendReflectionInvitation(book_id, title, author, logger);

    if (!result.success) {
      logger.error("Failed to send reflection invitation", {
        operation: "reflection_processor",
        book_id,
        error: result.error,
      });
      return internalError("Failed to send reflection invitation", requestId, result.error);
    }

    logger.info("Reflection processor completed successfully", {
      operation: "reflection_processor",
      book_id,
    });

    return new Response(JSON.stringify({ success: true, requestId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error("Unexpected error in reflection processor", {
      operation: "reflection_processor",
      error: error.message,
      stack: error.stack,
    });
    return internalError("Unexpected error in reflection processor", requestId, error.message);
  }
});
