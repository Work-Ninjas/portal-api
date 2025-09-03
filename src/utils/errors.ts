import { ErrorResponse, ValidationError } from '../types';

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly type: string;
  public readonly errors?: ValidationError[];

  constructor(
    status: number,
    code: string,
    message: string,
    type?: string,
    errors?: ValidationError[]
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.type = type || `https://api.portal.example.com/errors/${code.toLowerCase()}`;
    this.errors = errors;
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  toResponse(traceId: string): ErrorResponse {
    return {
      type: this.type,
      title: this.getTitle(),
      status: this.status,
      code: this.code,
      detail: this.message,
      traceId,
      ...(this.errors && { errors: this.errors })
    };
  }

  private getTitle(): string {
    switch (this.status) {
      case 400:
        return 'Bad Request';
      case 401:
        return 'Unauthorized';
      case 403:
        return 'Forbidden';
      case 404:
        return 'Not Found';
      case 422:
        return 'Validation Error';
      case 429:
        return 'Too Many Requests';
      case 500:
      default:
        return 'Internal Server Error';
    }
  }
}

export const ErrorCodes = {
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  WRONG_ENVIRONMENT_TOKEN: 'WRONG_ENVIRONMENT_TOKEN',
  INVALID_TOKEN_FORMAT: 'INVALID_TOKEN_FORMAT'
} as const;