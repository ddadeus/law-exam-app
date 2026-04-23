const API_URL = '/api'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    })
  } catch {
    throw new Error('서버에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인하세요.')
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: '서버 오류가 발생했습니다' }))
    throw new Error(error.detail || '오류가 발생했습니다')
  }

  return response.json()
}

export interface User {
  id: string
  email: string
  name: string
  role: 'teacher' | 'student' | 'admin'
  is_active?: boolean
  created_at?: string
}

export interface Problem {
  id: string
  title: string
  content: string
  question: string
  legal_basis: string
  created_by: string
  created_at: string
  creator?: { name: string }
}

export interface Answer {
  id: string
  problem_id: string
  student_id: string
  content: string
  score: number | null
  feedback: string | null
  status: 'pending' | 'ai_graded' | 'teacher_confirmed'
  submitted_at: string
  problems?: { id: string; title: string; question: string }
  student?: { name: string; email: string }
}

export interface AdminStats {
  users: { total: number; teachers: number; students: number; admins: number; active: number }
  problems: { total: number }
  answers: { total: number; pending: number; ai_graded: number; confirmed: number; avg_score: number | null }
}

export interface Assignment {
  teacher_id: string
  student_id: string
  assigned_at: string
  teacher?: { name: string; email: string }
  student?: { name: string; email: string }
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ access_token: string; token_type: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    register: (email: string, password: string, name: string, role: string) =>
      request<{ access_token: string; token_type: string; user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name, role }),
      }),
  },
  problems: {
    list: () => request<Problem[]>('/problems'),
    get: (id: string) => request<Problem>(`/problems/${id}`),
    create: (data: {
      title: string
      content: string
      question: string
      legal_basis: string
    }) =>
      request<Problem>('/problems', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
  answers: {
    submit: (problem_id: string, content: string) =>
      request<Answer>('/answers', {
        method: 'POST',
        body: JSON.stringify({ problem_id, content }),
      }),
    getMy: () => request<Answer[]>('/answers/my'),
    getByProblem: (problem_id: string) => request<Answer[]>(`/answers/problem/${problem_id}`),
    get: (id: string) => request<Answer>(`/answers/${id}`),
    regrade: (answer_id: string) =>
      request<Answer>(`/answers/${answer_id}/regrade`, { method: 'POST' }),
    confirm: (answer_id: string, score: number, feedback: string) =>
      request<Answer>(`/answers/${answer_id}/confirm`, {
        method: 'PATCH',
        body: JSON.stringify({ score, feedback }),
      }),
    getAiGraded: () => request<Answer[]>('/answers/ai-graded'),
  },
  admin: {
    getUsers: () => request<User[]>('/admin/users'),
    toggleActive: (user_id: string) =>
      request<{ id: string; is_active: boolean }>(`/admin/users/${user_id}/toggle-active`, {
        method: 'PATCH',
      }),
    getStats: () => request<AdminStats>('/admin/stats'),
    getAssignments: () => request<Assignment[]>('/admin/assignments'),
    createAssignment: (teacher_id: string, student_id: string) =>
      request<Assignment>('/admin/assignments', {
        method: 'POST',
        body: JSON.stringify({ teacher_id, student_id }),
      }),
    deleteAssignment: (teacher_id: string, student_id: string) =>
      request<{ message: string }>(`/admin/assignments/${teacher_id}/${student_id}`, {
        method: 'DELETE',
      }),
  },
}

export function saveAuth(token: string, user: User) {
  localStorage.setItem('token', token)
  localStorage.setItem('user', JSON.stringify(user))
}

export function getUser(): User | null {
  if (typeof window === 'undefined') return null
  const user = localStorage.getItem('user')
  return user ? JSON.parse(user) : null
}

export function logout() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

export function getDashboardPath(role: string): string {
  if (role === 'admin') return '/admin'
  if (role === 'teacher') return '/teacher'
  return '/student'
}
