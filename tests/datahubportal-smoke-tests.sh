#!/bin/bash
# DataHub Portal API Smoke Tests - datahubportal.com Domain Cutover Validation
# Run this script to validate complete domain migration

set -e

# Configuration
PROD_BASE_URL="https://api.datahubportal.com/v1"
STAGING_BASE_URL="https://api.staging.datahubportal.com/v1"
API_KEY="prod_api_token_here"
STAGING_API_KEY="staging_api_token_here"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0
TOTAL_TESTS=0

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++))
    ((TOTAL_TESTS++))
}

log_failure() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((TESTS_FAILED++))
    ((TOTAL_TESTS++))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Test function template
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_result="$3"
    
    echo
    log_info "Running: $test_name"
    
    if eval "$test_command"; then
        log_success "$test_name"
    else
        log_failure "$test_name - $expected_result"
    fi
}

# Start smoke tests
echo "============================================================"
echo "DataHub Portal API Smoke Tests - Domain Cutover Validation"
echo "============================================================"
echo "Production: $PROD_BASE_URL"
echo "Staging: $STAGING_BASE_URL"
echo "Timestamp: $(date)"
echo

# 1. DNS Resolution Tests
log_info "Phase 1: DNS Resolution & TLS Validation"
echo "--------------------------------------------------------"

# Test DNS resolution
run_test "DNS Resolution - api.datahubportal.com" \
    "nslookup api.datahubportal.com > /dev/null 2>&1" \
    "DNS should resolve"

run_test "DNS Resolution - api.staging.datahubportal.com" \
    "nslookup api.staging.datahubportal.com > /dev/null 2>&1" \
    "DNS should resolve"

run_test "DNS Resolution - docs.datahubportal.com" \
    "nslookup docs.datahubportal.com > /dev/null 2>&1" \
    "DNS should resolve"

# Test TLS certificates
run_test "TLS Certificate - api.datahubportal.com" \
    "echo | openssl s_client -servername api.datahubportal.com -connect api.datahubportal.com:443 2>/dev/null | openssl x509 -noout -subject | grep -q 'datahubportal.com'" \
    "Valid TLS certificate"

run_test "TLS Certificate - api.staging.datahubportal.com" \
    "echo | openssl s_client -servername api.staging.datahubportal.com -connect api.staging.datahubportal.com:443 2>/dev/null | openssl x509 -noout -subject | grep -q 'datahubportal.com'" \
    "Valid TLS certificate"

# 2. API Health Tests
log_info "Phase 2: API Health & Basic Functionality"
echo "--------------------------------------------------------"

# Production health check
HEALTH_RESPONSE=$(curl -s -H "Authorization: Bearer $API_KEY" "$PROD_BASE_URL/health")
HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.status' 2>/dev/null || echo "error")

run_test "Health Check - Production" \
    "[[ \"$HEALTH_STATUS\" == \"healthy\" ]]" \
    "Health status should be 'healthy'"

# Check version in health response
HEALTH_VERSION=$(echo "$HEALTH_RESPONSE" | jq -r '.version' 2>/dev/null || echo "unknown")
run_test "Version Check - Production" \
    "[[ \"$HEALTH_VERSION\" == \"1.0.0\" ]]" \
    "Version should be '1.0.0'"

# Staging health check
STAGING_HEALTH=$(curl -s -H "Authorization: Bearer $STAGING_API_KEY" "$STAGING_BASE_URL/health")
STAGING_STATUS=$(echo "$STAGING_HEALTH" | jq -r '.status' 2>/dev/null || echo "error")

run_test "Health Check - Staging" \
    "[[ \"$STAGING_STATUS\" == \"healthy\" ]]" \
    "Staging health status should be 'healthy'"

# 3. CORS Validation Tests
log_info "Phase 3: CORS Policy Validation"
echo "--------------------------------------------------------"

# Valid origin test
CORS_VALID=$(curl -s -H "Origin: https://datahubportal.com" -H "Authorization: Bearer $API_KEY" -D- "$PROD_BASE_URL/health" 2>/dev/null | grep -i "access-control-allow-origin" | grep -c "https://datahubportal.com" || echo "0")

run_test "CORS - Valid Origin (datahubportal.com)" \
    "[[ \"$CORS_VALID\" -gt \"0\" ]]" \
    "Should allow https://datahubportal.com origin"

# Invalid origin test (should be blocked)
CORS_INVALID_RESPONSE=$(curl -s -w "%{http_code}" -H "Origin: https://malicious.example.com" -H "Authorization: Bearer $API_KEY" "$PROD_BASE_URL/health" 2>/dev/null | tail -n1)

run_test "CORS - Invalid Origin Block" \
    "[[ \"$CORS_INVALID_RESPONSE\" != \"200\" ]]" \
    "Should block malicious origins"

# 4. Rate Limiting Tests
log_info "Phase 4: Rate Limiting Validation"
echo "--------------------------------------------------------"

# Test rate limit headers presence
RATE_LIMIT_HEADERS=$(curl -s -H "Authorization: Bearer $API_KEY" -D- "$PROD_BASE_URL/health" 2>/dev/null | grep -c "X-RateLimit" || echo "0")

run_test "Rate Limit Headers - Present" \
    "[[ \"$RATE_LIMIT_HEADERS\" -ge \"3\" ]]" \
    "Should have X-RateLimit-Limit, -Remaining, -Reset headers"

# Test global rate limit
GLOBAL_RATE_LIMIT=$(curl -s -H "Authorization: Bearer $API_KEY" -D- "$PROD_BASE_URL/health" 2>/dev/null | grep "X-RateLimit-Limit:" | grep -o "[0-9]\+" || echo "0")

run_test "Rate Limit - Global (60 RPM)" \
    "[[ \"$GLOBAL_RATE_LIMIT\" == \"60\" ]]" \
    "Global rate limit should be 60 RPM"

# Test files endpoint rate limit
FILES_RATE_LIMIT=$(curl -s -H "Authorization: Bearer $API_KEY" -D- "$PROD_BASE_URL/jobs/job_test/files" 2>/dev/null | grep "X-RateLimit-Limit:" | grep -o "[0-9]\+" || echo "0")

run_test "Rate Limit - Files Endpoint (120 RPM)" \
    "[[ \"$FILES_RATE_LIMIT\" == \"120\" ]]" \
    "Files endpoint rate limit should be 120 RPM"

# 5. API Endpoint Tests
log_info "Phase 5: API Endpoints Functionality"
echo "--------------------------------------------------------"

# Test contacts endpoint
CONTACTS_RESPONSE=$(curl -s -H "Authorization: Bearer $API_KEY" "$PROD_BASE_URL/contacts?limit=1")
CONTACTS_TOTAL=$(echo "$CONTACTS_RESPONSE" | jq -r '.total' 2>/dev/null || echo "error")

run_test "Contacts API - Data Response" \
    "[[ \"$CONTACTS_TOTAL\" != \"error\" && \"$CONTACTS_TOTAL\" != \"null\" ]]" \
    "Contacts API should return valid data"

# Test jobs endpoint  
JOBS_RESPONSE=$(curl -s -H "Authorization: Bearer $API_KEY" "$PROD_BASE_URL/jobs?limit=1")
JOBS_DATA=$(echo "$JOBS_RESPONSE" | jq -r '.data[0].status' 2>/dev/null || echo "error")

run_test "Jobs API - Data Response" \
    "[[ \"$JOBS_DATA\" != \"error\" && \"$JOBS_DATA\" != \"null\" ]]" \
    "Jobs API should return valid data"

# 6. Files & Signed URLs Tests
log_info "Phase 6: Files API & Signed URLs Validation"
echo "--------------------------------------------------------"

# Test files endpoint
FILES_RESPONSE=$(curl -s -H "Authorization: Bearer $API_KEY" "$PROD_BASE_URL/jobs/job_test/files?limit=1")
SIGNED_URL=$(echo "$FILES_RESPONSE" | jq -r '.data[0].signed_url' 2>/dev/null || echo "error")

run_test "Files API - Signed URL Generation" \
    "[[ \"$SIGNED_URL\" != \"error\" && \"$SIGNED_URL\" != \"null\" && \"$SIGNED_URL\" != \"\" ]]" \
    "Should generate signed URLs"

# Test expires_at field (should be ~15 minutes from now)
EXPIRES_AT=$(echo "$FILES_RESPONSE" | jq -r '.data[0].expires_at' 2>/dev/null || echo "error")
if [[ "$EXPIRES_AT" != "error" && "$EXPIRES_AT" != "null" ]]; then
    EXPIRES_TIMESTAMP=$(date -d "$EXPIRES_AT" +%s 2>/dev/null || echo "0")
    NOW_TIMESTAMP=$(date +%s)
    EXPIRES_DIFF=$(( (EXPIRES_TIMESTAMP - NOW_TIMESTAMP) / 60 ))
    
    run_test "Files API - 15min Expiry" \
        "[[ \"$EXPIRES_DIFF\" -ge \"13\" && \"$EXPIRES_DIFF\" -le \"16\" ]]" \
        "Signed URLs should expire in ~15 minutes"
else
    log_failure "Files API - 15min Expiry - Could not parse expires_at"
    ((TESTS_FAILED++))
    ((TOTAL_TESTS++))
fi

# Test cache control headers
CACHE_CONTROL=$(curl -s -H "Authorization: Bearer $API_KEY" -D- "$PROD_BASE_URL/jobs/job_test/files" 2>/dev/null | grep -i "cache-control" | grep -c "no-store" || echo "0")

run_test "Files API - Cache Headers" \
    "[[ \"$CACHE_CONTROL\" -gt \"0\" ]]" \
    "Should have Cache-Control: no-store headers"

# 7. Security Headers Tests
log_info "Phase 7: Security Headers Validation"
echo "--------------------------------------------------------"

# Test HSTS header
HSTS_HEADER=$(curl -s -D- "$PROD_BASE_URL/health" 2>/dev/null | grep -c "Strict-Transport-Security" || echo "0")

run_test "Security Headers - HSTS" \
    "[[ \"$HSTS_HEADER\" -gt \"0\" ]]" \
    "Should have HSTS header"

# Test X-Content-Type-Options
CONTENT_TYPE_HEADER=$(curl -s -D- "$PROD_BASE_URL/health" 2>/dev/null | grep -c "X-Content-Type-Options.*nosniff" || echo "0")

run_test "Security Headers - X-Content-Type-Options" \
    "[[ \"$CONTENT_TYPE_HEADER\" -gt \"0\" ]]" \
    "Should have X-Content-Type-Options: nosniff"

# Test X-Frame-Options
FRAME_OPTIONS=$(curl -s -D- "$PROD_BASE_URL/health" 2>/dev/null | grep -c "X-Frame-Options" || echo "0")

run_test "Security Headers - X-Frame-Options" \
    "[[ \"$FRAME_OPTIONS\" -gt \"0\" ]]" \
    "Should have X-Frame-Options header"

# 8. Documentation Tests
log_info "Phase 8: Documentation & OpenAPI Validation"
echo "--------------------------------------------------------"

# Test docs.datahubportal.com accessibility
DOCS_STATUS=$(curl -s -w "%{http_code}" -o /dev/null https://docs.datahubportal.com 2>/dev/null || echo "000")

run_test "Documentation Site - Accessible" \
    "[[ \"$DOCS_STATUS\" == \"200\" ]]" \
    "docs.datahubportal.com should be accessible"

# 9. Error Handling Tests
log_info "Phase 9: Error Handling Validation"  
echo "--------------------------------------------------------"

# Test 404 for invalid endpoint
NOT_FOUND_RESPONSE=$(curl -s -w "%{http_code}" -H "Authorization: Bearer $API_KEY" "$PROD_BASE_URL/invalid-endpoint" 2>/dev/null | tail -n1)

run_test "Error Handling - 404 for Invalid Endpoint" \
    "[[ \"$NOT_FOUND_RESPONSE\" == \"404\" ]]" \
    "Invalid endpoints should return 404"

# Test 401 for missing auth
UNAUTHORIZED_RESPONSE=$(curl -s -w "%{http_code}" "$PROD_BASE_URL/health" 2>/dev/null | tail -n1)

run_test "Error Handling - 401 for Missing Auth" \
    "[[ \"$UNAUTHORIZED_RESPONSE\" == \"401\" ]]" \
    "Missing authorization should return 401"

# 10. Performance Baseline Tests
log_info "Phase 10: Performance Baseline Validation"
echo "--------------------------------------------------------"

# Test response time for health endpoint
HEALTH_TIME=$(curl -s -w "%{time_total}" -o /dev/null -H "Authorization: Bearer $API_KEY" "$PROD_BASE_URL/health" 2>/dev/null)
HEALTH_TIME_MS=$(echo "$HEALTH_TIME * 1000" | bc | cut -d. -f1)

run_test "Performance - Health Response Time" \
    "[[ \"$HEALTH_TIME_MS\" -lt \"1000\" ]]" \
    "Health endpoint should respond in <1s"

# Test response time for contacts endpoint
CONTACTS_TIME=$(curl -s -w "%{time_total}" -o /dev/null -H "Authorization: Bearer $API_KEY" "$PROD_BASE_URL/contacts?limit=1" 2>/dev/null)
CONTACTS_TIME_MS=$(echo "$CONTACTS_TIME * 1000" | bc | cut -d. -f1)

run_test "Performance - Contacts Response Time" \
    "[[ \"$CONTACTS_TIME_MS\" -lt \"5000\" ]]" \
    "Contacts endpoint should respond in <5s"

# Summary Report
echo
echo "============================================================"
echo "SMOKE TEST SUMMARY"
echo "============================================================"
echo "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo "Success Rate: $(echo "scale=1; $TESTS_PASSED * 100 / $TOTAL_TESTS" | bc)%"
echo
echo "Timestamp: $(date)"
echo "Domain: datahubportal.com"
echo "Environment: Production & Staging"
echo

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "${GREEN}✅ ALL TESTS PASSED - DOMAIN CUTOVER SUCCESSFUL!${NC}"
    echo
    log_info "DataHub Portal API is ready at api.datahubportal.com"
    log_info "Documentation is available at docs.datahubportal.com"  
    log_info "HSTS with includeSubDomains can now be activated"
    exit 0
else
    echo -e "${RED}❌ SOME TESTS FAILED - REVIEW REQUIRED${NC}"
    echo
    log_warning "Please address failed tests before completing domain cutover"
    exit 1
fi