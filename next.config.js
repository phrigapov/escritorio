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
        'phaser3spectorjs': false,
      }
      const webpack = require('webpack')
      config.plugins.push(
        new webpack.IgnorePlugin({ resourceRegExp: /phaser3spectorjs/ })
      )
    }
    return config
  },
}

module.exports = nextConfig
