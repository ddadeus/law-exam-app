-- ==========================================
-- 법률 논술 채점 시스템 Supabase 스키마
-- ==========================================

-- UUID 확장 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 테이블 생성
-- ==========================================

-- 사용자 테이블
CREATE TABLE IF NOT EXISTS users (
  id        UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email     TEXT UNIQUE NOT NULL,
  password  TEXT NOT NULL,
  role      TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
  name      TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 문제 테이블
CREATE TABLE IF NOT EXISTS problems (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  question    TEXT NOT NULL,
  legal_basis TEXT NOT NULL,
  created_by  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 답안 테이블
CREATE TABLE IF NOT EXISTS answers (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  problem_id   UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content      TEXT NOT NULL,
  score        FLOAT,
  feedback     TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(problem_id, student_id)  -- 학생당 문제별 답안 1개 제한
);

-- ==========================================
-- 인덱스 생성 (성능 최적화)
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_problems_created_by ON problems(created_by);
CREATE INDEX IF NOT EXISTS idx_problems_created_at ON problems(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_answers_problem_id ON answers(problem_id);
CREATE INDEX IF NOT EXISTS idx_answers_student_id ON answers(student_id);
CREATE INDEX IF NOT EXISTS idx_answers_submitted_at ON answers(submitted_at DESC);

-- ==========================================
-- Row Level Security 비활성화
-- (백엔드에서 service role key로 접근하므로 불필요)
-- ==========================================

ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE problems DISABLE ROW LEVEL SECURITY;
ALTER TABLE answers DISABLE ROW LEVEL SECURITY;
