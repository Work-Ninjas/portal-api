import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createSecurityMiddleware, createCorsOptions } from './middleware/security';
import { tracingMiddleware } from './middleware/tracing';
import { loggingMiddleware } from './middleware/logging';
import { metricsMiddleware, createMetricsRoute } from './middleware/metrics';
import { errorHandler } from './middleware/errorHandler';
import healthRoutes from './routes/health';
import contactsRoutes from './routes/contacts-real';
import jobsRoutes from './routes/jobs-real';
import filesRoutes from './routes/files-real';
import { ApiError, ErrorCodes } from './utils/errors';

export function createGateCApp(): Application {
  const app = express();

  // Security middleware - production hardened
  app.use(createSecurityMiddleware());
  app.use(cors(createCorsOptions()));

  // Global rate limiting (lower than files-specific limit)
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '60'),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req: Request, res: Response) => {
      res.setHeader('Retry-After', '30');
      throw new ApiError(
        429,
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        'Rate limit exceeded. Please retry after 30 seconds'
      );
    }
  });

  // Apply rate limiting to API routes
  app.use('/v1', limiter);

  // Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Custom middleware
  app.use(tracingMiddleware);
  app.use(loggingMiddleware);
  app.use(metricsMiddleware);

  // Routes
  app.use('/v1', healthRoutes);
  app.use('/v1', contactsRoutes);
  app.use('/v1', jobsRoutes);
  app.use('/v1', filesRoutes); // Gate C: Files with signed URLs
  
  // Metrics endpoint (for monitoring)
  app.get('/metrics', createMetricsRoute());

  // 404 handler
  app.use((_req: Request, _res: Response, _next: NextFunction) => {
    throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Endpoint not found');
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}