'use client'
import { useEffect, useRef, useState } from 'react'
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
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setUser(getUser())
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  function handleLogout() {
    logout()
    router.push('/login')
  }

  return (
    <nav className="bg-navy-800 border-b border-navy-900 shadow-md">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href={user ? getDashboardPath(user.role) : '/'} className="flex items-center gap-2">
          <span className="text-gold-400 font-bold text-xl tracking-tight">⚖ 로스타</span>
          <span className="text-xs bg-gold-500 text-navy-900 px-2 py-0.5 rounded-full font-semibold hidden sm:inline">
            AI 채점
          </span>
        </Link>

        {/* 데스크탑 메뉴 */}
        <div className="hidden sm:flex items-center gap-4">
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
              <span className="text-sm text-navy-100">
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

        {/* 모바일 햄버거 버튼 */}
        {user && (
          <div className="sm:hidden relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="text-gold-400 text-2xl leading-none px-2 py-1 hover:text-gold-300 transition-colors"
              aria-label="메뉴 열기"
            >
              {menuOpen ? '✕' : '≡'}
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-navy-800 border border-navy-600 rounded-lg shadow-lg z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-navy-600">
                  <p className="text-white font-medium text-sm">{user.name}</p>
                  <p className="text-xs text-navy-300 mt-0.5">
                    <span className="bg-navy-600 text-navy-100 px-2 py-0.5 rounded-full">
                      {ROLE_LABEL[user.role] ?? user.role}
                    </span>
                  </p>
                </div>
                {user.role === 'admin' && (
                  <Link
                    href="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2.5 text-sm text-gold-400 hover:bg-navy-700 transition-colors"
                  >
                    관리자 대시보드
                  </Link>
                )}
                <button
                  onClick={() => { setMenuOpen(false); handleLogout() }}
                  className="w-full text-left px-4 py-2.5 text-sm text-navy-300 hover:bg-navy-700 hover:text-red-400 transition-colors"
                >
                  로그아웃
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
