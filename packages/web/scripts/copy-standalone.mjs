#!/usr/bin/env node

/**
 * Copy Next.js standalone build to @talos/web package
 *
 * This script copies the standalone build from apps/web/.next/standalone
 * to packages/web/standalone, making it available as part of the npm package.
 */

import fsExtra from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const { copy } = fsExtra;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const appsWebDir = path.join(rootDir, '../../apps/web');
const talosRootDir = path.join(rootDir, '../..');

async function copyStandalone() {
  const source = path.join(appsWebDir, '.next', 'standalone');
  const target = path.join(rootDir, 'standalone');

  console.log(`📦 Copying standalone build...`);
  console.log(`  From: ${source}`);
  console.log(`  To: ${target}`);

  try {
    await copy(source, target, {
      overwrite: true,
    });
    console.log('✓ Copied standalone build successfully');

    // Copy node-pty prebuilds (native modules)
    const nodePtySource = path.join(talosRootDir, 'node_modules/.pnpm/node-pty@1.1.0/node_modules/node-pty/prebuilds');
    const nodePtyTarget = path.join(target, 'node_modules/.pnpm/node-pty@1.1.0/node_modules/node-pty/prebuilds');

    try {
      await copy(nodePtySource, nodePtyTarget, { overwrite: true });
      console.log('✓ Copied node-pty prebuilds');
    } catch (error) {
      console.warn('⚠️  Warning: Could not copy node-pty prebuilds:', error.message);
      console.warn('   Terminal functionality may not work properly');
    }

    // Verify key files exist
    const { existsSync } = await import('fs');
    // The server.js file is located at apps/web/server.js in the standalone build
    const serverJsPath = path.join(target, 'apps', 'web', 'server.js');
    const buildIdPath = path.join(target, 'apps', 'web', '.next', 'BUILD_ID');
    const pagesManifestPath = path.join(target, 'apps', 'web', '.next', 'server', 'pages-manifest.json');

    if (!existsSync(serverJsPath)) {
      console.error('❌ Error: server.js not found in standalone build');
      console.error(`   Expected path: ${serverJsPath}`);
      process.exit(1);
    }

    if (!existsSync(buildIdPath)) {
      console.error('❌ Error: BUILD_ID not found in standalone build');
      console.error(`   Expected path: ${buildIdPath}`);
      process.exit(1);
    }

    if (!existsSync(pagesManifestPath)) {
      console.error('❌ Error: pages-manifest.json not found in standalone build');
      console.error(`   Expected path: ${pagesManifestPath}`);
      process.exit(1);
    }

    console.log('✓ Verified standalone build structure');
    console.log(`  Server path: apps/web/server.js`);
    console.log(`  BUILD_ID: apps/web/.next/BUILD_ID`);
    console.log(`  Pages manifest: apps/web/.next/server/pages-manifest.json`);
  } catch (error) {
    console.error('❌ Error copying standalone build:', error.message);
    process.exit(1);
  }
}

copyStandalone().catch(console.error);
