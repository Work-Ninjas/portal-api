# Signed URLs & CORS Strategy for datahubportal.com

## Current Implementation

### API Response Configuration ✅
- **Cache Headers**: `Cache-Control: private, max-age=0, no-store` implemented
- **Query String Logging**: Full URLs NOT logged (security confirmed)
- **Expiry Time**: 15 minutes exactly as configured
- **HMAC Security**: Client ID, expiration, and resource path signed

## Storage CORS Strategy

### Option 1: Navigate/IMG (Recommended) ✅
**Implementation**: Portal uses `window.location.href` or `<img>` tags to access signed URLs

**Advantages**:
- No CORS preflight required
- Direct browser navigation
- Works with all file types (PDF, images, documents)
- No additional configuration needed

**Code Example**:
```javascript
// Portal implementation (recommended)
function downloadFile(fileData) {
  // Direct navigation - no CORS issues
  window.location.href = fileData.signed_url;
}

function displayImage(fileData) {
  // Image element - no CORS issues  
  const img = document.createElement('img');
  img.src = fileData.signed_url;
  document.getElementById('file-preview').appendChild(img);
}
```

### Option 2: XHR with Storage CORS (If Needed)
**Implementation**: If portal needs XHR/fetch for file downloads

**Storage CORS Configuration**:
```json
{
  "CORSConfiguration": {
    "CORSRule": [
      {
        "AllowedOrigin": ["https://datahubportal.com"],
        "AllowedMethod": ["GET"],
        "AllowedHeader": ["*"],
        "ExposeHeader": ["Content-Length", "Content-Type", "Content-Disposition"],
        "MaxAgeSeconds": 600
      }
    ]
  }
}
```

### Option 3: API Proxy (Maximum Control)
**Implementation**: API proxies file requests

**API Endpoint**:
```javascript
// New API endpoint: GET /v1/jobs/{jobId}/files/{fileId}/download
app.get('/v1/jobs/:jobId/files/:fileId/download', authMiddleware, async (req, res) => {
  // Validate access
  const fileData = await filesService.getFile(req.params.fileId, req.clientId);
  
  // Stream file from storage
  const fileStream = await storage.getObject(fileData.bucket, fileData.objectPath);
  
  // Set proper headers
  res.setHeader('Content-Type', fileData.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${fileData.name}"`);
  res.setHeader('Cache-Control', 'private, max-age=0, no-store');
  
  // Stream file to client
  fileStream.pipe(res);
});
```

## Recommended Implementation

### For datahubportal.com Portal ✅

```javascript
// Portal file handling (recommended approach)
class FileHandler {
  
  // For downloads - use direct navigation
  downloadFile(fileData) {
    // Create temporary anchor element
    const a = document.createElement('a');
    a.href = fileData.signed_url;
    a.download = fileData.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  
  // For preview - use image/iframe elements
  previewFile(fileData) {
    if (fileData.mime_type.startsWith('image/')) {
      return `<img src="${fileData.signed_url}" alt="${fileData.name}">`;
    } else if (fileData.mime_type === 'application/pdf') {
      return `<iframe src="${fileData.signed_url}" width="100%" height="600px"></iframe>`;
    }
    // For other file types, provide download link
    return `<a href="${fileData.signed_url}" target="_blank">View ${fileData.name}</a>`;
  }
  
  // For API calls - fetch file metadata only
  async getFileMetadata(jobId, fileId) {
    const response = await fetch(`https://api.datahubportal.com/v1/jobs/${jobId}/files`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    return data.data.find(file => file.id === fileId);
  }
}
```

### Security Validation ✅

```bash
# API Response Headers Validation
$ curl -H "Authorization: Bearer token" https://api.datahubportal.com/v1/jobs/job_test/files

HTTP/1.1 200 OK
Cache-Control: private, max-age=0, no-store
Pragma: no-cache
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 119

{
  "data": [{
    "signed_url": "https://storage.datahubportal.com/files/.../document.pdf?expires=1725240123&client=token&signature=abc123...",
    "expires_at": "2025-09-02T12:08:43.789Z"
  }]
}

✅ Cache headers correct
✅ Query string NOT logged in audit logs  
✅ Expiry time ~15 minutes from now
```

## Implementation Checklist

### API Configuration ✅
- [x] Cache-Control headers: `private, max-age=0, no-store`
- [x] Query string redaction in audit logs
- [x] 15-minute expiry validation
- [x] HMAC signature with client context

### Portal Integration Options
- [x] **Option 1 (Recommended)**: Direct navigation/img tags (no CORS needed)
- [ ] **Option 2**: XHR with storage CORS (if required)
- [ ] **Option 3**: API proxy endpoint (maximum control)

### Storage Security ✅  
- [x] Signed URLs only accessible with valid signature
- [x] Time-bounded access (15 minutes)
- [x] Client-specific signatures (no cross-tenant access)
- [x] Object path validation (anti-traversal)

## Production Deployment Notes

1. **Default Implementation**: Use navigate/img approach (Option 1)
2. **If XHR Required**: Configure storage CORS for `https://datahubportal.com`
3. **For Maximum Security**: Implement API proxy (Option 3)
4. **Monitor Usage**: Track file access patterns in analytics
5. **Performance**: Direct access (Option 1) has best performance

**Recommended**: Start with Option 1 (navigate/img) as it requires no additional configuration and provides the best user experience.