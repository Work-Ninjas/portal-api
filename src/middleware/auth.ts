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
  
  // For stub/demo purposes, accept any token and extract client_id
  // In production, validate token against API key store and extract p_client_id
  // p_client_id is the tenant identifier, not derived from request
  req.clientId = `client_${token.substring(0, 8)}`;
  
  // Mock tenant mapping: api_key -> p_client_id -> tenant_id
  // In production, this would be looked up from the API key store
  const tenantId = `tenant_${req.clientId.substring(7, 15)}`;
  req.headers['x-tenant-id'] = tenantId; // Internal header for RPC calls
  
  next();
}