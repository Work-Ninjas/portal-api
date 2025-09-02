# Canary Deployment Plan - Portal API v1.0.0-rc.1

## Overview

This document outlines the canary deployment strategy for promoting Portal API v1.0.0-rc.1 from staging to production with risk mitigation and rollback procedures.

## Deployment Timeline

| Phase | Traffic % | Duration | Validation Criteria |
|-------|-----------|----------|-------------------|
| **Phase 1** | 5% | 15-30 minutes | Health checks, error rates |
| **Phase 2** | 25% | 30-45 minutes | Performance metrics, user feedback |
| **Phase 3** | 50% | 45-60 minutes | Full feature validation |
| **Phase 4** | 100% | Ongoing | Complete rollout |

**Total Rollout Time**: 2-3 hours (conservative)  
**Business Hours**: Deploy during low-traffic window (2-4 AM UTC)

## Phase-by-Phase Execution

### Phase 1: Initial Canary (5% Traffic)
**Duration**: 15-30 minutes  
**Scope**: Health check validation, basic functionality

#### Pre-deployment Checks
- [ ] Staging environment fully validated
- [ ] Load balancer configured for traffic splitting
- [ ] Monitoring dashboards active
- [ ] On-call engineer available
- [ ] Rollback plan tested and ready

#### Deployment Actions
```bash
# Deploy canary version
kubectl set image deployment/portal-api portal-api=portal-api:v1.0.0-rc.1
kubectl annotate deployment/portal-api deployment.kubernetes.io/canary="5%"

# Update load balancer weight
kubectl patch service portal-api-canary -p '{"spec":{"weight":5}}'
```

#### Validation Criteria (5% Traffic)
- [ ] Health endpoint returns 200 (>99.9% success)
- [ ] Circuit breakers remain CLOSED  
- [ ] p95 latency < 500ms across all endpoints
- [ ] Error rate < 1% overall
- [ ] No 5xx errors for 10+ minutes
- [ ] Rate limiting functioning (proper headers)

#### Abort Criteria
- **Health failures**: Health endpoint fails for 2+ minutes
- **High error rate**: >5% error rate for 2+ minutes  
- **Latency spike**: p95 >1000ms for 5+ minutes
- **Circuit breaker**: Any circuit breaker OPEN for >1 minute

### Phase 2: Expanded Canary (25% Traffic)
**Duration**: 30-45 minutes  
**Scope**: Core API functionality validation

#### Deployment Actions
```bash
# Increase canary traffic
kubectl patch service portal-api-canary -p '{"spec":{"weight":25}}'
```

#### Validation Criteria (25% Traffic)
- [ ] All Phase 1 criteria maintained
- [ ] Contacts API p95 < 300ms  
- [ ] Jobs API p95 < 400ms
- [ ] Files API p95 < 500ms (120 RPM rate limit active)
- [ ] Signed URL generation success rate >99.5%
- [ ] Cache headers properly set on file responses
- [ ] Tenant isolation functioning (cross-tenant 404s)

#### Additional Monitoring
- [ ] Memory usage < 80% of allocated
- [ ] CPU usage < 70% of allocated  
- [ ] RPC backend response times stable
- [ ] Database connection pool healthy

### Phase 3: Majority Canary (50% Traffic)  
**Duration**: 45-60 minutes  
**Scope**: Performance under significant load

#### Deployment Actions
```bash
# Increase to majority traffic
kubectl patch service portal-api-canary -p '{"spec":{"weight":50}}'
```

#### Validation Criteria (50% Traffic)
- [ ] All previous phase criteria maintained
- [ ] Handle expected peak QPS (15 QPS contacts, 6 QPS files)
- [ ] Prometheus metrics collection functioning
- [ ] Audit logging operational (signed URL redaction)
- [ ] Security headers present in all responses

#### Load Testing Validation
```bash
# Run load test with Postman/Newman
newman run Portal_API_Collection.json -e Production_Environment.json \
  --iteration-count 500 --delay-request 100
```

**Expected Results**:
- p95 latency within SLO targets
- <1% error rate across all endpoints
- Rate limiting triggers at expected thresholds
- No circuit breaker activations

### Phase 4: Full Rollout (100% Traffic)
**Duration**: Ongoing monitoring  
**Scope**: Complete production traffic

#### Deployment Actions
```bash
# Complete rollout
kubectl patch service portal-api-canary -p '{"spec":{"weight":100}}'

# Update production service to point to new version
kubectl set image deployment/portal-api-prod portal-api=portal-api:v1.0.0-rc.1

# Remove canary deployment after validation
kubectl delete deployment portal-api-canary
```

#### Final Validation
- [ ] 100% traffic on v1.0.0-rc.1
- [ ] All monitoring systems healthy
- [ ] SLO compliance within targets
- [ ] Customer-facing functionality verified
- [ ] No performance regressions detected

## Abort Criteria & Rollback

### Immediate Rollback Triggers
Any of these conditions trigger immediate rollback:

1. **p95 latency over budget for 10+ minutes**
   - Health: >100ms, Contacts: >600ms, Jobs: >800ms, Files: >1000ms

2. **5xx error rate > 1% for 10+ minutes**
   - Indicates backend service issues or code defects

3. **4xx anomalous rate > 2% for 10+ minutes**  
   - Suggests authentication or validation issues

4. **Circuit breakers OPEN for 5+ minutes**
   - RPC backend connectivity problems

5. **Memory/CPU exhaustion**
   - Resource leak or performance regression

### Rollback Procedure

#### Immediate Actions (< 2 minutes)
```bash
# Emergency rollback to previous version
kubectl set image deployment/portal-api portal-api=portal-api:v1.0.0-rc.0
kubectl rollout undo deployment/portal-api

# Reset traffic routing
kubectl patch service portal-api-canary -p '{"spec":{"weight":0}}'
kubectl patch service portal-api-prod -p '{"spec":{"weight":100}}'
```

#### Post-Rollback Checklist (Within 15 minutes)
- [ ] Health endpoint returns 200
- [ ] Error rates return to baseline
- [ ] Latency metrics within normal range
- [ ] Circuit breakers return to CLOSED
- [ ] Customer impact assessment completed
- [ ] Incident communication sent

#### Rollback Validation
- [ ] Previous version (v1.0.0-rc.0) fully operational
- [ ] Performance metrics back to baseline
- [ ] All customer-facing features functional
- [ ] Monitoring systems reporting normal status

#### Post-Rollback Analysis
- [ ] Root cause analysis initiated
- [ ] Logs and metrics preserved for analysis
- [ ] Timeline documentation completed
- [ ] Post-mortem scheduled within 24 hours

## Monitoring & Observability

### Key Dashboards
1. **Portal API Overview**: Request rates, latency, errors
2. **Circuit Breaker Status**: Real-time state monitoring  
3. **Resource Utilization**: CPU, memory, network
4. **SLO Compliance**: SLO achievement vs targets

### Alert Channels
- **Slack**: #portal-api-alerts (warnings)
- **PagerDuty**: On-call engineer (critical alerts)
- **Email**: Engineering team (deployment updates)
- **SMS**: Emergency escalation (service down)

### Synthetic Monitoring During Deployment

```bash
# Health check every 30 seconds
curl -f -H "Authorization: Bearer synthetic_token" \
  https://portal-api.example.com/v1/health || alert

# Full API test every 2 minutes  
newman run Portal_API_Collection.json -e Production_Environment.json \
  --reporters cli,json --reporter-json-export results.json
```

## Risk Assessment

### Low Risk (Continue Deployment)
- Minor latency increases (<20% above baseline)
- Occasional 4xx errors (<2% rate)
- Circuit breaker brief activations (<30 seconds)

### Medium Risk (Proceed with Caution)
- Moderate latency increases (20-50% above baseline)
- Elevated 4xx error rate (2-5%)
- Resource usage above 80%

### High Risk (Consider Rollback)
- Significant latency increases (>50% above baseline)  
- High 4xx error rate (>5%)
- Any 5xx errors present
- Circuit breakers frequently opening

### Critical Risk (Immediate Rollback)
- Any abort criteria met
- Customer escalations received
- Data corruption suspected
- Security incidents detected

## Communication Plan

### Stakeholder Notifications

#### Pre-Deployment (T-2 hours)
- Engineering team: Deployment window confirmed
- Product team: Feature validation checklist
- Customer success: Awareness of potential impacts

#### During Deployment (Each phase)
- Engineering: Phase completion status
- On-call: Current metrics and health status
- Management: Progress updates (major phases only)

#### Post-Deployment (T+24 hours)
- All stakeholders: Deployment success summary
- Metrics team: Performance comparison report
- Documentation: Lessons learned and improvements

## Success Criteria

### Technical Success
- [ ] All SLO targets achieved
- [ ] Zero customer-impacting incidents
- [ ] Performance within expected ranges
- [ ] Security controls functioning properly

### Business Success  
- [ ] Feature adoption metrics positive
- [ ] Customer satisfaction maintained
- [ ] Support ticket volume normal
- [ ] Revenue impact neutral or positive

### Operational Success
- [ ] Deployment completed within timeline
- [ ] Rollback plan validated (if needed)
- [ ] Monitoring systems effective
- [ ] Team confidence in production stability

## Post-Deployment Tasks

### Immediate (T+0 to T+24 hours)
- [ ] Monitor SLO compliance
- [ ] Validate all customer-facing features
- [ ] Review performance baselines
- [ ] Document any issues encountered

### Short-term (T+1 to T+7 days)
- [ ] Analyze performance trends
- [ ] Customer feedback collection
- [ ] Security audit completion
- [ ] Capacity planning review

### Long-term (T+1 to T+4 weeks)
- [ ] Post-deployment retrospective
- [ ] SLO target adjustments (if needed)
- [ ] Process improvements identification
- [ ] Next release planning

**Deployment Owner**: Platform Engineering Team  
**Emergency Contact**: +1-555-ON-CALL  
**Escalation Manager**: Engineering Director