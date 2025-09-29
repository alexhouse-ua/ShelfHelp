# Telegram Bot Configuration Reference

## Overview

This document provides a comprehensive reference for configuring the Shelf Help Assistant Telegram bot, including all settings, commands, and advanced features.

## Bot Profile Configuration

### Basic Information
- **Bot Username**: `@shelf_help_assistant_bot`
- **Display Name**: `Shelf Help Assistant`
- **Bot Type**: Private chat assistant (groups disabled)

### Description Text
```
Your personal reading companion! I help you discover, track, and get insights from your books. Add books to your shelf, get personalized recommendations, and reflect on your reading journey.
```

### About Text
```
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

## Command Configuration

### Primary Commands

| Command | Description | Implementation Status |
|---------|-------------|----------------------|
| `/start` | Welcome and introduction | ⏳ Pending |
| `/help` | Available commands and features | ⏳ Pending |
| `/addbook` | Add a new book to your shelf | ⏳ Pending |
| `/mybooks` | View your book collection | ⏳ Pending |
| `/recommend` | Get book recommendations | ⏳ Pending |
| `/reading` | Currently reading books | ⏳ Pending |
| `/finished` | Mark book as finished | ⏳ Pending |
| `/reflect` | Start post-reading reflection | ⏳ Pending |
| `/insights` | View your reading insights | ⏳ Pending |
| `/status` | Your reading statistics | ⏳ Pending |
| `/settings` | Configure preferences | ⏳ Pending |

### Command Details

#### `/start`
- **Purpose**: Welcome new users and returning users
- **Response**: Introduction message with quick actions
- **Features**:
  - User registration if first time
  - Quick access buttons for main features
  - Brief overview of capabilities

#### `/help`
- **Purpose**: Provide command reference and feature overview
- **Response**: Organized list of commands with descriptions
- **Features**:
  - Categorized command list
  - Feature explanations
  - Quick action buttons

#### `/addbook`
- **Purpose**: Add a new book to personal library
- **Response**: Interactive book entry process
- **Features**:
  - Title and author input
  - Status selection (to read, reading, finished)
  - Optional metadata (genre, pages, etc.)

#### `/mybooks`
- **Purpose**: Display user's book collection
- **Response**: Paginated list of books with status
- **Features**:
  - Filter by status (reading, finished, to-read)
  - Search functionality
  - Quick actions per book

#### `/recommend`
- **Purpose**: Provide personalized book recommendations
- **Response**: List of recommended books with reasons
- **Features**:
  - Based on reading history
  - Genre preferences
  - Similar authors
  - Trending books

#### `/reading`
- **Purpose**: Show currently reading books
- **Response**: List of in-progress books with progress
- **Features**:
  - Progress tracking
  - Update progress buttons
  - Quick actions (pause, finish)

#### `/finished`
- **Purpose**: Mark book as finished and start reflection
- **Response**: Book completion confirmation and reflection prompt
- **Features**:
  - Book selection from reading list
  - Automatic reflection initiation
  - Rating and review prompts

#### `/reflect`
- **Purpose**: Start or continue post-reading reflection
- **Response**: Guided reflection questions
- **Features**:
  - Personalized questions
  - Progress tracking
  - Save and resume functionality

#### `/insights`
- **Purpose**: Display reading analytics and insights
- **Response**: Reading statistics and patterns
- **Features**:
  - Reading velocity
  - Genre analysis
  - Reading streaks
  - Monthly summaries

#### `/status`
- **Purpose**: Show overall reading statistics
- **Response**: Quick overview of reading activity
- **Features**:
  - Books read this month/year
  - Current reading list size
  - Completion percentage

#### `/settings`
- **Purpose**: Configure bot preferences
- **Response**: Settings menu with options
- **Features**:
  - Notification preferences
  - Privacy settings
  - Display preferences

## Bot Features Configuration

### Inline Mode
- **Status**: Enabled
- **Placeholder**: "Search books..."
- **Purpose**: Quick book search and recommendations
- **Features**:
  - Book database search
  - Quick add to library
  - Share book recommendations

### Privacy Settings
- **Groups**: Disabled (private chats only)
- **Reason**: Personal reading data requires privacy
- **Group Messages**: Cannot read group messages
- **Purpose**: Ensure user privacy and data security

### Web App Integration
- **Status**: Planned for future releases
- **Purpose**: Enhanced reading analytics dashboard
- **Features** (planned):
  - Detailed reading statistics
  - Advanced book management
  - Reading goal tracking

## Webhook Configuration

### Allowed Updates
- `message` - Text messages and commands
- `callback_query` - Inline keyboard button presses
- `inline_query` - Inline mode searches

### Security Settings
- **Secret Token**: Required for webhook validation
- **HTTPS**: Required for production webhooks
- **Signature Validation**: All requests must include valid signature

### Rate Limiting
- **Messages**: 30 per minute per user
- **Commands**: 10 per minute per user
- **Inline Queries**: 20 per minute per user

## Environment Variables

### Required Variables
```bash
# Bot Authentication
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
BOT_USERNAME=shelf_help_assistant_bot
BOT_NAME="Shelf Help Assistant"

# Webhook Security
WEBHOOK_SECRET_TOKEN=your_secure_random_string
WEBHOOK_URL=https://your-domain.com/webhook

# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Optional Variables
```bash
# Debugging
DEBUG=false
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_MESSAGES=30
RATE_LIMIT_COMMANDS=10
RATE_LIMIT_INLINE=20

# Features
ENABLE_INLINE_MODE=true
ENABLE_WEB_APP=false
```

## BotFather Commands Reference

### Initial Setup Commands
```
/newbot
Shelf Help Assistant
shelf_help_assistant_bot
```

### Configuration Commands
```
# Set description
/setdescription
@shelf_help_assistant_bot
[Description text from above]

# Set about text
/setabouttext
@shelf_help_assistant_bot
[About text from above]

# Set commands
/setcommands
@shelf_help_assistant_bot
[Command list from above]

# Enable inline mode
/setinline
@shelf_help_assistant_bot
Search books...

# Disable groups
/setprivacy
@shelf_help_assistant_bot
Disable
```

### Maintenance Commands
```
# Get bot token
/token
@shelf_help_assistant_bot

# Regenerate token (if compromised)
/revoke
@shelf_help_assistant_bot

# Delete bot (if needed)
/deletebot
@shelf_help_assistant_bot
```

## API Endpoints

### Bot API Methods Used
- `getMe` - Get bot information
- `getUpdates` - Get pending updates (polling mode)
- `setWebhook` - Configure webhook
- `getWebhookInfo` - Check webhook status
- `sendMessage` - Send text messages
- `sendPhoto` - Send images (for book covers)
- `editMessageText` - Edit existing messages
- `answerCallbackQuery` - Respond to button presses
- `answerInlineQuery` - Respond to inline searches

### Custom Webhook Endpoints
- `POST /webhook` - Main webhook handler
- `GET /webhook/health` - Health check
- `POST /webhook/test` - Testing endpoint

## Security Considerations

### Token Security
- Never commit tokens to version control
- Use environment variables for all secrets
- Rotate tokens periodically
- Monitor for unauthorized access

### Webhook Security
- Validate all incoming requests
- Use HTTPS for all webhook URLs
- Implement request signature validation
- Rate limit incoming requests

### User Data Privacy
- Store minimal user data
- Encrypt sensitive information
- Implement data retention policies
- Provide data export/deletion

## Monitoring and Logging

### Key Metrics
- Message response time
- Command success rate
- Error frequency
- User engagement

### Log Levels
- `ERROR` - System errors and failures
- `WARN` - Non-critical issues
- `INFO` - General operation info
- `DEBUG` - Detailed execution info

### Health Checks
- Bot API connectivity
- Database availability
- Webhook responsiveness
- External service status

## Troubleshooting

### Common Issues

**Bot not responding:**
- Check bot token validity
- Verify webhook configuration
- Check server logs for errors
- Test with getUpdates polling

**Commands not appearing:**
- Re-run /setcommands with BotFather
- Clear Telegram cache
- Restart Telegram app

**Webhook errors:**
- Verify HTTPS certificate
- Check webhook URL accessibility
- Validate secret token
- Review server logs

**Rate limiting:**
- Monitor request frequency
- Implement client-side rate limiting
- Add request queuing
- Optimize message frequency

### Debug Commands
```bash
# Test bot connection
./scripts/test-bot.sh

# Setup webhook
./scripts/setup-webhook.sh

# Check webhook status
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"

# Get bot info
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe"
```

## Development Workflow

### Setup Process
1. Create bot with BotFather
2. Configure bot settings and commands
3. Set up environment variables
4. Implement webhook handlers
5. Deploy to production
6. Configure webhook URL
7. Test all functionality

### Testing Strategy
1. Unit tests for command handlers
2. Integration tests for webhook processing
3. Manual testing with real Telegram client
4. Load testing for rate limits
5. Security testing for webhook validation

### Deployment Checklist
- [ ] Environment variables configured
- [ ] Webhook URL accessible via HTTPS
- [ ] Database migrations applied
- [ ] Rate limiting configured
- [ ] Logging and monitoring set up
- [ ] Health checks functional
- [ ] Security validation working

---

**Last Updated**: 2025-09-28
**Configuration Version**: 1.0
**Bot API Version**: 7.10