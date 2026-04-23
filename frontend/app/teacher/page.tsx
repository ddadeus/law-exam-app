'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { api, getUser, Problem } from '@/lib/api'

export default function TeacherDashboard() {
  const router = useRouter()
  const [problems, setProblems] = useState<Problem[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const user = getUser()
    if (!user) { router.replace('/login'); return }
    if (user.role !== 'teacher') { router.replace(user.role === 'admin' ? '/admin' : '/student'); return }
    loadData()
  }, [router])

  async function loadData() {
    try {
      const [problemsData, aiGradedData] = await Promise.all([
        api.problems.list(),
        api.answers.getAiGraded(),
      ])
      setProblems(problemsData)
      setPendingCount(aiGradedData.length)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-navy-800">강사 대시보드</h1>
            <p className="text-gray-500 text-sm mt-1">출제한 문제를 관리하고 채점 결과를 확인하세요</p>
          </div>
          <Link href="/teacher/problems/new" className="btn-gold inline-block text-center">
            + 새 문제 출제
          </Link>
        </div>

        {/* 검토 대기 알림 */}
        {pendingCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-6 flex items-center gap-3">
            <span className="text-2xl">⏳</span>
            <div>
              <p className="font-semibold text-amber-800">
                AI 채점 완료 답안 {pendingCount}건이 검토를 기다리고 있습니다
              </p>
              <p className="text-sm text-amber-600 mt-0.5">
                각 문제를 클릭하여 답안을 검토하고 학생에게 결과를 공개하세요
              </p>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-12">
            <div className="text-gray-500">문제 목록을 불러오는 중...</div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">{error}</div>
        )}

        {!loading && problems.length === 0 && (
          <div className="card text-center py-16">
            <p className="text-4xl mb-4">📝</p>
            <p className="text-lg font-medium text-gray-700">출제한 문제가 없습니다</p>
            <p className="text-gray-500 text-sm mt-1">첫 번째 문제를 출제해보세요</p>
            <Link href="/teacher/problems/new" className="btn-gold inline-block mt-4">
              문제 출제하기
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {problems.map((problem) => (
            <Link key={problem.id} href={`/teacher/problems/${problem.id}`}>
              <div className="card hover:shadow-md transition-all cursor-pointer border-l-4 border-l-navy-600 hover:border-l-gold-500">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-semibold text-navy-800 truncate">{problem.title}</h2>
                    <p className="text-gray-400 text-xs mt-1">
                      출제일: {new Date(problem.created_at).toLocaleDateString('ko-KR', {
                        year: 'numeric', month: 'long', day: 'numeric'
                      })}
                    </p>
                    <p className="text-gray-600 mt-2 text-sm line-clamp-2">{problem.question}</p>
                  </div>
                  <span className="ml-4 text-navy-600 text-sm font-medium whitespace-nowrap">
                    답안 보기 →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
