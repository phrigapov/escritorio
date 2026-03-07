import type { Metadata } from 'next'
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
      <body>{children}</body>
    </html>
  )
}
