from fastapi import APIRouter, HTTPException, Depends
from models import ProblemCreate
from auth import get_current_user
from database import supabase

router = APIRouter(prefix="/problems", tags=["문제"], redirect_slashes=False)


@router.post("")
async def create_problem(
    problem: ProblemCreate, current_user: dict = Depends(get_current_user)
):
    """문제 출제 (강사/관리자)"""
    if current_user["role"] not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="강사만 문제를 출제할 수 있습니다")

    result = supabase.table("problems").insert({
        "title": problem.title,
        "content": problem.content,
        "question": problem.question,
        "legal_basis": problem.legal_basis,
        "created_by": current_user["id"],
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="문제 생성 중 오류가 발생했습니다")

    return result.data[0]


@router.get("")
async def get_problems(current_user: dict = Depends(get_current_user)):
    """역할별 문제 목록 조회"""
    role = current_user["role"]

    if role == "admin":
        result = (
            supabase.table("problems")
            .select("*, creator:users!created_by(name)")
            .order("created_at", desc=True)
            .execute()
        )
    elif role == "teacher":
        result = (
            supabase.table("problems")
            .select("*, creator:users!created_by(name)")
            .eq("created_by", current_user["id"])
            .order("created_at", desc=True)
            .execute()
        )
    else:  # student: 매칭된 강사의 문제만
        ts_result = (
            supabase.table("teacher_student")
            .select("teacher_id")
            .eq("student_id", current_user["id"])
            .execute()
        )
        teacher_ids = [r["teacher_id"] for r in ts_result.data]
        if not teacher_ids:
            return []
        result = (
            supabase.table("problems")
            .select("*, creator:users!created_by(name)")
            .in_("created_by", teacher_ids)
            .order("created_at", desc=True)
            .execute()
        )

    return result.data


@router.get("/{problem_id}")
async def get_problem(problem_id: str, current_user: dict = Depends(get_current_user)):
    """문제 상세 조회"""
    result = (
        supabase.table("problems")
        .select("*, creator:users!created_by(name)")
        .eq("id", problem_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="문제를 찾을 수 없습니다")

    problem = result.data[0]
    role = current_user["role"]

    if role == "student":
        ts_result = (
            supabase.table("teacher_student")
            .select("teacher_id")
            .eq("student_id", current_user["id"])
            .execute()
        )
        teacher_ids = [r["teacher_id"] for r in ts_result.data]
        if problem["created_by"] not in teacher_ids:
            raise HTTPException(status_code=403, detail="접근 권한이 없습니다")
    elif role == "teacher":
        if problem["created_by"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="본인이 출제한 문제만 조회할 수 있습니다")

    return problem
