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
        {/* Preload de sprites críticos para cache do navegador */}
        <link rel="preload" href="/sprites/Julia_walk_Foward.png" as="image" />
        <link rel="preload" href="/sprites/Julia_walk_Up.png" as="image" />
        <link rel="preload" href="/sprites/Julia_walk_Left.png" as="image" />
        <link rel="preload" href="/sprites/Julia_walk_Rigth.png" as="image" />
        <link rel="preload" href="/sprites/desk.png" as="image" />
        <link rel="preload" href="/sprites/Chair.png" as="image" />
        <link rel="preload" href="/maps/office-map.json" as="fetch" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  )
}
