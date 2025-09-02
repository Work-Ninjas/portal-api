#!/bin/bash

# Portal API Azure Production Verification Script
# Verifies complete Azure cutover for datahubportal.com

set -e

echo "🔍 Portal API Azure Production Verification"
echo "=========================================="
echo ""

# Configuration
PRODUCTION_API="https://api.datahubportal.com"
STAGING_API="https://api.staging.datahubportal.com" 
PRODUCTION_DOCS="https://docs.datahubportal.com"
STAGING_DOCS="https://docs.staging.datahubportal.com"
TEST_API_KEY="${VERIFICATION_API_KEY:-your_test_api_key_here}"
RESULTS_DIR="verification-results-$(date +%Y%m%d-%H%M%S)"

mkdir -p "${RESULTS_DIR}"

echo "📊 Test Results Directory: ${RESULTS_DIR}"
echo ""

# Test 1: DNS Resolution and TLS Certificates
echo "🌐 Test 1: DNS Resolution and TLS Certificates"
echo "----------------------------------------------"

check_dns_tls() {
    local host=$1
    local name=$2
    echo "  🔍 Checking ${name}: ${host}"
    
    # DNS resolution
    if nslookup "${host}" > "${RESULTS_DIR}/dns-${name}.txt" 2>&1; then
        echo "    ✅ DNS resolution successful"
        grep -E "Address|Name:" "${RESULTS_DIR}/dns-${name}.txt" | head -4
    else
        echo "    ❌ DNS resolution failed"
        return 1
    fi
    
    # TLS certificate check
    echo "  🔒 Checking TLS certificate..."
    if openssl s_client -connect "${host}:443" -servername "${host}" < /dev/null 2>/dev/null | openssl x509 -noout -text > "${RESULTS_DIR}/tls-${name}.txt" 2>&1; then
        echo "    ✅ TLS certificate valid"
        
        # Extract certificate details
        cert_subject=$(grep -A1 "Subject:" "${RESULTS_DIR}/tls-${name}.txt" | tr -d '\n' | sed 's/Subject: //')
        cert_issuer=$(grep -A1 "Issuer:" "${RESULTS_DIR}/tls-${name}.txt" | tr -d '\n' | sed 's/Issuer: //')
        cert_expiry=$(grep -A2 "Validity" "${RESULTS_DIR}/tls-${name}.txt" | grep "Not After" | sed 's/.*Not After : //')
        
        echo "      Subject: ${cert_subject}"
        echo "      Issuer: ${cert_issuer}"
        echo "      Expires: ${cert_expiry}"
    else
        echo "    ❌ TLS certificate check failed"
        return 1
    fi
    echo ""
}

check_dns_tls "api.datahubportal.com" "production-api"
check_dns_tls "api.staging.datahubportal.com" "staging-api"
check_dns_tls "docs.datahubportal.com" "production-docs"
check_dns_tls "docs.staging.datahubportal.com" "staging-docs"

# Test 2: CORS Configuration Verification
echo "🌍 Test 2: CORS Configuration"
echo "-----------------------------"

check_cors() {
    local url=$1
    local origin=$2
    local name=$3
    
    echo "  🔍 Testing CORS for ${name}"
    echo "      URL: ${url}"
    echo "      Origin: ${origin}"
    
    # Preflight OPTIONS request
    cors_response=$(curl -s -i -X OPTIONS \
        -H "Origin: ${origin}" \
        -H "Access-Control-Request-Method: GET" \
        -H "Access-Control-Request-Headers: Authorization,Content-Type,X-Request-Id" \
        "${url}/v1/contacts" 2>&1 || echo "CURL_ERROR")
    
    echo "${cors_response}" > "${RESULTS_DIR}/cors-${name}.txt"
    
    if echo "${cors_response}" | grep -q "Access-Control-Allow-Origin"; then
        echo "    ✅ CORS headers present"
        
        # Extract CORS headers
        allow_origin=$(echo "${cors_response}" | grep -i "access-control-allow-origin" | cut -d: -f2- | tr -d '\r\n ')
        allow_methods=$(echo "${cors_response}" | grep -i "access-control-allow-methods" | cut -d: -f2- | tr -d '\r\n ')
        allow_headers=$(echo "${cors_response}" | grep -i "access-control-allow-headers" | cut -d: -f2- | tr -d '\r\n ')
        max_age=$(echo "${cors_response}" | grep -i "access-control-max-age" | cut -d: -f2- | tr -d '\r\n ')
        
        echo "      Allow-Origin: ${allow_origin}"
        echo "      Allow-Methods: ${allow_methods}"
        echo "      Allow-Headers: ${allow_headers}"
        echo "      Max-Age: ${max_age}"
        
        # Verify expected values
        if [[ "${allow_origin}" == "${origin}" ]]; then
            echo "    ✅ Origin correctly reflected"
        else
            echo "    ⚠️  Origin mismatch - Expected: ${origin}, Got: ${allow_origin}"
        fi
        
        if echo "${allow_methods}" | grep -q "GET.*HEAD.*OPTIONS"; then
            echo "    ✅ Required methods present"
        else
            echo "    ⚠️  Methods incomplete - Got: ${allow_methods}"
        fi
        
        if [[ "${max_age}" == "600" ]]; then
            echo "    ✅ Max-Age correct (600s)"
        else
            echo "    ⚠️  Max-Age incorrect - Expected: 600, Got: ${max_age}"
        fi
    else
        echo "    ❌ CORS headers missing"
        echo "${cors_response}" | head -10
    fi
    echo ""
}

check_cors "${PRODUCTION_API}" "https://datahubportal.com" "production-main"
check_cors "${PRODUCTION_API}" "https://staging.datahubportal.com" "production-staging"
check_cors "${STAGING_API}" "https://staging.datahubportal.com" "staging-staging"

# Test 3: API Endpoints and Rate Limiting
echo "🔌 Test 3: API Endpoints and Rate Limiting"
echo "------------------------------------------"

test_api_endpoint() {
    local base_url=$1
    local endpoint=$2
    local name=$3
    local expected_status=$4
    
    echo "  🔍 Testing ${name}: ${base_url}${endpoint}"
    
    # Test without authentication
    response=$(curl -s -i -w "HTTPSTATUS:%{http_code}\nTOTALTIME:%{time_total}\n" \
        "${base_url}${endpoint}" 2>&1)
    
    echo "${response}" > "${RESULTS_DIR}/api-${name}.txt"
    
    http_status=$(echo "${response}" | grep "HTTPSTATUS:" | cut -d: -f2)
    total_time=$(echo "${response}" | grep "TOTALTIME:" | cut -d: -f2)
    
    echo "      Status: ${http_status}"
    echo "      Response Time: ${total_time}s"
    
    # Check rate limiting headers
    if echo "${response}" | grep -qi "x-ratelimit-limit"; then
        rate_limit=$(echo "${response}" | grep -i "x-ratelimit-limit" | cut -d: -f2 | tr -d '\r\n ')
        rate_remaining=$(echo "${response}" | grep -i "x-ratelimit-remaining" | cut -d: -f2 | tr -d '\r\n ')
        rate_reset=$(echo "${response}" | grep -i "x-ratelimit-reset" | cut -d: -f2 | tr -d '\r\n ')
        
        echo "      ✅ Rate limiting headers present"
        echo "         Limit: ${rate_limit}"
        echo "         Remaining: ${rate_remaining}"
        echo "         Reset: ${rate_reset}"
    else
        echo "      ❌ Rate limiting headers missing"
    fi
    
    # Check security headers
    if echo "${response}" | grep -qi "strict-transport-security"; then
        echo "      ✅ HSTS header present"
    else
        echo "      ⚠️  HSTS header missing"
    fi
    
    if echo "${response}" | grep -qi "x-content-type-options.*nosniff"; then
        echo "      ✅ X-Content-Type-Options: nosniff present"
    else
        echo "      ⚠️  X-Content-Type-Options header missing"
    fi
    
    if [[ "${http_status}" == "${expected_status}" ]]; then
        echo "      ✅ Expected status code: ${http_status}"
    else
        echo "      ⚠️  Unexpected status - Expected: ${expected_status}, Got: ${http_status}"
    fi
    
    echo ""
}

# Test API endpoints
test_api_endpoint "${PRODUCTION_API}" "/v1/health" "health" "200"
test_api_endpoint "${PRODUCTION_API}" "/v1/contacts" "contacts" "401"
test_api_endpoint "${PRODUCTION_API}" "/v1/jobs" "jobs" "401"
test_api_endpoint "${STAGING_API}" "/v1/health" "staging-health" "200"

# Test with authentication if API key provided
if [[ "${TEST_API_KEY}" != "your_test_api_key_here" ]]; then
    echo "🔐 Test 4: Authenticated Endpoints"
    echo "----------------------------------"
    
    test_authenticated_endpoint() {
        local base_url=$1
        local endpoint=$2
        local name=$3
        
        echo "  🔍 Testing authenticated ${name}: ${base_url}${endpoint}"
        
        response=$(curl -s -i -w "HTTPSTATUS:%{http_code}\nTOTALTIME:%{time_total}\n" \
            -H "Authorization: Bearer ${TEST_API_KEY}" \
            -H "User-Agent: Azure-Verification-Test/1.0" \
            "${base_url}${endpoint}" 2>&1)
        
        echo "${response}" > "${RESULTS_DIR}/auth-${name}.txt"
        
        http_status=$(echo "${response}" | grep "HTTPSTATUS:" | cut -d: -f2)
        total_time=$(echo "${response}" | grep "TOTALTIME:" | cut -d: -f2)
        
        echo "      Status: ${http_status}"
        echo "      Response Time: ${total_time}s"
        
        if [[ "${http_status}" == "200" ]]; then
            echo "      ✅ Authentication successful"
            
            # Check response format
            if echo "${response}" | grep -q '"data":'; then
                echo "      ✅ Response format correct"
            else
                echo "      ⚠️  Unexpected response format"
            fi
            
        elif [[ "${http_status}" == "429" ]]; then
            echo "      ⚠️  Rate limited (expected in load testing)"
            
            if echo "${response}" | grep -qi "retry-after"; then
                retry_after=$(echo "${response}" | grep -i "retry-after" | cut -d: -f2 | tr -d '\r\n ')
                echo "      Retry-After: ${retry_after}"
            fi
            
        else
            echo "      ❌ Unexpected response status"
        fi
        echo ""
    }
    
    test_authenticated_endpoint "${PRODUCTION_API}" "/v1/contacts" "contacts"
    test_authenticated_endpoint "${PRODUCTION_API}" "/v1/jobs" "jobs"
    
    # Test files endpoint (assuming a test job ID exists)
    echo "  🔍 Testing files endpoint (may fail if test job doesn't exist)"
    files_response=$(curl -s -i -w "HTTPSTATUS:%{http_code}\n" \
        -H "Authorization: Bearer ${TEST_API_KEY}" \
        "${PRODUCTION_API}/v1/jobs/test-job-id/files" 2>&1)
    
    files_status=$(echo "${files_response}" | grep "HTTPSTATUS:" | cut -d: -f2)
    echo "      Files endpoint status: ${files_status} (404 expected if test job doesn't exist)"
    
    # Check cache headers for files endpoint
    if echo "${files_response}" | grep -qi "cache-control.*no-store"; then
        echo "      ✅ Files endpoint has no-cache headers"
    else
        echo "      ⚠️  Files endpoint cache headers missing"
    fi
    
else
    echo "⚠️  Skipping authenticated endpoint tests - API key not provided"
    echo "   Set VERIFICATION_API_KEY environment variable to test authenticated endpoints"
fi

# Test 5: Documentation Sites
echo "📚 Test 5: Documentation Sites"
echo "-------------------------------"

test_docs_site() {
    local url=$1
    local name=$2
    
    echo "  🔍 Testing ${name}: ${url}"
    
    response=$(curl -s -i -w "HTTPSTATUS:%{http_code}\nTOTALTIME:%{time_total}\n" \
        "${url}" 2>&1)
    
    echo "${response}" > "${RESULTS_DIR}/docs-${name}.txt"
    
    http_status=$(echo "${response}" | grep "HTTPSTATUS:" | cut -d: -f2)
    total_time=$(echo "${response}" | grep "TOTALTIME:" | cut -d: -f2)
    
    echo "      Status: ${http_status}"
    echo "      Response Time: ${total_time}s"
    
    if [[ "${http_status}" == "200" ]]; then
        echo "      ✅ Documentation site accessible"
        
        # Check for Stoplight/API docs content
        if echo "${response}" | grep -qi "portal.*api\|stoplight\|openapi"; then
            echo "      ✅ API documentation content detected"
        else
            echo "      ⚠️  API documentation content not detected"
        fi
        
    else
        echo "      ❌ Documentation site not accessible"
    fi
    echo ""
}

test_docs_site "${PRODUCTION_DOCS}" "production-docs"
test_docs_site "${STAGING_DOCS}" "staging-docs"

# Test 6: Robots.txt Configuration
echo "🤖 Test 6: Robots.txt Configuration"
echo "-----------------------------------"

test_robots() {
    local url=$1
    local name=$2
    local should_allow=$3
    
    echo "  🔍 Testing robots.txt for ${name}: ${url}/robots.txt"
    
    robots_response=$(curl -s -w "HTTPSTATUS:%{http_code}\n" "${url}/robots.txt" 2>&1)
    robots_status=$(echo "${robots_response}" | grep "HTTPSTATUS:" | cut -d: -f2)
    robots_content=$(echo "${robots_response}" | grep -v "HTTPSTATUS:")
    
    echo "${robots_response}" > "${RESULTS_DIR}/robots-${name}.txt"
    
    echo "      Status: ${robots_status}"
    
    if [[ "${robots_status}" == "200" ]]; then
        echo "      ✅ robots.txt accessible"
        
        if [[ "${should_allow}" == "true" ]]; then
            if echo "${robots_content}" | grep -qi "allow.*/" && ! echo "${robots_content}" | grep -qi "disallow.*/"; then
                echo "      ✅ Production robots.txt allows crawling"
            else
                echo "      ⚠️  Production robots.txt may block crawling"
            fi
        else
            if echo "${robots_content}" | grep -qi "disallow.*/"; then
                echo "      ✅ Staging robots.txt blocks crawling"
            else
                echo "      ⚠️  Staging robots.txt may allow crawling"
            fi
        fi
        
        echo "      Content preview:"
        echo "${robots_content}" | head -5 | sed 's/^/        /'
    else
        echo "      ❌ robots.txt not accessible"
    fi
    echo ""
}

test_robots "${PRODUCTION_DOCS}" "production-docs" "true"
test_robots "${STAGING_DOCS}" "staging-docs" "false"

# Test 7: Azure-specific Headers and Features
echo "☁️  Test 7: Azure-specific Features"
echo "-----------------------------------"

echo "  🔍 Checking for Azure-specific response headers"

# Check production API for Azure headers
azure_response=$(curl -s -i "${PRODUCTION_API}/v1/health" 2>&1)
echo "${azure_response}" > "${RESULTS_DIR}/azure-headers.txt"

if echo "${azure_response}" | grep -qi "x-azure\|azure"; then
    echo "      ✅ Azure headers detected"
    echo "${azure_response}" | grep -i azure | head -3 | sed 's/^/        /'
else
    echo "      ℹ️  No explicit Azure headers (this is normal)"
fi

# Check for Azure Front Door headers
if echo "${azure_response}" | grep -qi "x-azure-ref\|x-fd-"; then
    echo "      ✅ Azure Front Door headers present"
    echo "${azure_response}" | grep -i "x-azure-ref\|x-fd-" | sed 's/^/        /'
else
    echo "      ℹ️  Azure Front Door headers not visible (may be stripped)"
fi

# Final Summary
echo ""
echo "📋 Verification Summary"
echo "======================"
echo ""

# Count tests and results
total_files=$(ls -1 "${RESULTS_DIR}"/*.txt 2>/dev/null | wc -l)
echo "📁 Results saved to: ${RESULTS_DIR}/ (${total_files} files)"
echo ""

# Generate summary
echo "✅ COMPLETED TESTS:"
echo "   🌐 DNS resolution and TLS certificates"
echo "   🌍 CORS configuration"
echo "   🔌 API endpoints and rate limiting"
echo "   📚 Documentation sites"  
echo "   🤖 Robots.txt configuration"
echo "   ☁️  Azure-specific features"
echo ""

if [[ "${TEST_API_KEY}" != "your_test_api_key_here" ]]; then
    echo "   🔐 Authenticated endpoint tests"
else
    echo "   ⚠️  Authenticated tests skipped (no API key)"
fi

echo ""
echo "📊 NEXT STEPS:"
echo "   1. Review detailed results in ${RESULTS_DIR}/"
echo "   2. Set up synthetic monitoring (24h)"
echo "   3. Monitor Application Insights dashboards"
echo "   4. Verify XHR calls from production portal"
echo ""
echo "🎯 AZURE CUTOVER VERIFICATION COMPLETE"
echo "   Production API: ${PRODUCTION_API}"
echo "   Production Docs: ${PRODUCTION_DOCS}"
echo "   Timestamp: $(date)"

# Create summary JSON for automated processing
cat > "${RESULTS_DIR}/verification-summary.json" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "production_api": "${PRODUCTION_API}",
  "staging_api": "${STAGING_API}", 
  "production_docs": "${PRODUCTION_DOCS}",
  "staging_docs": "${STAGING_DOCS}",
  "tests_completed": [
    "dns_tls",
    "cors_configuration", 
    "api_endpoints",
    "documentation_sites",
    "robots_txt",
    "azure_features"
  ],
  "authenticated_tests": $(if [[ "${TEST_API_KEY}" != "your_test_api_key_here" ]]; then echo "true"; else echo "false"; fi),
  "results_directory": "${RESULTS_DIR}",
  "total_result_files": ${total_files}
}
EOF

echo ""
echo "📄 Summary saved to: ${RESULTS_DIR}/verification-summary.json"