import { logger } from '../utils/logger';
import { 
  reliabilityService, 
  DEFAULT_RPC_TIMEOUT, 
  DEFAULT_RPC_RETRY, 
  DEFAULT_RPC_CIRCUIT_BREAKER 
} from './reliability';

export interface RpcOptions {
  baseUrl?: string;
  timeout?: number;
}

export interface RpcRequest {
  method: string;
  params?: Record<string, any>;
  traceId: string;
  clientId: string;
  tenantId?: string;
}

export interface RpcResponse<T = any> {
  result?: T;
  error?: {
    code: string;
    message: string;
    data?: any;
  };
}

export class RpcClient {
  private baseUrl: string;
  // private _timeout: number; // Future use for actual HTTP calls

  constructor(options: RpcOptions = {}) {
    this.baseUrl = options.baseUrl || process.env.RPC_BASE_URL || 'http://localhost:8080';
    // this._timeout = options.timeout || parseInt(process.env.RPC_TIMEOUT_MS || '10000');
  }

  async call<T>(request: RpcRequest): Promise<T> {
    const startTime = Date.now();
    
    logger.info('RPC call started', {
      method: request.method,
      traceId: request.traceId,
      clientId: request.clientId,
      baseUrl: this.baseUrl
    });

    try {
      // Execute RPC call with reliability features: timeout, retry, circuit breaker
      const result = await reliabilityService.executeReliably(
        () => this.simulateRpcCall<T>(request),
        {
          operationName: `rpc.${request.method}`,
          traceId: request.traceId,
          timeout: DEFAULT_RPC_TIMEOUT,
          retry: DEFAULT_RPC_RETRY,
          circuitBreaker: {
            name: `rpc-${request.method}`,
            options: DEFAULT_RPC_CIRCUIT_BREAKER
          }
        }
      );
      
      const latency = Date.now() - startTime;
      logger.info('RPC call completed', {
        method: request.method,
        traceId: request.traceId,
        latency,
        outcome: 'success'
      });

      return result;
    } catch (error) {
      const latency = Date.now() - startTime;
      logger.error('RPC call failed', {
        method: request.method,
        traceId: request.traceId,
        latency,
        outcome: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Simulate RPC calls with realistic data and behavior
  private async simulateRpcCall<T>(request: RpcRequest): Promise<T> {
    // Add realistic latency
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));

    switch (request.method) {
      case 'api_list_contacts':
        return this.simulateListContacts(request.params) as T;
      
      case 'api_get_contact':
        return this.simulateGetContact(request.params) as T;
      
      case 'api_list_jobs':
        return this.simulateListJobs(request.params) as T;
      
      case 'api_get_job':
        return this.simulateGetJob(request.params) as T;
      
      case 'api_get_job_files':
        return this.simulateGetJobFiles(request.params) as T;
      
      default:
        throw new Error(`Unknown RPC method: ${request.method}`);
    }
  }

  private simulateListContacts(params: any = {}) {
    // Simulate internal contact data with more fields than API response
    const internalContacts = [
      {
        contact_id: 'con_a1b2c3d4',
        full_name: 'John Smith',
        organization: 'Acme Corp',
        email_addresses: [
          { address: 'john@acme.com', type: 'WORK', primary: true },
          { address: 'john.personal@gmail.com', type: 'PERSONAL', primary: false }
        ],
        phone_numbers: [
          { number: '+14155551234', type: 'MOBILE', primary: true },
          { number: '+14155555678', type: 'WORK', primary: false }
        ],
        postal_address: {
          street_address: '123 Main St',
          city: 'San Francisco',
          state_province: 'CA',
          postal_code: '94105',
          country_code: 'US'
        },
        tags: ['vip', 'contractor'],
        created_timestamp: '2024-01-15T10:30:00Z',
        updated_timestamp: '2024-01-15T10:30:00Z',
        internal_notes: 'High-value client', // Internal field not exposed
        account_manager: 'Jane Manager' // Internal field not exposed
      },
      {
        contact_id: 'con_e5f6g7h8',
        full_name: 'Jane Doe',
        email_addresses: [
          { address: 'jane.doe@example.com', type: 'PERSONAL', primary: true }
        ],
        created_timestamp: '2024-01-14T09:15:00Z',
        updated_timestamp: '2024-01-14T09:15:00Z'
      },
      {
        contact_id: 'con_m9n0p1q2',
        full_name: 'Bob Johnson',
        organization: 'Tech Solutions Inc',
        email_addresses: [
          { address: 'bob@techsolutions.com', type: 'WORK', primary: true }
        ],
        phone_numbers: [
          { number: '+14155559999', type: 'MOBILE', primary: true }
        ],
        created_timestamp: '2024-01-12T15:20:00Z',
        updated_timestamp: '2024-01-12T15:20:00Z'
      }
    ];

    // Apply filtering and pagination (simplified)
    let filtered = [...internalContacts];
    
    if (params.search_query) {
      const query = params.search_query.toLowerCase();
      filtered = filtered.filter(contact => 
        contact.full_name.toLowerCase().includes(query) ||
        contact.organization?.toLowerCase().includes(query)
      );
    }

    const offset = params.offset || 0;
    const limit = params.limit || 25;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      contacts: paginated,
      total_count: filtered.length,
      has_more: (offset + limit) < filtered.length
    };
  }

  private simulateGetContact(params: any = {}) {
    const contacts = this.simulateListContacts().contacts;
    const contact = contacts.find(c => c.contact_id === params.contact_id);
    
    if (!contact) {
      throw new Error(`Contact not found: ${params.contact_id}`);
    }
    
    return contact;
  }

  private simulateListJobs(params: any = {}) {
    // Simulate internal job data with internal status values
    const internalJobs = [
      {
        job_id: 'job_x1y2z3a4',
        title: 'HVAC Maintenance - Building A',
        internal_status: 'IN_PROGRESS', // Internal status
        status_reason: null,
        status_changed_at: '2024-01-20T08:00:00Z',
        priority_level: 'HIGH',
        contact_id: 'con_a1b2c3d4',
        scheduled_start_time: '2024-01-20T09:00:00Z',
        scheduled_end_time: '2024-01-20T17:00:00Z',
        assigned_users: ['usr_abc123', 'usr_def456'],
        job_tags: ['maintenance', 'hvac'],
        created_timestamp: '2024-01-18T14:30:00Z',
        updated_timestamp: '2024-01-20T08:00:00Z',
        internal_notes: 'Urgent repair needed' // Internal field
      },
      {
        job_id: 'job_b5c6d7e8',
        title: 'Electrical Inspection',
        internal_status: 'SCHEDULED',
        status_changed_at: '2024-01-19T16:00:00Z',
        priority_level: 'MEDIUM',
        contact_id: 'con_e5f6g7h8',
        scheduled_start_time: '2024-01-25T10:00:00Z',
        created_timestamp: '2024-01-19T16:00:00Z',
        updated_timestamp: '2024-01-19T16:00:00Z'
      },
      {
        job_id: 'job_f9g0h1i2',
        title: 'Plumbing Repair - Floor 3',
        internal_status: 'BLOCKED',
        status_reason: 'Awaiting parts delivery',
        status_changed_at: '2024-01-19T11:30:00Z',
        priority_level: 'HIGH',
        contact_id: 'con_a1b2c3d4',
        created_timestamp: '2024-01-17T09:00:00Z',
        updated_timestamp: '2024-01-19T11:30:00Z'
      },
      {
        job_id: 'job_r3s4t5u6',
        title: 'Network Setup - Office 2B',
        internal_status: 'DONE',
        status_changed_at: '2024-01-16T17:00:00Z',
        priority_level: 'MEDIUM',
        contact_id: 'con_m9n0p1q2',
        created_timestamp: '2024-01-15T09:00:00Z',
        updated_timestamp: '2024-01-16T17:00:00Z'
      }
    ];

    // Apply filtering
    let filtered = [...internalJobs];
    
    if (params.status_filter) {
      // Map canonical status back to internal for filtering
      const statusMap: Record<string, string[]> = {
        'open': ['NEW', 'OPEN'],
        'scheduled': ['SCHEDULED'],
        'in_progress': ['IN_PROGRESS', 'WORKING'],
        'blocked': ['BLOCKED', 'ON_HOLD'],
        'awaiting_review': ['REVIEW', 'AWAITING_REVIEW'],
        'completed': ['DONE', 'COMPLETED', 'FINISHED'],
        'canceled': ['CANCELLED', 'CANCELED'],
        'archived': ['ARCHIVED', 'CLOSED']
      };
      
      const internalStatuses = statusMap[params.status_filter] || [];
      filtered = filtered.filter(job => 
        internalStatuses.includes(job.internal_status)
      );
    }

    if (params.search_query) {
      const query = params.search_query.toLowerCase();
      filtered = filtered.filter(job => 
        job.title.toLowerCase().includes(query)
      );
    }

    const offset = params.offset || 0;
    const limit = params.limit || 25;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      jobs: paginated,
      total_count: filtered.length,
      has_more: (offset + limit) < filtered.length
    };
  }

  private simulateGetJob(params: any = {}) {
    const jobs = this.simulateListJobs().jobs;
    const job = jobs.find(j => j.job_id === params.job_id);
    
    if (!job) {
      throw new Error(`Job not found: ${params.job_id}`);
    }
    
    return job;
  }

  private simulateGetJobFiles(params: any = {}) {
    // Simulate internal file data
    const filesByJob: Record<string, any[]> = {
      'job_x1y2z3a4': [
        {
          file_id: 'file_m3n4o5p6',
          filename: 'site_photo_001.jpg',
          file_kind: 'PHOTO',
          file_size_bytes: 2457600,
          mime_type: 'image/jpeg',
          bucket_name: 'portal-files-prod',
          object_path: 'jobs/job_x1y2z3a4/files/site_photo_001.jpg',
          created_timestamp: '2024-01-20T10:15:00Z',
          metadata: {
            camera_model: 'iPhone 12 Pro',
            location: 'Building A - HVAC Room'
          }
        },
        {
          file_id: 'file_q7r8s9t0',
          filename: 'work_order.pdf',
          file_kind: 'DOCUMENT',
          file_size_bytes: 145238,
          mime_type: 'application/pdf',
          bucket_name: 'portal-files-prod',
          object_path: 'jobs/job_x1y2z3a4/files/work_order.pdf',
          created_timestamp: '2024-01-19T14:00:00Z'
        },
        {
          file_id: 'file_a1b2c3d4',
          filename: 'invoice_materials.pdf',
          file_kind: 'INVOICE',
          file_size_bytes: 67890,
          mime_type: 'application/pdf',
          bucket_name: 'portal-files-prod',
          object_path: 'jobs/job_x1y2z3a4/files/invoice_materials.pdf',
          created_timestamp: '2024-01-18T16:30:00Z'
        }
      ],
      'job_b5c6d7e8': [
        {
          file_id: 'file_e5f6g7h8',
          filename: 'electrical_diagram.pdf',
          file_kind: 'DOCUMENT',
          file_size_bytes: 892345,
          mime_type: 'application/pdf',
          bucket_name: 'portal-files-prod',
          object_path: 'jobs/job_b5c6d7e8/files/electrical_diagram.pdf',
          created_timestamp: '2024-01-19T15:00:00Z'
        }
      ],
      'job_f9g0h1i2': [
        {
          file_id: 'file_u1v2w3x4',
          filename: 'inspection_report.pdf',
          file_kind: 'REPORT',
          file_size_bytes: 523456,
          mime_type: 'application/pdf',
          bucket_name: 'portal-files-prod',
          object_path: 'jobs/job_f9g0h1i2/files/inspection_report.pdf',
          created_timestamp: '2024-01-18T11:00:00Z'
        },
        {
          file_id: 'file_x9y8z7w6',
          filename: 'leak_photo.jpg',
          file_kind: 'PHOTO',
          file_size_bytes: 1856432,
          mime_type: 'image/jpeg',
          bucket_name: 'portal-files-prod',
          object_path: 'jobs/job_f9g0h1i2/files/leak_photo.jpg',
          created_timestamp: '2024-01-17T14:30:00Z'
        }
      ]
    };

    const jobFiles = filesByJob[params.job_id] || [];
    
    // Apply kind filter if specified
    let filtered = [...jobFiles];
    if (params.kind_filter) {
      const kindMap: Record<string, string[]> = {
        'document': ['DOCUMENT', 'DOC', 'PDF'],
        'photo': ['PHOTO', 'IMAGE', 'PICTURE'],
        'invoice': ['INVOICE', 'BILL'],
        'report': ['REPORT'],
        'other': ['OTHER']
      };
      
      const acceptedKinds = kindMap[params.kind_filter] || [];
      filtered = filtered.filter(file => 
        acceptedKinds.includes(file.file_kind.toUpperCase())
      );
    }

    const offset = params.offset || 0;
    const limit = params.limit || 25;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      files: paginated,
      total_count: filtered.length,
      has_more: (offset + limit) < filtered.length
    };
  }
}