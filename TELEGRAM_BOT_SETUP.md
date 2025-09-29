# Telegram Bot Setup Guide for Shelf Help Assistant

## Overview

This guide walks through the complete setup of the Shelf Help Assistant Telegram bot, including registration with BotFather, configuration, and testing.

## Prerequisites

- Active Telegram account
- Access to Telegram on mobile or desktop
- This project repository

## Step 1: Create Bot with BotFather

### 1.1 Start Chat with BotFather
1. Open Telegram and search for `@BotFather`
2. Start a chat with the official BotFather bot
3. Send `/start` to begin

### 1.2 Create New Bot
1. Send `/newbot` command
2. Enter bot name: `Shelf Help Assistant`
3. Enter bot username: `shelf_help_assistant_bot` (must end with 'bot')
4. **SAVE THE BOT TOKEN** - you'll need this for configuration

Example interaction:
```
You: /newbot
BotFather: Alright, a new bot. How are we going to call it? Please choose a name for your bot.
You: Shelf Help Assistant
BotFather: Good. Now let's choose a username for your bot. It must end in `bot`. Like this, for example: TetrisBot or tetris_bot.
You: shelf_help_assistant_bot
BotFather: Done! Congratulations on your new bot. You will find it at t.me/shelf_help_assistant_bot
```

### 1.3 Save Bot Information
After creation, BotFather will provide:
- **Bot Token**: Save this securely (e.g., `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)
- **Bot Link**: `t.me/shelf_help_assistant_bot`

## Step 2: Configure Bot Settings

### 2.1 Set Bot Description
```
/setdescription
@shelf_help_assistant_bot
Your personal reading companion! I help you discover, track, and get insights from your books. Add books to your shelf, get personalized recommendations, and reflect on your reading journey.
```

### 2.2 Set About Text
```
/setabouttext
@shelf_help_assistant_bot
📚 Shelf Help Assistant

Transform your reading experience with personalized book management, intelligent recommendations, and meaningful reading insights.

Features:
• Personal book shelf management
• Smart reading recommendations
• Post-reading reflection guidance
• Reading progress tracking
• Book discovery assistance

Start your reading journey with /start
```

### 2.3 Set Bot Commands
```
/setcommands
@shelf_help_assistant_bot
```

Then send this command list:
```
start - Welcome and introduction
help - Available commands and features
addbook - Add a new book to your shelf
mybooks - View your book collection
recommend - Get book recommendations
reading - Currently reading books
finished - Mark book as finished
reflect - Start post-reading reflection
insights - View your reading insights
status - Your reading statistics
settings - Configure preferences
```

## Step 3: Configure Bot Permissions

### 3.1 Enable Inline Mode (Optional for future features)
```
/setinline
@shelf_help_assistant_bot
Search books...
```

### 3.2 Set Bot Privacy (Groups - disabled for now)
```
/setprivacy
@shelf_help_assistant_bot
Disable
```

### 3.3 Configure Web App (for future features)
This will be configured later when the web interface is ready.

## Step 4: Environment Configuration

### 4.1 Create Environment File
Create `.env` file in project root (this file should be gitignored):

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret_here

# Bot Information
BOT_USERNAME=shelf_help_assistant_bot
BOT_NAME="Shelf Help Assistant"

# Webhook Configuration (to be set up later)
WEBHOOK_URL=https://your-supabase-url.functions.supabase.co/v1/telegram-webhook
WEBHOOK_SECRET_TOKEN=your_secret_token_here

# Environment
NODE_ENV=development
```

### 4.2 Update .gitignore
Ensure `.env` and other sensitive files are ignored:

```gitignore
# Environment variables
.env
.env.local
.env.development
.env.production

# Bot tokens and secrets
**/bot-token.txt
**/webhook-secret.txt
```

## Step 5: Initial Bot Testing

### 5.1 Find Your Bot
1. Search for your bot username in Telegram: `@shelf_help_assistant_bot`
2. Start a chat with your bot
3. Send `/start` command

### 5.2 Expected Behavior (Before Implementation)
Currently, the bot will:
- Show as created and accessible
- Not respond to messages (implementation pending)
- Display configured description and commands

### 5.3 Test Commands Menu
- Tap the menu button (/) in the chat
- Verify all configured commands appear
- Commands won't work until bot implementation is complete

## Step 6: Webhook Configuration (Future)

When implementing the bot backend:

### 6.1 Set Webhook URL
```bash
curl -X POST "https://api.telegram.org/bot{BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-supabase-url.functions.supabase.co/v1/telegram-webhook",
    "secret_token": "your_webhook_secret",
    "allowed_updates": ["message", "callback_query", "inline_query"]
  }'
```

### 6.2 Verify Webhook
```bash
curl "https://api.telegram.org/bot{BOT_TOKEN}/getWebhookInfo"
```

## Configuration Summary

After completing setup, you should have:

### ✅ Bot Created
- [x] Bot registered with BotFather
- [x] Bot token generated and saved securely
- [x] Bot username configured: `@shelf_help_assistant_bot`

### ✅ Bot Settings
- [x] Description set (user-facing description)
- [x] About text configured (detailed bot information)
- [x] Commands menu configured (11 commands)
- [x] Privacy settings configured

### ✅ Environment Configuration
- [x] `.env` file created with bot token
- [x] `.gitignore` updated to protect sensitive data
- [x] Environment variables defined for future implementation

### ✅ Basic Testing
- [x] Bot accessible via Telegram search
- [x] Commands menu visible to users
- [x] Bot profile information displays correctly

## Security Notes

### 🔐 Token Security
- **NEVER** commit bot tokens to version control
- Store tokens in environment variables only
- Use different tokens for development/production
- Regenerate tokens if compromised

### 🔐 Webhook Security
- Always use HTTPS for webhook URLs
- Implement webhook secret validation
- Validate all incoming requests
- Rate limit webhook endpoints

## Next Steps

1. **Bot Implementation**: Develop Supabase Edge Functions for webhook handling
2. **Database Setup**: Create tables for users, conversations, and books
3. **Command Handlers**: Implement logic for each bot command
4. **Testing**: Comprehensive testing of all bot features
5. **Deployment**: Deploy webhook endpoints and configure production environment

## Troubleshooting

### Common Issues

**Bot not found in Telegram search:**
- Verify username spelling: `@shelf_help_assistant_bot`
- Ensure bot was created successfully
- Check BotFather for any error messages

**Commands not showing:**
- Re-run `/setcommands` with BotFather
- Restart Telegram app
- Clear Telegram cache

**Bot token issues:**
- Verify token format: `number:letters_and_numbers`
- Check for extra spaces or characters
- Regenerate token if needed: `/token` with BotFather

## Support

For issues with this setup:
1. Check BotFather responses for error messages
2. Verify all commands were entered correctly
3. Ensure bot username follows Telegram requirements
4. Review Telegram Bot API documentation

---

**Created**: Issue #13 - Telegram Bot Registration and Configuration
**Status**: Setup Complete - Implementation Pending
**Last Updated**: 2025-09-28