from fastapi import APIRouter, HTTPException
from models import UserCreate, UserLogin, Token
from auth import verify_password, get_password_hash, create_access_token
from database import supabase

router = APIRouter(prefix="/auth", tags=["인증"])


@router.post("/register", response_model=Token)
async def register(user_data: UserCreate):
    """회원가입"""
    if user_data.role not in ["teacher", "student"]:
        raise HTTPException(status_code=400, detail="역할은 teacher 또는 student여야 합니다")

    existing = supabase.table("users").select("id").eq("email", user_data.email).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="이미 등록된 이메일입니다")

    hashed_password = get_password_hash(user_data.password)

    result = supabase.table("users").insert({
        "email": user_data.email,
        "password": hashed_password,
        "name": user_data.name,
        "role": user_data.role,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="회원가입 처리 중 오류가 발생했습니다")

    user = result.data[0]
    token = create_access_token({"sub": user["id"], "role": user["role"]})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
        },
    }


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin):
    """로그인"""
    result = supabase.table("users").select("*").eq("email", credentials.email).execute()

    if not result.data:
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다")

    user = result.data[0]

    if not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다")

    token = create_access_token({"sub": user["id"], "role": user["role"]})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
        },
    }
