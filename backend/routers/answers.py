from fastapi import APIRouter, HTTPException, Depends
from models import AnswerCreate
from auth import get_current_user
from database import supabase
from services.ollama import grade_answer

router = APIRouter(prefix="/answers", tags=["답안"], redirect_slashes=False)


@router.post("")
async def submit_answer(
    answer: AnswerCreate, current_user: dict = Depends(get_current_user)
):
    """답안 제출 및 AI 자동 채점 (학생 전용)"""
    if current_user["role"] != "student":
        raise HTTPException(status_code=403, detail="학생만 답안을 제출할 수 있습니다")

    existing = (
        supabase.table("answers")
        .select("id")
        .eq("problem_id", answer.problem_id)
        .eq("student_id", current_user["id"])
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=400, detail="이미 답안을 제출했습니다")

    problem_result = (
        supabase.table("problems")
        .select("*")
        .eq("id", answer.problem_id)
        .execute()
    )
    if not problem_result.data:
        raise HTTPException(status_code=404, detail="문제를 찾을 수 없습니다")

    problem = problem_result.data[0]

    try:
        score, feedback = await grade_answer(
            problem=problem, answer_content=answer.content
        )
    except Exception as e:
        score = None
        feedback = f"AI 채점 중 오류가 발생했습니다: {str(e)}"

    result = supabase.table("answers").insert({
        "problem_id": answer.problem_id,
        "student_id": current_user["id"],
        "content": answer.content,
        "score": score,
        "feedback": feedback,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="답안 저장 중 오류가 발생했습니다")

    return result.data[0]


@router.get("/my")
async def get_my_answers(current_user: dict = Depends(get_current_user)):
    """내 답안 목록 조회 (학생 전용)"""
    if current_user["role"] != "student":
        raise HTTPException(status_code=403, detail="학생만 접근할 수 있습니다")

    result = (
        supabase.table("answers")
        .select("*, problems(id, title, question)")
        .eq("student_id", current_user["id"])
        .order("submitted_at", desc=True)
        .execute()
    )
    return result.data


@router.get("/problem/{problem_id}")
async def get_answers_by_problem(
    problem_id: str, current_user: dict = Depends(get_current_user)
):
    """특정 문제의 전체 답안 조회 (강사 전용)"""
    if current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="강사만 접근할 수 있습니다")

    result = (
        supabase.table("answers")
        .select("*, student:users!student_id(name, email)")
        .eq("problem_id", problem_id)
        .order("submitted_at", desc=True)
        .execute()
    )
    return result.data


@router.get("/{answer_id}")
async def get_answer(answer_id: str, current_user: dict = Depends(get_current_user)):
    """답안 상세 조회"""
    result = (
        supabase.table("answers")
        .select("*, problems(id, title, content, question, legal_basis)")
        .eq("id", answer_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="답안을 찾을 수 없습니다")

    answer = result.data[0]

    if current_user["role"] == "student" and answer["student_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다")

    return answer
