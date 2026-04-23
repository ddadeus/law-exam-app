-- ==========================================
-- 법률 논술 채점 시스템 Supabase 스키마 v2
-- ==========================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 신규 설치 (전체 스키마)
-- ==========================================

CREATE TABLE IF NOT EXISTS users (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  password   TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('teacher', 'student', 'admin')),
  name       TEXT NOT NULL,
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS problems (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  question    TEXT NOT NULL,
  legal_basis TEXT NOT NULL,
  created_by  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS answers (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  problem_id   UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content      TEXT NOT NULL,
  score        INTEGER,
  feedback     TEXT,
  status       TEXT DEFAULT 'ai_graded' CHECK (status IN ('pending', 'ai_graded', 'teacher_confirmed')),
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(problem_id, student_id)
);

CREATE TABLE IF NOT EXISTS teacher_student (
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (teacher_id, student_id)
);

-- ==========================================
-- 인덱스
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_problems_created_by  ON problems(created_by);
CREATE INDEX IF NOT EXISTS idx_problems_created_at  ON problems(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_answers_problem_id   ON answers(problem_id);
CREATE INDEX IF NOT EXISTS idx_answers_student_id   ON answers(student_id);
CREATE INDEX IF NOT EXISTS idx_answers_status       ON answers(status);
CREATE INDEX IF NOT EXISTS idx_ts_teacher_id        ON teacher_student(teacher_id);
CREATE INDEX IF NOT EXISTS idx_ts_student_id        ON teacher_student(student_id);

-- ==========================================
-- RLS 비활성화 (service role key 사용)
-- ==========================================

ALTER TABLE users          DISABLE ROW LEVEL SECURITY;
ALTER TABLE problems       DISABLE ROW LEVEL SECURITY;
ALTER TABLE answers        DISABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_student DISABLE ROW LEVEL SECURITY;

-- ==========================================
-- 기존 DB 마이그레이션 (이미 스키마가 있을 경우)
-- ==========================================

-- 1) users: is_active 컬럼 추가 / role 체크 업데이트
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('teacher', 'student', 'admin'));

-- 2) answers: status 컬럼 추가, score를 INTEGER로
ALTER TABLE answers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ai_graded'
  CHECK (status IN ('pending', 'ai_graded', 'teacher_confirmed'));

-- 3) teacher_student 테이블 (없을 경우)
CREATE TABLE IF NOT EXISTS teacher_student (
  teacher_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (teacher_id, student_id)
);

-- 4) 관리자 계정 직접 생성 (비밀번호는 백엔드에서 해싱 후 넣을 것)
-- INSERT INTO users (email, password, role, name)
-- VALUES ('admin@example.com', '<hashed_password>', 'admin', '관리자');
