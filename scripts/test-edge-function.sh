#!/bin/bash

# Test the generate-article Edge Function locally
# This helps debug issues before deploying

echo "🔍 Testing generate-article Edge Function..."
echo ""

# Check if SUPABASE_URL and SUPABASE_ANON_KEY are set
if [ -z "$SUPABASE_URL" ]; then
  echo "❌ SUPABASE_URL not set"
  echo "   Get it from: https://supabase.com/dashboard/project/_/settings/api"
  exit 1
fi

if [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "❌ SUPABASE_ANON_KEY not set"
  echo "   Get it from: https://supabase.com/dashboard/project/_/settings/api"
  exit 1
fi

# Test with a brief ID
BRIEF_ID="${1:-5839afb0-42c8-4cc5-9f4b-c65860c4c8fb}"

echo "📝 Testing with Brief ID: $BRIEF_ID"
echo ""

# Call the Edge Function
curl -X POST "$SUPABASE_URL/functions/v1/generate-article" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"briefId\": \"$BRIEF_ID\"}" \
  --verbose

echo ""
echo "✅ Test complete"
