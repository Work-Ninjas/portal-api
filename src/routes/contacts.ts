import { Router, Request, Response } from 'express';
import { Contact, PaginationResponse } from '../types';
import { authMiddleware } from '../middleware/auth';
import { ApiError, ErrorCodes } from '../utils/errors';

const router = Router();

// Stub data for Gate A'
const stubContacts: Contact[] = [
  {
    id: 'con_a1b2c3d4',
    name: 'John Smith',
    company: 'Acme Corp',
    emails: [
      {
        email: 'john@acme.com',
        type: 'work',
        is_primary: true
      }
    ],
    phones: [
      {
        phone: '+14155551234',
        type: 'mobile',
        is_primary: true
      }
    ],
    created_at: '2024-01-15T10:30:00Z',
    updated_at: '2024-01-15T10:30:00Z'
  },
  {
    id: 'con_e5f6g7h8',
    name: 'Jane Doe',
    emails: [
      {
        email: 'jane.doe@example.com',
        type: 'personal',
        is_primary: true
      }
    ],
    created_at: '2024-01-14T09:15:00Z',
    updated_at: '2024-01-14T09:15:00Z'
  }
];

router.get('/contacts', authMiddleware, (req: Request, res: Response) => {
  // Parse pagination parameters
  const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const sort = (req.query.sort as string) || 'created_at';
  const dir = (req.query.dir as string) || 'desc';
  const q = req.query.q as string;

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
  if (!['created_at', 'updated_at', 'name'].includes(sort)) {
    throw new ApiError(422, ErrorCodes.VALIDATION_FAILED, 'Invalid sort field', undefined, [
      { field: 'sort', message: 'Invalid sort field', code: 'enum.invalid' }
    ]);
  }

  // Filter contacts based on search query (stub implementation)
  let filteredContacts = [...stubContacts];
  if (q) {
    filteredContacts = filteredContacts.filter(contact =>
      contact.name.toLowerCase().includes(q.toLowerCase()) ||
      contact.company?.toLowerCase().includes(q.toLowerCase())
    );
  }

  // Sort contacts (stub implementation)
  filteredContacts.sort((a, b) => {
    let aVal: any = a[sort as keyof Contact];
    let bVal: any = b[sort as keyof Contact];
    
    if (dir === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  // Apply pagination
  const paginatedContacts = filteredContacts.slice(offset, offset + limit);
  const total = filteredContacts.length;
  const has_more = (offset + limit) < total;

  const response: PaginationResponse & { data: Contact[] } = {
    data: paginatedContacts,
    total,
    limit,
    offset,
    has_more
  };

  res.status(200).json(response);
});

router.get('/contacts/:id', authMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;

  // Validate ID format
  if (!id.match(/^con_[a-z0-9]{8}$/)) {
    throw new ApiError(400, ErrorCodes.BAD_REQUEST, 'Invalid contact ID format');
  }

  // Find contact (stub implementation)
  const contact = stubContacts.find(c => c.id === id);

  if (!contact) {
    throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Contact not found');
  }

  res.status(200).json(contact);
});

export default router;