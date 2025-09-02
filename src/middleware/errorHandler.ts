import { Request, Response, NextFunction } from 'express';
import { ApiError, ErrorCodes } from '../utils/errors';
import { logger } from '../utils/logger';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const traceId = req.traceId || 'unknown';
  
  if (err instanceof ApiError) {
    logger.error('API Error', {
      traceId,
      clientId: req.clientId,
      endpoint: req.path,
      method: req.method,
      status: err.status,
      code: err.code,
      message: err.message
    });
    
    res.status(err.status).json(err.toResponse(traceId));
  } else {
    logger.error('Unexpected Error', {
      traceId,
      clientId: req.clientId,
      endpoint: req.path,
      method: req.method,
      error: err.message,
      stack: err.stack
    });
    
    const error = new ApiError(
      500,
      ErrorCodes.INTERNAL_ERROR,
      'An unexpected error occurred'
    );
    
    res.status(500).json(error.toResponse(traceId));
  }
}