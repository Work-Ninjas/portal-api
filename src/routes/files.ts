import { Router, Request, Response } from 'express';
import { FileAsset, PaginationResponse } from '../types';
import { authMiddleware } from '../middleware/auth';
import { ApiError, ErrorCodes } from '../utils/errors';

const router = Router();

// Stub data
const stubFiles: Record<string, FileAsset[]> = {
  'job_x1y2z3a4': [
    {
      id: 'file_m3n4o5p6',
      name: 'site_photo_001.jpg',
      kind: 'photo',
      size: 2457600,
      mime_type: 'image/jpeg',
      signed_url: 'https://storage.example.com/files/abc123?token=xyz&expires=1705745400',
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes from now
      created_at: '2024-01-20T10:15:00Z'
    },
    {
      id: 'file_q7r8s9t0',
      name: 'work_order.pdf',
      kind: 'document',
      size: 145238,
      mime_type: 'application/pdf',
      signed_url: 'https://storage.example.com/files/def456?token=abc&expires=1705745400',
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      created_at: '2024-01-19T14:00:00Z'
    }
  ],
  'job_b5c6d7e8': [],
  'job_f9g0h1i2': [
    {
      id: 'file_u1v2w3x4',
      name: 'inspection_report.pdf',
      kind: 'report',
      size: 523456,
      mime_type: 'application/pdf',
      signed_url: 'https://storage.example.com/files/ghi789?token=qrs&expires=1705744500',
      expires_at: new Date(Date.now() + 14 * 60 * 1000).toISOString(), // Expiring soon
      created_at: '2024-01-18T11:00:00Z'
    }
  ]
};

router.get('/jobs/:jobId/files', authMiddleware, (req: Request, res: Response) => {
  const { jobId } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const kind = req.query.kind as string;

  // Validate job ID format
  if (!jobId.match(/^job_[a-z0-9]{8}$/)) {
    throw new ApiError(400, ErrorCodes.BAD_REQUEST, 'Invalid job ID format');
  }

  // Validate parameters
  if (limit < 1) {
    throw new ApiError(400, ErrorCodes.BAD_REQUEST, 'Limit must be greater than 0');
  }
  if (offset < 0) {
    throw new ApiError(400, ErrorCodes.BAD_REQUEST, 'Offset must be non-negative');
  }

  const validKinds = ['document', 'photo', 'invoice', 'report', 'other'];
  if (kind && !validKinds.includes(kind)) {
    throw new ApiError(422, ErrorCodes.VALIDATION_FAILED, 'Invalid file kind', undefined, [
      { field: 'kind', message: 'Invalid file kind', code: 'enum.invalid' }
    ]);
  }

  // Get files for job
  const jobFiles = stubFiles[jobId];
  if (!jobFiles) {
    throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Job not found');
  }

  // Filter by kind if specified
  let filteredFiles = [...jobFiles];
  if (kind) {
    filteredFiles = filteredFiles.filter(file => file.kind === kind);
  }

  // Apply pagination
  const paginatedFiles = filteredFiles.slice(offset, offset + limit);
  const total = filteredFiles.length;
  const has_more = (offset + limit) < total;

  const response: PaginationResponse & { data: FileAsset[] } = {
    data: paginatedFiles,
    total,
    limit,
    offset,
    has_more
  };

  res.status(200).json(response);
});

export default router;