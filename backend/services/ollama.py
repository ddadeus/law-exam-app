import httpx
import json
import re
from config import settings


async def grade_answer(problem: dict, answer_content: str) -> tuple[int, str]:
    """
    Ollama Gemma 모델을 사용하여 학생 답안을 채점합니다.
    반환값: (점수, 첨삭 코멘트)
    """
    prompt = f"""당신은 대한민국 법률 논술 시험의 전문 채점관입니다.
아래 채점 기준 법리를 바탕으로 학생 답안을 엄정하게 평가하고 상세한 첨삭 코멘트를 한국어로 작성하세요.

[문제 제목]
{problem['title']}

[지문]
{problem['content']}

[질문]
{problem['question']}

[채점 기준 법리 (판례 및 법령 조문)]
{problem['legal_basis']}

[학생 답안]
{answer_content}

채점 기준:
1. 핵심 법리의 정확한 이해 및 적용 (40점)
2. 판례 및 조문의 적절한 인용 (30점)
3. 논리적 구성과 서술의 명확성 (20점)
4. 결론의 타당성 (10점)

반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):

{{"score": 85, "feedback": "여기에 상세한 첨삭 코멘트를 작성하세요. 잘된 점, 부족한 점, 개선 방향을 구체적으로 서술하세요."}}"""

    async with httpx.AsyncClient(timeout=180.0) as client:
        response = await client.post(
            f"{settings.OLLAMA_BASE_URL}/api/generate",
            json={
                "model": settings.OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "format": "json",
            },
        )
        response.raise_for_status()
        result = response.json()

    response_text = result.get("response", "")

    try:
        data = json.loads(response_text)
        score = int(round(float(data.get("score", 0))))
        score = max(0, min(100, score))
        feedback = data.get("feedback", "피드백을 생성할 수 없습니다.")
        return score, feedback
    except (json.JSONDecodeError, KeyError, ValueError):
        # JSON 파싱 실패 시 정규식으로 추출 시도
        score_match = re.search(r'"score"\s*:\s*(\d+(?:\.\d+)?)', response_text)
        score = int(round(float(score_match.group(1)))) if score_match else 0
        score = max(0, min(100, score))

        feedback_match = re.search(
            r'"feedback"\s*:\s*"((?:[^"\\]|\\.)*)"', response_text, re.DOTALL
        )
        feedback = feedback_match.group(1) if feedback_match else response_text[:500]
        return score, feedback
