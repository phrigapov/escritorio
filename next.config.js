/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Ignorar módulos opcionais
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        'phaser3spectorjs': false,
      };
      
      // Ignorar o módulo phaser3spectorjs que é opcional
      const webpack = require('webpack');
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /phaser3spectorjs/,
        })
      );
    }
    return config;
  },
}

module.exports = nextConfig
