import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import authMiddleware from '../middleware/auth';
import { ApiError, ErrorCodes } from '../utils/errors';
import { FilesService } from '../services/files-rpc';

const router = Router();
const filesService = new FilesService();

// Specific rate limiting for files endpoint: 120 requests per minute per client
const filesRateLimit = rateLimit({
  windowMs: 60000, // 1 minute
  max: 120,
  keyGenerator: (req: Request) => {
    // Rate limit per client_id, not IP
    return req.clientId || req.ip || 'unknown';
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.setHeader('Retry-After', '30');
    throw new ApiError(
      429,
      ErrorCodes.RATE_LIMIT_EXCEEDED,
      'Files endpoint rate limit exceeded. Please retry after 30 seconds'
    );
  }
});

router.get('/jobs/:jobId/files', authMiddleware, filesRateLimit, async (req: Request, res: Response) => {
  const { jobId } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const kind = req.query.kind as string;

  // Validate job ID format (UUID)
  if (!jobId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    throw new ApiError(400, ErrorCodes.BAD_REQUEST, 'Invalid job ID format');
  }

  // Validate parameters
  if (limit < 1) {
    throw new ApiError(400, ErrorCodes.BAD_REQUEST, 'Limit must be greater than 0');
  }
  if (limit > 100) {
    throw new ApiError(422, ErrorCodes.VALIDATION_FAILED, 'Limit cannot exceed 100', undefined, [
      { field: 'limit', message: 'Must be between 1 and 100', code: 'range.invalid' }
    ]);
  }
  if (offset < 0) {
    throw new ApiError(400, ErrorCodes.BAD_REQUEST, 'Offset must be non-negative');
  }

  const validKinds = ['document', 'photo', 'invoice', 'report', 'other'];
  if (kind && !validKinds.includes(kind)) {
    throw new ApiError(422, ErrorCodes.VALIDATION_FAILED, 'Invalid file kind', undefined, [
      { field: 'kind', message: 'Must be one of: document, photo, invoice, report, other', code: 'enum.invalid' }
    ]);
  }

  try {
    const result = await filesService.getJobFiles({
      jobId,
      limit,
      offset,
      kind,
      traceId: req.traceId,
      clientId: req.clientId!
    });

    // Set cache control headers as recommended for security
    res.setHeader('Cache-Control', 'private, max-age=0, no-store');
    res.setHeader('Pragma', 'no-cache');
    
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Job not found');
      }
      if (error.message.includes('Invalid object path')) {
        throw new ApiError(403, ErrorCodes.FORBIDDEN, 'File access denied');
      }
    }
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to retrieve job files');
  }
});

// GET /v1/activity/:activityId/files - COPIED EXACTLY FROM JOBS PATTERN
router.get('/activity/:activityId/files', authMiddleware, filesRateLimit, async (req: Request, res: Response) => {
  const { activityId } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const kind = req.query.kind as string;

  // Validate activity ID format (UUID) - COPIED FROM JOB VALIDATION
  if (!activityId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    throw new ApiError(400, ErrorCodes.BAD_REQUEST, 'Invalid activity ID format');
  }

  // Validate parameters - EXACT COPY FROM JOBS
  if (limit < 1) {
    throw new ApiError(400, ErrorCodes.BAD_REQUEST, 'Limit must be greater than 0');
  }
  if (limit > 100) {
    throw new ApiError(422, ErrorCodes.VALIDATION_FAILED, 'Limit cannot exceed 100', undefined, [
      { field: 'limit', message: 'Must be between 1 and 100', code: 'range.invalid' }
    ]);
  }
  if (offset < 0) {
    throw new ApiError(400, ErrorCodes.BAD_REQUEST, 'Offset must be non-negative');
  }

  const validKinds = ['document', 'photo', 'invoice', 'report', 'other'];
  if (kind && !validKinds.includes(kind)) {
    throw new ApiError(422, ErrorCodes.VALIDATION_FAILED, 'Invalid file kind', undefined, [
      { field: 'kind', message: 'Must be one of: document, photo, invoice, report, other', code: 'enum.invalid' }
    ]);
  }

  try {
    const result = await filesService.getActivityFiles({
      activityId,
      limit,
      offset,
      kind,
      traceId: req.traceId,
      clientId: req.clientId!
    });

    // Set cache control headers as recommended for security - EXACT COPY
    res.setHeader('Cache-Control', 'private, max-age=0, no-store');
    res.setHeader('Pragma', 'no-cache');
    
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Activity not found');
      }
      if (error.message.includes('Invalid object path')) {
        throw new ApiError(403, ErrorCodes.FORBIDDEN, 'File access denied');
      }
    }
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to retrieve activity files');
  }
});

export default router;