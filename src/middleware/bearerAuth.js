// F4-B: Strict Bearer Authentication using @datahubportal/tokens
const { parseToken, verifyToken } = require('@datahubportal/tokens');
const { getDatabase } = require('../services/database');
const { logger } = require('../utils/logger');

// F4-B: Required environment for token validation
const REQUIRED_ENV = process.env.TOKEN_ENV === 'live' ? 'live' : 'stg';

// Helper to return RFC 7807 Problem Details responses
function problem(res, status, code, detail, traceId, errors = null) {
  const response = {
    type: `https://api.portal.example.com/errors/${code.toLowerCase()}`,
    title: getStatusTitle(status),
    status,
    code,
    detail,
    traceId
  };
  
  if (errors) {
    response.errors = errors;
  }
  
  return res.status(status).json(response);
}

function getStatusTitle(status) {
  switch (status) {
    case 400: return 'Bad Request';
    case 401: return 'Unauthorized';
    case 403: return 'Forbidden';
    case 404: return 'Not Found';
    case 422: return 'Validation Error';
    case 429: return 'Too Many Requests';
    case 500: return 'Internal Server Error';
    default: return 'Unknown Error';
  }
}

// Schedule last_used_at update with throttling (fire and forget)
const lastUsedUpdateQueue = new Map();
function scheduleLastUsedUpdate(keyId) {
  if (lastUsedUpdateQueue.has(keyId)) {
    return; // Already scheduled within throttle window
  }
  
  lastUsedUpdateQueue.set(keyId, true);
  
  // Update after 1 second (batching), remove from queue after 60 seconds (throttle)
  setTimeout(async () => {
    try {
      const db = getDatabase();
      await db.supabase.rpc('api_update_key_last_used', { p_key_id: keyId });
    } catch (error) {
      logger.warn('Failed to update last_used_at', { keyId, error: error.message });
    }
  }, 1000);
  
  setTimeout(() => {
    lastUsedUpdateQueue.delete(keyId);
  }, 60000);
}

// F4-B: Strict Bearer Authentication Middleware
async function bearerAuth(req, res, next) {
  const traceId = req.headers['x-request-id'] || 'no-trace-id';
  req.traceId = traceId;
  
  // F4-B: Validate Authorization header
  const header = req.headers.authorization;
  if (!header) {
    logger.warn('F4-B: Missing Authorization header', { traceId });
    return problem(res, 401, 'missing_token', 'Bearer token required', traceId);
  }
  
  // F4-B: Extract token from Bearer format
  const match = /^Bearer\s+(.+)$/.exec(header);
  if (!match) {
    logger.warn('F4-B: Malformed Authorization header', { traceId });
    return problem(res, 401, 'invalid_token_format', 'Malformed Authorization', traceId);
  }
  const token = match[1];
  
  try {
    // F4-B: Parse token using official @datahubportal/tokens package
    let parsed;
    try {
      parsed = parseToken(token);
    } catch (parseError) {
      logger.warn('F4-B: Invalid token format', { 
        error: parseError.message, 
        traceId 
      });
      return problem(res, 401, 'invalid_token_format', 'Invalid token format', traceId);
    }
    
    // F4-B: Validate token environment
    if (parsed.env !== REQUIRED_ENV) {
      logger.warn('F4-B: Wrong token environment', { 
        required: REQUIRED_ENV, 
        provided: parsed.env, 
        traceId 
      });
      return problem(res, 401, 'wrong_environment_token', 'Wrong token environment', traceId);
    }
    
    // F4-B: Lookup API key in database (prefix_public_id, token_env, status='active')
    const db = getDatabase();
    const { data, error } = await db.supabase.rpc('api_find_active_key_by_public_id', {
      p_prefix_public_id: parsed.publicId,
      p_token_env: parsed.env
    });
    
    if (error) {
      logger.error('F4-B: Database error during key lookup', { 
        error: error.message, 
        traceId 
      });
      return problem(res, 500, 'internal_error', 'Authentication service error', traceId);
    }
    
    if (!data) {
      logger.warn('F4-B: API key not found or inactive', { 
        publicId: parsed.publicId, 
        env: parsed.env, 
        traceId 
      });
      return problem(res, 401, 'invalid_token', 'Invalid or revoked API key', traceId);
    }
    
    // F4-B: Cryptographic verification using @datahubportal/tokens package
    let verified;
    try {
      verified = await verifyToken(token, {
        hash: data.hash,
        hashVersion: data.hash_version,
        hashSaltId: data.hash_salt_id
      });
    } catch (verifyError) {
      logger.error('F4-B: Token verification failed', { 
        publicId: parsed.publicId,
        error: verifyError.message, 
        traceId 
      });
      return problem(res, 401, 'invalid_token', 'Invalid or revoked API key', traceId);
    }
    
    if (!verified) {
      logger.warn('F4-B: Token verification failed - hash mismatch', { 
        publicId: parsed.publicId, 
        traceId 
      });
      return problem(res, 401, 'invalid_token', 'Invalid or revoked API key', traceId);
    }
    
    // F4-B: Success - inject tenant context
    req.context = {
      client_id: data.client_id,
      api_key_id: data.id,
      token_env: data.token_env,
      public_id: parsed.publicId
    };
    
    // F4-B: Schedule last_used_at update (fire and forget, throttled)
    scheduleLastUsedUpdate(data.id);
    
    logger.info('F4-B: Bearer authentication successful', {
      publicId: parsed.publicId,
      clientId: data.client_id,
      env: data.token_env,
      traceId
    });
    
    next();
    
  } catch (error) {
    logger.error('F4-B: Unexpected authentication error', {
      error: error.message,
      stack: error.stack,
      traceId
    });
    return problem(res, 500, 'internal_error', 'Authentication service error', traceId);
  }
}

module.exports = {
  bearerAuth,
  problem
};