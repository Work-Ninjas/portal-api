import { Job, JobStatus, PaginationResponse } from '../types';
import { RpcClient } from './rpc';
import { mapInternalStatusToCanonical } from '../routes/jobs';

export class JobsService {
  private rpcClient: RpcClient;

  constructor() {
    this.rpcClient = new RpcClient();
  }

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
    
    const rpcResult = await this.rpcClient.call<{
      jobs: any[];
      total_count: number;
      has_more: boolean;
    }>({
      method: 'api_list_jobs',
      params: {
        limit: params.limit,
        offset: params.offset,
        sort_field: params.sort,
        sort_direction: params.dir,
        search_query: params.q,
        status_filter: params.status // Pass canonical status for RPC filtering
      },
      traceId: params.traceId,
      clientId: params.clientId
    });

    const jobs = rpcResult.jobs.map((internal: any) => this.mapInternalToApiJob(internal));

    return {
      data: jobs,
      total: rpcResult.total_count,
      limit: params.limit,
      offset: params.offset,
      has_more: rpcResult.has_more
    };
  }

  private mapInternalToApiJob(internal: any): Job {
    const job: Job = {
      id: internal.job_id,
      title: internal.title,
      status: mapInternalStatusToCanonical(internal.internal_status),
      status_updated_at: internal.status_changed_at,
      priority: this.mapPriority(internal.priority_level),
      contact_id: internal.contact_id,
      created_at: internal.created_timestamp,
      updated_at: internal.updated_timestamp
    };

    // Only include fields that have values (omit vs null policy)
    if (internal.status_reason) {
      job.status_reason = internal.status_reason;
    }

    if (internal.scheduled_start_time) {
      job.scheduled_start = internal.scheduled_start_time;
    }

    if (internal.scheduled_end_time) {
      job.scheduled_end = internal.scheduled_end_time;
    }

    if (internal.assigned_users && internal.assigned_users.length > 0) {
      job.assignee_ids = internal.assigned_users;
    }

    if (internal.job_tags && internal.job_tags.length > 0) {
      job.tags = internal.job_tags;
    }

    return job;
  }

  private mapPriority(internalPriority: string): Job['priority'] {
    switch (internalPriority?.toUpperCase()) {
      case 'LOW':
        return 'low';
      case 'MEDIUM':
      case 'NORMAL':
        return 'medium';
      case 'HIGH':
        return 'high';
      case 'URGENT':
      case 'CRITICAL':
        return 'urgent';
      default:
        return 'medium';
    }
  }
}