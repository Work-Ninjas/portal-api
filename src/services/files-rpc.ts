import { FileAsset, PaginationResponse } from '../types';
import { getDatabase } from './database';
import { logger } from '../utils/logger';

export class FilesService {
  constructor() {}

  async getJobFiles(params: {
    jobId: string;
    limit: number;
    offset: number;
    kind?: string;
    traceId: string;
    clientId: string;
  }): Promise<PaginationResponse & { data: FileAsset[] }> {
    
    logger.info('RPC call', {
      endpoint: '/v1/jobs/:id/files',
      client_id: params.clientId,
      job_id: params.jobId,
      rpc: 'api_list_job_files',
      traceId: params.traceId
    });

    try {
      const db = getDatabase();
      
      // Call api_list_job_files RPC - tenant resolution and job validation happens in DB
      const { data: rawFiles, error } = await db.supabase.rpc('api_list_job_files', {
        p_client_id: params.clientId,
        p_job_id: params.jobId,
        p_limit: params.limit,
        p_offset: params.offset,
        p_kind: params.kind || null
      });

      if (error) {
        logger.error('RPC error calling api_list_job_files', {
          error: error.message,
          client_id: params.clientId,
          job_id: params.jobId,
          traceId: params.traceId
        });
        
        // Handle specific error cases
        if (error.message.includes('Job not found or access denied')) {
          throw new Error('Job not found or access denied');
        }
        throw new Error(`RPC error: ${error.message}`);
      }

      // Passthrough response - map to API FileAsset format
      const files = await Promise.all(
        (rawFiles || []).map(async (record: any) => await this.mapRpcToApiFile(record, params.jobId))
      );

      // For pagination, we need total count - make a separate count call
      const { data: countData, error: countError } = await db.supabase.rpc('api_list_job_files', {
        p_client_id: params.clientId,
        p_job_id: params.jobId,
        p_limit: 10000, // Large limit to get total
        p_offset: 0,
        p_kind: params.kind || null
      });

      let total = 0;
      if (!countError && countData) {
        total = countData.length;
      }

      const hasMore = params.offset + params.limit < total;

      logger.info('RPC result', {
        client_id: params.clientId,
        job_id: params.jobId,
        rpc: 'api_list_job_files',
        returnedCount: files.length,
        total,
        hasMore,
        traceId: params.traceId
      });

      return {
        data: files,
        total,
        limit: params.limit,
        offset: params.offset,
        has_more: hasMore
      };

    } catch (error) {
      logger.error('FilesService.getJobFiles RPC error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        client_id: params.clientId,
        job_id: params.jobId,
        traceId: params.traceId
      });
      throw error;
    }
  }

  // COPIED EXACTLY FROM getJobFiles - ACTIVITY FILES METHOD
  async getActivityFiles(params: {
    activityId: string;
    limit: number;
    offset: number;
    kind?: string;
    traceId: string;
    clientId: string;
  }): Promise<PaginationResponse & { data: FileAsset[] }> {
    
    logger.info('RPC call', {
      endpoint: '/v1/activity/:id/files',
      client_id: params.clientId,
      activity_id: params.activityId,
      rpc: 'api_list_activity_files',
      traceId: params.traceId
    });

    try {
      const db = getDatabase();
      
      // Call api_list_activity_files RPC - tenant resolution and activity validation happens in DB
      const { data: rawFiles, error } = await db.supabase.rpc('api_list_activity_files', {
        p_client_id: params.clientId,
        p_activity_id: params.activityId,
        p_limit: params.limit,
        p_offset: params.offset,
        p_kind: params.kind || null
      });

      if (error) {
        logger.error('RPC error calling api_list_activity_files', {
          error: error.message,
          client_id: params.clientId,
          activity_id: params.activityId,
          traceId: params.traceId
        });
        
        // Handle specific error cases
        if (error.message.includes('Activity not found or access denied')) {
          throw new Error('Activity not found or access denied');
        }
        throw new Error(`RPC error: ${error.message}`);
      }

      // Passthrough response - map to API FileAsset format
      const files = await Promise.all(
        (rawFiles || []).map(async (record: any) => await this.mapRpcToApiFile(record, params.activityId))
      );

      // For pagination, we need total count - make a separate count call
      const { data: countData, error: countError } = await db.supabase.rpc('api_list_activity_files', {
        p_client_id: params.clientId,
        p_activity_id: params.activityId,
        p_limit: 10000, // Large limit to get total
        p_offset: 0,
        p_kind: params.kind || null
      });

      let total = 0;
      if (!countError && countData) {
        total = countData.length;
      }

      const hasMore = params.offset + params.limit < total;

      logger.info('RPC result', {
        client_id: params.clientId,
        activity_id: params.activityId,
        rpc: 'api_list_activity_files',
        returnedCount: files.length,
        total,
        hasMore,
        traceId: params.traceId
      });

      return {
        data: files,
        total,
        limit: params.limit,
        offset: params.offset,
        has_more: hasMore
      };

    } catch (error) {
      logger.error('FilesService.getActivityFiles RPC error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        client_id: params.clientId,
        activity_id: params.activityId,
        traceId: params.traceId
      });
      throw error;
    }
  }

  /**
   * Map RPC response to API FileAsset format
   * Passthrough approach - include all fields from RPC
   */
  private async mapRpcToApiFile(record: any, _jobId: string): Promise<FileAsset> {
    const fileAsset: FileAsset = {
      id: record.id,
      name: record.filename || 'Unknown File',
      kind: this.mapFileKind(record.kind),
      size: record.size_bytes || 0,
      mime_type: record.mime_type || 'application/octet-stream',
      signed_url: '',
      expires_at: '',
      created_at: record.created_at
    };

    // Generate signed URL using Supabase Storage (following portal implementation)
    if (record.object_path) {
      try {
        const db = getDatabase();
        
        // Generate signed URL with 1 hour expiry (3600 seconds)
        const { data: signedUrlData, error: urlError } = await db.supabase.storage
          .from('assets')
          .createSignedUrl(record.object_path, 3600);

        if (!urlError && signedUrlData?.signedUrl) {
          fileAsset.signed_url = signedUrlData.signedUrl;
          fileAsset.expires_at = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour from now
        } else {
          // Fallback if signed URL generation fails
          fileAsset.signed_url = '';
          fileAsset.expires_at = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        }
      } catch (error) {
        // Fallback if any error occurs
        fileAsset.signed_url = '';
        fileAsset.expires_at = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      }
    } else {
      // No object path available
      fileAsset.signed_url = '';
      fileAsset.expires_at = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    }

    return fileAsset;
  }

  private mapFileKind(kind: string): FileAsset['kind'] {
    switch (kind?.toLowerCase()) {
      case 'document':
      case 'doc':
      case 'pdf':
        return 'document';
      case 'photo':
      case 'image':
      case 'picture':
        return 'photo';
      case 'invoice':
      case 'bill':
        return 'invoice';
      case 'report':
        return 'report';
      default:
        return 'other';
    }
  }
}