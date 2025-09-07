import { Router, Request, Response } from 'express';
import { Job, JobStatus, PaginationResponse } from '../types';
import authMiddleware from '../middleware/auth';
import { ApiError, ErrorCodes } from '../utils/errors';

const router = Router();

// Status mapping from internal to canonical
const STATUS_MAP: Record<string, JobStatus> = {
  'NEW': 'open',
  'OPEN': 'open',
  'SCHEDULED': 'scheduled',
  'IN_PROGRESS': 'in_progress',
  'WORKING': 'in_progress',
  'BLOCKED': 'blocked',
  'ON_HOLD': 'blocked',
  'REVIEW': 'awaiting_review',
  'AWAITING_REVIEW': 'awaiting_review',
  'DONE': 'completed',
  'COMPLETED': 'completed',
  'FINISHED': 'completed',
  'CANCELLED': 'canceled',
  'CANCELED': 'canceled',
  'ARCHIVED': 'archived',
  'CLOSED': 'archived'
};

// Stub data for initial implementation
const stubJobs: Job[] = [
  {
    id: 'job_x1y2z3a4',
    title: 'HVAC Maintenance - Building A',
    status: 'in_progress',
    status_updated_at: '2024-01-20T08:00:00Z',
    priority: 'high',
    contact_id: 'con_a1b2c3d4',
    scheduled_start: '2024-01-20T09:00:00Z',
    scheduled_end: '2024-01-20T17:00:00Z',
    created_at: '2024-01-18T14:30:00Z',
    updated_at: '2024-01-20T08:00:00Z'
  },
  {
    id: 'job_b5c6d7e8',
    title: 'Electrical Inspection',
    status: 'scheduled',
    status_updated_at: '2024-01-19T16:00:00Z',
    priority: 'medium',
    contact_id: 'con_e5f6g7h8',
    scheduled_start: '2024-01-25T10:00:00Z',
    created_at: '2024-01-19T16:00:00Z',
    updated_at: '2024-01-19T16:00:00Z'
  },
  {
    id: 'job_f9g0h1i2',
    title: 'Plumbing Repair - Floor 3',
    status: 'blocked',
    status_reason: 'Awaiting parts delivery',
    status_updated_at: '2024-01-19T11:30:00Z',
    priority: 'high',
    contact_id: 'con_a1b2c3d4',
    created_at: '2024-01-17T09:00:00Z',
    updated_at: '2024-01-19T11:30:00Z'
  }
];

export function mapInternalStatusToCanonical(internalStatus: string): JobStatus {
  const canonical = STATUS_MAP[internalStatus.toUpperCase()];
  if (!canonical) {
    // Default to 'open' if unknown status
    return 'open';
  }
  return canonical;
}

router.get('/jobs', authMiddleware, (req: Request, res: Response) => {
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

  // Filter jobs
  let filteredJobs = [...stubJobs];
  
  if (status) {
    filteredJobs = filteredJobs.filter(job => job.status === status);
  }
  
  if (q) {
    filteredJobs = filteredJobs.filter(job =>
      job.title.toLowerCase().includes(q.toLowerCase())
    );
  }

  // Sort jobs
  filteredJobs.sort((a, b) => {
    let aVal: any = a[sort as keyof Job];
    let bVal: any = b[sort as keyof Job];
    
    if (dir === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  // Apply pagination
  const paginatedJobs = filteredJobs.slice(offset, offset + limit);
  const total = filteredJobs.length;
  const has_more = (offset + limit) < total;

  const response: PaginationResponse & { data: Job[] } = {
    data: paginatedJobs,
    total,
    limit,
    offset,
    has_more
  };

  res.status(200).json(response);
});

export default router;