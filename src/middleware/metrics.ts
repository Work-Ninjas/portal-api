import { Request, Response, NextFunction } from 'express';
import { metricsService } from '../services/metrics';
import { logger } from '../utils/logger';

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  
  // Store original end method
  const originalEnd = res.end;
  
  // Override res.end to capture metrics
  res.end = function(this: Response, ...args: any[]) {
    const latency = Date.now() - startTime;
    const endpoint = getEndpointPattern(req.path);
    const method = req.method;
    const statusCode = res.statusCode;

    // Record latency
    metricsService.recordLatency(endpoint, method, latency);

    // Record success/error
    if (statusCode >= 200 && statusCode < 400) {
      metricsService.recordSuccess(endpoint, method);
    } else {
      const errorType = getErrorType(statusCode);
      const errorCode = statusCode.toString();
      metricsService.recordError(endpoint, method, errorCode, errorType);
    }

    // Log high latency requests
    if (latency > 1000) { // > 1 second
      logger.warn('High latency request detected', {
        endpoint,
        method,
        latency,
        statusCode,
        traceId: req.traceId,
        clientId: req.clientId
      });
    }

    // Call original end method
    return originalEnd.apply(this, args);
  };

  next();
}

function getEndpointPattern(path: string): string {
  // Convert dynamic paths to patterns for better grouping
  return path
    .replace(/\/v\d+/, '/v*')           // /v1 -> /v*
    .replace(/\/job_[a-z0-9]+/, '/{jobId}')  // job IDs
    .replace(/\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/, '/{id}') // UUIDs
    .replace(/\/\d+/, '/{id}');         // numeric IDs
}

function getErrorType(statusCode: number): string {
  if (statusCode >= 400 && statusCode < 500) {
    return 'client_error';
  } else if (statusCode >= 500) {
    return 'server_error';
  }
  return 'unknown';
}

// Metrics endpoint for Prometheus scraping or monitoring
export function createMetricsRoute() {
  return (req: Request, res: Response) => {
    const format = req.query.format as string;
    
    if (format === 'prometheus') {
      res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.send(metricsService.toPrometheusFormat());
    } else {
      // Default JSON format
      const metrics = {
        system: metricsService.getSystemSummary(),
        endpoints: metricsService.getAllMetrics()
      };
      res.json(metrics);
    }
  };
}