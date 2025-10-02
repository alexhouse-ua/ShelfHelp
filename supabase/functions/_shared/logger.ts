/**
 * Centralized logging utility for Supabase Edge Functions
 * Provides structured JSON logging with request IDs for traceability
 */

/**
 * Log level types
 */
export type LogLevel = "info" | "warn" | "error" | "debug";

/**
 * Context object for additional log data
 */
export type LogContext = Record<string, unknown>;

/**
 * Structured log entry format
 */
export interface LogEntry {
  requestId: string;
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
}

/**
 * Logger interface with methods for each log level
 */
export interface Logger {
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
}

/**
 * Generates a unique request ID using crypto.randomUUID()
 * @returns A UUID v4 string
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Creates a logger instance bound to a specific request ID
 * @param requestId - The unique identifier for the request
 * @returns Logger instance with methods for each log level
 */
export function createLogger(requestId: string): Logger {
  const log = (level: LogLevel, message: string, context?: LogContext): void => {
    const logEntry: LogEntry = {
      requestId,
      level,
      message,
      timestamp: new Date().toISOString(),
      context: context || {},
    };

    const logString = JSON.stringify(logEntry);

    // Route to appropriate console method based on level
    if (level === "error") {
      console.error(logString);
    } else if (level === "warn") {
      console.warn(logString);
    } else if (level === "debug") {
      console.debug(logString);
    } else {
      console.log(logString);
    }
  };

  return {
    info: (message: string, context?: LogContext) => log("info", message, context),
    warn: (message: string, context?: LogContext) => log("warn", message, context),
    error: (message: string, context?: LogContext) => log("error", message, context),
    debug: (message: string, context?: LogContext) => log("debug", message, context),
  };
}
