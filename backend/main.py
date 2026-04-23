import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, problems, answers

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="법률 논술 채점 시스템 API", version="1.0.0")


@app.on_event("startup")
async def startup_check():
    required = ["SUPABASE_URL", "SUPABASE_SERVICE_KEY"]
    missing = [k for k in required if not os.getenv(k)]
    if missing:
        logger.error(f"필수 환경변수 누락: {missing}")
    else:
        logger.info("환경변수 확인 완료. 서버 기동 중...")
    logger.info(f"PORT: {os.getenv('PORT', '설정 없음')}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://valiant-expression-production-3364.up.railway.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(problems.router)
app.include_router(answers.router)


@app.get("/")
async def root():
    return {"message": "법률 논술 채점 시스템 API가 정상 실행 중입니다"}
