import json
import logging
from fastapi import APIRouter, HTTPException, Depends
from models import AnswerCreate, AnswerConfirm
from auth import get_current_user
from database import supabase
from services.ollama import grade_answer

logger = logging.getLogger(__name__)

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
        score, feedback, highlights = await grade_answer(
            problem=problem, answer_content=answer.content
        )
        feedback = feedback + "\n\n__HIGHLIGHTS__\n" + json.dumps(highlights, ensure_ascii=False)
        status = "ai_graded"
    except Exception as e:
        logger.error(f"AI 채점 실패 (problem_id={answer.problem_id}): {e}")
        score = None
        feedback = f"AI 채점 중 오류가 발생했습니다: {str(e)}"
        status = "pending"

    result = supabase.table("answers").insert({
        "problem_id": answer.problem_id,
        "student_id": current_user["id"],
        "content": answer.content,
        "score": score,
        "feedback": feedback,
        "status": status,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="답안 저장 중 오류가 발생했습니다")

    saved = result.data[0]
    # 학생에게는 컨펌 전까지 점수/피드백 숨김
    if saved.get("status") != "teacher_confirmed":
        saved["score"] = None
        saved["feedback"] = None
    return saved


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
    answers = result.data
    for ans in answers:
        if ans.get("status") != "teacher_confirmed":
            ans["score"] = None
            ans["feedback"] = None
    return answers


@router.get("/ai-graded")
async def get_ai_graded_answers(current_user: dict = Depends(get_current_user)):
    """AI 채점 완료, 강사 검토 대기 답안 (강사/관리자)"""
    if current_user["role"] not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다")

    if current_user["role"] == "admin":
        result = (
            supabase.table("answers")
            .select("id, problem_id, status")
            .eq("status", "ai_graded")
            .execute()
        )
    else:
        problems_result = (
            supabase.table("problems")
            .select("id")
            .eq("created_by", current_user["id"])
            .execute()
        )
        problem_ids = [p["id"] for p in problems_result.data]
        if not problem_ids:
            return []
        result = (
            supabase.table("answers")
            .select("id, problem_id, status")
            .in_("problem_id", problem_ids)
            .eq("status", "ai_graded")
            .execute()
        )
    return result.data


@router.get("/problem/{problem_id}")
async def get_answers_by_problem(
    problem_id: str, current_user: dict = Depends(get_current_user)
):
    """특정 문제의 전체 답안 조회 (강사/관리자)"""
    if current_user["role"] not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="강사만 접근할 수 있습니다")

    if current_user["role"] == "teacher":
        problem = supabase.table("problems").select("created_by").eq("id", problem_id).execute()
        if not problem.data or problem.data[0]["created_by"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="본인이 출제한 문제만 조회할 수 있습니다")

    result = (
        supabase.table("answers")
        .select("*, student:users!student_id(name, email)")
        .eq("problem_id", problem_id)
        .order("submitted_at", desc=True)
        .execute()
    )
    return result.data


@router.patch("/{answer_id}/confirm")
async def confirm_answer(
    answer_id: str, data: AnswerConfirm, current_user: dict = Depends(get_current_user)
):
    """강사가 AI 채점을 검토/수정하고 컨펌 (학생에게 공개)"""
    if current_user["role"] not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="강사만 컨펌할 수 있습니다")

    answer_result = (
        supabase.table("answers")
        .select("*, problems(created_by)")
        .eq("id", answer_id)
        .execute()
    )
    if not answer_result.data:
        raise HTTPException(status_code=404, detail="답안을 찾을 수 없습니다")

    answer = answer_result.data[0]

    if current_user["role"] == "teacher":
        if answer["problems"]["created_by"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="본인이 출제한 문제의 답안만 컨펌할 수 있습니다")

    updated = (
        supabase.table("answers")
        .update({"score": data.score, "feedback": data.feedback, "status": "teacher_confirmed"})
        .eq("id", answer_id)
        .execute()
    )
    if not updated.data:
        raise HTTPException(status_code=500, detail="컨펌 저장 중 오류가 발생했습니다")
    return updated.data[0]


@router.post("/{answer_id}/regrade")
async def regrade_answer(answer_id: str, current_user: dict = Depends(get_current_user)):
    """답안 재채점 (AI 채점 재실행, 강사/관리자 전용)"""
    if current_user["role"] not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="강사만 재채점을 요청할 수 있습니다")

    answer_result = (
        supabase.table("answers")
        .select("*, problems(created_by)")
        .eq("id", answer_id)
        .execute()
    )
    if not answer_result.data:
        raise HTTPException(status_code=404, detail="답안을 찾을 수 없습니다")

    answer = answer_result.data[0]

    if current_user["role"] == "teacher" and answer["problems"]["created_by"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="본인이 출제한 문제의 답안만 재채점할 수 있습니다")

    problem_result = (
        supabase.table("problems")
        .select("*")
        .eq("id", answer["problem_id"])
        .execute()
    )
    if not problem_result.data:
        raise HTTPException(status_code=404, detail="문제를 찾을 수 없습니다")

    problem = problem_result.data[0]

    try:
        score, feedback, highlights = await grade_answer(
            problem=problem, answer_content=answer["content"]
        )
        feedback = feedback + "\n\n__HIGHLIGHTS__\n" + json.dumps(highlights, ensure_ascii=False)
    except Exception as e:
        logger.error(f"재채점 실패 (answer_id={answer_id}): {e}")
        raise HTTPException(status_code=500, detail=f"AI 채점 중 오류가 발생했습니다: {str(e)}")

    updated = (
        supabase.table("answers")
        .update({"score": score, "feedback": feedback, "status": "ai_graded"})
        .eq("id", answer_id)
        .execute()
    )
    if not updated.data:
        raise HTTPException(status_code=500, detail="채점 결과 저장 중 오류가 발생했습니다")

    return updated.data[0]


@router.post("/{answer_id}/reset")
async def reset_answer(answer_id: str, current_user: dict = Depends(get_current_user)):
    """답안 초기화 - 해당 답안 행 삭제 (강사/관리자 전용)"""
    if current_user["role"] not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="강사만 답안을 초기화할 수 있습니다")

    answer_result = (
        supabase.table("answers")
        .select("*, problems(created_by)")
        .eq("id", answer_id)
        .execute()
    )
    if not answer_result.data:
        raise HTTPException(status_code=404, detail="답안을 찾을 수 없습니다")

    answer = answer_result.data[0]

    if current_user["role"] == "teacher" and answer["problems"]["created_by"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="본인이 출제한 문제의 답안만 초기화할 수 있습니다")

    supabase.table("answers").delete().eq("id", answer_id).execute()
    return {"message": "답안이 초기화되었습니다"}


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

    if current_user["role"] == "student":
        if answer["student_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="접근 권한이 없습니다")
        if answer.get("status") != "teacher_confirmed":
            answer["score"] = None
            answer["feedback"] = None

    return answer
