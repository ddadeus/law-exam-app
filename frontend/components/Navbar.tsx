'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getUser, logout, User, getDashboardPath } from '@/lib/api'

const ROLE_LABEL: Record<string, string> = {
  teacher: '강사',
  student: '학생',
  admin: '관리자',
}

export default function Navbar() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    setUser(getUser())
  }, [])

  function handleLogout() {
    logout()
    router.push('/login')
  }

  return (
    <nav className="bg-navy-800 border-b border-navy-900 shadow-md">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href={user ? getDashboardPath(user.role) : '/'} className="flex items-center gap-2">
          <span className="text-gold-400 font-bold text-xl tracking-tight">⚖ 법률논술채점</span>
          <span className="text-xs bg-gold-500 text-navy-900 px-2 py-0.5 rounded-full font-semibold hidden sm:inline">
            AI 채점
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {user && (
            <>
              {user.role === 'admin' && (
                <Link
                  href="/admin"
                  className="text-gold-400 text-sm font-semibold hover:text-gold-300 transition-colors"
                >
                  관리자 대시보드
                </Link>
              )}
              <span className="text-sm text-navy-100 hidden sm:inline">
                <span className="font-medium text-white">{user.name}</span>
                <span className="ml-1.5 text-xs bg-navy-600 text-navy-100 px-2 py-0.5 rounded-full">
                  {ROLE_LABEL[user.role] ?? user.role}
                </span>
              </span>
              <button
                onClick={handleLogout}
                className="text-sm text-navy-300 hover:text-red-400 transition-colors"
              >
                로그아웃
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
