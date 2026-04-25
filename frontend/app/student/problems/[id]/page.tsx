'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { api, getUser, Problem, Answer } from '@/lib/api'

const LINE_HEIGHT = 28

function LinedTextarea({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  disabled?: boolean
  placeholder?: string
}) {
  const lineCount = Math.max(20, value.split('\n').length + 3)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  function syncScroll() {
    if (textareaRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }

  return (
    <div className="relative border border-gray-200 rounded-lg overflow-hidden font-mono text-sm bg-white">
      {/* 줄 번호 + 구분선 배경 레이어 */}
      <div
        ref={scrollRef}
        className="absolute inset-0 overflow-hidden pointer-events-none select-none"
        aria-hidden
      >
        {Array.from({ length: lineCount }).map((_, i) => (
          <div
            key={i}
            className="flex items-center border-b border-gray-100"
            style={{ height: LINE_HEIGHT }}
          >
            <span
              className="text-right pr-3 text-gray-300 text-xs"
              style={{ width: 40, minWidth: 40 }}
            >
              {i + 1}
            </span>
          </div>
        ))}
      </div>

      {/* 실제 입력 textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={onChange}
        onScroll={syncScroll}
        disabled={disabled}
        placeholder={placeholder}
        spellCheck={false}
        className="relative w-full bg-transparent resize-none outline-none text-gray-800 placeholder-gray-300 py-0 pr-4"
        style={{
          paddingLeft: 48,
          lineHeight: `${LINE_HEIGHT}px`,
          height: lineCount * LINE_HEIGHT,
          caretColor: '#1e3a5f',
        }}
      />
    </div>
  )
}

function ScoreCircle({ score }: { score: number }) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444'
  const label = score >= 90 ? '우수' : score >= 80 ? '양호' : score >= 70 ? '보통' : score >= 60 ? '미흡' : '부족'

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative inline-flex items-center justify-center">
        <svg width="130" height="130" className="-rotate-90">
          <circle cx="65" cy="65" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="10" />
          <circle
            cx="65" cy="65" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        <div className="absolute text-center">
          <p className="text-3xl font-bold" style={{ color }}>{score}</p>
          <p className="text-xs text-gray-400">/ 100</p>
        </div>
      </div>
      <span className="text-sm font-semibold" style={{ color }}>{label}</span>
    </div>
  )
}

interface Highlight { text: string; type: 'good' | 'bad' }

function parseHighlights(feedback: string | null): { cleanFeedback: string; highlights: Highlight[] } {
  if (!feedback) return { cleanFeedback: '', highlights: [] }
  const marker = '\n\n__HIGHLIGHTS__\n'
  const idx = feedback.indexOf(marker)
  if (idx === -1) return { cleanFeedback: feedback, highlights: [] }
  const cleanFeedback = feedback.slice(0, idx)
  try {
    const highlights = JSON.parse(feedback.slice(idx + marker.length)) as Highlight[]
    return { cleanFeedback, highlights: Array.isArray(highlights) ? highlights : [] }
  } catch {
    return { cleanFeedback, highlights: [] }
  }
}

function HighlightedAnswer({ content, highlights }: { content: string; highlights: Highlight[] }) {
  if (!highlights.length) {
    return (
      <p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">{content}</p>
    )
  }

  // 답안 텍스트를 highlights 기준으로 분절
  type Segment = { text: string; type: 'good' | 'bad' | 'plain' }
  const segments: Segment[] = []
  let remaining = content

  // 각 highlight를 찾아 세그먼트로 분리
  const sorted = [...highlights].sort((a, b) => content.indexOf(a.text) - content.indexOf(b.text))

  for (const hl of sorted) {
    const pos = remaining.indexOf(hl.text)
    if (pos === -1) continue
    if (pos > 0) segments.push({ text: remaining.slice(0, pos), type: 'plain' })
    segments.push({ text: hl.text, type: hl.type })
    remaining = remaining.slice(pos + hl.text.length)
  }
  if (remaining) segments.push({ text: remaining, type: 'plain' })

  return (
    <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
      {segments.map((seg, i) => {
        if (seg.type === 'good')
          return <mark key={i} className="bg-green-100 text-green-900 rounded px-0.5 not-italic">{seg.text}</mark>
        if (seg.type === 'bad')
          return <span key={i} className="bg-red-50 text-red-700 line-through rounded px-0.5">{seg.text}</span>
        return <span key={i}>{seg.text}</span>
      })}
    </p>
  )
}

export default function StudentProblemPage() {
  const router = useRouter()
  const params = useParams()
  const problemId = params.id as string

  const [problem, setProblem] = useState<Problem | null>(null)
  const [existingAnswer, setExistingAnswer] = useState<Answer | null>(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [regrading, setRegrading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const user = getUser()
    if (!user) { router.replace('/login'); return }
    if (user.role !== 'student') { router.replace('/teacher'); return }
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

  async function handleRegrade() {
    if (!existingAnswer) return
    setError('')
    setRegrading(true)
    try {
      const updated = await api.answers.regrade(existingAnswer.id)
      setExistingAnswer(updated)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '재채점 요청에 실패했습니다')
    } finally {
      setRegrading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) { setError('답안을 입력해주세요'); return }
    if (content.trim().length < 50) { setError('답안은 50자 이상 작성해주세요'); return }

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

  const isConfirmed = existingAnswer?.status === 'teacher_confirmed'
  const isAiGraded = existingAnswer?.status === 'ai_graded'
  const isPending = existingAnswer?.status === 'pending'

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/student" className="text-gray-400 hover:text-navy-600 text-sm">
            ← 대시보드
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-navy-700 text-sm">문제 풀기</span>
        </div>

        {loading && (
          <div className="card text-center py-12 text-gray-400">불러오는 중...</div>
        )}
        {error && !problem && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">{error}</div>
        )}

        {problem && (
          <div className="space-y-5">
            {/* 문제 카드 */}
            <div className="card border-t-4 border-navy-700">
              <div className="flex items-center justify-between mb-3">
                <h1 className="text-xl font-bold text-navy-800">{problem.title}</h1>
                {problem.creator && (
                  <span className="text-xs text-gray-400">출제: {problem.creator.name}</span>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">지문</h3>
                  <div className="bg-slate-50 rounded-lg p-4 border-l-4 border-navy-400">
                    <p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">
                      {problem.content}
                    </p>
                  </div>
                </div>

                <div className="bg-navy-50 rounded-lg p-4 border border-navy-100">
                  <h3 className="text-xs font-semibold text-navy-600 uppercase tracking-wider mb-2">
                    문제
                  </h3>
                  <p className="text-gray-800 font-medium">{problem.question}</p>
                </div>
              </div>
            </div>

            {/* 제출 후 상태 */}
            {existingAnswer ? (
              <div className="space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>
                )}

                {/* 채점 진행 중 */}
                {regrading && (
                  <div className="bg-navy-50 border border-navy-200 text-navy-700 rounded-xl p-4 text-center">
                    <p className="font-semibold">AI 재채점 중입니다...</p>
                    <p className="text-sm mt-1 text-navy-500">잠시 기다려주세요 (최대 2~3분 소요)</p>
                  </div>
                )}

                {/* 강사 검토 대기 */}
                {(isAiGraded || isPending) && !regrading && (
                  <div className="card border-l-4 border-amber-400 bg-amber-50">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">⏳</span>
                      <div>
                        <p className="font-semibold text-amber-800">
                          {isPending ? 'AI 채점이 진행 중입니다' : '강사 검토 중입니다'}
                        </p>
                        <p className="text-sm text-amber-600 mt-1">
                          {isPending
                            ? 'AI 채점이 완료되면 강사가 검토 후 결과를 공개합니다'
                            : 'AI 채점이 완료되었습니다. 강사가 검토 후 결과를 공개하면 확인할 수 있습니다'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 강사 확인 완료 - 채점 결과 */}
                {isConfirmed && existingAnswer.score !== null && (
                  <div className="card border-t-4 border-green-500">
                    <div className="flex items-center gap-2 mb-5">
                      <span className="badge-confirmed text-sm px-3 py-1">✓ 강사 확인 완료</span>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                      <ScoreCircle score={existingAnswer.score} />
                      <div className="flex-1">
                        {existingAnswer.feedback && (() => {
                          const { cleanFeedback } = parseHighlights(existingAnswer.feedback)
                          return (
                            <>
                              <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
                                강사 첨삭 코멘트
                              </h3>
                              <div className="bg-slate-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed border">
                                {cleanFeedback}
                              </div>
                            </>
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {/* 제출한 답안 */}
                <div className="card">
                  <h2 className="text-base font-bold text-navy-800 mb-2">제출한 답안</h2>
                  <p className="text-xs text-gray-400 mb-3">
                    제출일시: {new Date(existingAnswer.submitted_at).toLocaleString('ko-KR')}
                  </p>
                  {isConfirmed && existingAnswer.feedback && (() => {
                    const { highlights } = parseHighlights(existingAnswer.feedback)
                    if (highlights.length > 0) {
                      return (
                        <p className="text-xs text-gray-400 mb-2">
                          <mark className="bg-green-100 text-green-900 rounded px-0.5 not-italic">초록</mark>: 잘된 부분&nbsp;&nbsp;
                          <span className="bg-red-50 text-red-700 line-through rounded px-0.5">빨간 취소선</span>: 보완 필요
                        </p>
                      )
                    }
                    return null
                  })()}
                  <div className="bg-slate-50 rounded-lg p-4 border">
                    {isConfirmed && existingAnswer.feedback
                      ? <HighlightedAnswer
                          content={existingAnswer.content}
                          highlights={parseHighlights(existingAnswer.feedback).highlights}
                        />
                      : <p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">{existingAnswer.content}</p>
                    }
                  </div>
                </div>

                <div className="flex gap-3 justify-center flex-wrap">
                  <Link href="/student" className="btn-secondary inline-block">
                    대시보드로 돌아가기
                  </Link>
                  {(isAiGraded || isPending) && (
                    <button
                      onClick={handleRegrade}
                      disabled={regrading}
                      className="btn-primary px-6"
                    >
                      {regrading ? '재채점 중...' : '다시 채점 요청'}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* 답안 작성 폼 */
              <div className="card">
                <h2 className="text-lg font-bold text-navy-800 mb-1">답안 작성</h2>
                <p className="text-sm text-gray-400 mb-4">
                  제출 후에는 수정이 불가합니다. 신중하게 작성해주세요.
                </p>

                <form onSubmit={handleSubmit}>
                  <LinedTextarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    disabled={submitting}
                    placeholder="여기에 답안을 작성하세요. 관련 법리, 판례를 적용하여 논리적으로 서술하세요."
                  />
                  <p className="text-xs text-gray-400 mb-4">{content.length}자 (최소 50자)</p>

                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm mb-4">
                      {error}
                    </div>
                  )}

                  {submitting && (
                    <div className="bg-navy-50 border border-navy-200 text-navy-700 rounded-xl p-4 mb-4 text-center">
                      <p className="font-semibold">AI 채점 중입니다...</p>
                      <p className="text-sm mt-1 text-navy-500">
                        Ollama 모델이 답안을 분석하고 있습니다. 잠시 기다려주세요 (최대 2~3분 소요).
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3 justify-end">
                    <Link href="/student" className="btn-secondary">
                      취소
                    </Link>
                    <button type="submit" className="btn-primary px-8" disabled={submitting}>
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
