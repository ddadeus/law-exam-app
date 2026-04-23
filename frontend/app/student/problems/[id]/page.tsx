'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { api, getUser, Problem, Answer } from '@/lib/api'

export default function StudentProblemPage() {
  const router = useRouter()
  const params = useParams()
  const problemId = params.id as string

  const [problem, setProblem] = useState<Problem | null>(null)
  const [existingAnswer, setExistingAnswer] = useState<Answer | null>(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const user = getUser()
    if (!user) {
      router.replace('/login')
      return
    }
    if (user.role !== 'student') {
      router.replace('/teacher')
      return
    }
    loadData()
  }, [router, problemId])

  async function loadData() {
    try {
      const [problemData, answersData] = await Promise.all([
        api.problems.get(problemId),
        api.answers.getMy(),
      ])
      setProblem(problemData)
      const myAnswer = answersData.find((a) => a.problem_id === problemId)
      if (myAnswer) setExistingAnswer(myAnswer)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) {
      setError('답안을 입력해주세요')
      return
    }
    if (content.trim().length < 50) {
      setError('답안은 50자 이상 작성해주세요')
      return
    }

    setError('')
    setSubmitting(true)

    try {
      const answer = await api.answers.submit(problemId, content)
      setExistingAnswer(answer)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '답안 제출에 실패했습니다')
    } finally {
      setSubmitting(false)
    }
  }

  function getScoreColor(score: number | null) {
    if (score === null) return 'text-gray-400'
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  function getScoreLabel(score: number | null) {
    if (score === null) return ''
    if (score >= 90) return '우수'
    if (score >= 80) return '양호'
    if (score >= 70) return '보통'
    if (score >= 60) return '미흡'
    return '부족'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/student" className="text-gray-400 hover:text-gray-600 text-sm">
            ← 대시보드
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-600 text-sm">문제 풀기</span>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <p className="text-gray-500">불러오는 중...</p>
          </div>
        )}

        {error && !problem && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">{error}</div>
        )}

        {problem && (
          <div className="space-y-6">
            {/* 문제 카드 */}
            <div className="card">
              <h1 className="text-xl font-bold text-gray-900 mb-4">{problem.title}</h1>

              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">지문</h3>
                  <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-blue-400">
                    <p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">
                      {problem.content}
                    </p>
                  </div>
                </div>

                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">
                    문제
                  </h3>
                  <p className="text-gray-800 font-medium">{problem.question}</p>
                </div>
              </div>
            </div>

            {/* 답안 제출 또는 결과 표시 */}
            {existingAnswer ? (
              <div className="space-y-4">
                {/* 채점 결과 */}
                {existingAnswer.score !== null && (
                  <div className="card border-l-4 border-green-400">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold text-gray-800">채점 결과</h2>
                      <div className="text-right">
                        <span className={`text-4xl font-bold ${getScoreColor(existingAnswer.score)}`}>
                          {existingAnswer.score}
                        </span>
                        <span className="text-gray-400 text-sm ml-1">/ 100점</span>
                        <p className={`text-sm font-medium ${getScoreColor(existingAnswer.score)}`}>
                          {getScoreLabel(existingAnswer.score)}
                        </p>
                      </div>
                    </div>

                    {existingAnswer.feedback && (
                      <div>
                        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
                          AI 첨삭 코멘트
                        </h3>
                        <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                          {existingAnswer.feedback}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 제출한 답안 */}
                <div className="card">
                  <h2 className="text-lg font-bold text-gray-800 mb-3">제출한 답안</h2>
                  <p className="text-xs text-gray-400 mb-2">
                    제출일시:{' '}
                    {new Date(existingAnswer.submitted_at).toLocaleString('ko-KR')}
                  </p>
                  <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed border border-gray-200">
                    {existingAnswer.content}
                  </div>
                </div>

                <div className="text-center">
                  <Link href="/student" className="btn-secondary inline-block">
                    대시보드로 돌아가기
                  </Link>
                </div>
              </div>
            ) : (
              /* 답안 작성 폼 */
              <div className="card">
                <h2 className="text-lg font-bold text-gray-800 mb-1">답안 작성</h2>
                <p className="text-sm text-gray-400 mb-4">
                  제출 후에는 수정이 불가합니다. 신중하게 작성해주세요.
                </p>

                <form onSubmit={handleSubmit}>
                  <textarea
                    className="input-field resize-none mb-2"
                    rows={12}
                    placeholder="여기에 답안을 작성하세요. 관련 법리, 판례를 적용하여 논리적으로 서술하세요."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    disabled={submitting}
                  />
                  <p className="text-xs text-gray-400 mb-4">{content.length}자 (최소 50자)</p>

                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm mb-4">
                      {error}
                    </div>
                  )}

                  {submitting && (
                    <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-lg p-4 mb-4 text-center">
                      <p className="font-medium">AI 채점 중입니다...</p>
                      <p className="text-sm mt-1">Ollama 모델이 답안을 분석하고 있습니다. 잠시 기다려주세요 (최대 2~3분 소요).</p>
                    </div>
                  )}

                  <div className="flex gap-3 justify-end">
                    <Link href="/student" className="btn-secondary">
                      취소
                    </Link>
                    <button
                      type="submit"
                      className="btn-primary px-8"
                      disabled={submitting}
                    >
                      {submitting ? '채점 중...' : '답안 제출 및 채점'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
