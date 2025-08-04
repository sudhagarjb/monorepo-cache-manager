import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import { glob } from 'glob';

export class CacheUtils {
  /**
   * Generate a hash for a file or directory
   */
  static async generateHash(filePath: string): Promise<string> {
    const stats = await fs.stat(filePath);
    
    if (stats.isFile()) {
      const content = await fs.readFile(filePath);
      return crypto.createHash('sha256').update(content).digest('hex');
    }
    
    if (stats.isDirectory()) {
      const files = await this.getAllFiles(filePath);
      const hashes = await Promise.all(
        files.map(file => this.generateHash(file))
      );
      return crypto.createHash('sha256').update(hashes.join('')).digest('hex');
    }
    
    return '';
  }

  /**
   * Get all files in a directory recursively
   */
  static async getAllFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const items = await fs.readdir(dirPath);
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const stats = await fs.stat(fullPath);
        
        if (stats.isDirectory()) {
          const subFiles = await this.getAllFiles(fullPath);
          files.push(...subFiles);
        } else {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }
    
    return files.sort();
  }

  /**
   * Calculate directory size
   */
  static async getDirectorySize(dirPath: string): Promise<number> {
    const files = await this.getAllFiles(dirPath);
    let totalSize = 0;
    
    for (const file of files) {
      try {
        const stats = await fs.stat(file);
        totalSize += stats.size;
      } catch (error) {
        // File might not exist or be accessible
      }
    }
    
    return totalSize;
  }

  /**
   * Find workspace directories
   */
  static async findWorkspaces(rootDir: string, patterns: string[]): Promise<string[]> {
    const workspaces: string[] = [];
    
    for (const pattern of patterns) {
      try {
        const matches = await glob(pattern, {
          cwd: rootDir,
          absolute: true,
          ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
        });
        workspaces.push(...matches);
      } catch (error) {
        // Pattern might be invalid
      }
    }
    
    return [...new Set(workspaces)];
  }

  /**
   * Create cache key from workspace and dependencies
   */
  static createCacheKey(workspace: string, dependencies: string[] = []): string {
    const key = `${workspace}:${dependencies.sort().join(',')}`;
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Ensure directory exists
   */
  static async ensureDir(dirPath: string): Promise<void> {
    await fs.ensureDir(dirPath);
  }

  /**
   * Clean old files based on TTL
   */
  static async cleanOldFiles(dirPath: string, ttl: number): Promise<void> {
    const now = Date.now();
    const files = await this.getAllFiles(dirPath);
    
    for (const file of files) {
      try {
        const stats = await fs.stat(file);
        if (now - stats.mtime.getTime() > ttl) {
          await fs.remove(file);
        }
      } catch (error) {
        // File might not exist or be accessible
      }
    }
  }

  /**
   * Compress data (simple implementation)
   */
  static compress(data: string): string {
    // Simple compression - in production, use zlib or similar
    return Buffer.from(data).toString('base64');
  }

  /**
   * Decompress data
   */
  static decompress(data: string): string {
    return Buffer.from(data, 'base64').toString();
  }
} 