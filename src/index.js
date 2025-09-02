// Portal API - Main Application
const express = require('express');
const cors = require('cors');
const app = express();

// Environment variables
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || 'https://datahubportal.com,https://staging.datahubportal.com,https://docs.datahubportal.com,https://docs.staging.datahubportal.com';

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = ALLOWED_ORIGINS.split(',');
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'HEAD', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After'],
  credentials: false,
  maxAge: 600 // 10 minutes
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Rate limiting headers (simulated)
app.use((req, res, next) => {
  res.setHeader('X-RateLimit-Limit', '60');
  res.setHeader('X-RateLimit-Remaining', '59');
  res.setHeader('X-RateLimit-Reset', Math.floor(Date.now() / 1000) + 60);
  next();
});

// Application Insights
if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  const appInsights = require('applicationinsights');
  appInsights.setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
    .setAutoDependencyCorrelation(true)
    .setAutoCollectRequests(true)
    .setAutoCollectPerformance(true, true)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectConsole(true)
    .setUseDiskRetryCaching(true)
    .setSendLiveMetrics(true)
    .setDistributedTracingMode(appInsights.DistributedTracingModes.AI_AND_W3C)
    .start();
}

// Routes
app.get('/v1/health', (req, res) => {
  res.json({
    status: 'healthy',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'portal-api',
    version: '1.0.0'
  });
});

app.get('/v1/contacts', (req, res) => {
  // Check for authorization
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      type: 'https://datatracker.ietf.org/doc/html/rfc7235#section-3.1',
      title: 'Unauthorized',
      status: 401,
      detail: 'Missing or invalid authorization header',
      traceId: req.headers['x-request-id'] || generateTraceId()
    });
  }

  // Return sample data
  res.json({
    data: [
      { id: 1, name: 'John Doe', email: 'john@example.com' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
    ],
    pagination: {
      limit: 25,
      offset: 0,
      total: 2,
      has_more: false
    }
  });
});

app.get('/v1/jobs', (req, res) => {
  // Check for authorization
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      type: 'https://datatracker.ietf.org/doc/html/rfc7235#section-3.1',
      title: 'Unauthorized',
      status: 401,
      detail: 'Missing or invalid authorization header',
      traceId: req.headers['x-request-id'] || generateTraceId()
    });
  }

  // Return sample jobs
  res.json({
    data: [
      { 
        id: 'job-001', 
        status: 'completed',
        created_at: '2025-09-01T10:00:00Z',
        updated_at: '2025-09-01T12:00:00Z'
      },
      { 
        id: 'job-002', 
        status: 'in_progress',
        created_at: '2025-09-02T08:00:00Z',
        updated_at: '2025-09-02T14:00:00Z'
      }
    ],
    pagination: {
      limit: 25,
      offset: 0,
      total: 2,
      has_more: false
    }
  });
});

app.get('/v1/jobs/:jobId/files', (req, res) => {
  // Check for authorization
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      type: 'https://datatracker.ietf.org/doc/html/rfc7235#section-3.1',
      title: 'Unauthorized',
      status: 401,
      detail: 'Missing or invalid authorization header',
      traceId: req.headers['x-request-id'] || generateTraceId()
    });
  }

  // Set cache headers for files endpoint
  res.setHeader('Cache-Control', 'private, max-age=0, no-store');
  res.setHeader('Pragma', 'no-cache');

  const { jobId } = req.params;
  
  // Return signed URLs (15-minute expiry)
  const expiryTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  
  res.json({
    job_id: jobId,
    files: [
      {
        name: 'document1.pdf',
        size: 1024000,
        signed_url: `https://storage.azure.com/files/${jobId}/document1.pdf?expires=${expiryTime}`,
        expires_at: expiryTime
      },
      {
        name: 'report.xlsx',
        size: 512000,
        signed_url: `https://storage.azure.com/files/${jobId}/report.xlsx?expires=${expiryTime}`,
        expires_at: expiryTime
      }
    ]
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.4',
    title: 'Not Found',
    status: 404,
    detail: `The requested resource ${req.path} was not found`,
    traceId: req.headers['x-request-id'] || generateTraceId()
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.6.1',
    title: 'Internal Server Error',
    status: 500,
    detail: 'An unexpected error occurred',
    traceId: req.headers['x-request-id'] || generateTraceId()
  });
});

// Helper function for trace ID
function generateTraceId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Start server
app.listen(PORT, () => {
  console.log(`Portal API running on port ${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
  console.log(`CORS origins: ${ALLOWED_ORIGINS}`);
  console.log(`Health check: http://localhost:${PORT}/v1/health`);
});