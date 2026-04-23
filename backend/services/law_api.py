import requests
import xml.etree.ElementTree as ET
import logging
from config import settings

logger = logging.getLogger(__name__)

LAW_API_BASE = "https://www.law.go.kr/DRF"
OC = settings.LAW_API_OC  # 법제처 API 인증키 (이메일 아이디)

def search_statutes(keyword: str, display: int = 3) -> str:
    """법령 조문 검색 - legalize-kr 데이터와 동일한 법제처 원본"""
    try:
        url = f"{LAW_API_BASE}/lawSearch.do"
        params = {"OC": OC, "target": "law", "type": "XML",
                  "query": keyword, "display": display, "page": 1}
        res = requests.get(url, params=params, timeout=10)
        root = ET.fromstring(res.text)
        results = []
        for law in root.findall("law"):
            name = law.findtext("법령명한글", "")
            mst = law.findtext("법령MST", "")
            if mst:
                # 조문 상세 조회
                detail_url = f"{LAW_API_BASE}/lawService.do"
                detail = requests.get(detail_url,
                    params={"OC": OC, "target": "law", "MST": mst, "type": "XML"},
                    timeout=10)
                detail_root = ET.fromstring(detail.text)
                articles = []
                for art in detail_root.findall(".//조문"):
                    num = art.findtext("조문번호", "")
                    content = art.findtext("조문내용", "")
                    if content:
                        articles.append(f"제{num}조 {content[:200]}")
                if articles:
                    results.append(f"【{name}】\n" + "\n".join(articles[:5]))
        return "\n\n".join(results) if results else ""
    except Exception as e:
        logger.warning(f"법령 검색 실패: {e}")
        return ""

def search_precedents(keyword: str, display: int = 3) -> str:
    """판례 검색 - precedent-kr 데이터와 동일한 법제처 원본"""
    try:
        url = f"{LAW_API_BASE}/lawSearch.do"
        params = {"OC": OC, "target": "prec", "type": "XML",
                  "query": keyword, "display": display, "page": 1,
                  "curt": "대법원"}
        res = requests.get(url, params=params, timeout=10)
        root = ET.fromstring(res.text)
        results = []
        for prec in root.findall("prec"):
            case_num = prec.findtext("사건번호", "")
            summary = prec.findtext("판결요지", "")
            issue = prec.findtext("판시사항", "")
            if case_num and (summary or issue):
                results.append(
                    f"【판례 {case_num}】\n"
                    f"판시사항: {issue[:150]}\n"
                    f"판결요지: {summary[:300]}"
                )
        return "\n\n".join(results) if results else ""
    except Exception as e:
        logger.warning(f"판례 검색 실패: {e}")
        return ""
