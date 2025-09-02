# Portal API v1.0.0 Go-Live Checklist

## Pre-Deployment Phase (T-60 to T-5 minutes)

### Change Management
- [ ] **Change Ticket**: CHG-2025090201 approved by CAB
- [ ] **Deployment Window**: Confirmed 02:00-06:00 UTC (low traffic)
- [ ] **Rollback Window**: 4-hour window available if needed
- [ ] **Stakeholder Approval**: Product, Engineering, Security teams signed off

### Environment Preparation
- [ ] **Production Environment**: All services healthy and ready
- [ ] **Load Balancer**: Canary routing configuration deployed
- [ ] **Monitoring**: Grafana dashboards active, alerts configured
- [ ] **Status Page**: Planned maintenance announced
- [ ] **On-call Engineer**: Available and briefed on procedures

### Configuration Validation
- [ ] **Environment Variables**: Production secrets verified
- [ ] **CORS Origins**: `https://portal.example.com` only
- [ ] **Rate Limits**: 60 RPM global, 120 RPM files endpoint
- [ ] **SSL Certificates**: Valid and not expiring within 30 days
- [ ] **Database Connections**: RPC backend connectivity verified

### Testing Preparation
- [ ] **Postman Environment**: Production environment configured
- [ ] **Smoke Test Scripts**: Ready and validated
- [ ] **Load Test Suite**: Newman collection prepared
- [ ] **Synthetic Monitors**: Active and reporting green
- [ ] **Alert Channels**: Slack, PagerDuty, email verified

## Deployment Phase (T0 to T+180 minutes)

### Phase 1: Initial Canary (5% - 15-30 minutes)
- [ ] **Deployment**: v1.0.0 deployed to canary instances
- [ ] **Traffic Routing**: 5% traffic to canary
- [ ] **Health Check**: `/v1/health` returns 200 consistently
- [ ] **Circuit Breakers**: All in CLOSED state
- [ ] **Basic Functionality**: Smoke tests pass
- [ ] **Phase 1 Go/No-Go**: ✅ Proceed / ❌ Rollback

### Phase 2: Expanded Canary (25% - 30-45 minutes)
- [ ] **Traffic Increase**: 25% traffic to canary
- [ ] **SLO Compliance**: p95 latency within targets
- [ ] **Error Rates**: < 1% overall error rate
- [ ] **Rate Limiting**: Proper headers and 429 responses
- [ ] **Files Endpoint**: Signed URLs with 15min expiry
- [ ] **Phase 2 Go/No-Go**: ✅ Proceed / ❌ Rollback

### Phase 3: Majority Canary (50% - 45-60 minutes)
- [ ] **Traffic Increase**: 50% traffic to canary  
- [ ] **Performance**: Handle expected QPS load
- [ ] **Metrics Export**: Prometheus histograms/counters active
- [ ] **Security**: Cache headers and CORS functioning
- [ ] **Tenant Isolation**: Cross-tenant access properly blocked
- [ ] **Phase 3 Go/No-Go**: ✅ Proceed / ❌ Rollback

### Phase 4: Full Rollout (100% - ongoing)
- [ ] **Complete Migration**: 100% traffic on v1.0.0
- [ ] **Old Version Cleanup**: Previous version instances terminated
- [ ] **Final Validation**: All endpoints functional
- [ ] **Status Page Update**: Maintenance window completed
- [ ] **Go-Live Complete**: ✅ Success / ❌ Rollback executed

## Abort Criteria (Immediate Rollback Triggers)

### Performance Thresholds
- [ ] **p95 Latency**: Over SLO budget for 10+ minutes
  - Health: >100ms, Contacts: >600ms, Jobs: >800ms, Files: >1000ms
- [ ] **5xx Errors**: > 1% for 10+ minutes
- [ ] **4xx Anomalous**: > 2% for 10+ minutes (excluding expected 404s)

### Reliability Issues
- [ ] **Circuit Breakers**: Any breaker OPEN for 5+ minutes
- [ ] **Rate Limit Anomaly**: 429s > 2% above baseline for 10+ minutes
- [ ] **Health Check Failures**: Health endpoint failing for 2+ minutes

### Security/Business Issues
- [ ] **CORS Violations**: Unexpected origins being served
- [ ] **Authentication Failures**: Spike in 401/403 responses
- [ ] **Customer Escalations**: Critical customer issues reported
- [ ] **Data Integrity**: Any suspected data corruption

## Post-Deployment Phase (T+30 to T+1440 minutes)

### Immediate Validation (T+30 minutes)
- [ ] **Synthetic Monitors**: All green for 30+ minutes
- [ ] **Error Budget**: Within acceptable consumption rate
- [ ] **Customer Impact**: No negative feedback received
- [ ] **Performance Baseline**: Metrics within expected ranges

### Short-term Monitoring (T+60 to T+240 minutes)
- [ ] **SLO Compliance**: All endpoints meeting targets
- [ ] **Signed URL Generation**: Success rate > 99.5%
- [ ] **Cache Behavior**: Proper no-store headers
- [ ] **Audit Logging**: Query string redaction working

### Long-term Stability (T+240 to T+1440 minutes)
- [ ] **24-hour Stability**: No degradation over time
- [ ] **Resource Usage**: Memory/CPU within normal ranges
- [ ] **Error Budget Tracking**: Daily consumption on track
- [ ] **Business Metrics**: API usage patterns normal

## Rollback Procedures

### Emergency Rollback (< 5 minutes)
1. **Immediate Traffic Switch**: Route 100% traffic to previous version
2. **Health Validation**: Verify previous version responding
3. **Incident Declaration**: Activate incident response procedures
4. **Stakeholder Notification**: Alert all stakeholders immediately

### Rollback Commands
```bash
# Emergency traffic switch
kubectl patch service portal-api-prod -p '{"spec":{"selector":{"version":"v1.0.0-rc.0"}}}'

# Verify rollback
curl -f https://portal.example.com/v1/health

# Scale down canary
kubectl scale deployment portal-api-canary --replicas=0
```

### Post-Rollback Actions
- [ ] **Root Cause Analysis**: Begin immediate investigation
- [ ] **Customer Communication**: Status page update within 15 minutes
- [ ] **Log Preservation**: Capture logs from failed deployment
- [ ] **Post-mortem Scheduling**: Schedule within 24 hours

## Success Criteria

### Technical Success
- [ ] **Zero Critical Issues**: No P1/P2 incidents during deployment
- [ ] **SLO Achievement**: All performance targets met
- [ ] **Feature Functionality**: All API endpoints working correctly
- [ ] **Security Controls**: All security measures operational

### Business Success
- [ ] **Customer Satisfaction**: No complaints or escalations
- [ ] **API Adoption**: Usage patterns meet expectations
- [ ] **Revenue Impact**: No negative business impact
- [ ] **Support Volume**: Normal support ticket levels

### Operational Success
- [ ] **Deployment Timeline**: Completed within allocated window
- [ ] **Team Coordination**: Smooth execution across teams
- [ ] **Documentation Accuracy**: Procedures worked as documented
- [ ] **Lessons Learned**: Improvements identified for next release

## Communication Plan

### T-60 minutes: Pre-deployment
- **Engineering Team**: Final briefing and readiness check
- **Product Team**: Deployment start notification  
- **Support Team**: Awareness alert for potential issues

### T0: Deployment Start
- **Slack #deployments**: Canary deployment initiated
- **Status Page**: Maintenance window active
- **On-call Engineer**: Active monitoring begun

### Each Phase Gate
- **Engineering**: Phase completion status
- **Management**: Go/No-Go decision communicated
- **Support**: Current status and any issues

### T+180: Deployment Complete
- **All Stakeholders**: Go-live success announcement
- **Customers**: Status page updated to operational
- **Support**: Normal operations resumed

## Emergency Contacts

- **Deployment Lead**: +1-555-DEPLOY
- **On-call Engineer**: +1-555-ONCALL  
- **Engineering Manager**: +1-555-ENG-MGR
- **Incident Commander**: +1-555-INCIDENT
- **Executive Escalation**: +1-555-EXECUTIVE

## Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| **Deployment Lead** | | ________________ | _________ |
| **Engineering Manager** | | ________________ | _________ |
| **Product Manager** | | ________________ | _________ |
| **Security Lead** | | ________________ | _________ |
| **Release Manager** | | ________________ | _________ |

**Checklist Version**: 1.0  
**Last Updated**: 2025-09-02  
**Next Review**: After deployment completion