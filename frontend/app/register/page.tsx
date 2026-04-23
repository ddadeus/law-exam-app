'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, saveAuth, getDashboardPath } from '@/lib/api'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    passwordConfirm: '',
    role: 'student',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (form.password !== form.passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다')
      return
    }
    if (form.password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다')
      return
    }

    setLoading(true)
    try {
      const data = await api.auth.register(form.email, form.password, form.name, form.role)
      saveAuth(data.access_token, data.user)
      router.push(getDashboardPath(data.user.role))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '회원가입에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700">
      <div className="w-full max-w-md px-4 py-8">
        {/* 로고 */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gold-500 rounded-full mb-3 shadow-lg">
            <span className="text-2xl">⚖</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">법률논술채점</h1>
          <p className="text-navy-200 mt-1 text-sm">AI 기반 법률 논술 시험 채점 플랫폼</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-navy-800 mb-5 text-center">회원가입</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">이름</label>
              <input
                type="text"
                name="name"
                className="input-field"
                placeholder="이름을 입력하세요"
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="label">이메일</label>
              <input
                type="email"
                name="email"
                className="input-field"
                placeholder="이메일을 입력하세요"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="label">비밀번호</label>
              <input
                type="password"
                name="password"
                className="input-field"
                placeholder="6자 이상 입력하세요"
                value={form.password}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="label">비밀번호 확인</label>
              <input
                type="password"
                name="passwordConfirm"
                className="input-field"
                placeholder="비밀번호를 다시 입력하세요"
                value={form.passwordConfirm}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="label">역할 선택</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'student', label: '학생', icon: '📖', desc: '답안 제출 및 결과 확인' },
                  { value: 'teacher', label: '강사', icon: '🎓', desc: '문제 출제 및 채점 관리' },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`border-2 rounded-xl p-3 cursor-pointer transition-all ${
                      form.role === option.value
                        ? 'border-navy-700 bg-navy-50'
                        : 'border-gray-200 hover:border-navy-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={option.value}
                      checked={form.role === option.value}
                      onChange={handleChange}
                      className="sr-only"
                    />
                    <div className="text-xl mb-1">{option.icon}</div>
                    <div className="font-semibold text-navy-800">{option.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{option.desc}</div>
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full py-3 text-base mt-2" disabled={loading}>
              {loading ? '가입 처리 중...' : '회원가입'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-5">
            이미 계정이 있으신가요?{' '}
            <Link href="/login" className="text-navy-700 hover:text-navy-800 font-semibold underline">
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
