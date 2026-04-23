# 법률 논술 채점 시스템

대한민국 법률 논술 시험을 위한 AI 자동 채점 웹 플랫폼입니다.  
강사가 문제와 채점 기준 법리를 입력하면, 학생이 답안을 제출할 때 로컬 Ollama AI가 자동으로 채점하고 첨삭 코멘트를 생성합니다.

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 백엔드 | FastAPI (Python) |
| 프론트엔드 | Next.js 14 (TypeScript + Tailwind CSS) |
| 데이터베이스 | Supabase (PostgreSQL) |
| AI 채점 엔진 | Ollama (gemma4:e4b 모델) |

---

## 사전 준비

### 1. Ollama 설치 및 모델 다운로드

[https://ollama.ai](https://ollama.ai) 에서 Ollama를 설치한 후:

```bash
ollama pull gemma4:e4b
ollama serve   # 백그라운드에서 실행 (기본 포트: 11434)
```

### 2. Supabase 프로젝트 생성

1. [https://supabase.com](https://supabase.com) 에서 무료 계정 생성
2. 새 프로젝트 생성
3. **SQL Editor**에서 `supabase/schema.sql` 파일 내용을 붙여넣고 실행
4. **Project Settings → API**에서 다음 값 복사:
   - `Project URL` (SUPABASE_URL)
   - `service_role` 키 (SUPABASE_SERVICE_KEY) — **절대 외부에 노출하지 마세요**

---

## 실행 방법

### 1단계: 프로젝트 폴더로 이동

```bash
cd law-exam-app
```

---

### 2단계: 백엔드 설정 및 실행

```bash
cd backend
```

**가상환경 생성 및 활성화:**

```bash
python3 -m venv venv
source venv/bin/activate        # macOS / Linux
# venv\Scripts\activate         # Windows
```

**환경 변수 파일 생성:**

```bash
cp .env.example .env
```

`.env` 파일을 열어 Supabase 정보를 입력하세요:

```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SECRET_KEY=임의의_긴_비밀키_문자열
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma4:e4b
```

**패키지 설치:**

```bash
pip install -r requirements.txt
```

**서버 실행:**

```bash
uvicorn main:app --reload --port 8000
```

> 브라우저에서 [http://localhost:8000/docs](http://localhost:8000/docs) 접속 시 API 문서 확인 가능

---

### 3단계: 프론트엔드 설정 및 실행

새 터미널 창을 열고:

```bash
cd law-exam-app/frontend
```

**환경 변수 파일 생성:**

```bash
cp .env.local.example .env.local
```

`.env.local` 파일 내용 (기본값으로 사용 가능):

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**패키지 설치:**

```bash
npm install
```

**개발 서버 실행:**

```bash
npm run dev
```

> 브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

---

## 사용 방법

### 강사 계정으로 사용하기

1. `/register` 에서 회원가입 시 **강사** 역할 선택
2. 로그인 후 강사 대시보드로 이동
3. **새 문제 출제** 버튼 클릭
4. 지문, 질문, 채점 기준 법리(판례번호, 조문 텍스트) 입력 후 저장
5. 학생이 답안을 제출하면 대시보드에서 결과 확인 가능

### 학생 계정으로 사용하기

1. `/register` 에서 회원가입 시 **학생** 역할 선택
2. 로그인 후 학생 대시보드로 이동
3. 문제 목록에서 문제 클릭
4. 답안 작성 후 **답안 제출 및 채점** 버튼 클릭
5. AI 채점 완료 후 점수(100점 만점)와 첨삭 코멘트 확인

> **주의:** AI 채점은 Ollama 모델 성능에 따라 30초~3분 소요될 수 있습니다.

---

## 프로젝트 구조

```
law-exam-app/
├── backend/
│   ├── main.py              # FastAPI 앱 진입점
│   ├── config.py            # 환경 변수 설정
│   ├── database.py          # Supabase 클라이언트
│   ├── auth.py              # JWT 인증 유틸리티
│   ├── models.py            # Pydantic 데이터 모델
│   ├── requirements.txt
│   ├── .env.example
│   ├── routers/
│   │   ├── auth.py          # 로그인/회원가입 API
│   │   ├── problems.py      # 문제 CRUD API
│   │   └── answers.py       # 답안 제출/조회 API
│   └── services/
│       └── ollama.py        # Ollama AI 채점 서비스
├── frontend/
│   ├── app/
│   │   ├── login/           # 로그인 페이지
│   │   ├── register/        # 회원가입 페이지
│   │   ├── teacher/         # 강사 화면
│   │   └── student/         # 학생 화면
│   ├── components/
│   │   └── Navbar.tsx       # 상단 내비게이션 바
│   └── lib/
│       └── api.ts           # 백엔드 API 호출 함수
└── supabase/
    └── schema.sql           # DB 테이블 생성 SQL
```

---

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/auth/register` | 회원가입 |
| POST | `/auth/login` | 로그인 |
| GET | `/problems/` | 문제 목록 조회 |
| POST | `/problems/` | 문제 출제 (강사) |
| GET | `/problems/{id}` | 문제 상세 조회 |
| POST | `/answers/` | 답안 제출 + AI 채점 |
| GET | `/answers/my` | 내 답안 목록 (학생) |
| GET | `/answers/problem/{id}` | 문제별 답안 목록 (강사) |

---

## 문제 해결

**Ollama 연결 오류 시:**
```bash
ollama serve   # Ollama 서버가 실행 중인지 확인
ollama list    # gemma4:e4b 모델이 설치되어 있는지 확인
```

**Supabase 연결 오류 시:**
- `.env` 파일의 `SUPABASE_URL`과 `SUPABASE_SERVICE_KEY`가 올바른지 확인
- `schema.sql`이 Supabase SQL Editor에서 정상 실행되었는지 확인

**CORS 오류 시:**
- 백엔드 `main.py`의 `allow_origins`에 프론트엔드 주소가 포함되어 있는지 확인
