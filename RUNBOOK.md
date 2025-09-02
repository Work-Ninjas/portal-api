# Portal API Operations Runbook

## Overview

This runbook provides operational procedures for the Portal API system, covering monitoring, troubleshooting, deployment, and maintenance activities.

## Architecture Summary

- **API Gateway**: Express.js with TypeScript
- **Authentication**: Bearer token with tenant isolation
- **Rate Limiting**: 60 RPM global, 120 RPM files endpoint
- **Security**: CORS, HSTS, CSP, security headers
- **Reliability**: Circuit breakers, retries, timeouts
- **Observability**: Metrics, logging, distributed tracing

## Monitoring and Alerting

### Health Check Endpoints

```bash
# Primary health check
curl -H "Authorization: Bearer <token>" http://localhost:3000/v1/health

# Expected healthy response:
{
  "status": "healthy",
  "timestamp": "2025-09-02T17:00:00.000Z",
  "version": "1.0.0-rc.1",
  "traceId": "abc123-def456",
  "circuitBreakers": {}
}

# Degraded response (503 status):
{
  "status": "degraded",
  "circuitBreakers": {
    "rpc-api_get_contacts": {
      "state": "OPEN",
      "failureCount": 5,
      "nextAttempt": "2025-09-02T17:05:00.000Z"
    }
  }
}
```

### Metrics Monitoring

```bash
# Get metrics in JSON format
curl http://localhost:3000/metrics

# Get Prometheus format
curl http://localhost:3000/metrics?format=prometheus
```

### Key Metrics to Monitor

1. **Request Latency (SLA: p95 < 500ms)**
   - `http_request_duration_ms{quantile="0.95"}`
   - Alert if p95 > 1000ms for 5+ minutes

2. **Error Rate (SLA: < 1%)**
   - `http_requests_errors_total / http_requests_total`
   - Alert if error rate > 5% for 2+ minutes

3. **Circuit Breaker Status**
   - Monitor health endpoint for OPEN circuit breakers
   - Alert immediately when any circuit breaker opens

4. **Rate Limiting**
   - Monitor 429 responses
   - Alert if 429 rate > 10% for 5+ minutes

### Log Monitoring

**Key log patterns to monitor:**

```bash
# High latency requests
grep "High latency request detected" /var/log/portal-api.log

# Circuit breaker events
grep "Circuit breaker" /var/log/portal-api.log

# Authentication failures
grep "Authentication failed" /var/log/portal-api.log

# RPC failures
grep "RPC call failed" /var/log/portal-api.log
```

## Troubleshooting Guide

### Common Issues

#### 1. High Latency (p95 > 1000ms)

**Symptoms:**
- Slow response times
- Timeouts in client applications
- High latency alerts

**Diagnosis:**
```bash
# Check metrics for specific endpoints
curl http://localhost:3000/metrics | jq '.endpoints'

# Check circuit breaker status
curl http://localhost:3000/v1/health | jq '.circuitBreakers'

# Review high latency logs
grep "High latency" /var/log/portal-api.log | tail -20
```

**Resolution:**
1. Check if RPC backend is responding slowly
2. Verify circuit breakers are functioning
3. Review resource utilization (CPU, memory)
4. Check for database connection issues
5. Consider scaling if consistently high load

#### 2. High Error Rate (> 5%)

**Symptoms:**
- Increased 4xx/5xx responses
- Error rate alerts
- Client application failures

**Diagnosis:**
```bash
# Check error breakdown by endpoint
curl http://localhost:3000/metrics | jq '.endpoints[] | select(.errorRate.errorRate > 0.05)'

# Review error logs
grep "ERROR" /var/log/portal-api.log | tail -50

# Check authentication failures
grep "Authentication failed" /var/log/portal-api.log
```

**Resolution:**
1. **4xx errors**: Check client integration, API key validity
2. **5xx errors**: Check backend services, database connectivity
3. **403 errors**: Review tenant access controls
4. **422 errors**: Validate request parameters

#### 3. Circuit Breaker Tripped

**Symptoms:**
- Health check returns 503
- "Circuit breaker is OPEN" errors
- Reduced functionality

**Diagnosis:**
```bash
# Check circuit breaker status
curl http://localhost:3000/v1/health

# Review circuit breaker logs
grep "Circuit breaker" /var/log/portal-api.log
```

**Resolution:**
1. Investigate underlying RPC service health
2. Check network connectivity to backend
3. Monitor for automatic recovery (30-second reset timeout)
4. Manual intervention if backend is healthy:
   ```bash
   # Restart service to reset circuit breakers
   systemctl restart portal-api
   ```

#### 4. Rate Limiting Issues

**Symptoms:**
- Clients receiving 429 responses
- High rate limit alerts
- "Rate limit exceeded" errors

**Diagnosis:**
```bash
# Check rate limit headers in responses
curl -D- -H "Authorization: Bearer <token>" http://localhost:3000/v1/health

# Monitor 429 response rate
grep "429" /var/log/portal-api.log | wc -l
```

**Resolution:**
1. **Legitimate traffic spike**: Consider temporary rate limit increase
2. **Client misbehavior**: Identify and contact client
3. **DDoS/abuse**: Implement IP-based blocking

### Emergency Procedures

#### Service Restart
```bash
# Graceful restart
sudo systemctl restart portal-api

# Check status
sudo systemctl status portal-api

# View logs
sudo journalctl -u portal-api -f
```

#### Traffic Diversion
```bash
# Enable maintenance mode (return 503)
export MAINTENANCE_MODE=true

# Disable specific endpoints
export DISABLE_FILES_ENDPOINT=true
```

#### Database Emergency
```bash
# Check RPC connectivity
curl -H "Authorization: Bearer test" http://localhost:3000/v1/contacts

# Enable read-only mode if needed
export READ_ONLY_MODE=true
```

## Deployment Procedures

### Pre-deployment Checklist

- [ ] All tests passing (`npm test`)
- [ ] TypeScript compilation successful (`npm run typecheck`)
- [ ] ESLint checks passing (`npm run lint`)
- [ ] Version bumped in package.json
- [ ] Changelog updated
- [ ] Security scan completed
- [ ] Staging deployment successful

### Deployment Steps

1. **Backup Configuration**
   ```bash
   cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
   ```

2. **Build Application**
   ```bash
   npm run build
   ```

3. **Deploy with Rolling Update**
   ```bash
   # Blue-green deployment recommended
   # Deploy to staging slot first
   ```

4. **Health Check Verification**
   ```bash
   # Wait 30 seconds after deployment
   sleep 30
   curl http://localhost:3000/v1/health
   ```

5. **Smoke Tests**
   ```bash
   npm run test:smoke
   ```

### Rollback Procedures

```bash
# Rollback to previous version
git checkout <previous-commit>
npm run build
systemctl restart portal-api

# Or use container rollback
docker rollback portal-api
```

## Maintenance Tasks

### Daily Tasks

- [ ] Check health endpoint status
- [ ] Review error rate metrics
- [ ] Monitor disk usage for logs
- [ ] Verify backup completion

### Weekly Tasks

- [ ] Review security logs
- [ ] Analyze performance trends
- [ ] Update dependencies (security patches)
- [ ] Clean up old log files

### Monthly Tasks

- [ ] Review and update rate limits
- [ ] Security audit
- [ ] Performance optimization review
- [ ] Disaster recovery test

## Configuration Management

### Environment Variables

**Required:**
```bash
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
```

**Optional:**
```bash
CORS_ORIGIN=https://portal.example.com
RATE_LIMIT_MAX_REQUESTS=60
RATE_LIMIT_WINDOW_MS=60000
RPC_BASE_URL=http://rpc-service:8080
RPC_TIMEOUT_MS=5000
```

**Security:**
```bash
STORAGE_SECRET_KEY=<secure-secret>
ALLOWED_ORIGINS=https://portal.example.com,https://staging.portal.example.com
```

### Scaling Considerations

**Vertical Scaling:**
- CPU: 2+ cores recommended
- Memory: 1GB+ RAM for production
- Storage: 10GB+ for logs

**Horizontal Scaling:**
- Stateless design enables multiple instances
- Load balancer required for distribution
- Session affinity not needed

## Security Procedures

### Incident Response

1. **Security Alert Received**
   - Assess threat severity
   - Collect relevant logs
   - Document timeline

2. **Active Attack Detected**
   ```bash
   # Enable rate limiting
   export EMERGENCY_RATE_LIMIT=10
   
   # Block suspicious IPs
   iptables -A INPUT -s <suspicious-ip> -j DROP
   ```

3. **Data Breach Suspected**
   - Isolate affected systems
   - Preserve forensic evidence
   - Notify security team

### Regular Security Tasks

```bash
# Check for security updates
npm audit

# Review access logs
grep "401\|403" /var/log/portal-api.log

# Verify SSL/TLS configuration
openssl s_client -connect portal.example.com:443
```

## Performance Optimization

### Database Optimization
- Monitor RPC response times
- Implement connection pooling
- Add query timeout monitoring

### Caching Strategy
- Implement response caching for static data
- Add CDN for signed URL responses
- Consider Redis for session data

### Resource Optimization
- Monitor memory usage patterns
- Implement request payload limits
- Add compression for large responses

## Contact Information

- **On-call Engineer**: +1-555-ONCALL
- **Security Team**: security@example.com
- **DevOps Team**: devops@example.com
- **Escalation Manager**: manager@example.com

## References

- [API Documentation](./docs/)
- [Architecture Decision Records](./adr/)
- [Deployment Guide](./STAGING_README.md)
- [Security Policies](./docs/security.md)