'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { api, getUser } from '@/lib/api'

export default function NewProblemPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    title: '',
    content: '',
    question: '',
    legal_basis: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const user = getUser()
    if (!user) {
      router.replace('/login')
      return
    }
    if (user.role !== 'teacher') {
      router.replace('/student')
    }
  }, [router])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.title.trim() || !form.content.trim() || !form.question.trim() || !form.legal_basis.trim()) {
      setError('모든 항목을 입력해주세요')
      return
    }

    setLoading(true)
    try {
      await api.problems.create(form)
      router.push('/teacher')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '문제 생성에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/teacher" className="text-gray-400 hover:text-gray-600">
            ← 대시보드
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-2xl font-bold text-gray-900">새 문제 출제</h1>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="label">문제 제목 *</label>
              <input
                type="text"
                name="title"
                className="input-field"
                placeholder="예: 2024년 사법시험 민법 제1문"
                value={form.title}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="label">지문 *</label>
              <p className="text-xs text-gray-400 mb-1">사례 또는 상황 설명을 입력하세요</p>
              <textarea
                name="content"
                className="input-field resize-none"
                rows={6}
                placeholder="甲은 乙로부터 부동산을 매수하였고..."
                value={form.content}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="label">질문 *</label>
              <textarea
                name="question"
                className="input-field resize-none"
                rows={3}
                placeholder="위 사례에서 甲의 법적 지위를 논하시오."
                value={form.question}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="label">채점 기준 법리 *</label>
              <p className="text-xs text-gray-400 mb-1">
                관련 판례 번호, 법령 조문, 핵심 법리를 입력하세요. AI가 이를 기준으로 채점합니다.
              </p>
              <textarea
                name="legal_basis"
                className="input-field resize-none"
                rows={8}
                placeholder={`예시:\n[판례] 대법원 2023. 1. 12. 선고 2022다12345 판결\n- 부동산 이중매매에서 후매수인의 악의 판단 기준\n- 반사회적 법률행위(민법 제103조) 해당 여부\n\n[법령] 민법 제103조 (반사회질서의 법률행위)\n민법 제186조 (부동산물권변동의 효력)\n\n[핵심 법리]\n1. 이중매매의 경우 후매수인이 배임행위에 적극 가담한 경우 무효\n2. 등기의 추정력과 그 번복 요건`}
                value={form.legal_basis}
                onChange={handleChange}
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <Link href="/teacher" className="btn-secondary">
                취소
              </Link>
              <button type="submit" className="btn-primary px-8" disabled={loading}>
                {loading ? '저장 중...' : '문제 출제'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
