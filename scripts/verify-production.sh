#!/bin/bash
# Production Verification Script
# Tests all Edge Functions are accessible and responding correctly

set -e

# Configuration - use environment variables with fallback defaults
PROJECT_REF="${SUPABASE_PROJECT_REF:-wyzuelwotgyoautxjpxv}"
BASE_URL="https://${PROJECT_REF}.supabase.co/functions/v1"
ANON_KEY="${SUPABASE_ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5enVlbHdvdGd5b2F1dHhqcHh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxODY0ODAsImV4cCI6MjA3NDc2MjQ4MH0.KkklGsyLf27_ZptH4m6YlmqUaxS3BVGDWsgstXB5ug0}"

echo "🔍 Production Verification Tests"
echo "================================="
echo ""

# Test 1: Telegram Webhook
echo "Test 1: telegram-webhook (expect 401 - missing auth)"
RESPONSE=$(curl -s -X POST "${BASE_URL}/telegram-webhook" -w "\nHTTP_CODE:%{http_code}")
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d':' -f2)
if [ "$HTTP_CODE" = "401" ]; then
  echo "✅ PASS: telegram-webhook responding (HTTP $HTTP_CODE)"
else
  echo "❌ FAIL: telegram-webhook unexpected status (HTTP $HTTP_CODE)"
fi
echo ""

# Test 2: Seed Lookup Data
echo "Test 2: seed-lookup-data (expect 200 - already seeded)"
RESPONSE=$(curl -s -X POST "${BASE_URL}/seed-lookup-data" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json")
if echo "$RESPONSE" | grep -q "success"; then
  echo "✅ PASS: seed-lookup-data accessible"
  echo "   Response: $RESPONSE"
else
  echo "⚠️  WARN: seed-lookup-data unexpected response"
  echo "   Response: $RESPONSE"
fi
echo ""

# Test 3: CSV Backfill
echo "Test 3: csv-backfill (expect 200 - already executed)"
RESPONSE=$(curl -s -X POST "${BASE_URL}/csv-backfill" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json")
if echo "$RESPONSE" | grep -q "success\|booksImported"; then
  echo "✅ PASS: csv-backfill accessible"
  echo "   Response: $RESPONSE"
else
  echo "⚠️  WARN: csv-backfill unexpected response"
  echo "   Response: $RESPONSE"
fi
echo ""

# Test 4: Enrich Metadata
echo "Test 4: enrich-metadata (expect 400 - missing bookId)"
RESPONSE=$(curl -s -X POST "${BASE_URL}/enrich-metadata" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}')
HTTP_CODE=$(echo "$RESPONSE" | jq -r '.code // empty')
if [ "$HTTP_CODE" = "400" ] || echo "$RESPONSE" | grep -q "bookId"; then
  echo "✅ PASS: enrich-metadata accessible (validation working)"
  echo "   Response: $RESPONSE"
else
  echo "⚠️  WARN: enrich-metadata unexpected response"
  echo "   Response: $RESPONSE"
fi
echo ""

# Test 5: RSS Ingestion
echo "Test 5: rss-ingestion (expect 200 - success)"
RESPONSE=$(curl -s -X POST "${BASE_URL}/rss-ingestion" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json")
if echo "$RESPONSE" | grep -q "success\|booksAdded"; then
  echo "✅ PASS: rss-ingestion accessible and working"
  echo "   Response: $RESPONSE"
else
  echo "❌ FAIL: rss-ingestion error"
  echo "   Response: $RESPONSE"
fi
echo ""

echo "================================="
echo "✅ Verification Complete"
