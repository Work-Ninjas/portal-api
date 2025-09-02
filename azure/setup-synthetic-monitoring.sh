#!/bin/bash

# 24-Hour Synthetic Monitoring Setup for Portal API
# Implements comprehensive monitoring with 1-5 minute intervals

set -e

echo "🎯 Setting up 24-hour synthetic monitoring for datahubportal.com"
echo "==============================================================="
echo ""

# Configuration
RESOURCE_GROUP="portal-api-rg"
LOCATION="eastus"
SUBSCRIPTION_ID="${AZURE_SUBSCRIPTION_ID:-$(az account show --query id -o tsv)}"
APPINSIGHTS_NAME="portal-api-insights"
API_KEY="${SYNTHETIC_MONITORING_API_KEY:-test-key-change-me}"

# Test locations for global monitoring
LOCATIONS=(
    "us-east-1"
    "us-west-2" 
    "eu-west-1"
    "ap-southeast-1"
    "us-central"
)

echo "📍 Monitoring from locations: ${LOCATIONS[*]}"
echo "🔑 API Key: ${API_KEY:0:8}..."
echo ""

# Create web tests with different intervals
echo "🌐 Creating web tests..."

# High-frequency health check (1 minute)
echo "  ⚡ Creating 1-minute health check..."
az monitor app-insights web-test create \
  --resource-group "${RESOURCE_GROUP}" \
  --name "portal-api-health-1min" \
  --app-insights-name "${APPINSIGHTS_NAME}" \
  --web-test-kind "ping" \
  --url "https://api.datahubportal.com/v1/health" \
  --frequency 60 \
  --timeout 30 \
  --enabled true \
  --locations "us-east-1" "us-west-2" "eu-west-1" \
  --expected-status-code 200

# Medium-frequency API endpoints (5 minutes)
echo "  🔄 Creating 5-minute API endpoint tests..."

# Contacts endpoint test
CONTACTS_TEST_XML=$(cat <<'EOF'
<WebTest Name="portal-api-contacts-5min" Id="$(NEWID)" Enabled="True" CssProjectStructure="" CssIteration="" Timeout="300" WorkItemIds="" xmlns="http://microsoft.com/schemas/VisualStudio/TeamTest/2010" Description="" CredentialUserName="" CredentialPassword="" PreAuthenticate="True" Proxy="default" StopOnError="False" RecordedResultFile="" ResultsLocale="">
  <Items>
    <Request Method="GET" Guid="$(NEWID)" Version="1.1" Url="https://api.datahubportal.com/v1/contacts" ThinkTime="0" Timeout="30" ParseDependentRequests="False" FollowRedirects="True" RecordResult="True" Cache="False" ResponseTimeGoal="0" Encoding="utf-8" ExpectedHttpStatusCode="401" ExpectedResponseUrl="" ReportingName="" IgnoreHttpStatusCode="False">
      <Headers>
        <Header Name="User-Agent" Value="Azure-Synthetic-Monitor/2.0" />
        <Header Name="Accept" Value="application/json" />
      </Headers>
    </Request>
  </Items>
</WebTest>
EOF
)

echo "${CONTACTS_TEST_XML}" | az monitor app-insights web-test create \
  --resource-group "${RESOURCE_GROUP}" \
  --name "portal-api-contacts-5min" \
  --app-insights-name "${APPINSIGHTS_NAME}" \
  --web-test-kind "multistep" \
  --frequency 300 \
  --timeout 60 \
  --enabled true \
  --locations "us-east-1" "us-west-2" \
  --web-test-xml /dev/stdin

# Jobs endpoint test
JOBS_TEST_XML=$(cat <<'EOF'
<WebTest Name="portal-api-jobs-5min" Id="$(NEWID)" Enabled="True" CssProjectStructure="" CssIteration="" Timeout="300" WorkItemIds="" xmlns="http://microsoft.com/schemas/VisualStudio/TeamTest/2010" Description="" CredentialUserName="" CredentialPassword="" PreAuthenticate="True" Proxy="default" StopOnError="False" RecordedResultFile="" ResultsLocale="">
  <Items>
    <Request Method="GET" Guid="$(NEWID)" Version="1.1" Url="https://api.datahubportal.com/v1/jobs" ThinkTime="0" Timeout="30" ParseDependentRequests="False" FollowRedirects="True" RecordResult="True" Cache="False" ResponseTimeGoal="0" Encoding="utf-8" ExpectedHttpStatusCode="401" ExpectedResponseUrl="" ReportingName="" IgnoreHttpStatusCode="False">
      <Headers>
        <Header Name="User-Agent" Value="Azure-Synthetic-Monitor/2.0" />
        <Header Name="Accept" Value="application/json" />
      </Headers>
    </Request>
  </Items>
</WebTest>
EOF
)

echo "${JOBS_TEST_XML}" | az monitor app-insights web-test create \
  --resource-group "${RESOURCE_GROUP}" \
  --name "portal-api-jobs-5min" \
  --app-insights-name "${APPINSIGHTS_NAME}" \
  --web-test-kind "multistep" \
  --frequency 300 \
  --timeout 60 \
  --enabled true \
  --locations "us-east-1" "us-west-2" \
  --web-test-xml /dev/stdin

# Documentation sites (5 minutes)
echo "  📚 Creating documentation monitoring..."
az monitor app-insights web-test create \
  --resource-group "${RESOURCE_GROUP}" \
  --name "portal-docs-prod-5min" \
  --app-insights-name "${APPINSIGHTS_NAME}" \
  --web-test-kind "ping" \
  --url "https://docs.datahubportal.com" \
  --frequency 300 \
  --timeout 30 \
  --enabled true \
  --locations "us-east-1" "us-west-2" "eu-west-1" \
  --expected-status-code 200

az monitor app-insights web-test create \
  --resource-group "${RESOURCE_GROUP}" \
  --name "portal-docs-staging-5min" \
  --app-insights-name "${APPINSIGHTS_NAME}" \
  --web-test-kind "ping" \
  --url "https://docs.staging.datahubportal.com" \
  --frequency 300 \
  --timeout 30 \
  --enabled true \
  --locations "us-east-1" \
  --expected-status-code 200

echo "✅ Web tests created successfully"
echo ""

# Create availability alerts
echo "🚨 Creating availability alerts..."

# Get Application Insights resource ID
APPINSIGHTS_ID=$(az monitor app-insights component show \
  --app "${APPINSIGHTS_NAME}" \
  --resource-group "${RESOURCE_GROUP}" \
  --query "id" -o tsv)

# Get Action Group ID
ACTION_GROUP_ID="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/microsoft.insights/actiongroups/portal-api-alerts"

# Health check alert (critical - 1 location failure)
az monitor metrics alert create \
  --name "portal-api-health-critical" \
  --resource-group "${RESOURCE_GROUP}" \
  --scopes "${APPINSIGHTS_ID}" \
  --condition "avg availabilityResults/availabilityPercentage < 100" \
  --window-size "5m" \
  --evaluation-frequency "1m" \
  --severity 0 \
  --description "Critical alert when health check fails from any location" \
  --action "${ACTION_GROUP_ID}"

# API endpoints alert (warning - multiple failures)
az monitor metrics alert create \
  --name "portal-api-endpoints-warning" \
  --resource-group "${RESOURCE_GROUP}" \
  --scopes "${APPINSIGHTS_ID}" \
  --condition "avg availabilityResults/availabilityPercentage < 95" \
  --window-size "10m" \
  --evaluation-frequency "5m" \
  --severity 2 \
  --description "Warning when API endpoint availability drops below 95%" \
  --action "${ACTION_GROUP_ID}"

# Documentation sites alert
az monitor metrics alert create \
  --name "portal-docs-availability" \
  --resource-group "${RESOURCE_GROUP}" \
  --scopes "${APPINSIGHTS_ID}" \
  --condition "avg availabilityResults/availabilityPercentage < 99" \
  --window-size "15m" \
  --evaluation-frequency "5m" \
  --severity 3 \
  --description "Alert when documentation sites availability drops" \
  --action "${ACTION_GROUP_ID}"

echo "✅ Availability alerts created"
echo ""

# Create custom log queries for monitoring
echo "📊 Creating custom monitoring queries..."

# Save monitoring queries to files for easy import
mkdir -p monitoring-queries

cat > monitoring-queries/api-performance-24h.kql << 'EOF'
// API Performance Overview - Last 24 Hours
availabilityResults
| where timestamp >= ago(24h)
| where name contains "portal-api"
| summarize 
    AvailabilityPct = avg(success) * 100,
    AvgDuration = avg(duration),
    P95Duration = percentile(duration, 95),
    P99Duration = percentile(duration, 99),
    TotalTests = count(),
    FailedTests = countif(success == false)
by bin(timestamp, 5m), name
| order by timestamp desc
EOF

cat > monitoring-queries/error-analysis-24h.kql << 'EOF' 
// Error Analysis - Last 24 Hours
availabilityResults  
| where timestamp >= ago(24h)
| where success == false
| summarize 
    ErrorCount = count(),
    ErrorRate = (count() * 100.0) / toscalar(availabilityResults | where timestamp >= ago(24h) | count())
by bin(timestamp, 15m), name, location
| order by timestamp desc, ErrorCount desc
EOF

cat > monitoring-queries/location-performance.kql << 'EOF'
// Performance by Location - Last 24 Hours
availabilityResults
| where timestamp >= ago(24h) 
| where name contains "portal-api"
| summarize
    AvailabilityPct = avg(success) * 100,
    AvgResponseTime = avg(duration),
    P95ResponseTime = percentile(duration, 95),
    TestCount = count()
by location, name
| order by AvailabilityPct asc, P95ResponseTime desc
EOF

cat > monitoring-queries/sla-report.kql << 'EOF'
// SLA Report - Last 7 Days  
availabilityResults
| where timestamp >= ago(7d)
| where name contains "portal-api"
| summarize 
    TotalTests = count(),
    SuccessfulTests = countif(success == true),
    FailedTests = countif(success == false),
    AvailabilityPct = (countif(success == true) * 100.0) / count(),
    AvgResponseTime = avg(duration),
    P95ResponseTime = percentile(duration, 95),
    P99ResponseTime = percentile(duration, 99)
by name
| extend SLAStatus = case(
    AvailabilityPct >= 99.9, "✅ Exceeds SLA",
    AvailabilityPct >= 99.5, "⚠️ Meets SLA", 
    "❌ Below SLA"
)
| order by AvailabilityPct desc
EOF

echo "✅ Monitoring queries saved to monitoring-queries/"
echo ""

# Create monitoring dashboard
echo "📈 Creating 24-hour monitoring dashboard..."

DASHBOARD_JSON=$(cat << 'EOF'
{
  "properties": {
    "lenses": [
      {
        "order": 0,
        "parts": [
          {
            "position": {"x": 0, "y": 0, "rowSpan": 3, "colSpan": 6},
            "metadata": {
              "inputs": [
                {
                  "name": "ComponentId",
                  "value": {"Name": "portal-api-insights", "ResourceGroup": "portal-api-rg"}
                },
                {
                  "name": "Query", 
                  "value": "availabilityResults | where timestamp >= ago(24h) | where name contains 'portal-api' | summarize AvailabilityPct = avg(success) * 100 by bin(timestamp, 5m), name | render timechart"
                },
                {
                  "name": "TimeRange",
                  "value": "P1D"
                }
              ],
              "type": "Extension/Microsoft_OperationsManagementSuite_Workspace/PartType/LogsDashboardPart",
              "settings": {
                "content": {
                  "title": "API Availability - 24h",
                  "subtitle": "Availability percentage by endpoint"
                }
              }
            }
          },
          {
            "position": {"x": 6, "y": 0, "rowSpan": 3, "colSpan": 6},
            "metadata": {
              "inputs": [
                {
                  "name": "ComponentId", 
                  "value": {"Name": "portal-api-insights", "ResourceGroup": "portal-api-rg"}
                },
                {
                  "name": "Query",
                  "value": "availabilityResults | where timestamp >= ago(24h) | summarize P95 = percentile(duration, 95), P99 = percentile(duration, 99) by bin(timestamp, 10m) | render timechart"
                }
              ],
              "type": "Extension/Microsoft_OperationsManagementSuite_Workspace/PartType/LogsDashboardPart",
              "settings": {
                "content": {
                  "title": "Response Time Percentiles",
                  "subtitle": "P95/P99 response times"
                }
              }
            }
          },
          {
            "position": {"x": 0, "y": 3, "rowSpan": 2, "colSpan": 4},
            "metadata": {
              "inputs": [
                {
                  "name": "ComponentId",
                  "value": {"Name": "portal-api-insights", "ResourceGroup": "portal-api-rg"}
                },
                {
                  "name": "Query",
                  "value": "availabilityResults | where timestamp >= ago(24h) | summarize AvailabilityPct = avg(success) * 100, AvgResponseTime = avg(duration) by location | order by AvailabilityPct desc"
                }
              ],
              "type": "Extension/Microsoft_OperationsManagementSuite_Workspace/PartType/LogsDashboardPart",
              "settings": {
                "content": {
                  "title": "Performance by Location",
                  "subtitle": "Last 24 hours"
                }
              }
            }
          },
          {
            "position": {"x": 4, "y": 3, "rowSpan": 2, "colSpan": 4},
            "metadata": {
              "inputs": [
                {
                  "name": "ComponentId",
                  "value": {"Name": "portal-api-insights", "ResourceGroup": "portal-api-rg"}
                },
                {
                  "name": "Query",
                  "value": "availabilityResults | where timestamp >= ago(7d) | summarize TotalTests = count(), SuccessfulTests = countif(success == true), AvailabilityPct = (countif(success == true) * 100.0) / count() by name | extend SLAStatus = case(AvailabilityPct >= 99.9, '✅ Exceeds SLA', AvailabilityPct >= 99.5, '⚠️ Meets SLA', '❌ Below SLA')"
                }
              ],
              "type": "Extension/Microsoft_OperationsManagementSuite_Workspace/PartType/LogsDashboardPart",
              "settings": {
                "content": {
                  "title": "7-Day SLA Report",
                  "subtitle": "Target: 99.9% availability"
                }
              }
            }
          },
          {
            "position": {"x": 8, "y": 3, "rowSpan": 2, "colSpan": 4},
            "metadata": {
              "inputs": [
                {
                  "name": "ComponentId",
                  "value": {"Name": "portal-api-insights", "ResourceGroup": "portal-api-rg"}
                },
                {
                  "name": "Query",
                  "value": "availabilityResults | where timestamp >= ago(24h) and success == false | summarize ErrorCount = count() by bin(timestamp, 30m), name | render columnchart"
                }
              ],
              "type": "Extension/Microsoft_OperationsManagementSuite_Workspace/PartType/LogsDashboardPart",
              "settings": {
                "content": {
                  "title": "Failures by Endpoint",
                  "subtitle": "Last 24 hours"
                }
              }
            }
          }
        ]
      }
    ]
  },
  "location": "eastus"
}
EOF
)

echo "${DASHBOARD_JSON}" | az portal dashboard create \
  --resource-group "${RESOURCE_GROUP}" \
  --name "portal-api-24h-monitoring" \
  --input-path /dev/stdin

echo "✅ 24-hour monitoring dashboard created"
echo ""

# Create synthetic monitoring status page
echo "📄 Creating monitoring status script..."

cat > check-synthetic-status.sh << 'EOF'
#!/bin/bash

# Check synthetic monitoring status
echo "🎯 Portal API Synthetic Monitoring Status"
echo "========================================"
echo ""

# Get latest availability results
az monitor app-insights query \
  --app portal-api-insights \
  --analytics-query "
    availabilityResults 
    | where timestamp >= ago(1h)
    | summarize 
        LatestTest = max(timestamp),
        AvailabilityPct = avg(success) * 100,
        AvgResponseTime = avg(duration),
        TestCount = count()
    by name
    | order by name asc
  " \
  --output table

echo ""
echo "🕐 Last updated: $(date)"
EOF

chmod +x check-synthetic-status.sh

echo "✅ Status check script created: check-synthetic-status.sh"
echo ""

# Output summary
echo "📋 24-Hour Synthetic Monitoring Setup Complete"
echo "=============================================="
echo ""
echo "✅ CONFIGURED TESTS:"
echo "   🏥 Health Check: Every 1 minute (3 locations)"
echo "   🔌 API Endpoints: Every 5 minutes (2 locations)" 
echo "   📚 Documentation: Every 5 minutes (3 locations)"
echo ""
echo "🚨 ALERT RULES:"
echo "   🔴 Health Critical: Any location failure (1min eval)"
echo "   🟡 API Warning: <95% availability (5min eval)"
echo "   🟠 Docs Alert: <99% availability (15min eval)"
echo ""
echo "📊 MONITORING RESOURCES:"
echo "   📈 Dashboard: portal-api-24h-monitoring"
echo "   📁 Queries: monitoring-queries/*.kql"
echo "   🔍 Status Check: ./check-synthetic-status.sh"
echo ""
echo "🌍 MONITORING LOCATIONS:"
for location in "${LOCATIONS[@]}"; do
    echo "   📍 ${location}"
done
echo ""
echo "⏰ MONITORING SCHEDULE:"
echo "   📊 Health checks: 24/7 every minute"
echo "   🔄 API endpoints: 24/7 every 5 minutes" 
echo "   📚 Documentation: 24/7 every 5 minutes"
echo "   📧 Alerts: Real-time notifications"
echo ""
echo "🎯 MONITORING URLS:"
APPINSIGHTS_ID=$(az monitor app-insights component show --app "${APPINSIGHTS_NAME}" --resource-group "${RESOURCE_GROUP}" --query "id" -o tsv)
echo "   📊 Dashboard: https://portal.azure.com/#dashboard/arm${RESOURCE_GROUP}/portal-api-24h-monitoring"
echo "   🔍 Application Insights: https://portal.azure.com/#@/resource${APPINSIGHTS_ID}"
echo "   📈 Availability: https://portal.azure.com/#@/resource${APPINSIGHTS_ID}/availability"
echo ""
echo "✅ 24-HOUR SYNTHETIC MONITORING IS NOW ACTIVE!"
echo "🚀 Tests will begin within 5-10 minutes"
echo "📊 Full metrics available in 15-30 minutes"
EOF