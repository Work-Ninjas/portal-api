#!/bin/bash

# P0 Emergency Production Fix Script
# Apply strict auth configuration to production Container Apps

set -e

echo "🚨 P0 Emergency Fix: Applying strict auth to production..."

# Use the Container App ID from the environment
CONTAINER_APP_ID="${CONTAINER_APP_ID}"

if [ -z "$CONTAINER_APP_ID" ]; then
    echo "❌ CONTAINER_APP_ID not set. Using fallback..."
    CONTAINER_APP_ID="/subscriptions/c4c5770f-c9b4-49db-ae81-fae53703aef5/resourceGroups/rg-data-migration-portal-prod/providers/Microsoft.App/containerapps/portal-api-prod"
fi

echo "📍 Container App: $CONTAINER_APP_ID"

# Build and push latest image
echo "🔨 Building latest image with strict auth..."
docker build -t portalregistry.azurecr.io/portal-api:latest .
docker push portalregistry.azurecr.io/portal-api:latest

# Update Container App with strict auth environment variables
echo "🔧 Updating Container App with strict configuration..."

az containerapp update \
  --ids "$CONTAINER_APP_ID" \
  --image "portalregistry.azurecr.io/portal-api:latest" \
  --set-env-vars \
    ENV=production \
    NODE_ENV=production \
    AUTH_MODE=strict \
    MOCK_MODE=off \
    ALLOW_ANON_DOCS=false \
    TOKEN_ENV_PREFIX=dhp_live_ \
    DB_SCHEMA=public \
    RPC_LIST_CONTACTS=api_list_contacts \
    RPC_GET_CONTACT=api_get_contact \
    RPC_LIST_JOBS=api_list_jobs \
    RPC_LIST_JOB_FILES=api_list_job_files \
  --revision-suffix "strict-auth-$(date +%s)"

echo "⏱️  Waiting for deployment to complete..."
sleep 30

# Test the deployment
echo "🧪 Testing deployment..."

# Test 1: No token should return 401
echo "Test 1: No Authorization header"
RESULT=$(curl -s -o /dev/null -w "%{http_code}" "https://api.datahubportal.com/v1/contacts?limit=1")
if [ "$RESULT" = "401" ]; then
    echo "✅ Test 1 PASSED: Returns 401 without token"
else
    echo "❌ Test 1 FAILED: Expected 401, got $RESULT"
fi

# Test 2: Health endpoint should show strict mode
echo "Test 2: Health endpoint authMode"
HEALTH=$(curl -s "https://api.datahubportal.com/v1/health")
if echo "$HEALTH" | grep -q '"authMode":"strict"'; then
    echo "✅ Test 2 PASSED: authMode is strict"
else
    echo "❌ Test 2 FAILED: authMode not strict"
    echo "Response: $HEALTH"
fi

if echo "$HEALTH" | grep -q '"mockMode":false'; then
    echo "✅ Test 3 PASSED: mockMode is false"
else
    echo "❌ Test 3 FAILED: mockMode not false"
    echo "Response: $HEALTH"
fi

echo "🏁 P0 Fix deployment completed!"
echo "📋 Next steps:"
echo "   1. Configure Supabase secrets via Azure portal"
echo "   2. Test with valid dhp_live_ tokens"
echo "   3. Monitor for any 5xx errors"

echo "📊 Current health status:"
curl -s "https://api.datahubportal.com/v1/health" | jq .