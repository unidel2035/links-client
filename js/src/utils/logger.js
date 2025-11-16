// Minimal logger utility for links-client
// Provides simple logging functionality with support for structured logging

/**
 * Format log message with optional context object
 * @param {string} level - Log level
 * @param {object|string} contextOrMessage - Context object or message string
 * @param {string} message - Message string (optional if first arg is string)
 * @returns {void}
 */
function formatLog(level, contextOrMessage, message) {
  const timestamp = new Date().toISOString();
  const levelUpper = level.toUpperCase();

  // Handle both formats: logger.info('message') and logger.info({context}, 'message')
  if (typeof contextOrMessage === 'string') {
    // Simple format: logger.info('message')
    console.log(`[${timestamp}] [${levelUpper}] ${contextOrMessage}`);
  } else if (typeof contextOrMessage === 'object' && message) {
    // Structured format: logger.info({key: value}, 'message')
    const contextStr = JSON.stringify(contextOrMessage);
    console.log(`[${timestamp}] [${levelUpper}] ${message} ${contextStr}`);
  } else {
    // Fallback
    console.log(`[${timestamp}] [${levelUpper}]`, contextOrMessage, message || '');
  }
}

const logger = {
  /**
   * Log info message
   * @param {object|string} contextOrMessage - Context object or message
   * @param {string} message - Message (optional)
   */
  info: (contextOrMessage, message) => {
    formatLog('info', contextOrMessage, message);
  },

  /**
   * Log error message
   * @param {object|string} contextOrMessage - Context object or message
   * @param {string} message - Message (optional)
   */
  error: (contextOrMessage, message) => {
    formatLog('error', contextOrMessage, message);
  },

  /**
   * Log warning message
   * @param {object|string} contextOrMessage - Context object or message
   * @param {string} message - Message (optional)
   */
  warn: (contextOrMessage, message) => {
    formatLog('warn', contextOrMessage, message);
  },

  /**
   * Log debug message
   * @param {object|string} contextOrMessage - Context object or message
   * @param {string} message - Message (optional)
   */
  debug: (contextOrMessage, message) => {
    // Only log debug messages if DEBUG environment variable is set
    if (process.env.DEBUG) {
      formatLog('debug', contextOrMessage, message);
    }
  },

  /**
   * Current log level
   */
  level: 'info'
};

export default logger;
