import * as fs from 'fs-extra';
import * as path from 'path';
import { MonorepoCacheManager } from '../cache-manager';
import { CacheUtils } from '../utils';

describe('MonorepoCacheManager', () => {
  let cacheManager: MonorepoCacheManager;
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(__dirname, '../../test-temp');
    await fs.ensureDir(testDir);
    
    cacheManager = new MonorepoCacheManager({
      rootDir: testDir,
      cacheDir: path.join(testDir, '.cache'),
      maxSize: 10 * 1024 * 1024, // 10MB
      ttl: 1000, // 1 second for testing
      workspacePatterns: ['packages/*']
    });
    
    await cacheManager.initialize();
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe('initialization', () => {
    it('should create cache directory', async () => {
      const cacheDir = path.join(testDir, '.cache');
      expect(await fs.pathExists(cacheDir)).toBe(true);
    });

    it('should load existing cache index', async () => {
      const indexPath = path.join(testDir, '.cache', 'index.json');
      await fs.writeJson(indexPath, { test: 'data' });
      
      const newCacheManager = new MonorepoCacheManager({
        rootDir: testDir,
        cacheDir: path.join(testDir, '.cache')
      });
      
      await newCacheManager.initialize();
      const stats = newCacheManager.getStats();
      expect(stats.totalEntries).toBe(1); // Should load the test entry
    });
  });

  describe('caching', () => {
    it('should cache workspace build output', async () => {
      const workspacePath = path.join(testDir, 'packages', 'test-package');
      await fs.ensureDir(workspacePath);
      await fs.ensureDir(path.join(workspacePath, 'dist'));
      await fs.writeFile(path.join(workspacePath, 'dist', 'index.js'), 'test content');
      
      await cacheManager.set('packages/test-package', ['dist'], {
        dependencies: ['react'],
        metadata: { buildTime: Date.now() }
      });

      const entry = await cacheManager.get('packages/test-package', {
        dependencies: ['react']
      });

      expect(entry).toBeTruthy();
      expect(entry?.workspace).toBe('packages/test-package');
      expect(entry?.dependencies).toEqual(['react']);
    });

    it('should handle cache misses', async () => {
      const entry = await cacheManager.get('non-existent-package');
      expect(entry).toBeNull();
    });

    it('should respect TTL', async () => {
      const workspacePath = path.join(testDir, 'packages', 'test-package');
      await fs.ensureDir(workspacePath);
      await fs.ensureDir(path.join(workspacePath, 'dist'));
      
      await cacheManager.set('packages/test-package', ['dist']);
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const entry = await cacheManager.get('packages/test-package');
      expect(entry).toBeNull();
    });
  });

  describe('restoration', () => {
    it('should restore cached build output', async () => {
      const workspacePath = path.join(testDir, 'packages', 'test-package');
      await fs.ensureDir(workspacePath);
      await fs.ensureDir(path.join(workspacePath, 'dist'));
      await fs.writeFile(path.join(workspacePath, 'dist', 'index.js'), 'original content');
      
      await cacheManager.set('packages/test-package', ['dist']);
      
      // Remove the original
      await fs.remove(workspacePath);
      
      const restored = await cacheManager.restore('packages/test-package');
      expect(restored).toBe(true);
      
      const restoredContent = await fs.readFile(path.join(workspacePath, 'dist', 'index.js'), 'utf8');
      expect(restoredContent).toBe('original content');
    });

    it('should return false when cache miss', async () => {
      const restored = await cacheManager.restore('non-existent-package');
      expect(restored).toBe(false);
    });
  });

  describe('statistics', () => {
    it('should track cache hits and misses', async () => {
      const workspacePath = path.join(testDir, 'packages', 'test-package');
      await fs.ensureDir(workspacePath);
      await fs.ensureDir(path.join(workspacePath, 'dist'));
      
      await cacheManager.set('packages/test-package', ['dist']);
      
      // Hit
      await cacheManager.get('packages/test-package');
      
      // Miss
      await cacheManager.get('non-existent-package');
      
      const stats = cacheManager.getStats();
      expect(stats.hitRate).toBe(0.5);
      expect(stats.missRate).toBe(0.5);
      expect(stats.totalEntries).toBe(1);
    });
  });

  describe('size management', () => {
    it('should enforce size limits', async () => {
      const workspacePath = path.join(testDir, 'packages', 'large-package');
      await fs.ensureDir(workspacePath);
      await fs.ensureDir(path.join(workspacePath, 'dist'));
      
      // Create a large file
      const largeContent = 'x'.repeat(5 * 1024 * 1024); // 5MB
      await fs.writeFile(path.join(workspacePath, 'dist', 'large.js'), largeContent);
      
      await cacheManager.set('packages/large-package', ['dist']);
      
      const stats = cacheManager.getStats();
      expect(stats.totalSize).toBeLessThanOrEqual(10 * 1024 * 1024); // Should respect maxSize
    });
  });

  describe('workspace discovery', () => {
    it('should find workspaces', async () => {
      const workspacePath = path.join(testDir, 'packages', 'test-package');
      await fs.ensureDir(workspacePath);
      await fs.writeJson(path.join(workspacePath, 'package.json'), {
        name: 'test-package',
        dependencies: { react: '^18.0.0' }
      });
      
      const workspaces = await cacheManager.findWorkspaces();
      expect(workspaces).toHaveLength(1);
      expect(workspaces[0].name).toBe('test-package');
      expect(workspaces[0].path).toBe('packages/test-package');
    });
  });

  describe('cache operations', () => {
    it('should remove specific cache entries', async () => {
      const workspacePath = path.join(testDir, 'packages', 'test-package');
      await fs.ensureDir(workspacePath);
      await fs.ensureDir(path.join(workspacePath, 'dist'));
      
      await cacheManager.set('packages/test-package', ['dist']);
      
      const cacheKey = CacheUtils.createCacheKey('packages/test-package');
      await cacheManager.remove(cacheKey);
      
      const entry = await cacheManager.get('packages/test-package');
      expect(entry).toBeNull();
    });

    it('should clear all cache', async () => {
      const workspacePath = path.join(testDir, 'packages', 'test-package');
      await fs.ensureDir(workspacePath);
      await fs.ensureDir(path.join(workspacePath, 'dist'));
      
      await cacheManager.set('packages/test-package', ['dist']);
      
      await cacheManager.clear();
      
      const stats = cacheManager.getStats();
      expect(stats.totalEntries).toBe(0);
    });
  });
}); 