import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '로스타 - AI 법률 논술 첨삭',
  description: 'AI 기반 법률 논술 첨삭 플랫폼 로스타',
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
