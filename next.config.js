/** @type {import('next').NextConfig} */
const nextConfig = {
  // Otimizações de performance
  compress: true,
  poweredByHeader: false,
  
  // Cache agressivo para assets estáticos
  async headers() {
    return [
      {
        source: '/sprites/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/maps/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600, must-revalidate' },
        ],
      },
    ]
  },

  webpack: (config, { isServer, dev }) => {
    // Phaser é carregado via CDN (ver layout.tsx) — não bundlar, economiza ~400MB na compilação
    if (!isServer) {
      config.externals = [
        ...(config.externals || []),
        { phaser: 'Phaser' },
      ]
    }

    // Em modo desenvolvimento, desabilitar minimização para economizar memória
    if (dev) {
      config.optimization = {
        ...config.optimization,
        minimize: false,
      }
    }

    // Limitar paralelismo para reduzir pico de memória em máquinas com pouca RAM
    config.parallelism = 1

    // Cache em disco para recompilações mais rápidas e com menos memória
    if (dev) {
      config.cache = { type: 'filesystem' }
    }

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        https: false,
        http: false,
        crypto: false,
        stream: false,
        zlib: false,
        'phaser3spectorjs': false,
      }
      // Alias node: protocol imports to their non-prefixed equivalents
      config.resolve.alias = {
        ...config.resolve.alias,
        'node:https': false,
        'node:http': false,
        'node:crypto': false,
        'node:stream': false,
        'node:zlib': false,
        'node:path': false,
        'node:fs': false,
        'node:url': false,
        'node:buffer': false,
        'node:util': false,
        'node:events': false,
        'node:net': false,
        'node:tls': false,
        'node:os': false,
      }
      const webpack = require('webpack')
      config.plugins.push(
        new webpack.IgnorePlugin({ resourceRegExp: /phaser3spectorjs/ })
      )
      // Handle node: URI scheme (used by pptxgenjs) — strip the prefix so webpack can resolve normally
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:(.*)$/, (resource) => {
          resource.request = resource.request.replace(/^node:/, '')
        })
      )
    }
    return config
  },
}

module.exports = nextConfig
