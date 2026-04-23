from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, problems, answers

app = FastAPI(title="법률 논술 채점 시스템 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
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
