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
    if (!user) {
      router.replace('/login')
      return
    }
    if (user.role !== 'student') {
      router.replace('/teacher')
      return
    }
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
  const notSubmitted = problems.length - submitted

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">학생 대시보드</h1>
          <p className="text-gray-500 text-sm mt-1">문제를 확인하고 답안을 제출하세요</p>
        </div>

        {/* 통계 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="card text-center">
            <p className="text-3xl font-bold text-blue-600">{problems.length}</p>
            <p className="text-sm text-gray-500 mt-1">전체 문제</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-green-600">{submitted}</p>
            <p className="text-sm text-gray-500 mt-1">제출 완료</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-orange-500">{notSubmitted}</p>
            <p className="text-sm text-gray-500 mt-1">미제출</p>
          </div>
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
            <p className="text-lg font-medium text-gray-700">아직 출제된 문제가 없습니다</p>
            <p className="text-gray-400 text-sm mt-1">강사가 문제를 출제하면 여기에 표시됩니다</p>
          </div>
        )}

        <div className="space-y-4">
          {problems.map((problem) => {
            const answer = getAnswerForProblem(problem.id)
            return (
              <Link key={problem.id} href={`/student/problems/${problem.id}`}>
                <div className="card hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-lg font-semibold text-gray-800 truncate">
                          {problem.title}
                        </h2>
                        {answer ? (
                          <span className="shrink-0 bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">
                            제출 완료
                          </span>
                        ) : (
                          <span className="shrink-0 bg-orange-100 text-orange-600 text-xs px-2 py-0.5 rounded-full font-medium">
                            미제출
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 text-sm">
                        출제일: {new Date(problem.created_at).toLocaleDateString('ko-KR', {
                          year: 'numeric', month: 'long', day: 'numeric'
                        })}
                      </p>
                      <p className="text-gray-600 text-sm mt-2 line-clamp-2">{problem.question}</p>
                    </div>

                    <div className="shrink-0 text-right">
                      {answer && answer.score !== null ? (
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
                        <span className="text-sm text-gray-400">결과 확인</span>
                      ) : (
                        <span className="text-sm text-blue-600 font-medium">답안 작성 →</span>
                      )}
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
