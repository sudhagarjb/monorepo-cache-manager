# Monorepo Cache Manager

A lightweight, high-performance cache manager for monorepos with cross-workspace cache sharing and optimization.

## Features

- 🚀 **Lightweight**: Minimal dependencies, optimized for performance
- 🔄 **Cross-workspace caching**: Share cache between workspaces
- 📊 **Smart invalidation**: Hash-based cache invalidation
- 💾 **Size management**: Automatic cache size limits and cleanup
- ⚡ **Fast**: Optimized file operations and hash generation
- 🔧 **Flexible**: Works with any monorepo structure (Yarn, npm, pnpm, Lerna)

## Installation

```bash
npm install monorepo-cache-manager
```

## Quick Start

```typescript
import { MonorepoCacheManager } from 'monorepo-cache-manager';

// Initialize cache manager
const cacheManager = new MonorepoCacheManager({
  rootDir: process.cwd(),
  cacheDir: '.cache',
  maxSize: 100 * 1024 * 1024, // 100MB
  ttl: 24 * 60 * 60 * 1000, // 24 hours
  workspacePatterns: ['packages/*', 'apps/*', 'libs/*']
});

await cacheManager.initialize();

// Cache a workspace build
await cacheManager.set('packages/my-package', ['dist', 'build'], {
  dependencies: ['react', 'typescript'],
  metadata: { buildTime: Date.now() }
});

// Restore from cache
const restored = await cacheManager.restore('packages/my-package', {
  dependencies: ['react', 'typescript']
});

// Get cache statistics
const stats = cacheManager.getStats();
console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);
```

## API Reference

### MonorepoCacheManager

#### Constructor

```typescript
new MonorepoCacheManager(config?: Partial<CacheConfig>)
```

**Config Options:**
- `rootDir`: Root directory of the monorepo (default: `process.cwd()`)
- `cacheDir`: Cache directory path (default: `.cache`)
- `maxSize`: Maximum cache size in bytes (default: `100MB`)
- `ttl`: Time to live for cache entries in milliseconds (default: `24 hours`)
- `compression`: Enable compression (default: `false`)
- `workspacePatterns`: Glob patterns for workspace detection (default: `['packages/*', 'apps/*', 'libs/*']`)

#### Methods

##### `initialize(): Promise<void>`
Initialize the cache manager and load existing cache index.

##### `set(workspace: string, buildOutput: string[], options?: CacheOptions): Promise<void>`
Cache build output for a workspace.

**Parameters:**
- `workspace`: Workspace path relative to root
- `buildOutput`: Array of build output directories/files
- `options`: Cache options (dependencies, metadata, etc.)

##### `get(workspace: string, options?: CacheOptions): Promise<CacheEntry | null>`
Get cache entry for a workspace.

##### `restore(workspace: string, options?: CacheOptions): Promise<boolean>`
Restore cached build output to workspace. Returns `true` if successful.

##### `remove(cacheKey: string): Promise<void>`
Remove a specific cache entry.

##### `clear(): Promise<void>`
Clear all cache entries.

##### `getStats(): CacheStats`
Get cache statistics including hit rate, total size, etc.

##### `findWorkspaces(): Promise<WorkspaceInfo[]>`
Find all workspaces in the monorepo.

## Usage Examples

### Basic Usage

```typescript
import { MonorepoCacheManager } from 'monorepo-cache-manager';

const cacheManager = new MonorepoCacheManager();
await cacheManager.initialize();

// Cache a build
await cacheManager.set('packages/ui', ['dist'], {
  dependencies: ['react', 'styled-components']
});

// Restore from cache
const restored = await cacheManager.restore('packages/ui', {
  dependencies: ['react', 'styled-components']
});

if (restored) {
  console.log('Build restored from cache!');
} else {
  console.log('No cache found, building from scratch...');
}
```

### Advanced Configuration

```typescript
const cacheManager = new MonorepoCacheManager({
  rootDir: '/path/to/monorepo',
  cacheDir: '.build-cache',
  maxSize: 500 * 1024 * 1024, // 500MB
  ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
  compression: true,
  workspacePatterns: [
    'packages/*',
    'apps/*',
    'libs/*',
    'tools/*'
  ]
});
```

### Integration with Build Tools

```typescript
// Integration with npm scripts
const cacheManager = new MonorepoCacheManager();

async function buildWithCache(workspace: string) {
  await cacheManager.initialize();
  
  // Try to restore from cache
  const restored = await cacheManager.restore(workspace);
  
  if (!restored) {
    // Build from scratch
    console.log(`Building ${workspace}...`);
    await runBuildCommand(workspace);
    
    // Cache the build
    await cacheManager.set(workspace, ['dist', 'build']);
  } else {
    console.log(`${workspace} restored from cache!`);
  }
}
```

### Cache Statistics

```typescript
const stats = cacheManager.getStats();

console.log(`Cache Statistics:
  Total Entries: ${stats.totalEntries}
  Total Size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB
  Hit Rate: ${(stats.hitRate * 100).toFixed(2)}%
  Miss Rate: ${(stats.missRate * 100).toFixed(2)}%
`);
```

## Performance Tips

1. **Use appropriate TTL**: Set TTL based on your build frequency
2. **Limit cache size**: Prevent cache from growing too large
3. **Include dependencies**: Always include relevant dependencies in cache keys
4. **Clean regularly**: Use `clear()` periodically to remove old entries
5. **Monitor stats**: Track hit rates to optimize cache strategy

## Comparison with Other Tools

| Feature | monorepo-cache-manager | Turbo | Nx |
|---------|----------------------|-------|----|
| Bundle Size | ~50KB | ~2MB | ~5MB |
| Dependencies | 2 | 50+ | 100+ |
| Setup Complexity | Minimal | Medium | High |
| Customization | High | Medium | High |
| Performance | Excellent | Good | Good |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](https://github.com/sudhagar_b/monorepo-cache-manager)
- 🐛 [Issues](https://github.com/sudhagar_b/monorepo-cache-manager/issues)
- 💬 [Discussions](https://github.com/sudhagar_b/monorepo-cache-manager/discussions) 