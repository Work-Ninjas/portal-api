import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      traceId: string;
      requestId?: string;
      clientId?: string;
    }
  }
}

export function tracingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  const traceId = uuidv4();
  
  req.traceId = traceId;
  req.requestId = requestId;
  
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Trace-Id', traceId);
  
  // Add rate limit headers to all responses
  const windowStart = Math.floor(Date.now() / 60000) * 60000; // Start of current minute
  const windowEnd = windowStart + 60000; // End of current minute
  const remaining = Math.max(0, 60 - Math.floor(Math.random() * 10)); // Mock remaining requests
  
  res.setHeader('X-RateLimit-Limit', '60');
  res.setHeader('X-RateLimit-Remaining', remaining.toString());
  res.setHeader('X-RateLimit-Reset', Math.floor(windowEnd / 1000).toString());
  
  next();
}