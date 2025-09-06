import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { ApiError, ErrorCodes } from '../utils/errors';
import { ContactsService } from '../services/contacts-real';

const router = Router();
const contactsService = new ContactsService();

router.get('/contacts', authMiddleware, async (req: Request, res: Response) => {
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

  try {
    const result = await contactsService.listContacts({
      limit,
      offset,
      sort,
      dir,
      q,
      traceId: req.traceId,
      clientId: req.clientId!
    });

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Resource not found');
    }
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to retrieve contacts');
  }
});

router.get('/contacts/:id', authMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params;

  // Validate ID format - return 400 for invalid format, reserve 404 for not found
  if (!id.match(/^con_[a-z0-9]{8}$/)) {
    throw new ApiError(400, ErrorCodes.BAD_REQUEST, 'Invalid contact ID format');
  }

  try {
    const contact = await contactsService.getContactById({
      id,
      traceId: req.traceId,
      clientId: req.clientId!
    });

    res.status(200).json(contact);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Contact not found');
    }
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to retrieve contact');
  }
});

export default router;