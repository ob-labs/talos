const path = require("path");
const webpack = require("webpack");

module.exports = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  output: "standalone",
  ...(process.env.NODE_ENV !== 'production' && {
    generateEtags: false,
  }),
  webpack: (config, { isServer, dev }) => {
    // Use source files in both dev and production
    // This ensures @/ aliases work correctly
    const coreSrcPath = path.resolve(__dirname, '../../packages/core/src');

    config.resolve.alias = {
      ...config.resolve.alias,
      // Point to source files for HMR and proper @/ alias resolution
      '@talos/types': path.resolve(__dirname, '../../packages/types/src/index.ts'),
      '@talos/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
      '@talos/core/storage': path.resolve(__dirname, '../../packages/core/src/storage/storage.ts'),
      '@talos/terminal': path.resolve(__dirname, '../../packages/terminal/src/index.ts'),
      '@talos/git': path.resolve(__dirname, '../../packages/git/src/index.ts'),

      // Core package internal @/ aliases (needed when resolving source files)
      '@/domain': path.join(coreSrcPath, 'domain'),
      '@/domain/entities': path.join(coreSrcPath, 'domain/entities'),
      '@/domain/repositories': path.join(coreSrcPath, 'domain/repositories'),
      '@/repositories': path.join(coreSrcPath, 'repositories'),
      '@/infrastructure': path.join(coreSrcPath, 'infrastructure'),
      '@/infrastructure/communication': path.join(coreSrcPath, 'infrastructure/communication'),
      '@/infrastructure/constant': path.join(coreSrcPath, 'infrastructure/constant.ts'),
      '@/infrastructure/process': path.join(coreSrcPath, 'infrastructure/process'),
      '@/application': path.join(coreSrcPath, 'application'),
      '@/storage': path.join(coreSrcPath, 'storage'),
      '@/process': path.join(coreSrcPath, 'process'),
      '@/logger': path.join(coreSrcPath, 'logger'),
    };

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        child_process: false,
        util: false,
        buffer: require.resolve("buffer/"),
        "node-pty": false,
        ws: false,
        worker_threads: false,
        net: false,
      };
      // Disable @talos/core on client side (use mocks instead)
      config.resolve.alias['@talos/core'] = false;

      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /git-service\.ts$/,
          path.resolve(__dirname, 'lib/mocks/git-service-mock.ts')
        )
      );
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /session-manager\.ts$/,
          path.resolve(__dirname, 'lib/mocks/session-manager-mock.ts')
        )
      );
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /history\.ts$/,
          path.resolve(__dirname, 'lib/mocks/command-history-mock.ts')
        )
      );
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
          const mod = resource.request.replace(/^node:/, "");
          switch (mod) {
            case "buffer":
              resource.request = "buffer";
              break;
            default:
              resource.request = mod;
          }
        })
      );
    }

    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push("node-pty");
      const originalExternals = config.externals;
      config.externals = [
        function({ request }, callback) {
          if (request &&
              (request.includes("node-pty") ||
               request.includes("worker_threads") ||
               request.includes("net") ||
               request.includes("windowsConoutConnection") ||
               request.includes("windowsPtyAgent"))) {
            return callback(null, "commonjs " + request);
          }
          if (typeof originalExternals === 'function') {
            originalExternals({ request }, callback);
          } else {
            callback();
          }
        },
        ...(Array.isArray(originalExternals) ? originalExternals : [originalExternals].filter(Boolean))
      ];
    }

    return config;
  },
};
