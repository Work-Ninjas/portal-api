import helmet from 'helmet';

export function createSecurityMiddleware() {
  return helmet({
    // Strict Transport Security - enforce HTTPS
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    
    // Prevent MIME sniffing
    xContentTypeOptions: false, // Use default nosniff behavior
    
    // Prevent framing (clickjacking protection)
    frameguard: {
      action: 'deny'
    },
    
    // CSP disabled for API - not needed for JSON responses
    contentSecurityPolicy: false,
    
    // Remove X-Powered-By header
    hidePoweredBy: true,
    
    // Additional security headers
    crossOriginEmbedderPolicy: false, // Not needed for API
    crossOriginOpenerPolicy: false,   // Not needed for API
    crossOriginResourcePolicy: false, // Will be handled by CORS
    
    // Referrer policy
    referrerPolicy: {
      policy: 'no-referrer'
    }
  });
}

// Azure Production CORS configuration - restricted to datahubportal.com origins
export function createCorsOptions() {
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : ['https://datahubportal.com', 'https://staging.datahubportal.com'];

  return {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow no-origin requests in development and from Azure health checks
      if (!origin && (process.env.NODE_ENV !== 'production' || isAzureHealthCheck())) {
        return callback(null, true);
      }
      
      // In production, require valid origin for browser requests
      if (!origin && process.env.NODE_ENV === 'production') {
        return callback(new Error('Origin header required'));
      }
      
      if (origin && allowedOrigins.includes(origin)) {
        callback(null, true);
      } else if (origin) {
        callback(new Error(`Origin ${origin} not allowed by CORS policy`));
      } else {
        callback(null, true); // No origin in dev
      }
    },
    methods: ['GET', 'HEAD', 'OPTIONS', 'POST'], // Add POST for API key rotation
    allowedHeaders: [
      'Authorization',
      'Content-Type', 
      'X-Request-Id',
      'x-user-id' // Required for portal integration
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset', 
      'Retry-After'
    ],
    credentials: false, // No credentials needed for API key auth
    maxAge: 600 // 10 minutes preflight cache as requested
  };
}

// Helper function to detect Azure health check requests
function isAzureHealthCheck(): boolean {
  // Azure Front Door and Application Gateway health checks
  const userAgent = process.env.HTTP_USER_AGENT || '';
  return userAgent.includes('Azure-FrontDoor-HealthProbe') ||
         userAgent.includes('Microsoft-Azure-Application-Gateway') ||
         userAgent.includes('AlwaysOn');
}