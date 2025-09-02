# Azure Cutover Summary - datahubportal.com

## 🎯 Cutover Overview

Complete Azure migration for Portal API with the following domains:
- **Production API**: `api.datahubportal.com` 
- **Staging API**: `api.staging.datahubportal.com`
- **Production Docs**: `docs.datahubportal.com`
- **Staging Docs**: `docs.staging.datahubportal.com`

**Status**: ✅ READY FOR DEPLOYMENT

## 🏗️ Infrastructure Components

### 1. Azure Front Door Configuration
- **File**: `frontdoor-config.json`
- **Features**: 
  - Custom domain binding with managed TLS certificates
  - Global load balancing and CDN
  - Health probes and traffic distribution
  - Security headers and rules engine

### 2. Azure Container Apps  
- **File**: `container-apps-config.yaml`
- **Features**:
  - Production: 2-10 replicas, 1.0 CPU, 2.0Gi memory
  - Staging: 1-3 replicas, 0.5 CPU, 1.0Gi memory
  - Auto-scaling based on HTTP requests and CPU
  - Health checks and monitoring integration

### 3. Azure Static Web Apps
- **File**: `staticwebapp.config.json` + GitHub Actions
- **Features**:
  - Automated deployment from GitHub
  - Production and staging environments
  - Security headers and CSP
  - Custom domain binding

### 4. DNS Configuration
- **File**: `dns-records.yaml`
- **Records**:
  - `api.datahubportal.com` → Azure Front Door
  - `docs.datahubportal.com` → Static Web Apps
  - Staging equivalents

## 🔒 Security Implementation

### CORS Configuration
- **Origins**: `https://datahubportal.com`, `https://staging.datahubportal.com`
- **Methods**: `GET`, `HEAD`, `OPTIONS`
- **Headers**: `Authorization`, `Content-Type`, `X-Request-Id`
- **Preflight Cache**: 600 seconds
- **Implementation**: Both application-level and Front Door Rules Engine

### TLS Certificates
- **Provider**: Azure managed certificates
- **Coverage**: All custom domains
- **Auto-renewal**: Enabled
- **HSTS**: Enabled with 1-year max-age

### Security Headers
- `Strict-Transport-Security`: 1 year with subdomains
- `X-Content-Type-Options`: nosniff
- `X-Frame-Options`: DENY
- `Referrer-Policy`: no-referrer
- `Content-Security-Policy`: Configured for docs

## 📊 Monitoring & Observability

### Application Insights
- **File**: `application-insights-config.json`
- **Features**:
  - Request tracking and performance metrics
  - Error rate and response time monitoring
  - Custom dashboards with p95/p99 metrics
  - Rate limiting (429) tracking

### Synthetic Monitoring
- **File**: `synthetic-monitoring-config.json`
- **Tests**:
  - Health check: Every 1 minute (3 locations)
  - API endpoints: Every 5 minutes (2 locations)
  - Documentation: Every 5 minutes (3 locations)
- **Locations**: US East, US West, EU West, AP Southeast

### Alerts
- **High Error Rate**: >5% in 5 minutes
- **High Response Time**: >2000ms p95 in 10 minutes  
- **Rate Limiting**: >100 429s in 5 minutes
- **Health Check Failure**: Any location failure
- **SLA Breach**: <99.9% availability

## 🚀 Deployment Scripts

### Core Infrastructure
```bash
# Deploy Front Door and DNS
./azure/deploy-frontdoor.sh

# Deploy Container Apps
./azure/deploy-container-apps.sh

# Deploy monitoring
./azure/deploy-monitoring.sh
```

### Verification & Monitoring
```bash
# Verify production deployment
./azure/verify-production.sh

# Setup 24h synthetic monitoring
./azure/setup-synthetic-monitoring.sh

# Check monitoring status
./azure/check-synthetic-status.sh
```

## ✅ Pre-Deployment Checklist

### Infrastructure
- [ ] Azure Front Door deployed and configured
- [ ] DNS records updated and propagated
- [ ] TLS certificates active and valid
- [ ] Container Apps deployed to production and staging
- [ ] Static Web Apps configured for docs

### Security
- [ ] CORS policy implemented and tested
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Authentication endpoints secured

### Monitoring
- [ ] Application Insights connected
- [ ] Synthetic monitoring active
- [ ] Alert rules configured
- [ ] Dashboard created and accessible

### Documentation
- [ ] OpenAPI spec updated with Azure servers
- [ ] Stoplight documentation published
- [ ] robots.txt configured correctly
- [ ] API reference accessible

## 🔍 Verification Requirements

### XHR Calls from Portal
Test the following from `https://datahubportal.com`:
```javascript
// Health check
fetch('https://api.datahubportal.com/v1/health')

// Authenticated requests
fetch('https://api.datahubportal.com/v1/contacts', {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
})

// Files endpoint
fetch('https://api.datahubportal.com/v1/jobs/JOB_ID/files', {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
})
```

### Expected Headers
- `Access-Control-Allow-Origin`: Request origin
- `X-RateLimit-Limit`: Request limit per minute
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp
- `Cache-Control`: `private, max-age=0, no-store` (files endpoint)

### Rate Limiting Test
- Verify 429 responses when limits exceeded
- Check `Retry-After` header presence
- Confirm rate limit headers in all responses

### Files Endpoint Verification
- Signed URLs with 15-minute expiry
- No-cache headers on file listing
- Proper JSON response format

## 📈 24-Hour Monitoring Evidence

### Synthetic Monitoring
- Tests running every 1-5 minutes
- Multiple global locations
- Success rate >99.9%
- Response times <2000ms p95

### Application Insights
- Request tracking active
- Error rate monitoring
- Performance metrics
- Custom queries for SLA reporting

### Dashboards
- Real-time availability status  
- Response time percentiles
- Error rate trends
- Geographic performance

## 🎯 Success Criteria

### Functional Requirements
- ✅ Domain binding: api.datahubportal.com → Container Apps
- ✅ Domain binding: docs.datahubportal.com → Static Web Apps  
- ✅ TLS certificates active on all hosts
- ✅ CORS working from allowed origins
- ✅ OpenAPI servers updated and published

### Performance Requirements  
- Response time p95 < 2000ms
- Response time p99 < 5000ms
- Availability > 99.9%
- Rate limiting functional with proper headers

### Monitoring Requirements
- 24-hour synthetic monitoring active
- Application Insights collecting metrics
- Alerts configured and tested
- Dashboards accessible and functional

## 🚨 Rollback Plan

If issues occur during cutover:

1. **DNS Rollback**: Update DNS records to previous endpoints
2. **Front Door**: Disable custom domains temporarily  
3. **Container Apps**: Scale down or disable unhealthy revisions
4. **Monitoring**: Alerts will notify of any issues immediately

## 📞 Support Contacts

- **Operations Team**: ops@datahubportal.com
- **Azure Support**: Portal Azure support ticket
- **Monitoring**: Application Insights alerts → Slack webhook

---

**Deployment Date**: _To be filled during actual deployment_  
**Deployed By**: _To be filled during actual deployment_  
**Verification Status**: _To be filled after verification_

## 🎉 Post-Cutover Tasks

1. Monitor dashboards for first 24 hours
2. Verify all synthetic tests passing
3. Confirm XHR calls from production portal
4. Validate rate limiting and file endpoints
5. Review Application Insights metrics
6. Update documentation with final URLs
7. Notify stakeholders of successful cutover