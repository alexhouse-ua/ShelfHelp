#!/usr/bin/env -S deno run --allow-env --allow-net

/**
 * Script to register Telegram webhook with the Bot API
 *
 * This script reads environment variables and registers the webhook URL
 * with Telegram, including the secret token for validation.
 *
 * Usage:
 *   deno run --allow-env --allow-net scripts/register-webhook.ts
 */

import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

// Load environment variables from .env file
const env = await load();

const BOT_TOKEN = env.TELEGRAM_BOT_TOKEN || Deno.env.get("TELEGRAM_BOT_TOKEN");
const WEBHOOK_SECRET = env.TELEGRAM_WEBHOOK_SECRET || Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
const SUPABASE_PROJECT_REF = env.SUPABASE_PROJECT_REF || Deno.env.get("SUPABASE_PROJECT_REF") ||
  "wyzuelwotgyoautxjpxv";

if (!BOT_TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN is not set");
  Deno.exit(1);
}

if (!WEBHOOK_SECRET) {
  console.error("❌ TELEGRAM_WEBHOOK_SECRET is not set");
  Deno.exit(1);
}

// Construct webhook URL
const webhookUrl = `https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/telegram-webhook`;

console.log("🔧 Registering Telegram webhook...");
console.log(`📍 Webhook URL: ${webhookUrl}`);

// Register webhook with Telegram
const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    url: webhookUrl,
    secret_token: WEBHOOK_SECRET,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  }),
});

const result = await response.json();

if (result.ok) {
  console.log("✅ Webhook registered successfully!");
  console.log("📊 Response:", JSON.stringify(result, null, 2));
} else {
  console.error("❌ Failed to register webhook");
  console.error("📊 Response:", JSON.stringify(result, null, 2));
  Deno.exit(1);
}

// Verify webhook info
console.log("\n🔍 Verifying webhook info...");
const infoResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);

const infoResult = await infoResponse.json();
console.log("📊 Webhook Info:", JSON.stringify(infoResult, null, 2));
