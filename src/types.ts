export interface CacheConfig {
  rootDir: string;
  cacheDir: string;
  maxSize: number; // in bytes
  ttl: number; // time to live in milliseconds
  compression: boolean;
  workspacePatterns: string[];
}

export interface CacheEntry {
  key: string;
  workspace: string;
  timestamp: number;
  size: number;
  hash: string;
  dependencies: string[];
  metadata: Record<string, any>;
}

export interface WorkspaceInfo {
  name: string;
  path: string;
  dependencies: string[];
  buildOutput: string[];
  cacheKey: string;
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  oldestEntry: number;
  newestEntry: number;
}

export interface CacheOptions {
  workspace?: string;
  force?: boolean;
  dependencies?: string[];
  metadata?: Record<string, any>;
}

export type CacheStrategy = 'hash' | 'timestamp' | 'hybrid';

export interface BuildInfo {
  workspace: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  outputSize: number;
  cacheHit: boolean;
} 