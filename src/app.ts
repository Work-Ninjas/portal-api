import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { tracingMiddleware } from './middleware/tracing';
import { loggingMiddleware } from './middleware/logging';
import { errorHandler } from './middleware/errorHandler';
import healthRoutes from './routes/health';
import contactsRoutes from './routes/contacts';
import jobsRoutes from './routes/jobs';
import filesRoutes from './routes/files';
import { ApiError, ErrorCodes } from './utils/errors';

export function createApp(): Application {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '60'),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req: Request, _res: Response) => {
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

  // Routes
  app.use('/v1', healthRoutes);
  app.use('/v1', contactsRoutes);
  app.use('/v1', jobsRoutes);
  app.use('/v1', filesRoutes);

  // 404 handler
  app.use((_req: Request, _res: Response, _next: NextFunction) => {
    throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Endpoint not found');
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}