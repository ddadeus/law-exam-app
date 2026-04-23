'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, saveAuth } from '@/lib/api'

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
      router.push(data.user.role === 'teacher' ? '/teacher' : '/student')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '회원가입에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-800">법률논술채점</h1>
          <p className="text-gray-500 mt-2">AI 기반 법률 논술 시험 채점 플랫폼</p>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold text-gray-800 mb-6">회원가입</h2>

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
              <label className="label">역할</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'student', label: '학생', desc: '답안 제출 및 결과 확인' },
                  { value: 'teacher', label: '강사', desc: '문제 출제 및 채점 관리' },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`border-2 rounded-lg p-3 cursor-pointer transition-colors ${
                      form.role === option.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
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
                    <div className="font-medium text-gray-800">{option.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{option.desc}</div>
                  </label>
                ))}
              </div>
            </div>

            {error && <p className="error-text">{error}</p>}

            <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
              {loading ? '가입 처리 중...' : '회원가입'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-4">
            이미 계정이 있으신가요?{' '}
            <Link href="/login" className="text-blue-600 hover:underline font-medium">
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
