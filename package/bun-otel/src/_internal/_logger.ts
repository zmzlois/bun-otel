import { isDebugEnabled } from "./_debug";

/**
 * Internal logger for bun-otel package
 * Only logs debug/info/warn when DEBUG=true or DEBUG=bun-otel*
 * Errors always log
 */
export const logger = {
  /**
   * Check if debug mode is enabled
   */
  get enabled(): boolean {
    return isDebugEnabled;
  },

  /**
   * Log debug information (only in debug mode)
   */
  log(...args: unknown[]): void {
    if (isDebugEnabled) {
      console.log("[bun-otel]", ...args);
    }
  },

  /**
   * Log info messages (only in debug mode)
   */
  info(...args: unknown[]): void {
    if (isDebugEnabled) {
      console.log("[bun-otel:info]", ...args);
    }
  },

  /**
   * Log warnings (only in debug mode)
   */
  warn(...args: unknown[]): void {
    if (isDebugEnabled) {
      console.warn("[bun-otel:warn]", ...args);
    }
  },

  /**
   * Log errors (always logs, regardless of debug mode)
   */
  error(...args: unknown[]): void {
    console.error("[bun-otel:error]", ...args);
  },
};
