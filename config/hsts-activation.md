# HSTS Activation for datahubportal.com

## Current Status
✅ Domain cutover completed  
✅ TLS certificates active for all subdomains  
✅ DNS resolution working  
✅ API functionality validated  
⏳ Ready for HSTS includeSubDomains activation  

## HSTS Configuration

### Stage 1: Current Configuration (Active)
```typescript
// src/middleware/security.ts
hsts: {
  maxAge: 31536000, // 1 year
  includeSubDomains: false, // Currently false for testing
  preload: false
}
```

### Stage 2: Full HSTS Activation (After 24h Stability)
```typescript
// src/middleware/security.ts  
hsts: {
  maxAge: 31536000, // 1 year
  includeSubDomains: true, // ✅ Activate after validation
  preload: true // Enable for HSTS preload list
}
```

## Activation Checklist

### Pre-activation Requirements ✅
- [x] All subdomains have valid TLS certificates
  - api.datahubportal.com ✅
  - docs.datahubportal.com ✅  
  - api.staging.datahubportal.com ✅
  - docs.staging.datahubportal.com ✅
- [x] DNS resolution working for all subdomains
- [x] API endpoints responding correctly
- [x] No mixed content issues detected
- [x] 24-hour stability period completed

### Activation Steps

1. **Update Production Configuration**
```bash
# Update environment variable
HSTS_INCLUDE_SUBDOMAINS=true
HSTS_PRELOAD=true

# Deploy configuration update  
kubectl patch deployment portal-api-prod -p '{"spec":{"template":{"spec":{"containers":[{"name":"portal-api","env":[{"name":"HSTS_INCLUDE_SUBDOMAINS","value":"true"},{"name":"HSTS_PRELOAD","value":"true"}]}]}}}}'
```

2. **Validate HSTS Headers**
```bash
# Test production API
curl -D- https://api.datahubportal.com/v1/health | grep -i strict-transport-security

# Expected output:
# Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

3. **Update Staging Environment**
```bash
# Apply same configuration to staging
kubectl patch deployment portal-api-staging -p '{"spec":{"template":{"spec":{"containers":[{"name":"portal-api","env":[{"name":"HSTS_INCLUDE_SUBDOMAINS","value":"true"},{"name":"HSTS_PRELOAD","value":"true"}]}]}}}}'
```

4. **Monitor for Issues**
```bash
# Check for any HTTPS issues in logs
kubectl logs deployment/portal-api-prod | grep -i "ssl\|tls\|cert"

# Monitor error rates for 1 hour after activation
curl "https://prometheus.datahubportal.com/api/v1/query?query=rate(http_requests_errors_total[5m])"
```

## HSTS Preload Submission

### After 24h of Stable HSTS
Submit domain to HSTS preload list: https://hstspreload.org/

**Requirements Met:**
- [x] HTTPS redirect from HTTP (automatic via load balancer)
- [x] Valid certificate on all subdomains
- [x] HSTS header with max-age >= 31536000 (1 year)
- [x] includeSubDomains directive present
- [x] preload directive present

## Rollback Plan

### If Issues Detected
```bash
# Emergency HSTS rollback
kubectl patch deployment portal-api-prod -p '{"spec":{"template":{"spec":{"containers":[{"name":"portal-api","env":[{"name":"HSTS_INCLUDE_SUBDOMAINS","value":"false"},{"name":"HSTS_PRELOAD","value":"false"}]}]}}}}'

# Reduce max-age if needed (not recommended)
kubectl patch deployment portal-api-prod -p '{"spec":{"template":{"spec":{"containers":[{"name":"portal-api","env":[{"name":"HSTS_MAX_AGE","value":"3600"}]}]}}}}'
```

## Validation Commands

### DNS & TLS Validation
```bash
# Verify all subdomains resolve
nslookup api.datahubportal.com
nslookup docs.datahubportal.com
nslookup api.staging.datahubportal.com  
nslookup docs.staging.datahubportal.com

# Verify TLS certificates
echo | openssl s_client -servername api.datahubportal.com -connect api.datahubportal.com:443 2>/dev/null | openssl x509 -noout -subject -dates

# Check certificate covers all subdomains
echo | openssl s_client -servername api.datahubportal.com -connect api.datahubportal.com:443 2>/dev/null | openssl x509 -noout -text | grep -A5 "Subject Alternative Name"
```

### HSTS Header Validation
```bash
# Check current HSTS headers (before activation)
curl -D- https://api.datahubportal.com/v1/health 2>/dev/null | grep -i strict-transport-security

# After activation - should include includeSubDomains
curl -D- https://api.datahubportal.com/v1/health 2>/dev/null | grep -i strict-transport-security | grep includeSubDomains
```

## Monitoring During Activation

### Key Metrics to Monitor
```bash
# Error rate (should remain <1%)
curl "https://prometheus.datahubportal.com/api/v1/query?query=rate(http_requests_errors_total[5m])/rate(http_requests_total[5m])"

# Response time (should remain within SLO)
curl "https://prometheus.datahubportal.com/api/v1/query?query=histogram_quantile(0.95,rate(http_request_duration_ms_bucket[5m]))"

# Certificate expiry (should be >30 days)
curl "https://prometheus.datahubportal.com/api/v1/query?query=ssl_certificate_expiry_days"
```

### Alert Rules During Activation
```yaml
- alert: HSTSActivationIssue
  expr: 'increase(http_requests_errors_total{hostname="api.datahubportal.com"}[5m]) > 10'
  for: "1m"
  labels:
    severity: "critical"
  annotations:
    summary: "Potential HSTS activation issue detected"
```

## Post-Activation Tasks

### Immediate (T+0 to T+1 hour)
- [ ] Validate HSTS headers on all endpoints
- [ ] Monitor error rates and response times  
- [ ] Test all subdomain access via HTTPS
- [ ] Verify no mixed content warnings

### Short-term (T+1 to T+24 hours)
- [ ] Monitor synthetic checks for stability
- [ ] Validate no user-reported issues
- [ ] Check certificate monitoring alerts
- [ ] Confirm all applications working normally

### Long-term (T+24 hours+)
- [ ] Submit to HSTS preload list
- [ ] Update documentation with final configuration
- [ ] Schedule certificate renewal monitoring
- [ ] Plan quarterly HSTS configuration review

**Activation Authorization Required From:**
- Security Team Lead
- Platform Engineering Manager  
- Site Reliability Engineering Lead

**Contact for Issues:**
- Primary: platform-engineering@datahubportal.com
- Secondary: sre-on-call@datahubportal.com
- Emergency: +1-555-DATAHUB