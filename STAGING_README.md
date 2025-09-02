# Portal API - Staging Deployment Guide

## Overview

This guide covers the complete staging environment setup for Portal API v1.0.0-rc.1, including synthetic monitoring, load testing, and production readiness validation.

## Environment Architecture

### Staging Infrastructure
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Load Balancer │────│  Portal API      │────│   RPC Backend   │
│   (nginx/ALB)   │    │  (2 instances)   │    │   (mock/real)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         │                        │                        │
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Monitoring    │    │     Logging      │    │    Storage      │
│ (Prometheus+    │    │   (ELK Stack)    │    │   (S3/MinIO)    │
│  Grafana)       │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Prerequisites

### System Requirements
- **Kubernetes**: v1.25+ or Docker Swarm
- **Node.js**: v18+ for application runtime
- **Memory**: 2GB+ per API instance
- **CPU**: 2+ cores per API instance
- **Storage**: 50GB+ for logs and monitoring

### Required Tools
```bash
# Install required CLI tools
npm install -g @postman/newman  # API testing
kubectl # If using Kubernetes
docker # Container management
curl jq # API testing utilities
```

## Deployment Steps

### Step 1: Environment Configuration

Create staging environment variables:

```bash
# staging.env
NODE_ENV=staging
PORT=3000
LOG_LEVEL=info

# API Configuration
CORS_ORIGIN=https://staging.portal.example.com
RATE_LIMIT_MAX_REQUESTS=60
RATE_LIMIT_WINDOW_MS=60000

# RPC Configuration  
RPC_BASE_URL=https://staging-rpc.example.com
RPC_TIMEOUT_MS=5000

# Security Configuration
STORAGE_SECRET_KEY=staging_secure_secret_key_here
ALLOWED_ORIGINS=https://staging.portal.example.com,https://staging-admin.portal.example.com

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
```

### Step 2: Container Deployment

#### Docker Compose Setup
```yaml
# docker-compose.staging.yml
version: '3.8'
services:
  portal-api-1:
    image: portal-api:v1.0.0-rc.1
    ports:
      - "3001:3000"
    env_file: staging.env
    environment:
      INSTANCE_ID: "staging-1"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  portal-api-2:
    image: portal-api:v1.0.0-rc.1  
    ports:
      - "3002:3000"
    env_file: staging.env
    environment:
      INSTANCE_ID: "staging-2"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.staging.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - portal-api-1
      - portal-api-2

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--web.enable-lifecycle'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: staging_admin_pass
    volumes:
      - grafana-data:/var/lib/grafana

volumes:
  grafana-data:
```

#### Deployment Commands
```bash
# Build and deploy
docker-compose -f docker-compose.staging.yml up -d

# Verify deployment
docker-compose ps
curl -H "Authorization: Bearer staging_token" \
  http://localhost/v1/health
```

### Step 3: Load Balancer Configuration

#### Nginx Configuration
```nginx
# nginx.staging.conf
upstream portal_api {
    least_conn;
    server portal-api-1:3000 max_fails=3 fail_timeout=30s;
    server portal-api-2:3000 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name staging.portal-api.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name staging.portal-api.example.com;

    ssl_certificate /etc/nginx/ssl/staging.crt;
    ssl_certificate_key /etc/nginx/ssl/staging.key;
    ssl_protocols TLSv1.2 TLSv1.3;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=60r/m;
    limit_req zone=api burst=100 nodelay;

    # Health check endpoint (bypass rate limiting)
    location /v1/health {
        proxy_pass http://portal_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API endpoints
    location /v1/ {
        proxy_pass http://portal_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeout configuration
        proxy_connect_timeout 5s;
        proxy_send_timeout 10s;
        proxy_read_timeout 10s;
    }

    # Metrics endpoint (monitoring only)
    location /metrics {
        proxy_pass http://portal_api;
        allow 10.0.0.0/8;
        allow 172.16.0.0/12;
        allow 192.168.0.0/16;
        deny all;
    }
}
```

## Synthetic Monitoring Setup

### Health Check Monitoring
```bash
#!/bin/bash
# synthetic-health.sh

ENDPOINTS=(
    "https://staging.portal-api.example.com/v1/health"
    "https://staging.portal-api.example.com/v1/contacts"  
    "https://staging.portal-api.example.com/v1/jobs"
    "https://staging.portal-api.example.com/v1/jobs/job_staging01/files"
)

API_KEY="staging_synthetic_test_token"

for endpoint in "${ENDPOINTS[@]}"; do
    echo "Testing: $endpoint"
    
    response=$(curl -s -w "%{http_code},%{time_total}" \
        -H "Authorization: Bearer $API_KEY" \
        "$endpoint")
    
    http_code=$(echo $response | cut -d',' -f1)
    time_total=$(echo $response | cut -d',' -f2)
    
    if [ "$http_code" -eq 200 ]; then
        echo "✅ SUCCESS: $endpoint (${time_total}s)"
    else
        echo "❌ FAILED: $endpoint (HTTP $http_code)"
        # Send alert to monitoring system
        curl -X POST "https://alerts.example.com/webhook" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"Staging health check failed: $endpoint (HTTP $http_code)\"}"
    fi
done
```

### Cron Job Setup
```bash
# Add to crontab for continuous monitoring
# Run every minute
* * * * * /opt/scripts/synthetic-health.sh

# Run comprehensive tests every 5 minutes  
*/5 * * * * /opt/scripts/comprehensive-test.sh
```

## Load Testing

### Newman-based Load Testing
```bash
#!/bin/bash
# load-test.sh

echo "Starting load test for Portal API staging..."

# Light load test (1x expected QPS)
echo "Phase 1: Light load (60 seconds, 1 req/sec)"
newman run Portal_API_Collection.json \
    -e Staging_Environment.json \
    --iteration-count 60 \
    --delay-request 1000 \
    --reporters cli,json \
    --reporter-json-export load-test-light.json

# Peak load test (1.5x expected QPS)
echo "Phase 2: Peak load (120 seconds, 1.5 req/sec)"  
newman run Portal_API_Collection.json \
    -e Staging_Environment.json \
    --iteration-count 180 \
    --delay-request 667 \
    --reporters cli,json \
    --reporter-json-export load-test-peak.json

# Analyze results
echo "Load test analysis:"
jq '.run.stats' load-test-light.json
jq '.run.stats' load-test-peak.json

# Check for failures
light_failures=$(jq '.run.stats.tests.failed' load-test-light.json)
peak_failures=$(jq '.run.stats.tests.failed' load-test-peak.json)

if [ "$light_failures" -gt 0 ] || [ "$peak_failures" -gt 0 ]; then
    echo "❌ Load test failures detected!"
    exit 1
else
    echo "✅ Load tests passed successfully!"
fi
```

### Load Test SLO Validation

Expected results for staging load test:
- **p95 latency**: < SLO targets (Health: 50ms, Contacts: 300ms, etc.)
- **Error rate**: < 1% overall
- **2xx/3xx ratio**: > 99%
- **Rate limit behavior**: 429 responses when exceeding limits
- **Circuit breaker**: No OPEN states during normal operation

## Key Rotation Drill

### Staging Key Rotation Procedure
```bash
#!/bin/bash
# key-rotation-drill.sh

echo "🔄 Starting key rotation drill in staging..."

# Step 1: Generate new key
NEW_KEY=$(openssl rand -hex 32)
echo "Generated new storage key: ${NEW_KEY:0:8}..."

# Step 2: Update environment with both keys (dual-key phase)
kubectl create secret generic portal-api-secrets-new \
    --from-literal=STORAGE_SECRET_KEY_PRIMARY="$NEW_KEY" \
    --from-literal=STORAGE_SECRET_KEY_SECONDARY="$OLD_KEY"

# Step 3: Deploy with dual-key support
kubectl patch deployment portal-api \
    -p '{"spec":{"template":{"spec":{"containers":[{"name":"portal-api","env":[{"name":"STORAGE_SECRET_KEY_PRIMARY","valueFrom":{"secretKeyRef":{"name":"portal-api-secrets-new","key":"STORAGE_SECRET_KEY_PRIMARY"}}},{"name":"STORAGE_SECRET_KEY_SECONDARY","valueFrom":{"secretKeyRef":{"name":"portal-api-secrets-new","key":"STORAGE_SECRET_KEY_SECONDARY"}}}]}]}}}}'

# Step 4: Validate dual-key operation
echo "Validating dual-key operation..."
sleep 30
curl -H "Authorization: Bearer staging_token" \
    "https://staging.portal-api.example.com/v1/jobs/job_staging01/files" | \
    jq '.data[0].signed_url' | grep -q "signature=" && echo "✅ URL generation working"

# Step 5: Switch to primary key only
kubectl patch deployment portal-api \
    -p '{"spec":{"template":{"spec":{"containers":[{"name":"portal-api","env":[{"name":"STORAGE_SECRET_KEY","valueFrom":{"secretKeyRef":{"name":"portal-api-secrets-new","key":"STORAGE_SECRET_KEY_PRIMARY"}}}]}]}}}}'

# Step 6: Validate single key operation  
echo "Validating primary key operation..."
sleep 30
curl -H "Authorization: Bearer staging_token" \
    "https://staging.portal-api.example.com/v1/jobs/job_staging01/files" | \
    jq '.data[0].signed_url' | grep -q "signature=" && echo "✅ Primary key working"

# Step 7: Revoke old key (cleanup)
kubectl delete secret portal-api-secrets-old

echo "✅ Key rotation drill completed successfully!"
```

## Backup/Restore Validation

### Configuration Backup
```bash
#!/bin/bash
# backup-staging-config.sh

BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups/staging/$BACKUP_DATE"

mkdir -p "$BACKUP_DIR"

# Backup Kubernetes configurations
kubectl get configmap portal-api-config -o yaml > "$BACKUP_DIR/configmap.yaml"
kubectl get secret portal-api-secrets -o yaml > "$BACKUP_DIR/secrets.yaml"
kubectl get deployment portal-api -o yaml > "$BACKUP_DIR/deployment.yaml"
kubectl get service portal-api -o yaml > "$BACKUP_DIR/service.yaml"

# Backup application configuration
cp staging.env "$BACKUP_DIR/"
cp nginx.staging.conf "$BACKUP_DIR/"

# Create backup manifest
cat > "$BACKUP_DIR/manifest.json" << EOF
{
  "backup_date": "$BACKUP_DATE",
  "environment": "staging",
  "version": "v1.0.0-rc.1",
  "components": [
    "kubernetes-configs",
    "application-configs", 
    "nginx-config"
  ]
}
EOF

echo "Backup completed: $BACKUP_DIR"
```

### Restore Validation
```bash
#!/bin/bash
# restore-test.sh

BACKUP_DIR="/opt/backups/staging/latest"

echo "Testing restore from: $BACKUP_DIR"

# Apply Kubernetes configs
kubectl apply -f "$BACKUP_DIR/configmap.yaml"
kubectl apply -f "$BACKUP_DIR/secrets.yaml"
kubectl apply -f "$BACKUP_DIR/deployment.yaml"
kubectl apply -f "$BACKUP_DIR/service.yaml"

# Wait for rollout
kubectl rollout status deployment/portal-api --timeout=300s

# Validate restore
sleep 30
curl -f -H "Authorization: Bearer staging_token" \
    "https://staging.portal-api.example.com/v1/health" && \
    echo "✅ Restore validation successful"
```

## Staging Environment URLs

### API Endpoints
- **Base URL**: `https://staging.portal-api.example.com`
- **Health Check**: `https://staging.portal-api.example.com/v1/health`
- **API Docs**: `https://staging.portal-api.example.com/docs` (if enabled)
- **Metrics**: `https://staging.portal-api.example.com/metrics` (internal)

### Monitoring Dashboards
- **Grafana**: `https://staging-monitoring.example.com:3000`
- **Prometheus**: `https://staging-monitoring.example.com:9090`
- **Logs**: `https://staging-logs.example.com` (ELK/Loki)

### Test Resources
- **Postman Workspace**: [Portal API Staging](https://staging-postman.example.com)
- **Load Test Results**: `https://staging-reports.example.com/load-tests`

## Production Readiness Checklist

### Security Validation
- [ ] HTTPS/TLS properly configured
- [ ] Security headers present (HSTS, CSP, etc.)
- [ ] API keys rotated and secured
- [ ] CORS properly restricted to staging origins
- [ ] Rate limiting functioning correctly

### Performance Validation  
- [ ] Load test passes with 1.5x expected QPS
- [ ] All SLO targets met under load
- [ ] Circuit breakers function correctly
- [ ] Memory/CPU usage within acceptable limits

### Reliability Validation
- [ ] Health checks operational
- [ ] Synthetic monitoring active (1-5 min intervals)
- [ ] Backup/restore procedures tested
- [ ] Key rotation drill successful
- [ ] Rollback procedures validated

### Monitoring Validation
- [ ] Prometheus metrics collection active
- [ ] Grafana dashboards configured
- [ ] Alerting rules configured and tested  
- [ ] Log aggregation functioning
- [ ] Trace propagation working

### Operational Validation
- [ ] Runbook procedures tested
- [ ] On-call escalation paths validated
- [ ] Documentation complete and accurate
- [ ] Team training on staging environment complete

## Troubleshooting

### Common Issues

#### High Memory Usage
```bash
# Check container memory
docker stats portal-api-staging-1

# Analyze heap dumps if needed
kubectl exec portal-api-pod -- node --heapsnapshot /tmp/heap.snapshot
```

#### Circuit Breaker Issues
```bash
# Check circuit breaker status
curl "https://staging.portal-api.example.com/v1/health" | jq .circuitBreakers

# Reset circuit breakers (if needed)
kubectl rollout restart deployment/portal-api
```

#### Rate Limiting Problems
```bash
# Check rate limit headers
curl -D- "https://staging.portal-api.example.com/v1/health"

# Validate rate limit configuration  
kubectl get configmap portal-api-config -o yaml | grep RATE_LIMIT
```

### Log Analysis
```bash
# View recent logs
kubectl logs deployment/portal-api --tail=100 -f

# Search for errors
kubectl logs deployment/portal-api | grep ERROR

# Check specific patterns
kubectl logs deployment/portal-api | grep "High latency\|Circuit breaker\|Rate limit"
```

## Next Steps

After successful staging validation:

1. **RC Tag Creation**: Tag both repositories with `v1.0.0-rc.1`
2. **Load Test Report**: Generate comprehensive performance report
3. **Security Audit**: Complete final security validation
4. **Production Deployment**: Execute canary deployment plan
5. **Go-Live**: Full production rollout with monitoring

**Environment Owner**: Platform Engineering Team  
**Staging URL**: `https://staging.portal-api.example.com`  
**Support Contact**: staging-support@example.com