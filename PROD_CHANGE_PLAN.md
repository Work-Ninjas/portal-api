# Production Change Plan - Portal API v1.0.0

## Change Summary

**Change ID**: CHG-2025090201  
**Change Type**: Major Release (New API Version)  
**Risk Level**: Medium  
**Business Impact**: Low (backward compatible)  

**Change Description**: Deploy Portal API v1.0.0 with enhanced security, reliability, and observability features including signed URL generation, circuit breakers, advanced metrics, and production-hardened security controls.

## Change Details

### Components Affected
- **Portal API Application**: Upgrade from v1.0.0-rc.0 to v1.0.0
- **Load Balancer Configuration**: Canary routing rules
- **Monitoring Systems**: New Prometheus metrics and Grafana dashboards
- **Security Configuration**: Enhanced CORS and rate limiting

### Infrastructure Impact
- **Servers**: 4 production API instances (2 primary, 2 canary)
- **Load Balancer**: AWS ALB with weighted routing
- **Database**: No schema changes (read-only API)
- **Storage**: Enhanced signed URL generation service

## Implementation Plan

### Phase 1: Pre-Deployment (T-60 to T0)
**Duration**: 60 minutes  
**Team**: Platform Engineering (3 engineers)

#### Tasks
1. **Environment Validation** (15 min)
   - Verify production environment health
   - Confirm monitoring systems operational
   - Validate backup and rollback procedures

2. **Configuration Deployment** (20 min)
   - Deploy canary load balancer rules
   - Update security configurations
   - Configure new monitoring dashboards

3. **Final Testing** (15 min)
   - Execute pre-deployment smoke tests
   - Validate synthetic monitoring
   - Confirm rollback readiness

4. **Stakeholder Notification** (10 min)
   - Announce maintenance window start
   - Brief on-call team on procedures
   - Final go/no-go decision

### Phase 2: Canary Deployment (T0 to T+180)
**Duration**: 180 minutes  
**Team**: Platform Engineering + SRE

#### Phase 2.1: Initial Canary (5% Traffic)
**Duration**: 15-30 minutes

```bash
# Deploy v1.0.0 to canary instances
kubectl set image deployment/portal-api-canary portal-api=portal-api:v1.0.0

# Configure 5% traffic split
kubectl patch service portal-api -p '{
  "spec": {
    "selector": {"app": "portal-api"},
    "sessionAffinity": "None"
  }
}'

# Update ALB target group weights
aws elbv2 modify-target-group --target-group-arn arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/portal-api-canary/1234567890123456 --health-check-interval-seconds 15

# Validation commands
curl -H "Authorization: Bearer prod_token" https://portal.example.com/v1/health
kubectl get pods -l app=portal-api-canary
```

**Success Criteria**:
- Health endpoint returns 200 for 5+ minutes
- Circuit breakers remain CLOSED
- Error rate < 1%
- p95 latency within SLO

#### Phase 2.2: Expanded Canary (25% Traffic)  
**Duration**: 30-45 minutes

```bash
# Increase traffic to 25%
aws elbv2 modify-listener --listener-arn arn:aws:elasticloadbalancing:us-east-1:123456789012:listener/app/portal-api/1234567890123456/1234567890123456 --default-actions '[{
  "Type": "forward",
  "ForwardConfig": {
    "TargetGroups": [
      {
        "TargetGroupArn": "arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/portal-api-prod/1234567890123456",
        "Weight": 75
      },
      {
        "TargetGroupArn": "arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/portal-api-canary/1234567890123456", 
        "Weight": 25
      }
    ]
  }
}]'

# Validation
newman run postman/Portal_API_Collection.json -e postman/Production_Environment.json --iteration-count 50
```

**Success Criteria**:
- All Phase 2.1 criteria maintained
- Files endpoint p95 < 500ms
- Signed URLs generated with 15min expiry
- Rate limiting headers present

#### Phase 2.3: Majority Canary (50% Traffic)
**Duration**: 45-60 minutes

```bash
# Increase traffic to 50%
aws elbv2 modify-listener --listener-arn arn:aws:elasticloadbalancing:us-east-1:123456789012:listener/app/portal-api/1234567890123456/1234567890123456 --default-actions '[{
  "Type": "forward", 
  "ForwardConfig": {
    "TargetGroups": [
      {
        "TargetGroupArn": "arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/portal-api-prod/1234567890123456",
        "Weight": 50
      },
      {
        "TargetGroupArn": "arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/portal-api-canary/1234567890123456",
        "Weight": 50  
      }
    ]
  }
}]'

# Load test validation
ab -n 1000 -c 10 -H "Authorization: Bearer prod_token" https://portal.example.com/v1/health
```

**Success Criteria**:
- Handle expected peak QPS (15 contacts, 6 files)
- Prometheus metrics operational
- Security headers present
- Tenant isolation functioning

#### Phase 2.4: Complete Rollout (100% Traffic)
**Duration**: Ongoing

```bash
# Complete migration to v1.0.0
kubectl set image deployment/portal-api-prod portal-api=portal-api:v1.0.0

# Route 100% traffic to new version
aws elbv2 modify-listener --listener-arn arn:aws:elasticloadbalancing:us-east-1:123456789012:listener/app/portal-api/1234567890123456/1234567890123456 --default-actions '[{
  "Type": "forward",
  "ForwardConfig": {
    "TargetGroups": [
      {
        "TargetGroupArn": "arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/portal-api-prod/1234567890123456",
        "Weight": 100
      }
    ]
  }
}]'

# Cleanup canary resources
kubectl scale deployment portal-api-canary --replicas=0
```

### Phase 3: Post-Deployment (T+180 to T+1440)
**Duration**: 24 hours  
**Team**: SRE + Support

#### Immediate Validation (T+180 to T+240)
- Monitor synthetic checks for 60+ minutes
- Validate all SLO targets being met
- Confirm no customer escalations
- Update status page to operational

#### Extended Monitoring (T+240 to T+1440)  
- 24-hour stability monitoring
- Error budget consumption tracking
- Performance baseline establishment
- Customer feedback collection

## Risk Assessment

### High Impact Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|---------|------------|
| **API Latency Spike** | Medium | High | Circuit breakers, immediate rollback |
| **Authentication Issues** | Low | Critical | Pre-deployment auth validation |
| **Rate Limiting Problems** | Medium | Medium | Conservative limits, monitoring |
| **Signed URL Failures** | Low | High | Fallback to previous URL generation |

### Rollback Triggers

**Automatic Rollback** (no manual intervention):
- Health endpoint failure > 2 minutes
- 5xx error rate > 5% for 5+ minutes

**Manual Rollback Decision** (engineering judgment):
- p95 latency 2x SLO for 10+ minutes  
- Customer escalations received
- Circuit breakers OPEN > 5 minutes
- Unexpected security issues

## Rollback Plan

### Emergency Rollback Procedure
**RTO**: < 5 minutes  
**RPO**: 0 (stateless service)

```bash
# Immediate traffic revert
aws elbv2 modify-listener --listener-arn arn:aws:elasticloadbalancing:us-east-1:123456789012:listener/app/portal-api/1234567890123456/1234567890123456 --default-actions '[{
  "Type": "forward",
  "ForwardConfig": {
    "TargetGroups": [
      {
        "TargetGroupArn": "arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/portal-api-rc0/1234567890123456",
        "Weight": 100
      }
    ]
  }
}]'

# Verify rollback
curl -f https://portal.example.com/v1/health
```

### Rollback Validation
- Previous version health check passes
- Error rates return to baseline  
- Customer-facing functionality restored
- Incident response activated

## Testing Strategy

### Pre-Deployment Testing
1. **Staging Validation**: Complete smoke test suite
2. **Load Testing**: 1.5x expected QPS validation
3. **Security Testing**: CORS and rate limiting validation
4. **Canary Testing**: 5% traffic validation in staging

### Production Testing
1. **Smoke Tests**: Critical path validation each phase
2. **Load Tests**: Progressive load increase validation
3. **Security Tests**: Production CORS and auth validation
4. **Integration Tests**: End-to-end workflow validation

### Test Scripts
```bash
# Smoke test suite
curl -H "Authorization: Bearer prod_token" https://portal.example.com/v1/health
curl -H "Authorization: Bearer prod_token" https://portal.example.com/v1/contacts?limit=1
curl -H "Authorization: Bearer prod_token" https://portal.example.com/v1/jobs?limit=1
curl -H "Authorization: Bearer prod_token" https://portal.example.com/v1/jobs/job_prod_test/files?limit=1

# Load test
newman run postman/Portal_API_Collection.json -e postman/Production_Environment.json --iteration-count 100 --delay-request 100
```

## Monitoring and Alerting

### Key Metrics
- **Request Latency**: p95/p99 per endpoint
- **Error Rates**: 2xx/4xx/5xx breakdown  
- **Circuit Breaker Status**: OPEN/CLOSED state
- **Rate Limiting**: 429 response rates
- **Signed URL Generation**: Success/failure rates

### Alert Configuration
```yaml
# Prometheus alerts
groups:
- name: portal-api-deployment
  rules:
  - alert: HighLatency
    expr: histogram_quantile(0.95, rate(http_request_duration_ms_bucket[5m])) > 500
    for: 10m
    labels:
      severity: critical
    annotations:
      summary: "Portal API high latency detected"
      
  - alert: HighErrorRate
    expr: rate(http_requests_errors_total[5m]) / rate(http_requests_total[5m]) > 0.05
    for: 10m
    labels:
      severity: critical
    annotations:
      summary: "Portal API high error rate detected"
```

### Dashboard URLs
- **Main Dashboard**: https://grafana.example.com/d/portal-api/overview
- **SLO Dashboard**: https://grafana.example.com/d/portal-api-slo/slo-tracking
- **Circuit Breaker Dashboard**: https://grafana.example.com/d/portal-api-cb/circuit-breakers

## Communication Plan

### Notification Timeline
- **T-120**: Change advisory sent to all stakeholders
- **T-60**: Maintenance window start notification
- **T0**: Deployment initiation announcement
- **T+30**: First phase completion update
- **T+90**: Majority rollout completion
- **T+180**: Full deployment success/failure
- **T+240**: Post-deployment stability report

### Communication Channels
- **Status Page**: https://status.portal.example.com
- **Slack**: #portal-api-deployments, #portal-alerts
- **Email**: portal-team@example.com distribution list
- **PagerDuty**: On-call engineer escalation

### Templates
```markdown
# Deployment Start
🚀 Portal API v1.0.0 deployment has begun
- Window: 02:00-06:00 UTC  
- Expected duration: 3 hours
- Current phase: Canary (5% traffic)
- Monitoring: https://grafana.example.com/d/portal-api

# Phase Complete  
✅ Portal API canary phase 1 (5%) completed successfully
- Duration: 25 minutes
- Error rate: 0.01%
- p95 latency: 45ms (target: <50ms)
- Next phase: 25% traffic in 5 minutes

# Deployment Success
🎉 Portal API v1.0.0 deployment completed successfully!  
- Total duration: 2h 45m
- Zero customer impact
- All SLOs met
- Status: Monitoring for 24h stability period
```

## Approval and Sign-off

### Change Advisory Board Approval
- **CAB Chair**: Approved ✅ (2025-08-30)
- **Security Team**: Approved ✅ (2025-08-30) 
- **Architecture Team**: Approved ✅ (2025-08-31)
- **Business Stakeholder**: Approved ✅ (2025-08-31)

### Technical Review
- **Code Review**: Completed ✅ (2025-08-28)
- **Security Review**: Completed ✅ (2025-08-29)
- **Performance Review**: Completed ✅ (2025-08-30)
- **Operational Review**: Completed ✅ (2025-08-31)

### Final Approvals
- **Release Manager**: _________________ Date: _________
- **Engineering Director**: _________________ Date: _________
- **Product Manager**: _________________ Date: _________

**Change Plan Version**: 1.0  
**Last Updated**: 2025-09-02  
**Implementation Date**: 2025-09-02 02:00 UTC