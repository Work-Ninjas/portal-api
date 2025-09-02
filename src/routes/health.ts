import { Router, Request, Response } from 'express';
import { reliabilityService } from '../services/reliability';

const router = Router();

router.get('/health', (req: Request, res: Response) => {
  const circuitBreakers = reliabilityService.getCircuitBreakerStatuses();
  const hasOpenCircuits = Object.values(circuitBreakers).some((cb: any) => cb.state === 'OPEN');
  
  const response = {
    status: hasOpenCircuits ? 'degraded' : 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0-alpha',
    traceId: req.traceId,
    circuitBreakers,
    ...(req.requestId && { requestId: req.requestId })
  };
  
  // Return 503 if any circuit breakers are open
  const statusCode = hasOpenCircuits ? 503 : 200;
  res.status(statusCode).json(response);
});

export default router;