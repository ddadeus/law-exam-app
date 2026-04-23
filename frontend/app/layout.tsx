import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '법률 논술 채점 시스템',
  description: '대한민국 법률 논술 시험 AI 자동 채점 플랫폼',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
