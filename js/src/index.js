// Main export file for @unidel2035/links-client

export { default as LinkDBService } from './services/link-db-service.js';
export { default as AuthStorageService } from './services/auth-storage-service.js';
export { default as MenuStorageService } from './services/menu-storage-service.js';

// Re-export utilities
export { default as logger } from './utils/logger.js';

// Re-export universal recursive API
export { default as ILinks } from './api/ilinks.js';
export { default as RecursiveLinks } from './api/recursive-links.js';

// Re-export API routes (optional, for Express integration)
export { default as menuConfigRoutes } from './api/menu-config-routes.js';
export { default as authDataRoutes } from './api/auth-data-routes.js';
