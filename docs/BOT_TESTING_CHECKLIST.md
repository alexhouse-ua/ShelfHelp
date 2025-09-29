# Telegram Bot Testing Checklist

## Pre-Testing Setup

### ✅ Environment Verification
- [ ] Bot created via @BotFather
- [ ] Bot token saved securely in `.env` file
- [ ] Bot username verified: `@shelf_help_assistant_bot`
- [ ] `.env` file exists and contains required variables
- [ ] Scripts are executable (`chmod +x scripts/*.sh`)

### ✅ Configuration Verification
- [ ] Bot description set correctly
- [ ] Bot about text configured
- [ ] All 11 commands configured in BotFather
- [ ] Inline mode enabled with proper placeholder
- [ ] Privacy settings configured (groups disabled)

## Automated Testing

### ✅ Script Tests
Run these scripts to verify basic functionality:

```bash
# Test bot API connection and configuration
./scripts/test-bot.sh

# Expected output:
# ✅ Bot API Connection: Working
# ✅ Bot Commands: 11 configured
# ⚠️  Webhook: Not configured (using polling mode)
```

### ✅ API Connection Test
- [ ] Bot token is valid
- [ ] Bot API returns correct bot information
- [ ] Bot username matches expected value
- [ ] Commands are properly configured

## Manual Testing

### ✅ Bot Discovery
1. **Find Bot in Telegram**
   - [ ] Open Telegram (mobile or desktop)
   - [ ] Search for `@shelf_help_assistant_bot`
   - [ ] Bot appears in search results
   - [ ] Bot profile shows correct name and description

2. **Bot Profile Verification**
   - [ ] Display name: "Shelf Help Assistant"
   - [ ] Description matches configured text
   - [ ] About section shows full description
   - [ ] Profile indicates it's a bot

### ✅ Initial Bot Interaction
1. **Start Conversation**
   - [ ] Click "START" button or send `/start`
   - [ ] Bot shows as "online" or recently active
   - [ ] No immediate response (expected - implementation pending)

2. **Commands Menu Test**
   - [ ] Tap the "/" button in message input
   - [ ] Commands menu appears
   - [ ] All 11 commands are listed:
     - [ ] `/start` - Welcome and introduction
     - [ ] `/help` - Available commands and features
     - [ ] `/addbook` - Add a new book to your shelf
     - [ ] `/mybooks` - View your book collection
     - [ ] `/recommend` - Get book recommendations
     - [ ] `/reading` - Currently reading books
     - [ ] `/finished` - Mark book as finished
     - [ ] `/reflect` - Start post-reading reflection
     - [ ] `/insights` - View your reading insights
     - [ ] `/status` - Your reading statistics
     - [ ] `/settings` - Configure preferences

3. **Command Testing** (No responses expected yet)
   - [ ] Send `/start` command
   - [ ] Send `/help` command
   - [ ] Send `/status` command
   - [ ] Send random text message
   - [ ] All messages appear as "sent" ✓
   - [ ] No error messages from Telegram
   - [ ] Bot doesn't respond (implementation pending)

### ✅ Feature Testing
1. **Inline Mode Test**
   - [ ] Type `@shelf_help_assistant_bot` in any chat
   - [ ] Inline query interface appears
   - [ ] Placeholder text: "Search books..."
   - [ ] No results returned (implementation pending)

2. **Settings Verification**
   - [ ] Bot cannot be added to groups (privacy setting)
   - [ ] Bot works only in private chats
   - [ ] Bot doesn't request unnecessary permissions

## Error Testing

### ✅ Invalid Inputs
1. **Unknown Commands**
   - [ ] Send `/unknown_command`
   - [ ] Send `/test123`
   - [ ] No error responses (implementation pending)

2. **Invalid Characters**
   - [ ] Send messages with special characters
   - [ ] Send very long messages
   - [ ] Send empty messages
   - [ ] All handled gracefully (no crashes)

3. **Rate Limiting**
   - [ ] Send multiple messages rapidly
   - [ ] No rate limit errors from Telegram
   - [ ] All messages delivered successfully

## Technical Verification

### ✅ Bot Information API
Using `curl` or the test script:

```bash
# Get bot information
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe"

# Expected fields:
# - id: Bot's unique ID
# - is_bot: true
# - first_name: "Shelf Help Assistant"
# - username: "shelf_help_assistant_bot"
# - can_join_groups: false
# - can_read_all_group_messages: false
# - supports_inline_queries: true
```

### ✅ Commands API
```bash
# Get configured commands
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMyCommands"

# Expected: Array of 11 command objects
# Each with "command" and "description" fields
```

### ✅ Webhook Status
```bash
# Check webhook status
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"

# Expected for initial setup:
# - url: "" (empty, no webhook set yet)
# - has_custom_certificate: false
# - pending_update_count: 0 (or small number)
```

## Expected Results (Current State)

### ✅ What Should Work
- Bot appears in Telegram search
- Bot profile information displays correctly
- Commands menu shows all configured commands
- Messages can be sent to bot without errors
- Inline mode interface appears
- Bot API calls return correct information

### ⚠️ What Won't Work Yet (Implementation Pending)
- Bot responses to any commands
- Message processing and replies
- Inline query results
- Database interactions
- Webhook processing
- User registration and data storage

## Testing Checklist Summary

### ✅ Phase 1: Configuration Complete
- [x] Bot created and configured
- [x] Commands menu set up
- [x] Environment variables configured
- [x] Documentation created
- [x] Testing scripts created

### ⏳ Phase 2: Implementation Pending
- [ ] Webhook endpoint development
- [ ] Database schema creation
- [ ] Command handlers implementation
- [ ] Message processing logic
- [ ] User management system

### ⏳ Phase 3: Full Testing
- [ ] End-to-end functionality testing
- [ ] Performance and load testing
- [ ] Security validation
- [ ] User acceptance testing

## Troubleshooting

### Common Issues and Solutions

**Bot not found in search:**
- Verify bot username spelling
- Check that bot was created successfully with BotFather
- Ensure bot is not deleted or suspended

**Commands menu not showing:**
- Run `/setcommands` again with BotFather
- Restart Telegram application
- Clear Telegram cache/data

**API calls failing:**
- Verify bot token in `.env` file
- Check token format (should be `number:alphanumeric`)
- Ensure no extra spaces or characters in token

**Script errors:**
- Verify `.env` file exists and is properly formatted
- Check that `jq` is installed for JSON parsing
- Ensure scripts have execute permissions

## Next Steps

After completing this testing checklist:

1. **Commit Configuration**
   ```bash
   git add .
   git commit -m "Issue #13: Complete Telegram bot registration and configuration"
   ```

2. **Implementation Planning**
   - Proceed to bot backend implementation
   - Set up Supabase Edge Functions
   - Create database schema
   - Implement webhook handlers

3. **Continuous Testing**
   - Re-run this checklist after each implementation milestone
   - Update expected results as features are implemented
   - Add new test cases for implemented functionality

---

**Testing Date**: _____________
**Tester**: ___________________
**Bot Version**: Configuration v1.0
**Status**: ⏳ Ready for Implementation