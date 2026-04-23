'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { api, getUser, Problem, Answer } from '@/lib/api'

export default function TeacherProblemDetail() {
  const router = useRouter()
  const params = useParams()
  const problemId = params.id as string

  const [problem, setProblem] = useState<Problem | null>(null)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [expandedAnswer, setExpandedAnswer] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const user = getUser()
    if (!user) {
      router.replace('/login')
      return
    }
    if (user.role !== 'teacher') {
      router.replace('/student')
      return
    }
    loadData()
  }, [router, problemId])

  async function loadData() {
    try {
      const [problemData, answersData] = await Promise.all([
        api.problems.get(problemId),
        api.answers.getByProblem(problemId),
      ])
      setProblem(problemData)
      setAnswers(answersData)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  function getScoreColor(score: number | null) {
    if (score === null) return 'text-gray-400'
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  function getScoreBadge(score: number | null) {
    if (score === null) return 'bg-gray-100 text-gray-500'
    if (score >= 80) return 'bg-green-100 text-green-700'
    if (score >= 60) return 'bg-yellow-100 text-yellow-700'
    return 'bg-red-100 text-red-700'
  }

  const avgScore =
    answers.length > 0 && answers.some((a) => a.score !== null)
      ? Math.round(
          answers.filter((a) => a.score !== null).reduce((acc, a) => acc + (a.score ?? 0), 0) /
            answers.filter((a) => a.score !== null).length
        )
      : null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/teacher" className="text-gray-400 hover:text-gray-600 text-sm">
            ← 대시보드
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-600 text-sm font-medium">문제 상세</span>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <p className="text-gray-500">불러오는 중...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">{error}</div>
        )}

        {problem && (
          <>
            {/* 문제 정보 */}
            <div className="card mb-6">
              <h1 className="text-xl font-bold text-gray-900 mb-4">{problem.title}</h1>

              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">지문</h3>
                  <p className="text-gray-700 text-sm whitespace-pre-wrap bg-gray-50 rounded-lg p-3">
                    {problem.content}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">질문</h3>
                  <p className="text-gray-800 font-medium">{problem.question}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">채점 기준 법리</h3>
                  <p className="text-gray-700 text-sm whitespace-pre-wrap bg-blue-50 rounded-lg p-3 border border-blue-100">
                    {problem.legal_basis}
                  </p>
                </div>
              </div>
            </div>

            {/* 통계 */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="card text-center">
                <p className="text-3xl font-bold text-blue-600">{answers.length}</p>
                <p className="text-sm text-gray-500 mt-1">총 제출 수</p>
              </div>
              <div className="card text-center">
                <p className={`text-3xl font-bold ${avgScore !== null ? 'text-green-600' : 'text-gray-400'}`}>
                  {avgScore !== null ? avgScore : '-'}
                </p>
                <p className="text-sm text-gray-500 mt-1">평균 점수</p>
              </div>
              <div className="card text-center">
                <p className="text-3xl font-bold text-purple-600">
                  {answers.filter((a) => a.score !== null && a.score >= 80).length}
                </p>
                <p className="text-sm text-gray-500 mt-1">80점 이상</p>
              </div>
            </div>

            {/* 답안 목록 */}
            <div className="card">
              <h2 className="text-lg font-bold text-gray-800 mb-4">학생 답안 목록</h2>

              {answers.length === 0 ? (
                <p className="text-gray-400 text-center py-8">아직 제출된 답안이 없습니다</p>
              ) : (
                <div className="space-y-3">
                  {answers.map((answer) => (
                    <div key={answer.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() =>
                          setExpandedAnswer(expandedAnswer === answer.id ? null : answer.id)
                        }
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-medium">
                            {answer.student?.name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">
                              {answer.student?.name || '알 수 없음'}
                            </p>
                            <p className="text-xs text-gray-400">
                              {answer.student?.email} ·{' '}
                              {new Date(answer.submitted_at).toLocaleDateString('ko-KR')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {answer.score !== null ? (
                            <span
                              className={`text-lg font-bold px-3 py-1 rounded-full text-sm ${getScoreBadge(answer.score)}`}
                            >
                              {answer.score}점
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">채점 없음</span>
                          )}
                          <span className="text-gray-400 text-sm">
                            {expandedAnswer === answer.id ? '▲' : '▼'}
                          </span>
                        </div>
                      </button>

                      {expandedAnswer === answer.id && (
                        <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-4">
                          <div>
                            <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">학생 답안</h4>
                            <p className="text-gray-700 text-sm whitespace-pre-wrap bg-white rounded-lg p-3 border border-gray-200">
                              {answer.content}
                            </p>
                          </div>
                          {answer.feedback && (
                            <div>
                              <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">AI 첨삭 코멘트</h4>
                              <div className="bg-white rounded-lg p-3 border border-blue-200">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className={`text-xl font-bold ${getScoreColor(answer.score)}`}>
                                    {answer.score}점
                                  </span>
                                  <span className="text-xs text-gray-400">/ 100점</span>
                                </div>
                                <p className="text-gray-700 text-sm whitespace-pre-wrap">{answer.feedback}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
