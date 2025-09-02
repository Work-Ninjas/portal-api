import crypto from 'crypto';
import { logger } from '../utils/logger';

export interface SignedUrlRequest {
  bucket: string;
  objectPath: string;
  jobId: string;
  fileId: string;
  fileName: string;
  expirationMinutes?: number;
  traceId: string;
  clientId: string;
}

export interface SignedUrlResponse {
  signedUrl: string;
  expiresAt: string; // ISO 8601 UTC
}

export class SignedUrlService {
  private readonly baseUrl: string;
  private readonly secretKey: string;

  constructor() {
    this.baseUrl = process.env.STORAGE_BASE_URL || 'https://storage.example.com';
    this.secretKey = process.env.STORAGE_SECRET_KEY || 'mock-secret-key-for-development';
  }

  async generateSignedUrl(request: SignedUrlRequest): Promise<SignedUrlResponse> {
    const startTime = Date.now();
    
    logger.info('Signed URL generation started', {
      fileId: request.fileId,
      jobId: request.jobId,
      clientId: request.clientId,
      traceId: request.traceId,
      bucket: request.bucket,
      // Do NOT log the full objectPath for security
      objectPathHash: this.hashPath(request.objectPath)
    });

    try {
      // Validate object path for security (anti-path traversal)
      this.validateObjectPath(request.objectPath, request.jobId);

      // Generate expiration time (15 minutes by default)
      const expirationMinutes = request.expirationMinutes || 15;
      const expiresAt = new Date(Date.now() + (expirationMinutes * 60 * 1000));

      // Create signature components
      const expirationTimestamp = Math.floor(expiresAt.getTime() / 1000);
      const resourcePath = `${request.bucket}/${request.objectPath}`;
      
      // Generate secure signature
      const signature = this.generateSignature(resourcePath, expirationTimestamp, request.clientId);

      // Build signed URL
      const signedUrl = `${this.baseUrl}/files/${request.bucket}/${request.objectPath}?` +
        `expires=${expirationTimestamp}&` +
        `client=${request.clientId}&` +
        `signature=${signature}`;

      const latency = Date.now() - startTime;
      
      logger.info('Signed URL generated successfully', {
        fileId: request.fileId,
        jobId: request.jobId,
        clientId: request.clientId,
        traceId: request.traceId,
        expiresAt: expiresAt.toISOString(),
        latency,
        outcome: 'success'
      });

      return {
        signedUrl,
        expiresAt: expiresAt.toISOString()
      };

    } catch (error) {
      const latency = Date.now() - startTime;
      
      logger.error('Signed URL generation failed', {
        fileId: request.fileId,
        jobId: request.jobId,
        clientId: request.clientId,
        traceId: request.traceId,
        error: error instanceof Error ? error.message : 'Unknown error',
        latency,
        outcome: 'error'
      });

      throw error;
    }
  }

  private validateObjectPath(objectPath: string, jobId: string): void {
    // Validate that object path is within the expected job directory
    // This prevents path traversal attacks
    const expectedPrefix = `jobs/${jobId}/`;
    
    if (!objectPath.startsWith(expectedPrefix)) {
      throw new Error(`Invalid object path: must start with ${expectedPrefix}`);
    }

    // Check for path traversal attempts
    if (objectPath.includes('..') || objectPath.includes('//')) {
      throw new Error('Invalid object path: contains illegal characters');
    }

    // Validate against known bucket structure
    const pathPattern = /^jobs\/[a-z0-9_]+\/files\/[a-z0-9_.-]+$/i;
    if (!pathPattern.test(objectPath)) {
      throw new Error('Invalid object path: does not match expected pattern');
    }
  }

  private generateSignature(resourcePath: string, expiration: number, clientId: string): string {
    // Create HMAC signature using resource path, expiration, and client ID
    const stringToSign = `${resourcePath}\n${expiration}\n${clientId}`;
    
    const hmac = crypto.createHmac('sha256', this.secretKey);
    hmac.update(stringToSign);
    
    return hmac.digest('hex');
  }

  private hashPath(path: string): string {
    // Create hash for logging (security - don't log full paths)
    return crypto.createHash('md5').update(path).digest('hex').substring(0, 8);
  }

  // Utility method to sanitize Content-Disposition filename
  public sanitizeFileName(fileName: string): string {
    // Remove or replace dangerous characters for Content-Disposition header
    return fileName
      .replace(/[^\w\s\.-]/g, '_') // Replace non-alphanumeric chars except dots, spaces, hyphens
      .replace(/\s+/g, '_')        // Replace spaces with underscores
      .substring(0, 100);          // Limit length
  }
}