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


async def grade_answer(problem: dict, answer_content: str) -> tuple[int, str, list]:
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
    prompt = f"""당신은 변호사시험(로스쿨) 민법 논술 전문 채점관이자 친절한 멘토입니다.
수험생의 답안을 아래 기준으로 꼼꼼하게 채점하고, 구체적이고 따뜻한 피드백을 한국어로 작성하세요.

{"=" * 60}
[실제 법령 조문 및 판례 - 법제처 공식 데이터]
{rag_section if rag_section else "※ 법제처 데이터 없음 - 강사 입력 법리 기준으로만 채점"}
{"=" * 60}

[문제 제목]
{problem['title']}

[지문 (사례)]
{problem['content']}

[질문]
{problem['question']}

[강사 입력 채점 기준 법리]
{problem['legal_basis']}

[학생 답안]
{answer_content}

{"=" * 60}
## 민법 논술 채점 기준 (100점 만점)

### 1. 쟁점 파악 (20점)
- 사례에서 문제되는 법적 쟁점을 빠짐없이 파악했는가
- 쟁점의 우선순위와 논리적 순서가 맞는가
- 불필요한 쟁점을 다루느라 핵심 쟁점을 놓치지 않았는가

### 2. 요건사실 및 청구원인 (20점)
- 청구원인 요건사실을 먼저 제시했는가 (법리 → 사실 순서)
- 각 법률요건(주체·객체·행위·효과)을 빠짐없이 검토했는가
- 사실관계를 정확하게 법률요건에 포섭했는가

### 3. 판례 인용 정확도 (25점)
- 위에 제시된 관련 판례를 구체적으로 인용했는가
- 판례의 핵심 법리를 정확하게 이해하고 서술했는가
- 최신 판례 변경사항을 반영했는가
- 판례 취지를 왜곡하거나 잘못 적용하지 않았는가

### 4. 법령 조문 적용 (15점)
- 민법 조문을 정확하게 인용했는가 (제○○○조)
- 조문의 요건·효과를 올바르게 이해했는가
- 특별법(상법, 주택임대차보호법 등) 적용 여부를 검토했는가

### 5. 논리 구조 (3단 논법) (10점)
- 대전제(법리) → 소전제(사실) → 결론(포섭) 순서로 서술했는가
- 각 쟁점별로 독립적으로 검토했는가
- 논리적 비약이나 모순이 없는가

### 6. 실무적 결론 (10점)
- 법원이 어떤 판결을 내릴지 명확하게 제시했는가
- 인용/기각/일부인용 등 결론이 현행 판례·실무와 일치하는가
- 구체적 금액·기간 등 계산이 필요한 경우 정확하게 계산했는가

{"=" * 60}
## 민법 특유의 주요 체크 항목

다음 항목들이 답안에서 해당되는 경우 반드시 체크하세요:

[소멸시효]
- 기산점과 시효기간(민법 10년/상사 5년)을 정확히 적용했는가
- 시효중단 사유(청구·압류·승인)를 올바르게 검토했는가
- 부종성(제183조): 주채무 시효완성 → 보증채무도 소멸 여부
- 시효이익 포기 요건(완성 후, 처분능력, 알고서 포기) 검토

[채권양도]
- 양도금지특약(제449조)과 선의 제3자 요건 검토
- 악의·중과실 입증책임 소재 확인
- 대항요건(제450조) 통지·승낙 여부

[변제충당]
- 합의충당 → 지정충당(제476조) → 법정충당(제477조) 순서
- 제479조(비용·이자·원본 순서) 적용 여부

[보증·연대채무]
- 부종성, 수반성, 보충성 검토
- 연대보증과 일반보증의 구별

[불법행위]
- 고의·과실·위법성·손해·인과관계 5요건 모두 검토
- 과실상계(제396조) 적용 여부
- 손해배상 범위(제393조) 검토

{"=" * 60}
## 응답 형식

반드시 아래 JSON 형식으로만 응답하세요 (마크다운, 추가 텍스트 없이 순수 JSON):

{{"score": 점수(0~100 정수),
  "highlights": [
    {{"text": "학생 답안에서 잘된 문장 그대로 복사 (50자 이내)", "type": "good"}},
    {{"text": "학생 답안에서 잘못된 문장 그대로 복사 (50자 이내)", "type": "bad"}}
  ],
  "feedback": {{
    "잘된점": "2~3문장",
    "보완할점": "2~3문장",
    "모범답안힌트": "1~2문장",
    "총평": "2문장"
  }}
}}

highlights 규칙:
- 반드시 학생 답안에 실제로 있는 문장만 그대로 복사
- 최소 2개 최대 6개
- type은 "good" 또는 "bad" 만 사용"""

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
        highlights = data.get("highlights", [])

        if isinstance(feedback_raw, dict):
            good = feedback_raw.get("잘된점", "")
            bad = feedback_raw.get("보완할점", "")
            hint = feedback_raw.get("모범답안힌트", "")
            summary = feedback_raw.get("총평", "")
            parts = [f"✅ 잘된 점\n{good}", f"⚠️ 보완할 점\n{bad}"]
            if hint:
                parts.append(f"💡 모범답안 힌트\n{hint}")
            parts.append(f"📝 총평\n{summary}")
            feedback = "\n\n".join(parts)
        else:
            feedback = str(feedback_raw)

        return score, feedback, highlights

    except (json.JSONDecodeError, KeyError, ValueError) as e:
        logger.warning(f"JSON 파싱 실패, 정규식 재시도: {e}")
        score_match = re.search(r'"score"\s*:\s*(\d+(?:\.\d+)?)', response_text)
        score = int(round(float(score_match.group(1)))) if score_match else 0
        score = max(0, min(100, score))
        feedback_match = re.search(r'"feedback"\s*:\s*"((?:[^"\\]|\\.)*)"', response_text, re.DOTALL)
        feedback = feedback_match.group(1) if feedback_match else response_text[:500]
        return score, feedback, []
