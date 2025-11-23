// package/src/logger.ts
import { trace, context as apiContext } from "@opentelemetry/api";
import { logger as debug } from "./_internal/_logger";

export type LogAttributes = Record<string, unknown>;

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

interface DatadogLog {
  ddsource: string;
  ddtags: string;
  hostname: string;
  message: string;
  service: string;
  status: string;
  timestamp: number;
  trace_id?: string;
  span_id?: string;
  [key: string]: any;
}

export class Logger {
  private serviceName: string;
  private environment: string;
  private ddSite: string;
  private ddApiKey: string | undefined;
  private logBuffer: DatadogLog[] = [];
  private flushInterval: Timer | null = null;
  private readonly bufferSize = 100;
  private readonly flushIntervalMs = 10000; // 10 seconds

  constructor() {
    this.serviceName = process.env.SERVICE_NAME || "bun-otel-service";
    this.environment = process.env.ENV || process.env.NODE_ENV || "development";
    this.ddSite = process.env.DD_SITE?.replace(/"/g, "") || "us5.datadoghq.com";
    this.ddApiKey = process.env.DD_API_KEY;

    // Start flush interval
    if (this.ddApiKey) {
      this.flushInterval = setInterval(() => this.flush(), this.flushIntervalMs);
    }
  }

  /**
   * Get current trace context from active span
   * Converts OpenTelemetry hex IDs to Datadog decimal format
   */
  private getTraceContext() {
    const span = trace.getSpan(apiContext.active());
    if (!span) {
      return {};
    }

    const spanContext = span.spanContext();

    // Convert hex trace_id to decimal for Datadog
    // Datadog uses 64-bit decimal, so take last 16 hex chars (64 bits)
    const traceIdHex = spanContext.traceId.slice(-16);
    const traceIdDecimal = BigInt("0x" + traceIdHex).toString(10);

    // Convert hex span_id to decimal
    const spanIdDecimal = BigInt("0x" + spanContext.spanId).toString(10);

    return {
      trace_id: traceIdDecimal,
      span_id: spanIdDecimal,
      trace_flags: spanContext.traceFlags,
      // Also include hex for debugging
      "dd.trace_id": traceIdDecimal,
      "dd.span_id": spanIdDecimal,
    };
  }

  /**
   * Send logs to Datadog
   */
  private async sendToDatadog(logs: DatadogLog[]): Promise<void> {
    if (!this.ddApiKey || logs.length === 0) {
      return;
    }

    const isDev = this.environment === "development" || this.environment === "local";

    if (isDev) {
      debug.log(`\n📤 Sending ${logs.length} logs to Datadog...`);
      debug.log(`   Endpoint: https://http-intake.logs.${this.ddSite}/api/v2/logs`);
      debug.log(`   Sample log:`, JSON.stringify(logs[0], null, 2));
    }

    try {
      const response = await fetch(`https://http-intake.logs.${this.ddSite}/api/v2/logs`, {
        method: "POST",
        headers: {
          "DD-API-KEY": this.ddApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(logs),
      });

      if (response.status !== 202 && response.status !== 200) {
        debug.error(`❌ Failed to send logs to Datadog: HTTP ${response.status}`);
        const body = await response.text();
        debug.error(`   Response:`, body);
      } else if (isDev) {
        debug.log(`   ✅ Logs sent successfully (HTTP ${response.status})`);
      }
    } catch (error) {
      debug.error("❌ Error sending logs to Datadog:", error);
    }
  }

  /**
   * Flush buffered logs to Datadog
   */
  private async flush(): Promise<void> {
    if (this.logBuffer.length === 0) {
      return;
    }

    const logsToSend = [...this.logBuffer];
    this.logBuffer = [];

    await this.sendToDatadog(logsToSend);
  }

  /**
   * Core logging function
   */
  private log(level: LogLevel, message: string, attributes?: LogAttributes): void {
    const traceContext = this.getTraceContext();
    const timestamp = Date.now();

    // Build tags
    const tags: string[] = [
      `env:${this.environment}`,
      `service:${this.serviceName}`,
      `level:${level}`,
    ];

    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        if (value !== undefined) {
          tags.push(`${key}:${value}`);
        }
      });
    }

    // Create Datadog log entry
    const logEntry: DatadogLog = {
      ddsource: "bun-otel",
      ddtags: tags.join(","),
      hostname: process.env.HOSTNAME || "localhost",
      message,
      service: this.serviceName,
      status: level,
      timestamp,
      environment: this.environment,
      ...traceContext,
      ...attributes,
    };

    // Add to buffer
    if (this.ddApiKey) {
      this.logBuffer.push(logEntry);

      // Flush if buffer is full
      if (this.logBuffer.length >= this.bufferSize) {
        void this.flush();
      }
    }

    // Console output for development
    const prefix = traceContext.trace_id
      ? `[trace:${traceContext.trace_id.toString().substring(0, 8)}][span:${traceContext.span_id.toString().substring(0, 8)}]`
      : "";
    const logMessage = `[${level.toUpperCase()}]${prefix} ${message}`;
    const logFn = level === "error" || level === "fatal" ? console.error : console.log;

    if (this.environment === "development" || this.environment === "local") {
      logFn(logMessage, attributes || "");
    }
  }

  /**
   * Log debug message with trace correlation
   */
  debug(message: string, attributes?: LogAttributes): void {
    this.log("debug", message, attributes);
  }

  /**
   * Log info message with trace correlation
   */
  info(message: string, attributes?: LogAttributes): void {
    this.log("info", message, attributes);
  }

  /**
   * Log warning message with trace correlation
   */
  warn(message: string, attributes?: LogAttributes): void {
    this.log("warn", message, attributes);
  }

  /**
   * Log error message with trace correlation
   */
  error(message: string, error?: Error, attributes?: LogAttributes): void {
    const errorAttrs = error
      ? {
          "error.type": error.name,
          "error.message": error.message,
          "error.stack": error.stack,
          ...attributes,
        }
      : attributes;

    this.log("error", message, errorAttrs);

    // Also record exception in current span if available
    if (error) {
      const span = trace.getSpan(apiContext.active());
      if (span) {
        span.recordException(error);
      }
    }
  }

  /**
   * Log fatal error message with trace correlation
   */
  fatal(message: string, error?: Error, attributes?: LogAttributes): void {
    const errorAttrs = error
      ? {
          "error.type": error.name,
          "error.message": error.message,
          "error.stack": error.stack,
          ...attributes,
        }
      : attributes;

    this.log("fatal", message, errorAttrs);

    if (error) {
      const span = trace.getSpan(apiContext.active());
      if (span) {
        span.recordException(error);
      }
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(defaultAttributes: LogAttributes): Logger {
    const childLogger = new Logger();
    const originalLog = childLogger.log.bind(childLogger);

    childLogger.log = (level: LogLevel, message: string, attrs?: LogAttributes) => {
      originalLog(level, message, { ...defaultAttributes, ...attrs });
    };

    return childLogger;
  }

  /**
   * Force flush all buffered logs
   */
  async forceFlush(): Promise<void> {
    await this.flush();
  }

  /**
   * Cleanup and flush on shutdown
   */
  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flush();
  }
}

// Export singleton instance
export const correlatedLogger = new Logger();

// Convenience exports
export default correlatedLogger;

// Cleanup on process exit
process.on("beforeExit", () => {
  void correlatedLogger.forceFlush();
});

process.on("SIGTERM", () => {
  void correlatedLogger.shutdown();
});
