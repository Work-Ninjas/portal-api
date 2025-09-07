import { Router, Request, Response } from 'express';
import { ActivityEntityType, ActivityType, ActivityPriority } from '../types';
import authMiddleware from '../middleware/auth';
import { ApiError, ErrorCodes } from '../utils/errors';
import { ActivitiesService } from '../services/activities-rpc';

const router = Router();
const activitiesService = new ActivitiesService();

// GET /v1/activity - List all activities with optional filtering
router.get('/activity', authMiddleware, async (req: Request, res: Response) => {
  // ✅ PARSEO Y VALIDACIÓN DE PARÁMETROS
  const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const sort = (req.query.sort as string) || 'occurred_at';
  const dir = (req.query.dir as string) || 'desc';
  
  // Optional filters
  const entityType = req.query.entity_type as ActivityEntityType;
  const entityId = req.query.entity_id as string;
  const author = req.query.author as string;
  const since = req.query.since as string;
  const until = req.query.until as string;
  const q = req.query.q as string;
  const activityType = req.query.activity_type as ActivityType;
  const priority = req.query.priority as ActivityPriority;

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
  if (!['occurred_at', 'created_at', 'updated_at', 'author'].includes(sort)) {
    throw new ApiError(422, ErrorCodes.VALIDATION_FAILED, 'Invalid sort field', undefined, [
      { field: 'sort', message: 'Must be one of: occurred_at, created_at, updated_at, author', code: 'enum.invalid' }
    ]);
  }

  // Validate entity_type and entity_id relationship
  if ((entityType && !entityId) || (!entityType && entityId)) {
    throw new ApiError(400, ErrorCodes.BAD_REQUEST, 'Both entity_type and entity_id must be provided together or both omitted');
  }

  // Validate entity_type values
  if (entityType && !['job', 'contact'].includes(entityType)) {
    throw new ApiError(422, ErrorCodes.VALIDATION_FAILED, 'Invalid entity_type', undefined, [
      { field: 'entity_type', message: 'Must be either "job" or "contact"', code: 'enum.invalid' }
    ]);
  }

  // Validate entity_id format (UUID)
  if (entityId && !entityId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    throw new ApiError(400, ErrorCodes.BAD_REQUEST, 'Invalid entity_id format (must be UUID)');
  }

  // Validate activity_type values
  if (activityType && !['user', 'system'].includes(activityType)) {
    throw new ApiError(422, ErrorCodes.VALIDATION_FAILED, 'Invalid activity_type', undefined, [
      { field: 'activity_type', message: 'Must be either "user" or "system"', code: 'enum.invalid' }
    ]);
  }

  // Validate priority values
  if (priority && !['low', 'normal', 'high'].includes(priority)) {
    throw new ApiError(422, ErrorCodes.VALIDATION_FAILED, 'Invalid priority', undefined, [
      { field: 'priority', message: 'Must be one of: low, normal, high', code: 'enum.invalid' }
    ]);
  }

  // Validate date formats (ISO 8601)
  if (since && isNaN(Date.parse(since))) {
    throw new ApiError(400, ErrorCodes.BAD_REQUEST, 'Invalid since date format (must be ISO 8601)');
  }
  if (until && isNaN(Date.parse(until))) {
    throw new ApiError(400, ErrorCodes.BAD_REQUEST, 'Invalid until date format (must be ISO 8601)');
  }

  try {
    const result = await activitiesService.listActivities({
      entityType,
      entityId,
      author,
      since,
      until,
      q,
      activityType,
      priority,
      limit,
      offset,
      sort,
      dir,
      traceId: req.traceId,
      clientId: req.clientId!
    });

    res.status(200).json(result);
  } catch (error) {
    // ✅ MANEJO DE ERRORES ESPECÍFICOS
    if (error instanceof Error) {
      if (error.message.includes('Both entity_type and entity_id must be provided together')) {
        throw new ApiError(400, ErrorCodes.BAD_REQUEST, 'Both entity_type and entity_id must be provided together or both omitted');
      }
    }
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to retrieve activities');
  }
});

// GET /v1/jobs/:jobId/activity - List activities for specific job
router.get('/jobs/:jobId/activity', authMiddleware, async (req: Request, res: Response) => {
  const { jobId } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const sort = (req.query.sort as string) || 'occurred_at';
  const dir = (req.query.dir as string) || 'desc';
  
  // Optional filters (same as general activity endpoint)
  const author = req.query.author as string;
  const since = req.query.since as string;
  const until = req.query.until as string;
  const q = req.query.q as string;
  const activityType = req.query.activity_type as ActivityType;
  const priority = req.query.priority as ActivityPriority;

  // Validate job ID format (UUID)
  if (!jobId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    throw new ApiError(400, ErrorCodes.BAD_REQUEST, 'Invalid job ID format');
  }

  // Same parameter validations as general endpoint
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

  try {
    const result = await activitiesService.listActivities({
      entityType: 'job',  // ✅ Fixed to 'job' for this endpoint
      entityId: jobId,    // ✅ Use jobId from URL params
      author,
      since,
      until,
      q,
      activityType,
      priority,
      limit,
      offset,
      sort,
      dir,
      traceId: req.traceId,
      clientId: req.clientId!
    });

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Job not found or no activities');
      }
    }
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to retrieve job activities');
  }
});

// GET /v1/activity/:id - Get single activity by ID
router.get('/activity/:id', authMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params;

  // Validate activity ID format (UUID)
  if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    throw new ApiError(400, ErrorCodes.BAD_REQUEST, 'Invalid activity ID format');
  }

  try {
    const activity = await activitiesService.getActivity({
      activityId: id,
      traceId: req.traceId,
      clientId: req.clientId!
    });

    res.status(200).json(activity);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Activity not found');
      }
    }
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to retrieve activity');
  }
});

export default router;