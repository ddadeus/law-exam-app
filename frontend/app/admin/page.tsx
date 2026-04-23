'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { api, getUser, User, Assignment, AdminStats } from '@/lib/api'

type Tab = 'stats' | 'users' | 'assignments'

export default function AdminPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('stats')
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 매칭 생성 폼
  const [newTeacherId, setNewTeacherId] = useState('')
  const [newStudentId, setNewStudentId] = useState('')
  const [assignError, setAssignError] = useState('')
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    const user = getUser()
    if (!user) { router.replace('/login'); return }
    if (user.role !== 'admin') { router.replace('/login'); return }
    loadAll()
  }, [router])

  async function loadAll() {
    setLoading(true)
    try {
      const [statsData, usersData, assignmentsData] = await Promise.all([
        api.admin.getStats(),
        api.admin.getUsers(),
        api.admin.getAssignments(),
      ])
      setStats(statsData)
      setUsers(usersData)
      setAssignments(assignmentsData)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '데이터를 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleActive(userId: string) {
    try {
      const result = await api.admin.toggleActive(userId)
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_active: result.is_active } : u))
      )
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다')
    }
  }

  async function handleCreateAssignment() {
    if (!newTeacherId || !newStudentId) {
      setAssignError('강사와 학생을 모두 선택해주세요')
      return
    }
    setAssignError('')
    setAssigning(true)
    try {
      const result = await api.admin.createAssignment(newTeacherId, newStudentId)
      setAssignments((prev) => [...prev, result])
      setNewTeacherId('')
      setNewStudentId('')
    } catch (err: unknown) {
      setAssignError(err instanceof Error ? err.message : '매칭 생성 중 오류가 발생했습니다')
    } finally {
      setAssigning(false)
    }
  }

  async function handleDeleteAssignment(teacherId: string, studentId: string) {
    if (!confirm('매칭을 해제하시겠습니까?')) return
    try {
      await api.admin.deleteAssignment(teacherId, studentId)
      setAssignments((prev) =>
        prev.filter((a) => !(a.teacher_id === teacherId && a.student_id === studentId))
      )
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다')
    }
  }

  const teachers = users.filter((u) => u.role === 'teacher')
  const students = users.filter((u) => u.role === 'student')

  const TABS: { key: Tab; label: string }[] = [
    { key: 'stats', label: '전체 통계' },
    { key: 'users', label: '사용자 관리' },
    { key: 'assignments', label: '강사-학생 매칭' },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-navy-800">관리자 대시보드</h1>
          <p className="text-gray-500 text-sm mt-1">사용자 및 시스템 전반을 관리합니다</p>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-6 w-fit shadow-sm">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === key
                  ? 'bg-navy-700 text-white shadow'
                  : 'text-gray-600 hover:text-navy-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="card flex justify-center py-16 text-gray-400">불러오는 중...</div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">{error}</div>
        ) : (
          <>
            {/* 통계 탭 */}
            {tab === 'stats' && stats && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: '전체 사용자', value: stats.users.total, color: 'text-navy-700' },
                    { label: '강사', value: stats.users.teachers, color: 'text-blue-600' },
                    { label: '학생', value: stats.users.students, color: 'text-indigo-600' },
                    { label: '활성 계정', value: stats.users.active, color: 'text-green-600' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="card text-center">
                      <p className={`text-3xl font-bold ${color}`}>{value}</p>
                      <p className="text-sm text-gray-500 mt-1">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: '전체 문제', value: stats.problems.total, color: 'text-purple-600' },
                    { label: '전체 답안', value: stats.answers.total, color: 'text-gray-700' },
                    { label: 'AI 채점 대기', value: stats.answers.ai_graded, color: 'text-yellow-600' },
                    {
                      label: '평균 점수',
                      value: stats.answers.avg_score !== null ? `${stats.answers.avg_score}점` : '-',
                      color: 'text-green-600',
                    },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="card text-center">
                      <p className={`text-3xl font-bold ${color}`}>{value}</p>
                      <p className="text-sm text-gray-500 mt-1">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="card">
                  <h3 className="font-semibold text-navy-800 mb-3">답안 현황</h3>
                  <div className="space-y-2">
                    {[
                      { label: 'AI 채점 대기 (pending)', value: stats.answers.pending, bg: 'bg-yellow-400' },
                      { label: 'AI 채점 완료 (검토 대기)', value: stats.answers.ai_graded, bg: 'bg-blue-500' },
                      { label: '강사 컨펌 완료', value: stats.answers.confirmed, bg: 'bg-green-500' },
                    ].map(({ label, value, bg }) => (
                      <div key={label} className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-600">{label}</span>
                            <span className="font-semibold">{value}건</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${bg} rounded-full transition-all`}
                              style={{ width: stats.answers.total ? `${(value / stats.answers.total) * 100}%` : '0%' }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 사용자 탭 */}
            {tab === 'users' && (
              <div className="card overflow-hidden p-0">
                <div className="p-6 border-b border-gray-100">
                  <h3 className="font-semibold text-navy-800">전체 사용자 목록 ({users.length}명)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-gray-100">
                      <tr>
                        <th className="text-left px-6 py-3 font-semibold text-gray-500">이름</th>
                        <th className="text-left px-6 py-3 font-semibold text-gray-500">이메일</th>
                        <th className="text-left px-6 py-3 font-semibold text-gray-500">역할</th>
                        <th className="text-left px-6 py-3 font-semibold text-gray-500">상태</th>
                        <th className="text-left px-6 py-3 font-semibold text-gray-500">가입일</th>
                        <th className="px-6 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {users.map((user) => (
                        <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-medium text-gray-800">{user.name}</td>
                          <td className="px-6 py-4 text-gray-500">{user.email}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              user.role === 'admin' ? 'bg-gold-100 text-gold-600' :
                              user.role === 'teacher' ? 'bg-blue-100 text-blue-700' :
                              'bg-indigo-100 text-indigo-700'
                            }`}>
                              {user.role === 'admin' ? '관리자' : user.role === 'teacher' ? '강사' : '학생'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              user.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                            }`}>
                              {user.is_active !== false ? '활성' : '비활성'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-400 text-xs">
                            {user.created_at ? new Date(user.created_at).toLocaleDateString('ko-KR') : '-'}
                          </td>
                          <td className="px-6 py-4">
                            {user.role !== 'admin' && (
                              <button
                                onClick={() => handleToggleActive(user.id)}
                                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                                  user.is_active !== false
                                    ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                    : 'bg-green-50 text-green-700 hover:bg-green-100'
                                }`}
                              >
                                {user.is_active !== false ? '비활성화' : '활성화'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 매칭 탭 */}
            {tab === 'assignments' && (
              <div className="space-y-6">
                {/* 매칭 생성 폼 */}
                <div className="card">
                  <h3 className="font-semibold text-navy-800 mb-4">새 매칭 생성</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="label">강사 선택</label>
                      <select
                        className="input-field"
                        value={newTeacherId}
                        onChange={(e) => setNewTeacherId(e.target.value)}
                      >
                        <option value="">강사를 선택하세요</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.email})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">학생 선택</label>
                      <select
                        className="input-field"
                        value={newStudentId}
                        onChange={(e) => setNewStudentId(e.target.value)}
                      >
                        <option value="">학생을 선택하세요</option>
                        {students.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.email})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {assignError && (
                    <p className="text-red-600 text-sm mb-3">{assignError}</p>
                  )}
                  <button
                    onClick={handleCreateAssignment}
                    disabled={assigning}
                    className="btn-gold px-6"
                  >
                    {assigning ? '처리 중...' : '+ 매칭 생성'}
                  </button>
                </div>

                {/* 현재 매칭 목록 */}
                <div className="card overflow-hidden p-0">
                  <div className="p-6 border-b border-gray-100">
                    <h3 className="font-semibold text-navy-800">현재 매칭 목록 ({assignments.length}건)</h3>
                  </div>
                  {assignments.length === 0 ? (
                    <div className="text-center text-gray-400 py-12">매칭된 조합이 없습니다</div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {assignments.map((a) => (
                        <div
                          key={`${a.teacher_id}-${a.student_id}`}
                          className="flex items-center justify-between px-6 py-4 hover:bg-slate-50"
                        >
                          <div className="flex items-center gap-4">
                            <div className="text-center">
                              <p className="font-medium text-navy-800">{a.teacher?.name}</p>
                              <p className="text-xs text-gray-400">{a.teacher?.email}</p>
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">강사</span>
                            </div>
                            <span className="text-gold-500 font-bold text-xl">→</span>
                            <div className="text-center">
                              <p className="font-medium text-navy-800">{a.student?.name}</p>
                              <p className="text-xs text-gray-400">{a.student?.email}</p>
                              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">학생</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteAssignment(a.teacher_id, a.student_id)}
                            className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            매칭 해제
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
