/** @type {import('next').NextConfig} */
const nextConfig = {
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
