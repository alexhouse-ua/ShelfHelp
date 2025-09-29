#!/bin/bash

# Telegram Bot Testing Script
# This script tests basic bot functionality and configuration

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

# Load environment variables
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
    print_info "Loaded environment variables from .env"
else
    print_error ".env file not found. Please create it from .env.example"
    exit 1
fi

# Check required environment variables
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    print_error "TELEGRAM_BOT_TOKEN not set in .env file"
    exit 1
fi

BASE_URL="https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN"

print_header "Bot Information Test"

# Get bot info
print_info "Fetching bot information..."
bot_info=$(curl -s "$BASE_URL/getMe")

if echo "$bot_info" | grep -q '"ok":true'; then
    print_success "Bot API connection successful!"

    if command -v jq >/dev/null 2>&1; then
        username=$(echo "$bot_info" | jq -r '.result.username')
        first_name=$(echo "$bot_info" | jq -r '.result.first_name')
        can_join_groups=$(echo "$bot_info" | jq -r '.result.can_join_groups')
        can_read_all_group_messages=$(echo "$bot_info" | jq -r '.result.can_read_all_group_messages')
        supports_inline_queries=$(echo "$bot_info" | jq -r '.result.supports_inline_queries')

        echo "  Username: @$username"
        echo "  Name: $first_name"
        echo "  Can join groups: $can_join_groups"
        echo "  Can read group messages: $can_read_all_group_messages"
        echo "  Supports inline queries: $supports_inline_queries"
    else
        echo "$bot_info"
    fi
else
    print_error "Failed to connect to bot API"
    echo "Response: $bot_info"
    exit 1
fi

print_header "Bot Commands Test"

# Get bot commands
print_info "Fetching bot commands..."
commands_info=$(curl -s "$BASE_URL/getMyCommands")

if echo "$commands_info" | grep -q '"ok":true'; then
    print_success "Bot commands fetched successfully!"

    if command -v jq >/dev/null 2>&1; then
        commands_count=$(echo "$commands_info" | jq '.result | length')
        echo "  Number of commands configured: $commands_count"

        if [ "$commands_count" -gt 0 ]; then
            echo "  Configured commands:"
            echo "$commands_info" | jq -r '.result[] | "    /" + .command + " - " + .description'
        else
            print_warning "No commands configured yet"
        fi
    else
        echo "$commands_info"
    fi
else
    print_error "Failed to fetch bot commands"
    echo "Response: $commands_info"
fi

print_header "Webhook Status Test"

# Get webhook info
print_info "Checking webhook configuration..."
webhook_info=$(curl -s "$BASE_URL/getWebhookInfo")

if echo "$webhook_info" | grep -q '"ok":true'; then
    print_success "Webhook information retrieved!"

    if command -v jq >/dev/null 2>&1; then
        url=$(echo "$webhook_info" | jq -r '.result.url')
        has_custom_certificate=$(echo "$webhook_info" | jq -r '.result.has_custom_certificate')
        pending_count=$(echo "$webhook_info" | jq -r '.result.pending_update_count')
        last_error=$(echo "$webhook_info" | jq -r '.result.last_error_message // "None"')
        last_error_date=$(echo "$webhook_info" | jq -r '.result.last_error_date // 0')
        max_connections=$(echo "$webhook_info" | jq -r '.result.max_connections // 40')
        allowed_updates=$(echo "$webhook_info" | jq -r '.result.allowed_updates[]? // "all"' | tr '\n' ',' | sed 's/,$//')

        echo "  Webhook URL: ${url:-"Not set"}"
        echo "  Custom certificate: $has_custom_certificate"
        echo "  Pending updates: $pending_count"
        echo "  Max connections: $max_connections"
        echo "  Allowed updates: ${allowed_updates:-"all"}"

        if [ "$last_error" != "None" ] && [ "$last_error" != "null" ]; then
            print_warning "Last error: $last_error"
            if [ "$last_error_date" != "0" ]; then
                error_time=$(date -d "@$last_error_date" 2>/dev/null || date -r "$last_error_date" 2>/dev/null || echo "Invalid date")
                echo "  Error time: $error_time"
            fi
        fi

        if [ "$url" = "null" ] || [ "$url" = "" ]; then
            print_warning "No webhook configured - bot will use polling mode"
            print_info "To set up webhook, run: ./scripts/setup-webhook.sh"
        fi
    else
        echo "$webhook_info"
    fi
else
    print_error "Failed to fetch webhook information"
    echo "Response: $webhook_info"
fi

print_header "Bot Updates Test"

# Check for recent updates (only if no webhook is set)
webhook_url=$(echo "$webhook_info" | jq -r '.result.url // ""')
if [ "$webhook_url" = "" ] || [ "$webhook_url" = "null" ]; then
    print_info "Checking for recent updates (polling mode)..."
    updates=$(curl -s "$BASE_URL/getUpdates?limit=5")

    if echo "$updates" | grep -q '"ok":true'; then
        if command -v jq >/dev/null 2>&1; then
            update_count=$(echo "$updates" | jq '.result | length')
            echo "  Recent updates: $update_count"

            if [ "$update_count" -gt 0 ]; then
                print_info "Most recent updates:"
                echo "$updates" | jq -r '.result[] | "    Update ID: " + (.update_id | tostring) + " - Type: " + (if .message then "message" elif .callback_query then "callback_query" elif .inline_query then "inline_query" else "other" end)'
            fi
        else
            echo "$updates"
        fi
    else
        print_error "Failed to fetch updates"
    fi
else
    print_info "Webhook is configured, skipping polling test"
fi

print_header "Test Summary"

# Summary
echo -e "\n${GREEN}Bot Test Results:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Bot API connection
if echo "$bot_info" | grep -q '"ok":true'; then
    print_success "Bot API Connection: Working"
else
    print_error "Bot API Connection: Failed"
fi

# Commands configuration
if echo "$commands_info" | grep -q '"ok":true'; then
    commands_count=$(echo "$commands_info" | jq '.result | length' 2>/dev/null || echo "0")
    if [ "$commands_count" -gt 0 ]; then
        print_success "Bot Commands: $commands_count configured"
    else
        print_warning "Bot Commands: None configured"
    fi
else
    print_error "Bot Commands: Failed to check"
fi

# Webhook status
webhook_url=$(echo "$webhook_info" | jq -r '.result.url // ""' 2>/dev/null)
if [ "$webhook_url" != "" ] && [ "$webhook_url" != "null" ]; then
    print_success "Webhook: Configured at $webhook_url"
else
    print_warning "Webhook: Not configured (using polling mode)"
fi

echo ""
print_info "Manual testing steps:"
print_info "1. Open Telegram and search for @${BOT_USERNAME:-your_bot_username}"
print_info "2. Start a chat with the bot"
print_info "3. Send /start command"
print_info "4. Try other commands from the menu"
print_info "5. Verify responses once bot backend is implemented"

if [ "$webhook_url" = "" ] || [ "$webhook_url" = "null" ]; then
    echo ""
    print_info "To enable webhook mode:"
    print_info "1. Deploy your Supabase Edge Functions"
    print_info "2. Update WEBHOOK_URL in .env"
    print_info "3. Run: ./scripts/setup-webhook.sh"
fi