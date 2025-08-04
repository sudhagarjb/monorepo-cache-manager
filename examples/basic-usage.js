const { MonorepoCacheManager } = require('../dist');
const fs = require('fs-extra');
const path = require('path');

async function basicExample() {
  console.log('🚀 Monorepo Cache Manager - Basic Example\n');

  // Create a temporary test workspace
  const testDir = path.join(__dirname, '../test-example');
  const workspacePath = path.join(testDir, 'packages', 'test-package');
  
  try {
    await fs.ensureDir(workspacePath);
    await fs.ensureDir(path.join(workspacePath, 'dist'));
    await fs.writeFile(path.join(workspacePath, 'dist', 'index.js'), 'console.log("Hello from cached build!");');
    await fs.writeJson(path.join(workspacePath, 'package.json'), {
      name: 'test-package',
      dependencies: { react: '^18.0.0' }
    });

    // Initialize cache manager
    const cacheManager = new MonorepoCacheManager({
      rootDir: testDir,
      cacheDir: path.join(testDir, '.cache'),
      maxSize: 50 * 1024 * 1024, // 50MB
      ttl: 60 * 60 * 1000, // 1 hour
      workspacePatterns: ['packages/*']
    });

    await cacheManager.initialize();
    console.log('✅ Cache manager initialized');

    // Cache a workspace build
    console.log('\n📦 Caching workspace build...');
    await cacheManager.set('packages/test-package', ['dist'], {
      dependencies: ['react'],
      metadata: { buildTime: Date.now() }
    });

    // Try to restore from cache
    console.log('🔄 Attempting to restore from cache...');
    const restored = await cacheManager.restore('packages/test-package', {
      dependencies: ['react']
    });

    if (restored) {
      console.log('✅ Successfully restored from cache!');
    } else {
      console.log('❌ No cache found, would build from scratch');
    }

    // Get cache statistics
    const stats = cacheManager.getStats();
    console.log('\n📊 Cache Statistics:');
    console.log(`  Total Entries: ${stats.totalEntries}`);
    console.log(`  Total Size: ${(stats.totalSize / 1024).toFixed(2)} KB`);
    console.log(`  Hit Rate: ${(stats.hitRate * 100).toFixed(2)}%`);
    console.log(`  Miss Rate: ${(stats.missRate * 100).toFixed(2)}%`);

    // Find workspaces
    console.log('\n🔍 Discovering workspaces...');
    const workspaces = await cacheManager.findWorkspaces();
    console.log(`Found ${workspaces.length} workspaces:`);
    workspaces.forEach(ws => {
      console.log(`  - ${ws.name} (${ws.path})`);
    });

    console.log('\n✨ Example completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    // Cleanup
    await fs.remove(testDir);
  }
}

// Run the example
basicExample().catch(console.error); 