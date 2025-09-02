#!/bin/bash

# Portal API Azure Monitoring Deployment Script
# This script deploys Application Insights, Log Analytics, Alerts, and Synthetic Monitoring

set -e

# Configuration
RESOURCE_GROUP="portal-api-rg"
LOCATION="eastus"
SUBSCRIPTION_ID="${AZURE_SUBSCRIPTION_ID:-$(az account show --query id -o tsv)}"
APP_NAME="portal-api"
WORKSPACE_NAME="${APP_NAME}-logs"
APPINSIGHTS_NAME="${APP_NAME}-insights"

echo "🚀 Deploying Portal API monitoring infrastructure..."
echo "Resource Group: ${RESOURCE_GROUP}"
echo "Location: ${LOCATION}"
echo "Subscription: ${SUBSCRIPTION_ID}"

# Create Log Analytics Workspace
echo "📊 Creating Log Analytics Workspace..."
az monitor log-analytics workspace create \
  --resource-group "${RESOURCE_GROUP}" \
  --workspace-name "${WORKSPACE_NAME}" \
  --location "${LOCATION}" \
  --sku "PerGB2018" \
  --retention-time 30 \
  --query "id" -o tsv

# Get workspace ID
WORKSPACE_ID=$(az monitor log-analytics workspace show \
  --resource-group "${RESOURCE_GROUP}" \
  --workspace-name "${WORKSPACE_NAME}" \
  --query "id" -o tsv)

echo "✅ Log Analytics Workspace created: ${WORKSPACE_ID}"

# Create Application Insights
echo "🔍 Creating Application Insights..."
az monitor app-insights component create \
  --app "${APPINSIGHTS_NAME}" \
  --location "${LOCATION}" \
  --resource-group "${RESOURCE_GROUP}" \
  --application-type web \
  --workspace "${WORKSPACE_ID}" \
  --query "instrumentationKey" -o tsv

# Get Application Insights details
APPINSIGHTS_KEY=$(az monitor app-insights component show \
  --app "${APPINSIGHTS_NAME}" \
  --resource-group "${RESOURCE_GROUP}" \
  --query "instrumentationKey" -o tsv)

APPINSIGHTS_CONNECTION_STRING=$(az monitor app-insights component show \
  --app "${APPINSIGHTS_NAME}" \
  --resource-group "${RESOURCE_GROUP}" \
  --query "connectionString" -o tsv)

APPINSIGHTS_ID=$(az monitor app-insights component show \
  --app "${APPINSIGHTS_NAME}" \
  --resource-group "${RESOURCE_GROUP}" \
  --query "id" -o tsv)

echo "✅ Application Insights created:"
echo "  Instrumentation Key: ${APPINSIGHTS_KEY}"
echo "  Connection String: ${APPINSIGHTS_CONNECTION_STRING}"

# Create Action Group for alerts
echo "🚨 Creating Action Group..."
az monitor action-group create \
  --resource-group "${RESOURCE_GROUP}" \
  --name "portal-api-alerts" \
  --short-name "portalapi" \
  --email-receivers "ops-team=ops@datahubportal.com"

ACTION_GROUP_ID="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/microsoft.insights/actiongroups/portal-api-alerts"

echo "✅ Action Group created: ${ACTION_GROUP_ID}"

# Create metric alerts
echo "⚠️  Creating metric alerts..."

# High error rate alert
az monitor metrics alert create \
  --name "portal-api-high-error-rate" \
  --resource-group "${RESOURCE_GROUP}" \
  --scopes "${APPINSIGHTS_ID}" \
  --condition "avg requests/failed > 5" \
  --window-size "5m" \
  --evaluation-frequency "1m" \
  --severity 2 \
  --description "Alert when API error rate exceeds 5%" \
  --action "${ACTION_GROUP_ID}"

# High response time alert  
az monitor metrics alert create \
  --name "portal-api-high-response-time" \
  --resource-group "${RESOURCE_GROUP}" \
  --scopes "${APPINSIGHTS_ID}" \
  --condition "avg requests/duration > 2000" \
  --window-size "10m" \
  --evaluation-frequency "5m" \
  --severity 3 \
  --description "Alert when API p95 response time exceeds 2000ms" \
  --action "${ACTION_GROUP_ID}"

echo "✅ Metric alerts created successfully"

# Create availability tests
echo "🌐 Creating availability tests..."

# Health check test
HEALTH_TEST_CONFIG='{
  "webTestName": "portal-api-health-check",
  "description": "Health check endpoint monitoring",
  "url": "https://api.datahubportal.com/v1/health",
  "expectedHttpStatusCode": 200,
  "webTestKind": "ping",
  "frequency": 300,
  "timeout": 30,
  "enabled": true,
  "locations": [
    {"Id": "us-east-1"},
    {"Id": "us-west-2"},
    {"Id": "eu-west-1"}
  ]
}'

az monitor app-insights web-test create \
  --resource-group "${RESOURCE_GROUP}" \
  --name "portal-api-health-check" \
  --app-insights-name "${APPINSIGHTS_NAME}" \
  --web-test-kind "ping" \
  --url "https://api.datahubportal.com/v1/health" \
  --frequency 300 \
  --timeout 30 \
  --enabled true \
  --locations "us-east-1" "us-west-2" "eu-west-1"

# Contacts endpoint test
az monitor app-insights web-test create \
  --resource-group "${RESOURCE_GROUP}" \
  --name "portal-api-contacts-endpoint" \
  --app-insights-name "${APPINSIGHTS_NAME}" \
  --web-test-kind "ping" \
  --url "https://api.datahubportal.com/v1/contacts" \
  --frequency 300 \
  --timeout 30 \
  --enabled true \
  --locations "us-east-1" "us-west-2" \
  --headers "Authorization=Bearer \${SYNTHETIC_TEST_API_KEY}"

echo "✅ Availability tests created successfully"

# Create custom dashboard
echo "📈 Creating monitoring dashboard..."
DASHBOARD_JSON=$(cat << 'EOF'
{
  "properties": {
    "lenses": [
      {
        "order": 0,
        "parts": [
          {
            "position": {"x": 0, "y": 0, "rowSpan": 2, "colSpan": 6},
            "metadata": {
              "inputs": [
                {
                  "name": "ComponentId",
                  "value": {"Name": "portal-api-insights", "ResourceGroup": "portal-api-rg"}
                },
                {
                  "name": "Query",
                  "value": "requests | where timestamp >= ago(1h) | summarize Total = count(), Success = countif(success == true), Failed = countif(success == false) | extend SuccessRate = (Success * 100.0) / Total | project SuccessRate, Total, Success, Failed"
                }
              ],
              "type": "Extension/Microsoft_OperationsManagementSuite_Workspace/PartType/LogsDashboardPart"
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

az portal dashboard create \
  --resource-group "${RESOURCE_GROUP}" \
  --name "portal-api-dashboard" \
  --input-path /dev/stdin <<< "${DASHBOARD_JSON}"

echo "✅ Dashboard created successfully"

# Output environment variables for Container Apps
echo ""
echo "🔧 Environment variables for Container Apps:"
echo "APPLICATIONINSIGHTS_CONNECTION_STRING=\"${APPINSIGHTS_CONNECTION_STRING}\""
echo "APPINSIGHTS_INSTRUMENTATIONKEY=\"${APPINSIGHTS_KEY}\""
echo ""
echo "🎯 Add these to your Container Apps environment variables:"
echo "  - APPLICATIONINSIGHTS_CONNECTION_STRING"
echo "  - APPINSIGHTS_INSTRUMENTATIONKEY"
echo "  - AZURE_LOG_LEVEL=info"
echo ""
echo "📊 Monitoring URLs:"
echo "  - Application Insights: https://portal.azure.com/#@/resource${APPINSIGHTS_ID}"
echo "  - Log Analytics: https://portal.azure.com/#@/resource${WORKSPACE_ID}"
echo "  - Dashboard: https://portal.azure.com/#dashboard/arm${RESOURCE_GROUP}/portal-api-dashboard"
echo ""
echo "✅ Portal API monitoring infrastructure deployed successfully!"
echo "🚀 Synthetic monitoring will start in 5-10 minutes"
echo "📈 Metrics and logs will be available within 15 minutes"