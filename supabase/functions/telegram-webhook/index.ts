// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Bot, webhookCallback } from "https://deno.land/x/grammy/mod.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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
