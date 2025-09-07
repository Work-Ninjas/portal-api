import { Job, JobStatus, PaginationResponse } from '../types';
import { getDatabase } from './database';
import { logger } from '../utils/logger';

export class JobsService {
  constructor() {}

  async listJobs(params: {
    limit: number;
    offset: number;
    sort?: string;
    dir?: string;
    q?: string;
    status?: JobStatus;
    traceId: string;
    clientId: string;
  }): Promise<PaginationResponse & { data: Job[] }> {
    
    logger.info('RPC call', {
      endpoint: '/v1/jobs',
      client_id: params.clientId,
      rpc: 'api_list_jobs',
      traceId: params.traceId
    });

    try {
      const db = getDatabase();
      
      // Call api_list_jobs RPC - tenant resolution happens in DB
      const { data: rawJobs, error } = await db.supabase.rpc('api_list_jobs', {
        p_client_id: params.clientId,
        p_limit: params.limit,
        p_offset: params.offset,
        p_sort: params.sort || 'created_at',
        p_dir: params.dir || 'desc',
        p_q: params.q || null,
        p_status: params.status || null
      });

      if (error) {
        logger.error('RPC error calling api_list_jobs', {
          error: error.message,
          client_id: params.clientId,
          traceId: params.traceId
        });
        throw new Error(`RPC error: ${error.message}`);
      }

      // Passthrough response - map to API Job format
      const jobs = (rawJobs || []).map((record: any) => this.mapRpcToApiJob(record));

      // For pagination, we need total count - make a separate count call
      const { data: countData, error: countError } = await db.supabase.rpc('api_list_jobs', {
        p_client_id: params.clientId,
        p_limit: 10000, // Large limit to get total
        p_offset: 0,
        p_sort: 'created_at',
        p_dir: 'desc',
        p_q: params.q || null,
        p_status: params.status || null
      });

      let total = 0;
      if (!countError && countData) {
        total = countData.length;
      }

      const hasMore = params.offset + params.limit < total;

      logger.info('RPC result', {
        client_id: params.clientId,
        rpc: 'api_list_jobs',
        returnedCount: jobs.length,
        total,
        hasMore,
        traceId: params.traceId
      });

      return {
        data: jobs,
        total,
        limit: params.limit,
        offset: params.offset,
        has_more: hasMore
      };

    } catch (error) {
      logger.error('JobsService.listJobs RPC error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        client_id: params.clientId,
        traceId: params.traceId
      });
      throw error;
    }
  }

  async getJobById(params: {
    id: string;
    traceId: string;
    clientId: string;
  }): Promise<Job> {
    
    logger.info('RPC call', {
      endpoint: '/v1/jobs/:id',
      client_id: params.clientId,
      job_id: params.id,
      rpc: 'api_get_job',
      traceId: params.traceId
    });

    try {
      const db = getDatabase();
      
      // Call api_get_job RPC - tenant resolution happens in DB  
      const { data: rawJob, error } = await db.supabase.rpc('api_get_job', {
        p_client_id: params.clientId,
        p_job_id: params.id
      });

      if (error) {
        logger.error('RPC error calling api_get_job', {
          error: error.message,
          client_id: params.clientId,
          job_id: params.id,
          traceId: params.traceId
        });
        throw new Error(`RPC error: ${error.message}`);
      }

      if (!rawJob || rawJob.length === 0) {
        throw new Error('Job not found');
      }

      // Map to API Job format
      const job = this.mapRpcToApiJob(rawJob[0]);

      logger.info('RPC result', {
        client_id: params.clientId,
        job_id: params.id,
        rpc: 'api_get_job',
        traceId: params.traceId
      });

      return job;

    } catch (error) {
      logger.error('JobsService.getJobById RPC error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        client_id: params.clientId,
        job_id: params.id,
        traceId: params.traceId
      });
      throw error;
    }
  }

  /**
   * Map RPC response to API Job format
   * Passthrough approach - include all fields from RPC
   */
  private mapRpcToApiJob(record: any): Job {
    const job: Job = {
      id: record.id,
      title: record.job_name || record.job_number || 'Untitled Job',
      status: this.mapStatus(record.status),
      status_updated_at: record.updated_at,
      priority: this.mapPriority(record.priority),
      contact_id: 'unknown', // TODO: Add contact mapping if needed
      created_at: record.created_at,
      updated_at: record.updated_at
    };

    // Add any additional fields as needed - they don't exist in the Job type
    // so we'll extend it as any for now
    const extendedJob = job as any;

    if (record.job_number) {
      extendedJob.job_number = record.job_number;
    }

    if (record.current_milestone) {
      extendedJob.current_milestone = record.current_milestone;
    }

    if (record.milestone_date) {
      extendedJob.milestone_date = record.milestone_date;
    }

    if (record.trade_type) {
      extendedJob.trade_type = record.trade_type;
    }

    if (record.work_type) {
      extendedJob.work_type = record.work_type;
    }

    // Add location if available
    if (record.location_street1 || record.location_city || record.location_state) {
      extendedJob.location = {
        street1: record.location_street1,
        city: record.location_city,
        state: record.location_state,
        zip_code: record.location_zip_code
      };
    }

    return extendedJob;
  }

  private mapStatus(status: string): JobStatus {
    // Map database status to API canonical status
    switch (status?.toLowerCase()) {
      case 'new':
      case 'open':
        return 'open';
      case 'scheduled':
        return 'scheduled';
      case 'in_progress':
      case 'in progress':
        return 'in_progress';
      case 'blocked':
        return 'blocked';
      case 'awaiting_review':
      case 'awaiting review':
        return 'awaiting_review';
      case 'completed':
      case 'done':
        return 'completed';
      case 'canceled':
      case 'cancelled':
        return 'canceled';
      case 'archived':
        return 'archived';
      default:
        return 'open';
    }
  }

  private mapPriority(priority: string): Job['priority'] {
    switch (priority?.toLowerCase()) {
      case 'low':
        return 'low';
      case 'medium':
      case 'normal':
        return 'medium';
      case 'high':
        return 'high';
      case 'urgent':
      case 'critical':
        return 'urgent';
      default:
        return 'medium';
    }
  }
}