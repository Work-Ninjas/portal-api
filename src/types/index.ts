export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface PaginationResponse {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface ErrorResponse {
  type: string;
  title: string;
  status: number;
  code: string;
  detail: string;
  traceId: string;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface Contact {
  id: string;
  name: string;
  company?: string;
  emails: ContactEmail[];
  phones?: ContactPhone[];
  address?: ContactAddress;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface ContactEmail {
  email: string;
  type: 'work' | 'personal' | 'other';
  is_primary: boolean;
}

export interface ContactPhone {
  phone: string;
  type: 'mobile' | 'work' | 'home' | 'other';
  is_primary: boolean;
}

export interface ContactAddress {
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

export type JobStatus = 
  | 'open'
  | 'scheduled'
  | 'in_progress'
  | 'blocked'
  | 'awaiting_review'
  | 'completed'
  | 'canceled'
  | 'archived';

export interface Job {
  id: string;
  title: string;
  status: JobStatus;
  status_reason?: string;
  status_updated_at: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  contact_id: string;
  scheduled_start?: string;
  scheduled_end?: string;
  assignee_ids?: string[];
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface FileAsset {
  id: string;
  name: string;
  kind: 'document' | 'photo' | 'invoice' | 'report' | 'other';
  size: number;
  mime_type: string;
  signed_url: string;
  expires_at: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}