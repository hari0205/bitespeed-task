/**
 * Services module exports
 */

export { ContactLinkingEngine } from './contact-linking-engine';
export type {
  IdentifyRequest,
  StrategyExecutionResult,
} from './contact-linking-engine';

export { ContactService } from './contact-service';

export { CacheService, MemoryCache, cacheService } from './cache-service';
export type { CacheStats } from './cache-service';

export { RedisCacheService } from './redis-cache-service';
export type { RedisCacheConfig } from './redis-cache-service';

export {
  HybridCacheService,
  createHybridCacheService,
} from './hybrid-cache-service';
export type { HybridCacheConfig } from './hybrid-cache-service';
