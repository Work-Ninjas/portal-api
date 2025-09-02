# Threat Model: Signed URLs Security Analysis

## Overview

This document provides a security threat analysis focused on the Files endpoint signed URL functionality using the STRIDE methodology. The analysis covers potential attack vectors and implemented mitigations.

## System Context

**Component**: `GET /v1/jobs/{jobId}/files` - Files endpoint with signed URL generation  
**Data Flow**: Client → API → Signed URL Service → Storage URL  
**Security Boundary**: Tenant isolation, time-bounded access, storage security  

## STRIDE Analysis

### S - Spoofing (Identity)

#### Threat: Impersonation of Legitimate User
**Description**: Attacker attempts to access files using stolen or forged API tokens
**Likelihood**: Medium | **Impact**: High

**Mitigations Implemented:**
- ✅ Bearer token authentication required for all file requests
- ✅ Tenant context validation - client can only access their job files  
- ✅ Job ownership verification via RPC before URL generation
- ✅ Audit logging of all file access attempts with client_id

**Residual Risk**: Low (Multi-layer validation)

#### Threat: Service Account Key Compromise  
**Description**: Storage service account keys leaked, allowing direct storage access
**Likelihood**: Low | **Impact**: Critical

**Mitigations Implemented:**
- ✅ Service role isolated to signed URL service only (`SignedUrlService`)
- ✅ Secret key stored in environment variables, not in code
- ✅ HMAC-based signing prevents key reconstruction from URLs
- ✅ Short-lived URLs (15 minutes) limit exposure window

**Residual Risk**: Low (Key isolation + time bounds)

### T - Tampering (Data Integrity)

#### Threat: Signed URL Parameter Manipulation
**Description**: Attacker modifies URL parameters to access different files
**Likelihood**: Medium | **Impact**: High

**Mitigations Implemented:**
- ✅ HMAC signature covers resource path, expiration, and client context
- ✅ Signature verification prevents parameter tampering
- ✅ Object path validation against expected job directory structure
- ✅ Client ID embedded in signature prevents cross-client access

**Example Signature Generation:**
```typescript
const stringToSign = `${resourcePath}\n${expiration}\n${clientId}`;
const signature = crypto.createHmac('sha256', secretKey).update(stringToSign).digest('hex');
```

**Residual Risk**: Very Low (Strong cryptographic protection)

#### Threat: Path Traversal Attacks
**Description**: Malicious object paths to access files outside job scope
**Likelihood**: Medium | **Impact**: High  

**Mitigations Implemented:**
- ✅ Path validation enforces job-specific prefix: `jobs/{jobId}/`
- ✅ Pattern matching against known safe paths: `/^jobs\/[a-z0-9_]+\/files\/[a-z0-9_.-]+$/i`
- ✅ Explicit checks for traversal patterns (`..`, `//`)
- ✅ Server-side path sanitization before signature

**Code Example:**
```typescript
validateObjectPath(objectPath: string, jobId: string): void {
  const expectedPrefix = `jobs/${jobId}/`;
  if (!objectPath.startsWith(expectedPrefix)) {
    throw new Error(`Invalid object path: must start with ${expectedPrefix}`);
  }
  if (objectPath.includes('..') || objectPath.includes('//')) {
    throw new Error('Invalid object path: contains illegal characters');  
  }
}
```

**Residual Risk**: Very Low (Multiple validation layers)

### R - Repudiation (Non-repudiation)

#### Threat: Denial of File Access Activity
**Description**: User claims they didn't access sensitive files
**Likelihood**: Low | **Impact**: Medium

**Mitigations Implemented:**
- ✅ Comprehensive audit logging of all URL generation requests
- ✅ Trace ID propagation for request correlation
- ✅ Client ID, job ID, and file ID logged for access attempts
- ✅ Success/failure outcomes recorded with timestamps

**Audit Log Example:**
```json
{
  "timestamp": "2025-09-02T17:31:15.754Z",
  "level": "info", 
  "message": "Signed URL generated successfully",
  "fileId": "file_m3n4o5p6",
  "jobId": "job_x1y2z3a4",
  "clientId": "test_token", 
  "traceId": "abc123-def456",
  "outcome": "success",
  "latency": 45
}
```

**Residual Risk**: Very Low (Comprehensive audit trail)

### I - Information Disclosure (Confidentiality)

#### Threat: URL Content Exposure in Logs
**Description**: Signed URLs with query parameters logged, exposing signatures
**Likelihood**: High | **Impact**: Medium

**Mitigations Implemented:**
- ✅ Query string parameters NOT logged in audit logs
- ✅ Object path hashed before logging: `MD5(path).substring(0, 8)`
- ✅ Only URL generation success/failure recorded, not full URLs
- ✅ Cache headers prevent URL caching: `Cache-Control: private, max-age=0, no-store`

**Residual Risk**: Very Low (Query strings not logged)

#### Threat: URL Interception in Transit  
**Description**: Network sniffing of signed URLs in HTTP responses
**Likelihood**: Medium | **Impact**: High

**Mitigations Implemented:**
- ✅ HTTPS enforcement via HSTS headers (1-year max-age)  
- ✅ Secure cookies and headers configuration
- ✅ Short URL lifetime (15 minutes) limits exposure window
- ✅ TLS 1.2+ encryption for all API communications

**Residual Risk**: Low (HTTPS + short lifetime)

#### Threat: URL Sharing/Forwarding
**Description**: Users inadvertently share signed URLs exposing file access
**Likelihood**: Medium | **Impact**: Medium

**Mitigations Implemented:**
- ✅ Short expiration time (15 minutes) limits sharing impact
- ✅ Client-specific signatures prevent cross-tenant usage
- ✅ No-cache headers prevent URL persistence in browsers/proxies
- ✅ Content-Disposition headers ensure download (not inline display)

**Residual Risk**: Low (Time-bounded + client-specific)

### D - Denial of Service (Availability)

#### Threat: Signed URL Generation Overload
**Description**: High-frequency requests to overwhelm URL generation service
**Likelihood**: Medium | **Impact**: Medium

**Mitigations Implemented:**
- ✅ Rate limiting: 120 RPM per client for files endpoint
- ✅ Circuit breakers for RPC backend protection (5 failures = 30s break)
- ✅ Request timeouts (5 seconds) prevent resource exhaustion
- ✅ Concurrent URL generation for multiple files (performance)

**Residual Risk**: Low (Multiple protection layers)

#### Threat: Storage Service Overload
**Description**: Mass URL usage overwhelming storage backend
**Likelihood**: Low | **Impact**: High

**Mitigations Implemented:**
- ✅ URL expiration limits concurrent usage window
- ✅ Rate limiting controls API request frequency  
- ✅ CDN/cache layer can be added for frequently accessed files
- ✅ Storage service implements its own rate limiting

**Residual Risk**: Medium (External dependency)

### E - Elevation of Privilege (Authorization)

#### Threat: Horizontal Privilege Escalation
**Description**: Access files belonging to different tenants/jobs
**Likelihood**: Medium | **Impact**: Critical

**Mitigations Implemented:**
- ✅ Job ownership verification before URL generation
- ✅ Client ID embedded in URL signature  
- ✅ Object path validation against job context
- ✅ RPC call validates tenant access to specific job

**Validation Flow:**
```
1. Extract jobId from request path
2. Validate jobId format (job_[a-z0-9]{8})
3. RPC call: api_get_job(jobId) with client context
4. If job not found/access denied → 404 response
5. Generate URLs only for confirmed accessible job
```

**Residual Risk**: Very Low (Multi-step validation)

#### Threat: Vertical Privilege Escalation
**Description**: Access administrative storage functions beyond file retrieval  
**Likelihood**: Low | **Impact**: High

**Mitigations Implemented:**
- ✅ Read-only signed URLs (no write/delete permissions)
- ✅ Service account has minimal required permissions
- ✅ URL signatures scoped to specific resource paths
- ✅ No administrative storage operations exposed via API

**Residual Risk**: Very Low (Principle of least privilege)

## Security Controls Summary

### Implemented Controls

| Control Type | Implementation | Effectiveness |
|--------------|----------------|---------------|
| **Authentication** | Bearer token + tenant validation | High |
| **Authorization** | Job ownership verification | High |  
| **Cryptography** | HMAC-SHA256 URL signing | High |
| **Input Validation** | Path traversal prevention | High |
| **Audit Logging** | Comprehensive access logging | High |
| **Rate Limiting** | 120 RPM per client | Medium |
| **Time Controls** | 15-minute URL expiration | High |
| **Cache Security** | No-store, private headers | Medium |

### Defense in Depth Layers

1. **Network**: HTTPS/TLS encryption, HSTS headers
2. **Application**: Authentication, rate limiting, input validation
3. **Business Logic**: Tenant isolation, job ownership verification
4. **Cryptographic**: HMAC signatures, secure key management  
5. **Audit**: Comprehensive logging, trace correlation
6. **Time-based**: URL expiration, circuit breaker timeouts

## Recommendations

### High Priority
- [ ] Implement storage-level access controls (bucket policies)
- [ ] Add client IP validation for signed URL usage  
- [ ] Implement URL usage monitoring/alerting
- [ ] Consider adding file virus scanning before URL generation

### Medium Priority  
- [ ] Add geographic restrictions for file access
- [ ] Implement file download analytics/metrics
- [ ] Consider watermarking for sensitive documents
- [ ] Add file integrity checksums to URLs

### Low Priority
- [ ] Implement client-side URL encryption
- [ ] Add dynamic URL rotation capabilities
- [ ] Consider blockchain-based audit trail
- [ ] Implement advanced behavioral analytics

## Incident Response

### Security Incident Playbook

1. **Suspected URL Compromise**:
   - Immediately rotate storage service keys
   - Invalidate all active signed URLs (change secret)
   - Review audit logs for unauthorized access patterns
   - Notify affected tenants within 24 hours

2. **Mass File Access Abuse**:
   - Temporarily reduce rate limits for affected client
   - Implement emergency IP-based blocking if needed
   - Analyze access patterns for malicious behavior
   - Consider temporary URL generation suspension

3. **Storage Service Compromise**:
   - Activate backup storage service
   - Implement read-only mode for API
   - Coordinate with storage provider security team
   - Conduct full security audit before restoration

## Review and Updates

- **Review Frequency**: Quarterly security review
- **Trigger Events**: Security incidents, major feature changes, compliance audits
- **Stakeholders**: Security team, Platform engineering, Product management
- **Next Review**: 2025-12-01

**Document Version**: 1.0  
**Last Updated**: 2025-09-02  
**Owner**: Security Engineering Team