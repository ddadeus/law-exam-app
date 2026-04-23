import logging
from fastapi import APIRouter, HTTPException, Depends
from auth import get_current_user
from database import supabase
from models import TeacherStudentAssign

router = APIRouter(prefix="/admin", tags=["관리자"], redirect_slashes=False)
logger = logging.getLogger(__name__)


def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="관리자만 접근 가능합니다")
    return current_user


@router.get("/users")
async def get_all_users(current_user: dict = Depends(require_admin)):
    """전체 사용자 목록"""
    result = (
        supabase.table("users")
        .select("id, email, name, role, is_active, created_at")
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


@router.patch("/users/{user_id}/toggle-active")
async def toggle_user_active(user_id: str, current_user: dict = Depends(require_admin)):
    """계정 활성화/비활성화 토글"""
    user_result = supabase.table("users").select("id, is_active").eq("id", user_id).execute()
    if not user_result.data:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")

    current_active = user_result.data[0].get("is_active", True)
    updated = (
        supabase.table("users")
        .update({"is_active": not current_active})
        .eq("id", user_id)
        .execute()
    )
    return {"id": user_id, "is_active": not current_active}


@router.get("/stats")
async def get_stats(current_user: dict = Depends(require_admin)):
    """전체 현황 통계"""
    users = supabase.table("users").select("role, is_active").execute().data
    problems = supabase.table("problems").select("id").execute().data
    answers = supabase.table("answers").select("score, status").execute().data

    scored = [a for a in answers if a.get("score") is not None]
    avg_score = round(sum(a["score"] for a in scored) / len(scored)) if scored else None

    return {
        "users": {
            "total": len(users),
            "teachers": sum(1 for u in users if u["role"] == "teacher"),
            "students": sum(1 for u in users if u["role"] == "student"),
            "admins": sum(1 for u in users if u["role"] == "admin"),
            "active": sum(1 for u in users if u.get("is_active", True)),
        },
        "problems": {"total": len(problems)},
        "answers": {
            "total": len(answers),
            "pending": sum(1 for a in answers if a.get("status") == "pending"),
            "ai_graded": sum(1 for a in answers if a.get("status") == "ai_graded"),
            "confirmed": sum(1 for a in answers if a.get("status") == "teacher_confirmed"),
            "avg_score": avg_score,
        },
    }


@router.get("/assignments")
async def get_assignments(current_user: dict = Depends(require_admin)):
    """강사-학생 매칭 목록"""
    result = (
        supabase.table("teacher_student")
        .select("teacher_id, student_id, assigned_at")
        .execute()
    )
    assignments = result.data
    if not assignments:
        return []

    # 동일 테이블에 대한 다중 FK 조인은 PostgREST에서 불안정하므로 수동 조인
    user_ids = list({a["teacher_id"] for a in assignments} | {a["student_id"] for a in assignments})
    users_result = (
        supabase.table("users")
        .select("id, name, email")
        .in_("id", user_ids)
        .execute()
    )
    users_map = {u["id"]: {"name": u["name"], "email": u["email"]} for u in users_result.data}

    for a in assignments:
        a["teacher"] = users_map.get(a["teacher_id"], {})
        a["student"] = users_map.get(a["student_id"], {})

    return assignments


@router.post("/assignments")
async def create_assignment(data: TeacherStudentAssign, current_user: dict = Depends(require_admin)):
    """강사-학생 매칭 생성"""
    teacher = supabase.table("users").select("role").eq("id", data.teacher_id).execute()
    student = supabase.table("users").select("role").eq("id", data.student_id).execute()

    if not teacher.data or teacher.data[0]["role"] != "teacher":
        raise HTTPException(status_code=400, detail="유효한 강사 ID가 아닙니다")
    if not student.data or student.data[0]["role"] != "student":
        raise HTTPException(status_code=400, detail="유효한 학생 ID가 아닙니다")

    result = (
        supabase.table("teacher_student")
        .insert({"teacher_id": data.teacher_id, "student_id": data.student_id})
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=400, detail="이미 매칭된 조합이거나 저장 오류입니다")
    return result.data[0]


@router.delete("/assignments/{teacher_id}/{student_id}")
async def delete_assignment(
    teacher_id: str, student_id: str, current_user: dict = Depends(require_admin)
):
    """강사-학생 매칭 해제"""
    supabase.table("teacher_student").delete().eq("teacher_id", teacher_id).eq(
        "student_id", student_id
    ).execute()
    return {"message": "매칭이 해제되었습니다"}
