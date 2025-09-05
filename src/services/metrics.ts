import { logger } from '../utils/logger';

export interface MetricPoint {
  timestamp: number;
  value: number;
  labels?: Record<string, string>;
}

export interface PercentileStats {
  p50: number;
  p95: number;
  p99: number;
  mean: number;
  count: number;
  min: number;
  max: number;
}

export interface ErrorRateStats {
  errorCount: number;
  totalCount: number;
  errorRate: number; // 0.0 to 1.0
  errorTypes: Record<string, number>;
}

export interface ApiEndpointMetrics {
  endpoint: string;
  method: string;
  latency: PercentileStats;
  errorRate: ErrorRateStats;
  requestCount: number;
  lastUpdated: string;
}

class MetricsBuffer {
  private buffer: number[] = [];
  private maxSize = 1000; // Keep last 1000 measurements

  add(value: number) {
    this.buffer.push(value);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  getPercentiles(): PercentileStats {
    if (this.buffer.length === 0) {
      return {
        p50: 0, p95: 0, p99: 0, mean: 0, count: 0, min: 0, max: 0
      };
    }

    const sorted = [...this.buffer].sort((a, b) => a - b);
    const count = sorted.length;
    
    const percentile = (p: number) => {
      const index = Math.ceil(count * p) - 1;
      return sorted[Math.max(0, index)];
    };

    const sum = sorted.reduce((acc, val) => acc + val, 0);

    return {
      p50: percentile(0.5),
      p95: percentile(0.95),
      p99: percentile(0.99),
      mean: sum / count,
      count,
      min: sorted[0],
      max: sorted[count - 1]
    };
  }

  clear() {
    this.buffer = [];
  }
}

class ErrorCounter {
  private errorCount = 0;
  private totalCount = 0;
  private errorTypes: Record<string, number> = {};

  recordSuccess() {
    this.totalCount++;
  }

  recordError(errorType?: string) {
    this.errorCount++;
    this.totalCount++;
    
    if (errorType) {
      this.errorTypes[errorType] = (this.errorTypes[errorType] || 0) + 1;
    }
  }

  getStats(): ErrorRateStats {
    return {
      errorCount: this.errorCount,
      totalCount: this.totalCount,
      errorRate: this.totalCount > 0 ? this.errorCount / this.totalCount : 0,
      errorTypes: { ...this.errorTypes }
    };
  }

  reset() {
    this.errorCount = 0;
    this.totalCount = 0;
    this.errorTypes = {};
  }
}

export class MetricsService {
  private latencyBuffers = new Map<string, MetricsBuffer>();
  private errorCounters = new Map<string, ErrorCounter>();
  private requestCounts = new Map<string, number>();
  
  private startTime = Date.now();

  // Record request latency for an endpoint
  recordLatency(endpoint: string, method: string, latencyMs: number) {
    const key = `${method}:${endpoint}`;
    
    if (!this.latencyBuffers.has(key)) {
      this.latencyBuffers.set(key, new MetricsBuffer());
    }
    
    this.latencyBuffers.get(key)!.add(latencyMs);
    this.requestCounts.set(key, (this.requestCounts.get(key) || 0) + 1);
  }

  // Record request success
  recordSuccess(endpoint: string, method: string) {
    const key = `${method}:${endpoint}`;
    
    if (!this.errorCounters.has(key)) {
      this.errorCounters.set(key, new ErrorCounter());
    }
    
    this.errorCounters.get(key)!.recordSuccess();
  }

  // Record request error
  recordError(endpoint: string, method: string, errorCode?: string, errorType?: string) {
    const key = `${method}:${endpoint}`;
    
    if (!this.errorCounters.has(key)) {
      this.errorCounters.set(key, new ErrorCounter());
    }
    
    const fullErrorType = errorCode ? `${errorCode}:${errorType || 'unknown'}` : errorType;
    this.errorCounters.get(key)!.recordError(fullErrorType);
  }

  // Get metrics for a specific endpoint
  getEndpointMetrics(endpoint: string, method: string): ApiEndpointMetrics | null {
    const key = `${method}:${endpoint}`;
    const latencyBuffer = this.latencyBuffers.get(key);
    const errorCounter = this.errorCounters.get(key);
    
    if (!latencyBuffer && !errorCounter) {
      return null;
    }

    return {
      endpoint,
      method,
      latency: latencyBuffer ? latencyBuffer.getPercentiles() : {
        p50: 0, p95: 0, p99: 0, mean: 0, count: 0, min: 0, max: 0
      },
      errorRate: errorCounter ? errorCounter.getStats() : {
        errorCount: 0, totalCount: 0, errorRate: 0, errorTypes: {}
      },
      requestCount: this.requestCounts.get(key) || 0,
      lastUpdated: new Date().toISOString()
    };
  }

  // Get all metrics
  getAllMetrics(): Record<string, ApiEndpointMetrics> {
    const allKeys = new Set([
      ...this.latencyBuffers.keys(),
      ...this.errorCounters.keys()
    ]);

    const metrics: Record<string, ApiEndpointMetrics> = {};
    
    for (const key of allKeys) {
      const [method, endpoint] = key.split(':', 2);
      const endpointMetrics = this.getEndpointMetrics(endpoint, method);
      if (endpointMetrics) {
        metrics[key] = endpointMetrics;
      }
    }

    return metrics;
  }

  // Get system-wide summary
  getSystemSummary() {
    const allMetrics = Object.values(this.getAllMetrics());
    
    const totalRequests = allMetrics.reduce((sum, m) => sum + m.requestCount, 0);
    const totalErrors = allMetrics.reduce((sum, m) => sum + m.errorRate.errorCount, 0);
    const avgErrorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;

    // Calculate overall latency stats from all endpoints
    const allLatencies: number[] = [];
    for (const buffer of this.latencyBuffers.values()) {
      const stats = buffer.getPercentiles();
      // Add weighted samples based on count
      for (let i = 0; i < Math.min(stats.count, 100); i++) {
        allLatencies.push(stats.mean);
      }
    }

    const overallLatency = allLatencies.length > 0 ? 
      this.calculatePercentiles(allLatencies) : 
      { p50: 0, p95: 0, p99: 0, mean: 0, count: 0, min: 0, max: 0 };

    return {
      uptime: Date.now() - this.startTime,
      totalRequests,
      totalErrors,
      errorRate: avgErrorRate,
      overallLatency,
      endpointCount: allMetrics.length,
      timestamp: new Date().toISOString()
    };
  }

  private calculatePercentiles(values: number[]): PercentileStats {
    if (values.length === 0) {
      return { p50: 0, p95: 0, p99: 0, mean: 0, count: 0, min: 0, max: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    
    const percentile = (p: number) => {
      const index = Math.ceil(count * p) - 1;
      return sorted[Math.max(0, index)];
    };

    const sum = sorted.reduce((acc, val) => acc + val, 0);

    return {
      p50: percentile(0.5),
      p95: percentile(0.95),
      p99: percentile(0.99),
      mean: sum / count,
      count,
      min: sorted[0],
      max: sorted[count - 1]
    };
  }

  // Log metrics summary (for periodic reporting)
  logMetricsSummary() {
    const summary = this.getSystemSummary();
    const endpointMetrics = this.getAllMetrics();

    logger.info('Metrics summary', {
      summary,
      topEndpoints: Object.entries(endpointMetrics)
        .sort((a, b) => b[1].requestCount - a[1].requestCount)
        .slice(0, 5)
        .map(([key, metrics]) => ({
          endpoint: key,
          requests: metrics.requestCount,
          p95Latency: metrics.latency.p95,
          errorRate: metrics.errorRate.errorRate
        }))
    });
  }

  // Clear all metrics (for testing or reset)
  reset() {
    this.latencyBuffers.clear();
    this.errorCounters.clear();
    this.requestCounts.clear();
    this.startTime = Date.now();
  }

  // Export metrics in Prometheus format (basic implementation)
  toPrometheusFormat(): string {
    const metrics = this.getAllMetrics();
    const lines: string[] = [];

    // Request count
    lines.push('# HELP http_requests_total Total HTTP requests');
    lines.push('# TYPE http_requests_total counter');
    for (const [, metric] of Object.entries(metrics)) {
      lines.push(`http_requests_total{method="${metric.method}",endpoint="${metric.endpoint}"} ${metric.requestCount}`);
    }

    // Request latency
    lines.push('# HELP http_request_duration_ms HTTP request latency in milliseconds');
    lines.push('# TYPE http_request_duration_ms histogram');
    for (const [, metric] of Object.entries(metrics)) {
      const labels = `method="${metric.method}",endpoint="${metric.endpoint}"`;
      lines.push(`http_request_duration_ms{${labels},quantile="0.5"} ${metric.latency.p50}`);
      lines.push(`http_request_duration_ms{${labels},quantile="0.95"} ${metric.latency.p95}`);
      lines.push(`http_request_duration_ms{${labels},quantile="0.99"} ${metric.latency.p99}`);
      lines.push(`http_request_duration_ms_sum{${labels}} ${metric.latency.mean * metric.latency.count}`);
      lines.push(`http_request_duration_ms_count{${labels}} ${metric.latency.count}`);
    }

    // Error rate
    lines.push('# HELP http_requests_errors_total Total HTTP request errors');
    lines.push('# TYPE http_requests_errors_total counter');
    for (const [, metric] of Object.entries(metrics)) {
      lines.push(`http_requests_errors_total{method="${metric.method}",endpoint="${metric.endpoint}"} ${metric.errorRate.errorCount}`);
    }

    return lines.join('\n') + '\n';
  }
}

// Singleton instance
export const metricsService = new MetricsService();

// Start periodic metrics logging (every 5 minutes)
setInterval(() => {
  metricsService.logMetricsSummary();
}, 5 * 60 * 1000);