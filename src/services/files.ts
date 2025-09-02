import { FileAsset, PaginationResponse } from '../types';
import { RpcClient } from './rpc';
import { SignedUrlService } from './signedUrls';

export class FilesService {
  private rpcClient: RpcClient;
  private signedUrlService: SignedUrlService;

  constructor() {
    this.rpcClient = new RpcClient();
    this.signedUrlService = new SignedUrlService();
  }

  async getJobFiles(params: {
    jobId: string;
    limit: number;
    offset: number;
    kind?: string;
    traceId: string;
    clientId: string;
  }): Promise<PaginationResponse & { data: FileAsset[] }> {
    
    // First, validate that the job belongs to the tenant
    await this.validateJobAccess(params.jobId, params.clientId, params.traceId);

    // Get files from RPC
    const rpcResult = await this.rpcClient.call<{
      files: any[];
      total_count: number;
      has_more: boolean;
    }>({
      method: 'api_get_job_files',
      params: {
        job_id: params.jobId,
        limit: params.limit,
        offset: params.offset,
        kind_filter: params.kind
      },
      traceId: params.traceId,
      clientId: params.clientId
    });

    // Map internal files to API format with signed URLs
    const files = await Promise.all(
      rpcResult.files.map(async (internal: any) => 
        await this.mapInternalToApiFile(internal, params.jobId, params.traceId, params.clientId)
      )
    );

    return {
      data: files,
      total: rpcResult.total_count,
      limit: params.limit,
      offset: params.offset,
      has_more: rpcResult.has_more
    };
  }

  private async validateJobAccess(jobId: string, clientId: string, traceId: string): Promise<void> {
    try {
      // Verify job exists and belongs to tenant
      await this.rpcClient.call({
        method: 'api_get_job',
        params: { job_id: jobId },
        traceId,
        clientId
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new Error(`Job not found or access denied: ${jobId}`);
      }
      throw error;
    }
  }

  private async mapInternalToApiFile(
    internal: any, 
    jobId: string, 
    traceId: string, 
    clientId: string
  ): Promise<FileAsset> {
    
    // Generate signed URL for the file
    const signedUrlResponse = await this.signedUrlService.generateSignedUrl({
      bucket: internal.bucket_name,
      objectPath: internal.object_path,
      jobId: jobId,
      fileId: internal.file_id,
      fileName: internal.filename,
      traceId,
      clientId
    });

    const fileAsset: FileAsset = {
      id: internal.file_id,
      name: internal.filename,
      kind: this.mapFileKind(internal.file_kind),
      size: internal.file_size_bytes,
      mime_type: internal.mime_type,
      signed_url: signedUrlResponse.signedUrl,
      expires_at: signedUrlResponse.expiresAt,
      created_at: internal.created_timestamp
    };

    // Only include metadata if present (omit vs null policy)
    if (internal.metadata && Object.keys(internal.metadata).length > 0) {
      fileAsset.metadata = internal.metadata;
    }

    return fileAsset;
  }

  private mapFileKind(internalKind: string): FileAsset['kind'] {
    switch (internalKind?.toUpperCase()) {
      case 'DOCUMENT':
      case 'DOC':
      case 'PDF':
        return 'document';
      case 'PHOTO':
      case 'IMAGE':
      case 'PICTURE':
        return 'photo';
      case 'INVOICE':
      case 'BILL':
        return 'invoice';
      case 'REPORT':
        return 'report';
      default:
        return 'other';
    }
  }
}