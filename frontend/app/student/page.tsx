'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { api, getUser, Problem, Answer } from '@/lib/api'

export default function StudentDashboard() {
  const router = useRouter()
  const [problems, setProblems] = useState<Problem[]>([])
  const [myAnswers, setMyAnswers] = useState<Answer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const user = getUser()
    if (!user) { router.replace('/login'); return }
    if (user.role !== 'student') { router.replace(user.role === 'admin' ? '/admin' : '/teacher'); return }
    loadData()
  }, [router])

  async function loadData() {
    try {
      const [problemsData, answersData] = await Promise.all([
        api.problems.list(),
        api.answers.getMy(),
      ])
      setProblems(problemsData)
      setMyAnswers(answersData)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  function getAnswerForProblem(problemId: string): Answer | undefined {
    return myAnswers.find((a) => a.problem_id === problemId)
  }

  const submitted = myAnswers.length
  const confirmed = myAnswers.filter((a) => a.status === 'teacher_confirmed').length
  const notSubmitted = problems.length - submitted

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-navy-800">학생 대시보드</h1>
          <p className="text-gray-500 text-sm mt-1">담당 강사의 문제를 확인하고 답안을 제출하세요</p>
        </div>

        {/* 통계 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { value: problems.length, label: '전체 문제', color: 'text-navy-700' },
            { value: submitted, label: '제출 완료', color: 'text-blue-600' },
            { value: confirmed, label: '결과 공개', color: 'text-green-600' },
            { value: notSubmitted, label: '미제출', color: 'text-orange-500' },
          ].map(({ value, label, color }) => (
            <div key={label} className="card text-center py-4">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <p className="text-gray-500">문제 목록을 불러오는 중...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">{error}</div>
        )}

        {!loading && problems.length === 0 && (
          <div className="card text-center py-16">
            <p className="text-4xl mb-4">📋</p>
            <p className="text-lg font-medium text-gray-700">아직 배정된 문제가 없습니다</p>
            <p className="text-gray-400 text-sm mt-1">
              강사에게 배정되면 문제가 여기에 표시됩니다
            </p>
          </div>
        )}

        <div className="space-y-3">
          {problems.map((problem) => {
            const answer = getAnswerForProblem(problem.id)
            const status = answer?.status

            return (
              <Link key={problem.id} href={`/student/problems/${problem.id}`}>
                <div className="card hover:shadow-md transition-all cursor-pointer border-l-4 border-l-navy-200 hover:border-l-gold-500">
                  {/* 제목 영역 - 모바일: 세로, 데스크탑: 가로 */}
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-base sm:text-lg font-semibold text-navy-800 leading-snug">
                        {problem.title}
                      </h2>
                      <p className="text-gray-400 text-xs mt-1">
                        {problem.creator?.name && `강사: ${problem.creator.name} · `}
                        출제일: {new Date(problem.created_at).toLocaleDateString('ko-KR', {
                          year: 'numeric', month: 'long', day: 'numeric'
                        })}
                      </p>
                      <p className="text-gray-600 text-sm mt-2 line-clamp-2">{problem.question}</p>
                    </div>

                    {/* 데스크탑 점수 */}
                    <div className="hidden sm:block shrink-0 text-right">
                      {answer && answer.status === 'teacher_confirmed' && answer.score !== null ? (
                        <div>
                          <p className={`text-2xl font-bold ${
                            answer.score >= 80 ? 'text-green-600' :
                            answer.score >= 60 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {answer.score}점
                          </p>
                          <p className="text-xs text-gray-400">/ 100점</p>
                        </div>
                      ) : answer ? (
                        <span className="text-xs text-gray-400">결과 대기</span>
                      ) : (
                        <span className="text-sm text-navy-600 font-medium">답안 작성 →</span>
                      )}
                    </div>
                  </div>

                  {/* 하단 상태 뱃지 + 점수 한 줄 */}
                  <div className="flex items-center justify-between mt-3 gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {!answer && (
                        <span className="bg-orange-100 text-orange-600 text-xs px-2 py-0.5 rounded-full font-medium">
                          미제출
                        </span>
                      )}
                      {status === 'pending' && (
                        <span className="badge-pending">AI 채점 대기</span>
                      )}
                      {status === 'ai_graded' && (
                        <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-medium">
                          강사 검토 중
                        </span>
                      )}
                      {status === 'teacher_confirmed' && (
                        <span className="badge-confirmed">결과 공개</span>
                      )}
                    </div>

                    {/* 모바일 점수 */}
                    <div className="sm:hidden shrink-0">
                      {answer && answer.status === 'teacher_confirmed' && answer.score !== null ? (
                        <span className={`text-lg font-bold ${
                          answer.score >= 80 ? 'text-green-600' :
                          answer.score >= 60 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {answer.score}점
                        </span>
                      ) : !answer ? (
                        <span className="text-sm text-navy-600 font-medium">작성 →</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
