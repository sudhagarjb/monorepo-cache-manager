import * as fs from 'fs-extra';
import * as path from 'path';
import { CacheConfig, CacheEntry, CacheOptions, CacheStats, WorkspaceInfo } from './types';
import { CacheUtils } from './utils';

export class MonorepoCacheManager {
  private config: CacheConfig;
  private cacheIndex: Map<string, CacheEntry> = new Map();
  private stats = {
    hits: 0,
    misses: 0,
    totalRequests: 0
  };

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      rootDir: process.cwd(),
      cacheDir: '.cache',
      maxSize: 100 * 1024 * 1024, // 100MB
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      compression: false,
      workspacePatterns: ['packages/*', 'apps/*', 'libs/*'],
      ...config
    };
  }

  /**
   * Initialize the cache manager
   */
  async initialize(): Promise<void> {
    await CacheUtils.ensureDir(this.config.cacheDir);
    await this.loadCacheIndex();
    await this.cleanup();
  }

  /**
   * Get cache entry for a workspace
   */
  async get(workspace: string, options: CacheOptions = {}): Promise<CacheEntry | null> {
    const cacheKey = CacheUtils.createCacheKey(workspace, options.dependencies);
    const entry = this.cacheIndex.get(cacheKey);

    if (!entry) {
      this.stats.misses++;
      this.stats.totalRequests++;
      return null;
    }

    // Check if entry is still valid
    if (Date.now() - entry.timestamp > this.config.ttl) {
      await this.remove(cacheKey);
      this.stats.misses++;
      this.stats.totalRequests++;
      return null;
    }

    // Check if cache files exist
    const cachePath = path.join(this.config.cacheDir, cacheKey);
    if (!(await fs.pathExists(cachePath))) {
      await this.remove(cacheKey);
      this.stats.misses++;
      this.stats.totalRequests++;
      return null;
    }

    this.stats.hits++;
    this.stats.totalRequests++;
    return entry;
  }

  /**
   * Set cache entry for a workspace
   */
  async set(workspace: string, buildOutput: string[], options: CacheOptions = {}): Promise<void> {
    const cacheKey = CacheUtils.createCacheKey(workspace, options.dependencies);
    const workspacePath = path.join(this.config.rootDir, workspace);
    
    // Generate hash of build output
    const outputHash = await CacheUtils.generateHash(workspacePath);
    
    // Calculate size
    const size = await CacheUtils.getDirectorySize(workspacePath);
    
    // Check cache size limit
    await this.enforceSizeLimit(size);
    
    // Create cache entry
    const entry: CacheEntry = {
      key: cacheKey,
      workspace,
      timestamp: Date.now(),
      size,
      hash: outputHash,
      dependencies: options.dependencies || [],
      metadata: options.metadata || {}
    };

    // Save cache files
    const cachePath = path.join(this.config.cacheDir, cacheKey);
    await CacheUtils.ensureDir(cachePath);
    
    // Copy build output to cache
    for (const output of buildOutput) {
      const sourcePath = path.join(workspacePath, output);
      const targetPath = path.join(cachePath, output);
      
      if (await fs.pathExists(sourcePath)) {
        await fs.copy(sourcePath, targetPath);
      }
    }

    // Save entry metadata
    const metadataPath = path.join(cachePath, 'metadata.json');
    await fs.writeJson(metadataPath, entry);

    this.cacheIndex.set(cacheKey, entry);
    await this.saveCacheIndex();
  }

  /**
   * Remove cache entry
   */
  async remove(cacheKey: string): Promise<void> {
    const cachePath = path.join(this.config.cacheDir, cacheKey);
    await fs.remove(cachePath);
    this.cacheIndex.delete(cacheKey);
    await this.saveCacheIndex();
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    await fs.remove(this.config.cacheDir);
    await CacheUtils.ensureDir(this.config.cacheDir);
    this.cacheIndex.clear();
    await this.saveCacheIndex();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalEntries = this.cacheIndex.size;
    const totalSize = Array.from(this.cacheIndex.values()).reduce((sum, entry) => sum + entry.size, 0);
    const hitRate = this.stats.totalRequests > 0 ? this.stats.hits / this.stats.totalRequests : 0;
    const missRate = 1 - hitRate;
    
    const timestamps = Array.from(this.cacheIndex.values()).map(entry => entry.timestamp);
    const oldestEntry = timestamps.length > 0 ? Math.min(...timestamps) : 0;
    const newestEntry = timestamps.length > 0 ? Math.max(...timestamps) : 0;

    return {
      totalEntries,
      totalSize,
      hitRate,
      missRate,
      oldestEntry,
      newestEntry
    };
  }

  /**
   * Find all workspaces in the monorepo
   */
  async findWorkspaces(): Promise<WorkspaceInfo[]> {
    const workspacePaths = await CacheUtils.findWorkspaces(this.config.rootDir, this.config.workspacePatterns);
    const workspaces: WorkspaceInfo[] = [];

    for (const workspacePath of workspacePaths) {
      const relativePath = path.relative(this.config.rootDir, workspacePath);
      const packageJsonPath = path.join(workspacePath, 'package.json');
      
      if (await fs.pathExists(packageJsonPath)) {
        const packageJson = await fs.readJson(packageJsonPath);
        const dependencies = [
          ...Object.keys(packageJson.dependencies || {}),
          ...Object.keys(packageJson.devDependencies || {})
        ];

        workspaces.push({
          name: packageJson.name || relativePath,
          path: relativePath,
          dependencies,
          buildOutput: ['dist', 'build', 'lib', 'out'],
          cacheKey: CacheUtils.createCacheKey(relativePath, dependencies)
        });
      }
    }

    return workspaces;
  }

  /**
   * Restore cache for a workspace
   */
  async restore(workspace: string, options: CacheOptions = {}): Promise<boolean> {
    const entry = await this.get(workspace, options);
    
    if (!entry) {
      return false;
    }

    const cacheKey = CacheUtils.createCacheKey(workspace, options.dependencies);
    const cachePath = path.join(this.config.cacheDir, cacheKey);
    const workspacePath = path.join(this.config.rootDir, workspace);

    // Copy cached files back to workspace
    if (await fs.pathExists(cachePath)) {
      await fs.copy(cachePath, workspacePath, { overwrite: true });
      return true;
    }

    return false;
  }

  private async loadCacheIndex(): Promise<void> {
    const indexPath = path.join(this.config.cacheDir, 'index.json');
    
    if (await fs.pathExists(indexPath)) {
      try {
        const indexData = await fs.readJson(indexPath);
        this.cacheIndex = new Map(Object.entries(indexData));
      } catch (error) {
        // Index file is corrupted, start fresh
        this.cacheIndex = new Map();
      }
    }
  }

  private async saveCacheIndex(): Promise<void> {
    const indexPath = path.join(this.config.cacheDir, 'index.json');
    const indexData = Object.fromEntries(this.cacheIndex);
    await fs.writeJson(indexPath, indexData, { spaces: 2 });
  }

  private async enforceSizeLimit(newEntrySize: number): Promise<void> {
    const stats = this.getStats();
    
    if (stats.totalSize + newEntrySize > this.config.maxSize) {
      // Remove oldest entries until we have space
      const entries = Array.from(this.cacheIndex.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp);

      for (const [key, entry] of entries) {
        await this.remove(key);
        const newStats = this.getStats();
        
        if (newStats.totalSize + newEntrySize <= this.config.maxSize) {
          break;
        }
      }
    }
  }

  private async cleanup(): Promise<void> {
    await CacheUtils.cleanOldFiles(this.config.cacheDir, this.config.ttl);
  }
} 