'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { api, getUser, Problem, Answer } from '@/lib/api'

type StatusKey = 'pending' | 'ai_graded' | 'teacher_confirmed'

const STATUS_BADGE: Record<StatusKey, string> = {
  pending: 'badge-pending',
  ai_graded: 'badge-ai-graded',
  teacher_confirmed: 'badge-confirmed',
}
const STATUS_LABEL: Record<StatusKey, string> = {
  pending: 'AI 채점 대기',
  ai_graded: '검토 대기',
  teacher_confirmed: '강사 확인 완료',
}

interface ConfirmForm { score: number; feedback: string }

export default function TeacherProblemDetail() {
  const router = useRouter()
  const params = useParams()
  const problemId = params.id as string

  const [problem, setProblem] = useState<Problem | null>(null)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [expandedAnswer, setExpandedAnswer] = useState<string | null>(null)
  const [confirmForms, setConfirmForms] = useState<Record<string, ConfirmForm>>({})
  const [confirming, setConfirming] = useState<string | null>(null)
  const [regrading, setRegrading] = useState<string | null>(null)
  const [resetting, setResetting] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const user = getUser()
    if (!user) { router.replace('/login'); return }
    if (user.role !== 'teacher') { router.replace('/student'); return }
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
      // 폼 초기화
      const forms: Record<string, ConfirmForm> = {}
      for (const a of answersData) {
        forms[a.id] = { score: a.score ?? 0, feedback: a.feedback ?? '' }
      }
      setConfirmForms(forms)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  function toggleExpand(answerId: string, answer: Answer) {
    if (expandedAnswer === answerId) {
      setExpandedAnswer(null)
    } else {
      setExpandedAnswer(answerId)
      if (!confirmForms[answerId]) {
        setConfirmForms((prev) => ({
          ...prev,
          [answerId]: { score: answer.score ?? 0, feedback: answer.feedback ?? '' },
        }))
      }
    }
  }

  async function handleReset(answerId: string) {
    if (!confirm('정말 초기화하시겠습니까? 학생의 답안이 삭제되고 다시 제출할 수 있게 됩니다.')) return
    setResetting(answerId)
    try {
      await api.answers.reset(answerId)
      await loadData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '초기화 중 오류가 발생했습니다')
    } finally {
      setResetting(null)
    }
  }

  async function handleRegrade(answerId: string) {
    setRegrading(answerId)
    try {
      await api.answers.regrade(answerId)
      await loadData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '재채점 요청 중 오류가 발생했습니다')
    } finally {
      setRegrading(null)
    }
  }

  async function handleConfirm(answerId: string) {
    const form = confirmForms[answerId]
    if (!form) return
    if (form.score < 0 || form.score > 100) {
      alert('점수는 0~100 사이여야 합니다')
      return
    }
    setConfirming(answerId)
    try {
      const updated = await api.answers.confirm(answerId, form.score, form.feedback)
      setAnswers((prev) => prev.map((a) => (a.id === answerId ? updated : a)))
      setConfirmForms((prev) => ({ ...prev, [answerId]: { score: updated.score ?? 0, feedback: updated.feedback ?? '' } }))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '컨펌 중 오류가 발생했습니다')
    } finally {
      setConfirming(null)
    }
  }

  const pendingCount = answers.filter((a) => a.status === 'ai_graded').length
  const confirmedCount = answers.filter((a) => a.status === 'teacher_confirmed').length
  const confirmedAnswers = answers.filter((a) => a.status === 'teacher_confirmed' && a.score !== null)
  const avgScore = confirmedAnswers.length
    ? Math.round(confirmedAnswers.reduce((acc, a) => acc + (a.score ?? 0), 0) / confirmedAnswers.length)
    : null

  function getScoreBadgeClass(score: number | null) {
    if (score === null) return 'bg-gray-100 text-gray-500'
    if (score >= 80) return 'bg-green-100 text-green-700'
    if (score >= 60) return 'bg-yellow-100 text-yellow-700'
    return 'bg-red-100 text-red-700'
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/teacher" className="text-gray-400 hover:text-navy-600 text-sm">
            ← 대시보드
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-navy-700 text-sm font-medium">문제 상세</span>
        </div>

        {loading && <div className="card text-center py-12 text-gray-400">불러오는 중...</div>}
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">{error}</div>}

        {problem && (
          <>
            {/* 문제 정보 */}
            <div className="card mb-5 border-t-4 border-navy-700">
              <h1 className="text-xl font-bold text-navy-800 mb-4">{problem.title}</h1>
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">지문</h3>
                  <p className="text-gray-700 text-sm whitespace-pre-wrap bg-slate-50 rounded-lg p-3 border">
                    {problem.content}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">질문</h3>
                  <p className="text-gray-800 font-medium">{problem.question}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">채점 기준 법리</h3>
                  <p className="text-gray-700 text-sm whitespace-pre-wrap bg-navy-50 rounded-lg p-3 border border-navy-100">
                    {problem.legal_basis}
                  </p>
                </div>
              </div>
            </div>

            {/* 통계 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
              {[
                { label: '총 제출', value: answers.length, color: 'text-navy-700' },
                { label: '검토 대기', value: pendingCount, color: 'text-amber-600' },
                { label: '확인 완료', value: confirmedCount, color: 'text-green-600' },
                { label: '평균 점수', value: avgScore !== null ? `${avgScore}점` : '-', color: 'text-blue-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="card text-center py-4">
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                </div>
              ))}
            </div>

            {/* 답안 목록 */}
            <div className="card p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-bold text-navy-800">학생 답안 목록</h2>
              </div>

              {answers.length === 0 ? (
                <p className="text-gray-400 text-center py-12">아직 제출된 답안이 없습니다</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {answers.map((answer) => {
                    const status = (answer.status ?? 'ai_graded') as StatusKey
                    const form = confirmForms[answer.id] ?? { score: answer.score ?? 0, feedback: answer.feedback ?? '' }
                    return (
                      <div key={answer.id}>
                        <button
                          onClick={() => toggleExpand(answer.id, answer)}
                          className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-navy-100 text-navy-700 rounded-full flex items-center justify-center text-sm font-bold">
                              {answer.student?.name?.charAt(0) || '?'}
                            </div>
                            <div>
                              <p className="font-medium text-gray-800">{answer.student?.name || '알 수 없음'}</p>
                              <p className="text-xs text-gray-400">
                                {answer.student?.email} · {new Date(answer.submitted_at).toLocaleDateString('ko-KR')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={STATUS_BADGE[status]}>
                              {STATUS_LABEL[status]}
                            </span>
                            {answer.score !== null && (
                              <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${getScoreBadgeClass(answer.score)}`}>
                                {answer.score}점
                              </span>
                            )}
                            <span className="text-gray-400 text-xs">
                              {expandedAnswer === answer.id ? '▲' : '▼'}
                            </span>
                          </div>
                        </button>

                        {expandedAnswer === answer.id && (
                          <div className="border-t border-gray-100 bg-slate-50 px-6 py-5 space-y-4">
                            {/* 학생 답안 */}
                            <div>
                              <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">학생 답안</h4>
                              <p className="text-gray-700 text-sm whitespace-pre-wrap bg-white rounded-lg p-3 border border-gray-200">
                                {answer.content}
                              </p>
                            </div>

                            {/* 컨펌 폼 */}
                            {status !== 'teacher_confirmed' ? (
                              <div className="bg-white rounded-xl border border-navy-200 p-4">
                                <h4 className="text-sm font-semibold text-navy-800 mb-3">
                                  AI 채점 결과 검토 및 컨펌
                                </h4>
                                <div className="flex items-center gap-3 mb-3">
                                  <label className="text-sm font-medium text-gray-600 w-12">점수</label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    className="input-field w-24 text-center font-bold text-lg"
                                    value={form.score}
                                    onChange={(e) =>
                                      setConfirmForms((prev) => ({
                                        ...prev,
                                        [answer.id]: { ...form, score: Number(e.target.value) },
                                      }))
                                    }
                                  />
                                  <span className="text-gray-400 text-sm">/ 100점</span>
                                </div>
                                <div className="mb-4">
                                  <label className="text-sm font-medium text-gray-600 block mb-1">첨삭 코멘트</label>
                                  <textarea
                                    rows={5}
                                    className="input-field resize-none text-sm"
                                    value={form.feedback}
                                    onChange={(e) =>
                                      setConfirmForms((prev) => ({
                                        ...prev,
                                        [answer.id]: { ...form, feedback: e.target.value },
                                      }))
                                    }
                                    placeholder="첨삭 코멘트를 입력하세요 (AI 생성 내용을 수정하거나 그대로 사용할 수 있습니다)"
                                  />
                                </div>
                                <div className="flex gap-3">
                                  <button
                                    onClick={() => api.answers.regrade(answer.id).then(() => loadData())}
                                    disabled={confirming === answer.id}
                                    className="text-sm text-gray-600 border border-gray-300 rounded-lg px-4 py-2 hover:bg-gray-50 transition-colors"
                                  >
                                    🔄 다시 채점 요청
                                  </button>
                                  <button
                                    onClick={() => handleConfirm(answer.id)}
                                    disabled={confirming === answer.id}
                                    className="btn-gold px-6"
                                  >
                                    {confirming === answer.id ? '처리 중...' : '✓ 강사 컨펌 (학생 공개)'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-green-50 rounded-xl border border-green-200 p-4">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <span className="text-green-600 font-semibold">✓ 강사 확인 완료</span>
                                  <span className="text-2xl font-bold text-green-700">{answer.score}점</span>
                                  <span className="text-sm text-gray-400">/ 100점</span>
                                  <div className="ml-auto flex gap-2">
                                    <button
                                      onClick={() => handleRegrade(answer.id)}
                                      disabled={regrading === answer.id || resetting === answer.id}
                                      className="text-sm text-gray-500 border border-gray-300 rounded px-3 py-1 hover:bg-gray-100 transition-colors disabled:opacity-50"
                                    >
                                      {regrading === answer.id ? '처리 중...' : '↺ 다시 채점 요청'}
                                    </button>
                                    <button
                                      onClick={() => handleReset(answer.id)}
                                      disabled={resetting === answer.id || regrading === answer.id}
                                      className="text-sm text-red-500 border border-red-300 rounded px-3 py-1 hover:bg-red-50 transition-colors disabled:opacity-50"
                                    >
                                      {resetting === answer.id ? '처리 중...' : '답안 초기화'}
                                    </button>
                                  </div>
                                </div>
                                <p className="text-gray-700 text-sm whitespace-pre-wrap">{answer.feedback}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
