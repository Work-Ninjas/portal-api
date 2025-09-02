import { logger } from '../utils/logger';

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  exponentialBackoff: boolean;
  retryableErrors?: string[];
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
  monitorWindowMs: number;
}

export interface TimeoutOptions {
  timeoutMs: number;
}

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN', 
  HALF_OPEN = 'HALF_OPEN'
}

export class CircuitBreaker {
  private state = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private nextAttempt = 0;
  private successCount = 0;

  constructor(
    private readonly options: CircuitBreakerOptions,
    private readonly name: string
  ) {}

  async execute<T>(operation: () => Promise<T>, traceId: string): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        logger.warn('Circuit breaker is OPEN', {
          circuitBreaker: this.name,
          traceId,
          state: this.state,
          failureCount: this.failureCount,
          nextAttempt: new Date(this.nextAttempt).toISOString()
        });
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      } else {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.successCount = 0;
        logger.info('Circuit breaker transitioning to HALF_OPEN', {
          circuitBreaker: this.name,
          traceId,
          state: this.state
        });
      }
    }

    try {
      const result = await operation();
      this.onSuccess(traceId);
      return result;
    } catch (error) {
      this.onFailure(traceId);
      throw error;
    }
  }

  private onSuccess(traceId: string): void {
    this.failureCount = 0;
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= 3) { // Require 3 successes to close
        this.state = CircuitBreakerState.CLOSED;
        logger.info('Circuit breaker CLOSED after successful recovery', {
          circuitBreaker: this.name,
          traceId,
          state: this.state,
          successCount: this.successCount
        });
      }
    }
  }

  private onFailure(traceId: string): void {
    this.failureCount++;
    
    if (this.failureCount >= this.options.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
      this.nextAttempt = Date.now() + this.options.resetTimeoutMs;
      
      logger.error('Circuit breaker OPENED due to failures', {
        circuitBreaker: this.name,
        traceId,
        state: this.state,
        failureCount: this.failureCount,
        threshold: this.options.failureThreshold,
        nextAttempt: new Date(this.nextAttempt).toISOString()
      });
    }
  }

  getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      nextAttempt: this.nextAttempt > 0 ? new Date(this.nextAttempt).toISOString() : null,
      successCount: this.successCount
    };
  }
}

export class ReliabilityService {
  private circuitBreakers = new Map<string, CircuitBreaker>();

  // Create or get circuit breaker for a service
  getCircuitBreaker(name: string, options: CircuitBreakerOptions): CircuitBreaker {
    if (!this.circuitBreakers.has(name)) {
      this.circuitBreakers.set(name, new CircuitBreaker(options, name));
    }
    return this.circuitBreakers.get(name)!;
  }

  // Retry with exponential backoff
  async retry<T>(
    operation: () => Promise<T>,
    options: RetryOptions,
    traceId: string,
    operationName: string
  ): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
      try {
        const result = await operation();
        
        if (attempt > 1) {
          logger.info('Operation succeeded after retry', {
            operation: operationName,
            attempt,
            traceId
          });
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        
        // Check if error is retryable
        if (options.retryableErrors && options.retryableErrors.length > 0) {
          const isRetryable = options.retryableErrors.some(retryableError => 
            lastError?.message.includes(retryableError)
          );
          if (!isRetryable) {
            logger.warn('Non-retryable error encountered', {
              operation: operationName,
              attempt,
              traceId,
              error: lastError.message
            });
            throw lastError;
          }
        }

        if (attempt === options.maxAttempts) {
          logger.error('All retry attempts exhausted', {
            operation: operationName,
            attempts: options.maxAttempts,
            traceId,
            error: lastError.message
          });
          break;
        }

        // Calculate delay with exponential backoff
        let delay = options.baseDelayMs;
        if (options.exponentialBackoff) {
          delay = Math.min(options.baseDelayMs * Math.pow(2, attempt - 1), options.maxDelayMs);
        }
        
        // Add jitter to prevent thundering herd
        delay = delay + Math.random() * 1000;

        logger.warn('Operation failed, retrying', {
          operation: operationName,
          attempt,
          maxAttempts: options.maxAttempts,
          delayMs: Math.round(delay),
          traceId,
          error: lastError.message
        });

        await this.sleep(delay);
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  // Add timeout to any operation
  async withTimeout<T>(
    operation: () => Promise<T>,
    options: TimeoutOptions,
    traceId: string,
    operationName: string
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        logger.error('Operation timed out', {
          operation: operationName,
          timeoutMs: options.timeoutMs,
          traceId
        });
        reject(new Error(`Operation ${operationName} timed out after ${options.timeoutMs}ms`));
      }, options.timeoutMs);
    });

    return Promise.race([operation(), timeoutPromise]);
  }

  // Combined: timeout + retry + circuit breaker
  async executeReliably<T>(
    operation: () => Promise<T>,
    config: {
      operationName: string;
      traceId: string;
      timeout?: TimeoutOptions;
      retry?: RetryOptions;
      circuitBreaker?: { name: string; options: CircuitBreakerOptions };
    }
  ): Promise<T> {
    let wrappedOperation = operation;

    // Wrap with timeout if specified
    if (config.timeout) {
      const originalOperation = wrappedOperation;
      wrappedOperation = () => this.withTimeout(
        originalOperation, 
        config.timeout!, 
        config.traceId, 
        config.operationName
      );
    }

    // Wrap with circuit breaker if specified
    if (config.circuitBreaker) {
      const circuitBreaker = this.getCircuitBreaker(
        config.circuitBreaker.name, 
        config.circuitBreaker.options
      );
      const originalOperation = wrappedOperation;
      wrappedOperation = () => circuitBreaker.execute(originalOperation, config.traceId);
    }

    // Wrap with retry if specified
    if (config.retry) {
      return this.retry(wrappedOperation, config.retry, config.traceId, config.operationName);
    }

    return wrappedOperation();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get status of all circuit breakers
  getCircuitBreakerStatuses() {
    const statuses: Record<string, any> = {};
    for (const [name, circuitBreaker] of this.circuitBreakers) {
      statuses[name] = circuitBreaker.getStatus();
    }
    return statuses;
  }
}

// Singleton instance
export const reliabilityService = new ReliabilityService();

// Default configurations
export const DEFAULT_RPC_TIMEOUT: TimeoutOptions = {
  timeoutMs: 5000 // 5 seconds
};

export const DEFAULT_RPC_RETRY: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 5000,
  exponentialBackoff: true,
  retryableErrors: ['ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'timeout']
};

export const DEFAULT_RPC_CIRCUIT_BREAKER: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeoutMs: 30000, // 30 seconds
  monitorWindowMs: 60000  // 1 minute
};