import { Router, Request, Response } from 'express';
import { JobStatus } from '../types';
import authMiddleware from '../middleware/auth';
import { ApiError, ErrorCodes } from '../utils/errors';
import { JobsService } from '../services/jobs-rpc';

const router = Router();
const jobsService = new JobsService();

router.get('/jobs', authMiddleware, async (req: Request, res: Response) => {
  // Parse parameters
  const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const sort = (req.query.sort as string) || 'created_at';
  const dir = (req.query.dir as string) || 'desc';
  const q = req.query.q as string;
  const status = req.query.status as JobStatus;

  // Validate parameters
  if (limit < 1) {
    throw new ApiError(400, ErrorCodes.BAD_REQUEST, 'Limit must be greater than 0');
  }
  if (offset < 0) {
    throw new ApiError(400, ErrorCodes.BAD_REQUEST, 'Offset must be non-negative');
  }
  if (!['asc', 'desc'].includes(dir)) {
    throw new ApiError(422, ErrorCodes.VALIDATION_FAILED, 'Invalid sort direction', undefined, [
      { field: 'dir', message: 'Must be either "asc" or "desc"', code: 'enum.invalid' }
    ]);
  }
  if (!['created_at', 'updated_at', 'status', 'priority'].includes(sort)) {
    throw new ApiError(422, ErrorCodes.VALIDATION_FAILED, 'Invalid sort field', undefined, [
      { field: 'sort', message: 'Invalid sort field', code: 'enum.invalid' }
    ]);
  }

  const validStatuses: JobStatus[] = [
    'open', 'scheduled', 'in_progress', 'blocked', 
    'awaiting_review', 'completed', 'canceled', 'archived'
  ];
  
  if (status && !validStatuses.includes(status)) {
    throw new ApiError(422, ErrorCodes.VALIDATION_FAILED, 'Invalid status value', undefined, [
      { field: 'status', message: 'Invalid status value', code: 'enum.invalid' }
    ]);
  }

  try {
    const result = await jobsService.listJobs({
      limit,
      offset,
      sort,
      dir,
      q,
      status,
      traceId: req.traceId,
      clientId: req.clientId!
    });

    res.status(200).json(result);
  } catch (error) {
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to retrieve jobs');
  }
});

router.get('/jobs/:id', authMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params;

  // Validate ID format (UUID) - return 400 for invalid format, reserve 404 for not found
  if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    throw new ApiError(400, ErrorCodes.BAD_REQUEST, 'Invalid job ID format');
  }

  try {
    const job = await jobsService.getJobById({
      id,
      traceId: req.traceId,
      clientId: req.clientId!
    });

    res.status(200).json(job);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Job not found');
    }
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to retrieve job');
  }
});

export default router;