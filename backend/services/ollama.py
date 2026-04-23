import asyncio
import json
import logging
import re
import requests
from config import settings
from services.law_api import search_statutes, search_precedents

logger = logging.getLogger(__name__)


def _extract_keywords(problem: dict) -> list[str]:
    """문제에서 법령/판례 검색 키워드 추출"""
    keywords = []
    # legal_basis에서 법령명 패턴 추출 (민법, 형법, 상법 등)
    legal_basis = problem.get("legal_basis", "")
    law_names = re.findall(r'[가-힣]+법(?:률)?', legal_basis)
    keywords.extend(list(set(law_names))[:3])
    # 문제 제목에서도 추출
    title = problem.get("title", "")
    title_laws = re.findall(r'[가-힣]+법(?:률)?', title)
    keywords.extend(list(set(title_laws))[:2])
    # 없으면 전체 legal_basis 앞 20자 키워드로 사용
    if not keywords and legal_basis:
        keywords.append(legal_basis[:20])
    return list(dict.fromkeys(keywords))[:3]  # 중복 제거, 최대 3개


def _call_ollama(prompt: str) -> str:
    """동기 requests로 Ollama /api/chat 호출"""
    url = f"{settings.OLLAMA_BASE_URL}/api/chat"
    headers = {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
        "User-Agent": "Mozilla/5.0",
    }
    payload = {
        "model": settings.OLLAMA_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "format": "json",
    }
    logger.info(f"Ollama 채점 요청: url={url}, model={settings.OLLAMA_MODEL}")
    response = requests.post(url, headers=headers, json=payload, verify=False, timeout=180)
    logger.info(f"Ollama 응답 상태: {response.status_code}")
    if response.status_code != 200:
        logger.error(f"Ollama 오류: {response.text[:500]}")
    response.raise_for_status()
    result = response.json()
    response_text = result.get("message", {}).get("content", "")
    logger.info(f"Ollama 응답 (앞 200자): {response_text[:200]}")
    return response_text


async def grade_answer(problem: dict, answer_content: str) -> tuple[int, str]:
    """
    법제처 법령/판례 RAG + Ollama Gemma 기반 채점
    반환값: (점수, 첨삭 코멘트)
    """
    # 1. 관련 법령/판례 실시간 검색
    keywords = _extract_keywords(problem)
    statute_context = ""
    precedent_context = ""

    if keywords:
        logger.info(f"법령/판례 검색 키워드: {keywords}")
        for kw in keywords:
            statutes = await asyncio.to_thread(search_statutes, kw, 2)
            if statutes:
                statute_context += statutes + "\n\n"
            precedents = await asyncio.to_thread(search_precedents, kw, 2)
            if precedents:
                precedent_context += precedents + "\n\n"

    # 2. RAG 컨텍스트 섹션 구성
    rag_section = ""
    if statute_context:
        rag_section += f"\n[실제 법령 조문 - 법제처 공식 데이터]\n{statute_context.strip()}\n"
    if precedent_context:
        rag_section += f"\n[관련 대법원 판례 - 법제처 공식 데이터]\n{precedent_context.strip()}\n"

    # 3. 프롬프트 구성
    prompt = f"""당신은 대한민국 사법시험/변호사시험 수준의 법률 논술 전문 채점관입니다.
아래 제공된 실제 법령 조문과 대법원 판례를 반드시 참고하여 학생 답안을 채점하세요.
{rag_section}
[문제 제목]
{problem['title']}

[지문]
{problem['content']}

[질문]
{problem['question']}

[강사 입력 채점 기준 법리]
{problem['legal_basis']}

[학생 답안]
{answer_content}

## 채점 기준 (100점 만점)

1. 핵심 법리의 정확한 이해 및 적용 (40점)
   - 해당 쟁점의 법적 성질을 정확히 파악했는가
   - 관련 법령 조문을 올바르게 이해하고 적용했는가
   - 법리의 오류나 왜곡이 없는가

2. 판례 및 조문의 적절한 인용 (30점)
   - 위에 제시된 관련 판례·조문을 구체적으로 인용했는가
   - 판례 취지를 정확히 이해하고 맥락에 맞게 활용했는가
   - 관련 없는 판례를 남발하지 않았는가

3. 논리적 구성과 서술의 명확성 (20점)
   - 문제 제기 → 법리 적용 → 결론의 체계적 서술
   - 법률 용어를 정확하게 사용했는가
   - 분량이 충분하고 핵심 논점을 빠뜨리지 않았는가

4. 결론의 타당성 (10점)
   - 법리 분석에서 도출한 결론이 논리적으로 일관되는가
   - 실무적·학문적으로 수용 가능한 결론인가

## 응답 형식

반드시 아래 JSON 형식으로만 응답하세요 (마크다운, 추가 텍스트 없이 순수 JSON):

{{"score": 점수(0~100 정수), "feedback": {{"잘된점": "어떤 법리/판례를 정확히 이해했는지 구체적으로 2~3문장", "보완할점": "어떤 법리가 빠졌는지, 어떤 판례를 잘못 적용했는지, 논리 구성의 문제를 2~3문장", "총평": "전반적 수준과 핵심 개선 방향 2문장"}}}}"""

    try:
        response_text = await asyncio.to_thread(_call_ollama, prompt)
    except requests.exceptions.ConnectionError as e:
        logger.error(f"Ollama 연결 실패: {e}")
        raise
    except requests.exceptions.HTTPError as e:
        logger.error(f"Ollama HTTP 오류 {e.response.status_code}: {e.response.text[:500]}")
        raise
    except requests.exceptions.Timeout:
        logger.error("Ollama 타임아웃 (180초 초과)")
        raise

    # 4. JSON 파싱
    try:
        data = json.loads(response_text)
        score = int(round(float(data.get("score", 0))))
        score = max(0, min(100, score))
        feedback_raw = data.get("feedback", {})

        if isinstance(feedback_raw, dict):
            good = feedback_raw.get("잘된점", "")
            bad = feedback_raw.get("보완할점", "")
            summary = feedback_raw.get("총평", "")
            feedback = f"✅ 잘된 점\n{good}\n\n⚠️ 보완할 점\n{bad}\n\n📝 총평\n{summary}"
        else:
            feedback = str(feedback_raw)

        return score, feedback

    except (json.JSONDecodeError, KeyError, ValueError) as e:
        logger.warning(f"JSON 파싱 실패, 정규식 재시도: {e}")
        score_match = re.search(r'"score"\s*:\s*(\d+(?:\.\d+)?)', response_text)
        score = int(round(float(score_match.group(1)))) if score_match else 0
        score = max(0, min(100, score))
        feedback_match = re.search(r'"feedback"\s*:\s*"((?:[^"\\]|\\.)*)"', response_text, re.DOTALL)
        feedback = feedback_match.group(1) if feedback_match else response_text[:500]
        return score, feedback
