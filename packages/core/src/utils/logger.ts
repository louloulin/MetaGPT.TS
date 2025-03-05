/**
 * Simple logger utility for consistent logging across the application
 */

// Log levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// Default log level
let currentLogLevel = LogLevel.INFO;

/**
 * Logger interface
 */
export const logger = {
  /**
   * Set the current log level
   * @param level - New log level
   */
  setLevel(level: LogLevel): void {
    currentLogLevel = level;
  },

  /**
   * Get the current log level
   * @returns Current log level
   */
  getLevel(): LogLevel {
    return currentLogLevel;
  },

  /**
   * Log a debug message
   * @param message - Message to log
   * @param args - Additional arguments
   */
  debug(message: string, ...args: any[]): void {
    if (currentLogLevel <= LogLevel.DEBUG) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  },

  /**
   * Log an info message
   * @param message - Message to log
   * @param args - Additional arguments
   */
  info(message: string, ...args: any[]): void {
    if (currentLogLevel <= LogLevel.INFO) {
      console.info(`[INFO] ${message}`, ...args);
    }
  },

  /**
   * Log a warning message
   * @param message - Message to log
   * @param args - Additional arguments
   */
  warn(message: string, ...args: any[]): void {
    if (currentLogLevel <= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  },

  /**
   * Log an error message
   * @param message - Message to log
   * @param args - Additional arguments
   */
  error(message: string, ...args: any[]): void {
    if (currentLogLevel <= LogLevel.ERROR) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  },
}; 