import { Request, Response, NextFunction } from 'express';
import { ApiError, ErrorCodes } from '../utils/errors';

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
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
  req.clientId = `client_${token.substring(tokenEnvPrefix.length, tokenEnvPrefix.length + 8)}`;
  
  // Mock tenant mapping: api_key -> p_client_id -> tenant_id
  // In production, this would be looked up from the API key store
  const tenantId = `tenant_${req.clientId.substring(7, 15)}`;
  req.headers['x-tenant-id'] = tenantId; // Internal header for RPC calls
  
  next();
}