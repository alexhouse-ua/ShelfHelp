#!/bin/bash

# Telegram Bot Webhook Setup Script
# This script configures the webhook for the Shelf Help Assistant bot

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

if [ -z "$WEBHOOK_URL" ]; then
    print_error "WEBHOOK_URL not set in .env file"
    exit 1
fi

if [ -z "$WEBHOOK_SECRET_TOKEN" ]; then
    print_error "WEBHOOK_SECRET_TOKEN not set in .env file"
    exit 1
fi

print_info "Setting up webhook for bot..."
print_info "Webhook URL: $WEBHOOK_URL"

# Set webhook
response=$(curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"$WEBHOOK_URL\",
    \"secret_token\": \"$WEBHOOK_SECRET_TOKEN\",
    \"allowed_updates\": [\"message\", \"callback_query\", \"inline_query\"],
    \"drop_pending_updates\": true
  }")

# Check response
if echo "$response" | grep -q '"ok":true'; then
    print_success "Webhook configured successfully!"
else
    print_error "Failed to configure webhook"
    echo "Response: $response"
    exit 1
fi

# Get webhook info
print_info "Verifying webhook configuration..."
webhook_info=$(curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo")

echo "Webhook Information:"
echo "$webhook_info" | jq '.' 2>/dev/null || echo "$webhook_info"

# Extract and display key information
if command -v jq >/dev/null 2>&1; then
    url=$(echo "$webhook_info" | jq -r '.result.url')
    pending_count=$(echo "$webhook_info" | jq -r '.result.pending_update_count')
    last_error=$(echo "$webhook_info" | jq -r '.result.last_error_message // "None"')

    print_info "Current webhook URL: $url"
    print_info "Pending updates: $pending_count"
    if [ "$last_error" != "None" ] && [ "$last_error" != "null" ]; then
        print_warning "Last error: $last_error"
    fi
fi

print_success "Webhook setup complete!"

# Test webhook (optional)
read -p "Do you want to test the webhook endpoint? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "Testing webhook endpoint..."

    # Simple curl test to webhook URL
    test_response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -H "X-Telegram-Bot-Api-Secret-Token: $WEBHOOK_SECRET_TOKEN" \
        -d '{"test": true}' || echo "000")

    if [ "$test_response" = "200" ] || [ "$test_response" = "404" ]; then
        print_success "Webhook endpoint is reachable (HTTP $test_response)"
    else
        print_warning "Webhook endpoint returned HTTP $test_response - check your deployment"
    fi
fi

print_info "To remove the webhook later, run:"
print_info "curl -X POST \"https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/deleteWebhook\""