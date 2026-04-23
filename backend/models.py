from pydantic import BaseModel, EmailStr
from typing import Optional


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str  # "teacher" or "student" (admin은 DB 직접 생성)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict


class ProblemCreate(BaseModel):
    title: str
    content: str
    question: str
    legal_basis: str


class AnswerCreate(BaseModel):
    problem_id: str
    content: str


class AnswerConfirm(BaseModel):
    score: int
    feedback: str


class TeacherStudentAssign(BaseModel):
    teacher_id: str
    student_id: str
