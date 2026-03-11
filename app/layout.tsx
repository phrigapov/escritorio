import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'

export const metadata: Metadata = {
  title: 'Escritório Virtual Multiplayer',
  description: 'Plataforma de escritório 2D online com chat em tempo real',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Phaser carregado via CDN para economizar memória na compilação */}
        <Script
          src="https://cdn.jsdelivr.net/npm/phaser@3.70.0/dist/phaser.min.js"
          strategy="beforeInteractive"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
