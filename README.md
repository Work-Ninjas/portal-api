# Portal API

Portal API - Tenant-aware REST API for contacts, jobs, and files management.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd portal-api

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
```

### Running Locally

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm run build
npm start
```

The server will start on `http://localhost:3000`

### Health Check

```bash
curl http://localhost:3000/v1/health
```

## 📋 Available Endpoints

### Gate A' - Walking Skeleton

- `GET /v1/health` - Health check endpoint (no auth required)
- `GET /v1/contacts` - List contacts (stub data)
- `GET /v1/contacts/:id` - Get contact by ID (stub data)

### Gate B - Real Implementation

- `GET /v1/jobs` - List jobs with status mapping
- `GET /v1/jobs/:jobId/files` - Get job files with signed URLs

## 🔐 Authentication

All endpoints except `/v1/health` require Bearer token authentication:

```bash
curl -H "Authorization: Bearer your_api_key" \
     http://localhost:3000/v1/contacts
```

## 📊 API Contract

This API implements the OpenAPI specification defined in the `portal-api-docs` repository.

### Pagination

All list endpoints support pagination:

```bash
GET /v1/contacts?limit=25&offset=0
```

- `limit`: Maximum items to return (1-100, default: 25)
- `offset`: Number of items to skip (default: 0)

Response includes:
- `total`: Total number of items
- `limit`: Applied limit
- `offset`: Applied offset
- `has_more`: Boolean indicating if more items exist

### Sorting

```bash
GET /v1/contacts?sort=created_at&dir=desc
```

- `sort`: Field to sort by (whitelist per resource)
- `dir`: Sort direction (`asc` or `desc`, default: `desc`)

### Search

```bash
GET /v1/contacts?q=smith
```

### Error Responses

Errors follow the Problem Details format (RFC 7807):

```json
{
  "type": "https://api.portal.example.com/errors/validation",
  "title": "Validation Error",
  "status": 422,
  "code": "VALIDATION_FAILED",
  "detail": "Invalid status value",
  "traceId": "abc123-def456-ghi789",
  "errors": [
    {
      "field": "status",
      "message": "Invalid status value",
      "code": "enum.invalid"
    }
  ]
}
```

## 🔍 Observability

### Request Tracing

Every request gets a unique `traceId` which is:
- Generated on request arrival
- Included in all log entries
- Returned in error responses
- Echoed if `X-Request-Id` header is provided

### Logging

Structured logging captures:
- `traceId`: Unique trace identifier
- `clientId`: Extracted from Bearer token
- `endpoint`: API endpoint path
- `method`: HTTP method
- `latency`: Request duration in ms
- `outcome`: `success` or `error`
- `statusCode`: HTTP response status

Example log entry:
```json
{
  "level": "info",
  "message": "Request completed",
  "traceId": "abc123-def456",
  "clientId": "client_test1234",
  "endpoint": "/v1/contacts",
  "method": "GET",
  "latency": 45,
  "outcome": "success",
  "statusCode": 200,
  "timestamp": "2024-01-20T10:30:00Z"
}
```

## 📈 Rate Limiting

Default limits (configurable via environment):
- 60 requests per minute per IP
- Headers included in responses:
  - `X-RateLimit-Limit`: Request limit
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset timestamp
  - `Retry-After`: Seconds until retry (on 429)

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Type check
npm run typecheck
```

## 📁 Project Structure

```
portal-api/
├── src/
│   ├── index.ts           # Application entry point
│   ├── app.ts             # Express app configuration
│   ├── types/             # TypeScript type definitions
│   ├── routes/            # API route handlers
│   ├── middleware/        # Express middleware
│   ├── utils/             # Utility functions
│   └── services/          # Business logic (future)
├── tests/                 # Test files
├── dist/                  # Compiled JavaScript (build output)
├── .env.example          # Environment variables template
├── tsconfig.json         # TypeScript configuration
├── package.json          # Dependencies and scripts
└── README.md            # This file
```

## 🔧 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `LOG_LEVEL` | Log level | `info` |
| `CORS_ORIGIN` | CORS origin | `*` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `60000` |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `60` |

## 📝 Development Notes

### Status Mapping

The API maps internal job statuses to canonical values:

| Internal Status | Canonical Status |
|----------------|-----------------|
| NEW, OPEN | open |
| SCHEDULED | scheduled |
| IN_PROGRESS, WORKING | in_progress |
| BLOCKED, ON_HOLD | blocked |
| REVIEW, AWAITING_REVIEW | awaiting_review |
| DONE, COMPLETED, FINISHED | completed |
| CANCELLED, CANCELED | canceled |
| ARCHIVED, CLOSED | archived |

### Null vs Omit Policy

Fields that don't apply are omitted from responses rather than set to `null`.

### Signed URLs

File endpoints return signed URLs with 15-minute expiration for secure file access.

## 🚢 Deployment

### Docker (future)

```bash
docker build -t portal-api .
docker run -p 3000:3000 portal-api
```

### Health Checks

The `/v1/health` endpoint can be used for:
- Load balancer health checks
- Kubernetes liveness/readiness probes
- Monitoring systems

## 📄 License

UNLICENSED - Proprietary

## 🤝 Contributing

1. Follow the API contract defined in `portal-api-docs`
2. Ensure all tests pass
3. Update documentation for API changes
4. Follow conventional commits format

## 📞 Support

For API issues or questions, contact the development team.