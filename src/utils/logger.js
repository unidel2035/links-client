// Simple logger utility for links-client
// Provides basic logging functionality with different log levels

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

class Logger {
  constructor() {
    this.level = process.env.LOG_LEVEL || 'info';
  }

  /**
   * Check if a log level should be output
   * @param {string} level - Log level to check
   * @returns {boolean}
   */
  shouldLog(level) {
    return LOG_LEVELS[level] <= LOG_LEVELS[this.level];
  }

  /**
   * Format a log message
   * @param {string} level - Log level
   * @param {object|string} data - Data to log
   * @param {string} message - Optional message
   * @returns {string}
   */
  formatMessage(level, data, message) {
    const timestamp = new Date().toISOString();
    const levelStr = level.toUpperCase().padEnd(5);

    if (typeof data === 'string') {
      return `[${timestamp}] ${levelStr} ${data}`;
    }

    if (message) {
      return `[${timestamp}] ${levelStr} ${message} ${JSON.stringify(data)}`;
    }

    return `[${timestamp}] ${levelStr} ${JSON.stringify(data)}`;
  }

  /**
   * Log an error message
   * @param {object|string} data - Data to log
   * @param {string} message - Optional message
   */
  error(data, message) {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', data, message));
    }
  }

  /**
   * Log a warning message
   * @param {object|string} data - Data to log
   * @param {string} message - Optional message
   */
  warn(data, message) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', data, message));
    }
  }

  /**
   * Log an info message
   * @param {object|string} data - Data to log
   * @param {string} message - Optional message
   */
  info(data, message) {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', data, message));
    }
  }

  /**
   * Log a debug message
   * @param {object|string} data - Data to log
   * @param {string} message - Optional message
   */
  debug(data, message) {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', data, message));
    }
  }
}

// Export a singleton instance
const logger = new Logger();
export default logger;
