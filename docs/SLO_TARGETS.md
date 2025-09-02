# Service Level Objectives (SLO) & Error Budgets

## Overview

This document defines the Service Level Objectives (SLOs) for the Portal API v1.0.0-rc.1, establishing performance and reliability targets for production operations.

## SLO Definitions

### 1. Request Latency SLOs

| Endpoint | p95 Target | p99 Target | Measurement Window |
|----------|------------|------------|-------------------|
| `GET /v1/health` | < 50ms | < 100ms | 5 minutes |
| `GET /v1/contacts` | < 300ms | < 800ms | 5 minutes |
| `GET /v1/contacts/{id}` | < 200ms | < 500ms | 5 minutes |
| `GET /v1/jobs` | < 400ms | < 1000ms | 5 minutes |
| `GET /v1/jobs/{jobId}/files` | < 500ms | < 1200ms | 5 minutes |

**Alert Thresholds:**
- **Warning**: p95 exceeds target for 5+ minutes
- **Critical**: p95 exceeds 2x target for 2+ minutes OR p99 exceeds target for 10+ minutes

### 2. Availability SLO

| Metric | Target | Measurement Window |
|--------|--------|--------------------|
| **Uptime** | 99.9% (43.2 min downtime/month) | 30 days rolling |
| **Success Rate** | ≥ 99.0% (2xx/3xx responses) | 5 minutes |
| **Error Rate** | ≤ 1.0% (4xx/5xx responses) | 5 minutes |

**Alert Thresholds:**
- **Warning**: Error rate > 5% for 2+ minutes
- **Critical**: Error rate > 10% for 1+ minute OR availability < 99.5% over 24h

### 3. Reliability SLOs

| Component | Target | Measurement |
|-----------|--------|-------------|
| **Circuit Breaker Recovery** | < 60 seconds | Time to CLOSED state after backend recovery |
| **Rate Limit Accuracy** | ± 5% of configured limits | Actual vs configured rate limits |
| **Signed URL Generation** | 99.5% success rate | URL generation without errors |

### 4. Security SLOs

| Security Control | Target | Measurement |
|------------------|--------|-------------|
| **Authentication Latency** | < 10ms | Token validation time |
| **CORS Policy Enforcement** | 100% compliance | Blocked invalid origins |
| **Signed URL Expiry** | 100% accuracy | URLs expire within 15 ± 1 minutes |

## Error Budgets

### Monthly Error Budget Allocation

Based on 99.9% availability target = 0.1% monthly error budget (43.2 minutes downtime)

| Error Type | Budget Allocation | Max Downtime | Alert Threshold |
|------------|-------------------|--------------|------------------|
| **Planned Maintenance** | 40% (17.3 min) | Scheduled windows | Pre-planned |
| **Infrastructure Issues** | 30% (13.0 min) | Cloud provider, networking | Immediate |
| **Application Errors** | 20% (8.6 min) | Code bugs, logic errors | Immediate |
| **External Dependencies** | 10% (4.3 min) | RPC backend, database | 5+ minutes |

### Error Budget Consumption Rules

1. **Green State** (< 25% consumed): Normal operations, feature development allowed
2. **Yellow State** (25-75% consumed): Enhanced monitoring, deployment freeze consideration  
3. **Red State** (> 75% consumed): Deployment freeze, focus on reliability improvements
4. **Budget Exhausted**: Emergency-only changes, post-mortem required

### Weekly Error Budget Tracking

| Week | Availability Target | Error Budget Available | Consumption Rate Alert |
|------|-------|----------|----------|
| Week 1 | 99.9% | 25% of monthly budget | > 30% consumption |
| Week 2 | 99.9% | 50% of monthly budget | > 60% consumption |  
| Week 3 | 99.9% | 75% of monthly budget | > 85% consumption |
| Week 4 | 99.9% | 100% of monthly budget | > 95% consumption |

## Monitoring and Alerting

### SLI Collection Methods

1. **Latency Metrics**: Application metrics via `/metrics` endpoint
2. **Availability**: Health check monitoring + synthetic tests  
3. **Error Rates**: HTTP status code tracking in logs and metrics
4. **Circuit Breaker**: Health endpoint degradation status

### Synthetic Monitoring Setup

```yaml
# Synthetic check configuration
endpoints:
  - url: "https://portal-api.example.com/v1/health"
    interval: "1m"
    timeout: "5s"
    expected_status: 200
    
  - url: "https://portal-api.example.com/v1/contacts"
    interval: "2m" 
    timeout: "10s"
    headers:
      Authorization: "Bearer synthetic_test_token"
    expected_status: 200
    
  - url: "https://portal-api.example.com/v1/jobs/job_synthetic_test/files"
    interval: "5m"
    timeout: "15s" 
    headers:
      Authorization: "Bearer synthetic_test_token"
    expected_status: 200
```

### Alert Escalation

1. **L1 - Warning** (5min violation): Slack notification to #portal-api-alerts
2. **L2 - Critical** (2min violation): PagerDuty alert to on-call engineer
3. **L3 - Emergency** (1min violation): Phone/SMS escalation to engineering manager
4. **L4 - Outage** (Service down): Executive notification + incident commander activation

## Performance Baselines

### Expected Request Rates

| Endpoint | Expected QPS | Peak QPS (2x) | Load Test Target |
|----------|--------------|---------------|------------------|
| `/v1/health` | 1.0 | 2.0 | 3.0 (1.5x peak) |
| `/v1/contacts` | 5.0 | 10.0 | 15.0 |
| `/v1/contacts/{id}` | 8.0 | 16.0 | 24.0 |
| `/v1/jobs` | 3.0 | 6.0 | 9.0 |
| `/v1/jobs/{jobId}/files` | 2.0 | 4.0 | 6.0 |

### Resource Utilization Targets

| Resource | Normal Load | Peak Load | Alert Threshold |
|----------|-------------|-----------|-----------------|
| **CPU Usage** | < 40% | < 70% | > 80% for 5min |
| **Memory Usage** | < 60% | < 80% | > 85% for 2min |
| **Network I/O** | < 100 Mbps | < 200 Mbps | > 500 Mbps |
| **Disk I/O** | < 50 IOPS | < 100 IOPS | > 200 IOPS |

## Disaster Recovery SLOs

| Recovery Scenario | RTO (Recovery Time) | RPO (Data Loss) |
|-------------------|---------------------|-----------------|
| **Application Restart** | < 2 minutes | 0 (stateless) |
| **Database Failover** | < 5 minutes | < 1 minute |
| **Full Region Outage** | < 30 minutes | < 5 minutes |
| **Complete Data Center Loss** | < 2 hours | < 15 minutes |

## SLO Review and Updates

- **Monthly Review**: SLO achievement vs targets, error budget consumption
- **Quarterly Review**: SLO target adjustments based on user experience and business needs
- **Annual Review**: Complete SLO framework evaluation and business alignment

**Next Review Date**: 2025-10-01  
**SLO Owner**: Platform Engineering Team  
**Business Stakeholder**: Product Management Team