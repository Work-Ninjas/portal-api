import { Request, Response, NextFunction } from 'express';
import { ApiError, ErrorCodes } from '../utils/errors';
import { getDatabase } from '../services/database';

// Wrapper for async middleware
function asyncMiddleware(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiError(
      401,
      ErrorCodes.UNAUTHORIZED,
      'Bearer token is missing or invalid'
    );
  }

  const token = authHeader.substring(7);
  
  // P0 Fix: Implement strict authentication mode
  const authMode = process.env.AUTH_MODE || 'permissive';
  const tokenEnvPrefix = process.env.TOKEN_ENV_PREFIX || '';
  
  if (authMode === 'strict') {
    // Strict mode: validate token environment prefix
    if (tokenEnvPrefix && !token.startsWith(tokenEnvPrefix)) {
      throw new ApiError(
        401,
        ErrorCodes.WRONG_ENVIRONMENT_TOKEN,
        `Token must start with ${tokenEnvPrefix} for this environment`
      );
    }
    
    // Additional strict validation: minimum token length
    if (token.length < 16) {
      throw new ApiError(
        401,
        ErrorCodes.INVALID_TOKEN_FORMAT,
        'Invalid token format'
      );
    }
  }
  
  // Extract client_id from validated token
  // In production, validate token against API key store and extract p_client_id
  // p_client_id is the tenant identifier, not derived from request
  
  try {
    // Real API key validation - look up in database
    // Extract public_id from token (format: prefix_publicId_rest)
    const tokenParts = token.split('_');
    if (tokenParts.length < 3) {
      throw new ApiError(
        401,
        ErrorCodes.INVALID_TOKEN_FORMAT,
        'Invalid token format'
      );
    }
    
    const publicId = tokenParts[2]; // Extract public ID from token (3rd part)
    const tokenEnv = tokenParts[1]; // Extract environment (2nd part)
    
    console.log('Auth debug:', { publicId, tokenEnv, token: token.substring(0, 20) + '...' });
    
    // Look up API key in database
    const db = getDatabase();
    const apiKey = await db.findActiveKeyByPublicId(publicId, tokenEnv);
    
    console.log('API key lookup result:', apiKey ? 'FOUND' : 'NOT_FOUND');
    
    if (!apiKey) {
      throw new ApiError(
        401,
        ErrorCodes.UNAUTHORIZED,
        'Invalid or expired API key'
      );
    }
    
    // Use the client_id from the validated API key
    req.clientId = apiKey.client_id;
    
    // Update last used timestamp (non-blocking)
    db.updateLastUsed(apiKey.id).catch(() => {
      // Ignore errors for non-critical operation
    });
    
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      401,
      ErrorCodes.UNAUTHORIZED,
      'Authentication failed'
    );
  }
  
  const tenantId = req.clientId; // client_id IS tenant_id in this database
  req.headers['x-tenant-id'] = tenantId; // Internal header for RPC calls
  
  next();
}

// Export wrapped middleware
export default asyncMiddleware(authMiddleware);