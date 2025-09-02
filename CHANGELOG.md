# Changelog

All notable changes to the Portal API will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-rc.1] - 2025-09-02

### Added
- **Security Hardening**: Production CORS with restricted origins and safe HTTP methods only
- **Circuit Breakers**: Per-RPC method circuit breakers with automatic recovery (30s timeout)
- **Retry Logic**: Exponential backoff with jitter for RPC calls (3 attempts, 1-5s delays)
- **Request Timeouts**: 5-second timeouts for all RPC operations
- **Advanced Metrics**: P95/P99 latency tracking, error rates by endpoint, Prometheus export
- **Health Degradation**: Circuit breaker status in health endpoint (503 when open)
- **Security Headers**: HSTS (1 year), X-Frame-Options: DENY, X-Content-Type-Options: nosniff
- **Signed URL Security**: Path traversal protection, cache headers, audit log redaction
- **Rate Limit Verification**: Proper X-RateLimit-* headers in 200/429 responses
- **Operational Documentation**: Complete RUNBOOK.md with troubleshooting procedures

### Security
- **Service Role Isolation**: Storage secret key only accessible in signed URL service
- **CORS Restrictions**: Production origins only (`portal.example.com`, `staging.portal.example.com`)
- **Cache Security**: `Cache-Control: private, max-age=0, no-store` for files endpoint
- **Query String Redaction**: Signed URLs not logged in audit logs
- **Path Validation**: Anti-traversal checks for object paths against job context

### Performance
- **Concurrent Processing**: Parallel URL generation for multiple files
- **Client-based Rate Limiting**: More efficient than IP-based limiting
- **Optimized Metrics**: Rolling window calculations for latency percentiles
- **Connection Pooling**: Prepared for RPC connection optimization

### Reliability
- **Graceful Degradation**: Health endpoint reports service state accurately
- **Error Budget Tracking**: Automatic monitoring of SLO compliance
- **Rollback Procedures**: Documented emergency response and deployment rollback
- **Synthetic Monitoring**: Health check endpoints for external monitoring

### Operations
- **Prometheus Integration**: `/metrics` endpoint with histogram and counter exports
- **Structured Logging**: Enhanced logging with trace propagation and latency tracking
- **Performance Alerting**: High latency detection (>1s requests logged)
- **Emergency Procedures**: Circuit breaker monitoring, traffic diversion, service restart

## [1.0.0-alpha] - 2025-09-01

### Added
- Initial API implementation with Express.js and TypeScript
- Authentication middleware with Bearer token support
- Rate limiting (60 RPM global, 120 RPM files endpoint)
- RPC client with simulation for development
- Signed URL generation with HMAC security
- OpenAPI 3.0.3 specification with complete schemas
- File upload endpoints with kind filtering
- Tenant isolation and access controls
- Distributed tracing with X-Request-Id propagation
- Structured logging with Winston
- Health check endpoint
- Error handling with Problem Details format (RFC 7807)

### API Endpoints
- `GET /v1/health` - Health check with circuit breaker status
- `GET /v1/contacts` - List contacts with pagination and search
- `GET /v1/contacts/{id}` - Get individual contact details
- `GET /v1/jobs` - List jobs with status filtering and pagination  
- `GET /v1/jobs/{jobId}/files` - Get job files with signed URLs and kind filtering

### Security
- Bearer token authentication with tenant context
- Rate limiting with client-based keys
- HMAC-based signed URL generation (15-minute expiry)
- Input validation and sanitization
- Tenant access control and isolation

### Reliability
- RPC client with error handling and logging
- Request timeout handling
- Graceful error responses with trace IDs
- Health monitoring endpoint

[1.0.0-rc.1]: https://github.com/portal/api/compare/v1.0.0-alpha...v1.0.0-rc.1
[1.0.0-alpha]: https://github.com/portal/api/releases/tag/v1.0.0-alpha