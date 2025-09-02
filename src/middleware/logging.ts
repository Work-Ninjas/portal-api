import { Request, Response, NextFunction } from 'express';
import { logger, LogContext } from '../utils/logger';

export function loggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  
  // Log request
  logger.info('Request received', {
    traceId: req.traceId,
    clientId: req.clientId,
    method: req.method,
    endpoint: req.path,
    query: req.query,
    headers: {
      'user-agent': req.headers['user-agent'],
      'x-request-id': req.headers['x-request-id']
    }
  });
  
  // Capture response
  const originalSend = res.send;
  res.send = function(data) {
    const latency = Date.now() - startTime;
    const outcome = res.statusCode >= 400 ? 'error' : 'success';
    
    const logContext: LogContext = {
      traceId: req.traceId,
      clientId: req.clientId,
      endpoint: req.path,
      method: req.method,
      latency,
      outcome,
      statusCode: res.statusCode
    };
    
    logger.info('Request completed', logContext);
    
    return originalSend.call(this, data);
  };
  
  next();
}