const express = require("express");
const path = require("path");
const RSSParser = require("rss-parser");
const fs = require("fs");

const app = express();
app.use(express.json());
const parser = new RSSParser({
  timeout: 15000,
  customFields: {
    item: ["media:content", "description"]
  }
});

const PORT = process.env.PORT || 10001;
const CACHE_TTL_MS = 5 * 60 * 1000;
const USE_DYNAMIC_BRIEFING = true;

let cache = {
  updatedAt: 0,
  payload: null
};

// ===================== 테마 정의 =====================

const EXTRA_CANDIDATE_POOLS = {
  "반도체": ["주성엔지니어링", "원익IPS", "피에스케이홀딩스", "고영", "유진테크", "와이씨"],
  "원전": ["한전산업", "한신기계", "서전기전", "지투파워", "오르비텍"],
  "전력": ["산일전기", "세명전기", "제일일렉트릭", "비츠로테크", "LS전선아시아"],
  "로봇": ["휴림로봇", "티로보틱스", "에스피지", "로보스타", "유일로보틱스"],
  "바이오": ["HK이노엔", "한올바이오파마", "보로노이", "오스코텍", "에이치엘비"],
  "우주항공": ["한국카본", "한양디지텍", "인텔리안테크", "현대위아"],
  "SpaceX+xAI": ["우리넷", "기가레인", "옵티코어", "한양디지텍"],
  "방산": ["한국항공우주", "SNT다이내믹스", "한화시스템", "퍼스텍"]
};

function getExtraCandidatePool(themeName = "") {
  return EXTRA_CANDIDATE_POOLS[themeName] || [];
}

const THEMES = [
  {
    name: "반도체",
    queries: [
      "삼성전자 반도체",
      "반도체 HBM 패키징",
      "하이닉스 반도체",
      "반도체 후공정 수주",
      "TC본더"
    ],
    fallbackQueries: [
      "AI 반도체 패키징",
      "HBM 장비 공급",
      "메모리 반도체 수출", "하이브리드본딩", "CXL"
    ],
    coreStocks: ["삼성전자", "SK하이닉스", "한미반도체", "리노공업"],
    candidateStocks: ["ISC", "테크윙", "이오테크닉스", "하나마이크론", "원익IPS", "솔브레인"]
  },
  {
  name: "원전",
  queries: [
    "원전 수주",
    "SMR 공급 계약",
    "한수원 원전 수출",
    "원전 기자재 공급",
    "두산에너빌리티 SMR"
  ],
  fallbackQueries: [
    "원자력 기자재 수주",
    "원전 설계 공급",
    "원전 수출 계약"
  ],
    coreStocks: ["두산에너빌리티", "한전기술", "한국전력", "비에이치아이"],
    candidateStocks: ["보성파워텍", "일진파워", "우진", "우리기술"]
  },
  {
    name: "전력",
    queries: [
      "전력 변압기 수주",
      "송배전 전선 공급",
      "데이터센터 전력 설비"
    ],
    fallbackQueries: [
      "변압기 공급 계약",
      "전력기기 데이터센터"
    ],
    coreStocks: ["HD현대일렉트릭", "효성중공업", "LS ELECTRIC", "제룡전기"],
    candidateStocks: ["가온전선", "대한전선", "일진전기", "광명전기"]
  },
  {
    name: "로봇",
    queries: [
      "로봇 자동화 도입",
      "휴머노이드 생산",
      "협동로봇 공급"
    ],
    fallbackQueries: [
      "자동화 로봇 계약",
      "휴머노이드 로봇 기사"
    ],
    coreStocks: ["두산로보틱스", "레인보우로보틱스", "현대로템", "현대오토에버"],
    candidateStocks: ["로보티즈", "뉴로메카", "현대무벡스", "삼익THK", "LG이노텍"]
  },
  {
    name: "바이오",
    queries: [
      "바이오 임상 허가",
      "신약 기술수출",
      "FDA 임상 승인"
    ],
    fallbackQueries: [
      "바이오 기술수출 계약",
      "신약 임상 결과"
    ],
    coreStocks: ["셀트리온", "삼성바이오로직스", "알테오젠", "유한양행"],
    candidateStocks: ["에이비엘바이오", "에이프릴바이오", "파마리서치", "리가켐바이오", "펩트론", "에스티팜"]
  },
  {
  name: "우주항공",
  queries: [
    "한화에어로스페이스 위성 공급",
    "쎄트렉아이 위성 계약",
    "한국항공우주 수주",
    "컨텍 우주항공 계약",
    "AP위성 위성통신 공급",
    "제노코 항공우주 부품",
    "켄코아에어로스페이스 공급"
  ],
  fallbackQueries: [
    "위성 공급 계약",
    "발사체 개발 수주",
    "항공우주 부품 공급",
    "위성통신 공급 계약",
    "우주항공 기업 계약"
  ],
  coreStocks: ["한화에어로스페이스", "쎄트렉아이", "컨텍", "한국항공우주"],
  candidateStocks: ["제노코", "켄코아에어로스페이스", "루미르", "AP위성"]
  },
  {
  name: "SpaceX+xAI",
  queries: [
    "스타링크 국내 수혜",
    "저궤도 통신 국내 기업",
    "인텔리안테크 스타링크",
    "AP위성 저궤도 통신",
    "쎄트렉아이 위성 통신",
    "센서뷰 저궤도 통신",
    "오이솔루션 위성 통신"
  ],
  fallbackQueries: [
    "SpaceX 스타링크 국내",
    "xAI 데이터센터 국내 수혜",
    "위성통신 국내 기업",
    "저궤도 위성 국내 수혜",
    "스타링크 안테나 국내"
  ],
  coreStocks: ["인텔리안테크", "쎄트렉아이", "AP위성"],
  candidateStocks: ["쏠리드", "에치에프알", "센서뷰", "오이솔루션", "케이엠더블유"]
},
  {
    name: "방산",
    queries: [
      "방산 수출 계약",
      "KF-21 수출",
      "미사일 공급 계약"
    ],
    fallbackQueries: [
      "방산 납품 기사",
      "국방 수출 계약"
    ],
    coreStocks: ["LIG넥스원", "한화에어로스페이스", "현대로템", "풍산"],
    candidateStocks: ["빅텍", "스페코", "퍼스텍", "휴니드"]
  }
];

const STOCK_ALIASES = {
  "삼성전자": ["삼성전자", "삼전"],
  "SK하이닉스": ["sk하이닉스", "하이닉스"],
  "한미반도체": ["한미반도체"],
  "리노공업": ["리노공업"],

  "두산에너빌리티": ["두산에너빌리티", "두산에너빌"],
  "한전기술": ["한전기술"],
  "한국전력": ["한국전력", "한전"],
  "비에이치아이": ["비에이치아이"],

  "HD현대일렉트릭": ["hd현대일렉트릭", "현대일렉트릭"],
  "효성중공업": ["효성중공업"],
  "LS ELECTRIC": ["ls electric", "lselectric", "ls일렉트릭"],
  "제룡전기": ["제룡전기"],
  "대한전선": ["대한전선"],
  "일진전기": ["일진전기"],

  "두산로보틱스": ["두산로보틱스"],
  "레인보우로보틱스": ["레인보우로보틱스"],
  "현대로템": ["현대로템"],
  "현대오토에버": ["현대오토에버"],
  "뉴로메카": ["뉴로메카"],

  "셀트리온": ["셀트리온"],
  "삼성바이오로직스": ["삼성바이오로직스", "삼바"],
  "알테오젠": ["알테오젠"],
  "유한양행": ["유한양행"],

  "한화에어로스페이스": ["한화에어로스페이스", "한화에어로"],
  "쎄트렉아이": ["쎄트렉아이"],
  "컨텍": ["컨텍"],
  "한국항공우주": ["한국항공우주", "kai"],
  "AP위성": ["ap위성"],

  "인텔리안테크": ["인텔리안테크"],
  "센서뷰": ["센서뷰"],
  "오이솔루션": ["오이솔루션"],
  "쏠리드": ["쏠리드"],
  "에치에프알": ["에치에프알"],

  "LIG넥스원": ["lig넥스원"],
  "한화시스템": ["한화시스템"],
  "풍산": ["풍산"],
  "퍼스텍": ["퍼스텍"],
  "휴니드": ["휴니드"]
};

function detectPrimaryStock(title = "") {
  const text = safeText(title);

  for (const [canonical, aliases] of Object.entries(STOCK_ALIASES)) {
    for (const alias of aliases) {
      if (text.includes(safeText(alias))) {
        return canonical;
      }
    }
  }

  return null;
}

const THEME_SIGNALS = {
  "반도체": { label: "📌 대형주 중심", className: "mid", insight: "반도체는 AI·HBM 이후 후공정·패키징 확산 구간" },
  "원전": { label: "⚠️ 정책 기대", className: "mid", insight: "원전은 정책보다 실제 수주·공급 기사 비중 우위 구간" },
  "전력": { label: "⚡ 수요 연결", className: "strong", insight: "전력은 데이터센터 수요의 변압기·송배전 확산 여부가 핵심" },
  "로봇": { label: "🤖 기대감 구간", className: "mid", insight: "로봇은 기대감보다 실제 도입·자동화 기사 비중이 핵심" },
  "바이오": { label: "🧬 이벤트 중심", className: "mid", insight: "바이오는 이벤트 수보다 임상·허가 기사 질이 핵심" },
  "우주항공": { label: "🚀 뉴스 점검", className: "mid", insight: "우주항공은 국가 프로젝트보다 실수혜 연결 종목 압축이 중요" },
  "SpaceX+xAI": { label: "🌐 테마성 접근", className: "mid", insight: "SpaceX+xAI는 머스크 생태계 확산보다 실수혜 구조 검증이 우선" },
  "방산": { label: "🛡 계약 강도", className: "strong", insight: "방산은 지정학보다 실제 계약·수출 기사 비중이 핵심" }
};

// ===================== 필터 / 소스 정의 =====================

const GLOBAL_EXCLUDE_KEYWORDS = [
  "부고", "인사", "칼럼", "사설", "오피니언", "인터뷰",
  "포토", "화보", "영상", "만평", "오늘의 운세",
  "브리핑", "장 마감", "개장 전",
  "사진", "[사진", "자료사진", "사진=", "포토뉴스"
];

const HARD_EXCLUDE_PATTERNS = [
  "특징주", "오전장 특징주", "오후장 특징주", "장중 특징주",
  "hot 종목", "hot종목", "핫스탁", "오늘의 종목", "급등주",
  "상한가", "하한가", "테마주", "관련주", "수혜주", "급등",
  "종목 체크", "종목분석", "주가 전망", "투자전략", "매수", "매도"
];

function isHardExcludedNews(title = "") {
  const text = safeText(title);
  return HARD_EXCLUDE_PATTERNS.some(k => text.includes(safeText(k)));
}

const BLOCKED_KEYWORDS = [
  "안산", "안산시", "안산시장",
  "대학교", "대학", "교수", "학생", "학과", "캠퍼스",
  "대학원", "논문", "입시", "수시", "정시", "총장", "산학협력",

  // 지역/지자체/행사성 기사 차단
  "사천", "사천시", "진주", "진주시", "고흥", "대덕",
  "고흥군", "우주항공청 유치", "국가산단", "국가산업단지",
  "세미나", "포럼", "벨트로 도약", "중심도시 도약",
  "산업도시 도약", "기술개발지원", "수혜기업 모집",
  "유치전", "행정", "출범식", "협약식", "개최"
];

const EXCLUDE_BY_THEME = {
  "우주항공": [
  "강세 토픽", "항공·우주 테마", "우주 테마", "관련주", "테마주",
  "사천", "사천시", "진주", "진주시", "고흥", "고흥군", "대덕",
  "유치전", "산업벨트", "산업도시", "세미나", "포럼",
  "수혜기업 모집", "기술개발지원"
  ],
  "방산": ["방산주", "강세 토픽", "관련주", "테마주"],
  "로봇": ["강세 토픽", "관련주", "테마주", "주목해야"],
  "SpaceX+xAI": [
  "ipo 임박",
  "spacex란 무엇인가",
  "머스크는 어떻게",
  "기업 배경부터",
  "심층 분석",
  "관련주란",
  "관련주 무엇인가",
  "공급망 전격 분석",
  "강세 토픽",
  "테마주",
  "관련주"
],
};

const NOISE_KEYWORDS = [
  "특징주", "급등", "급락", "상한가", "하한가",
  "수혜주", "관련주", "테마주", "왜 오르나", "왜 떨어지나",
  "주목", "기대감", "추천", "목표가", "매수", "매도",
  "전망", "상승", "하락", "강세", "약세", "들썩", "술렁",
  "브리핑", "토픽", "ETF", "레버리지", "인버스"
];

const HARD_KEYWORDS = [
  "계약", "수주", "공급", "납품", "양산",
  "투자", "증설", "합작", "인수", "합병",
  "수출", "허가", "승인", "임상", "기술수출",
  "발사", "시험", "개발", "완공", "공시",
  "착공", "생산", "출시", "선정", "체결"
];

const TRUST_HIGH_SOURCES = [
  "연합뉴스", "뉴스1", "뉴시스",
  "매일경제", "한국경제", "서울경제",
  "이데일리", "조선비즈", "아시아경제",
  "머니투데이", "파이낸셜뉴스", "전자신문",
  "디지털타임스", "헤럴드경제", "한국경제tv"
];

const TRUST_MID_SOURCES = [
  "데일리안", "아이뉴스24", "지디넷코리아", "zdnet korea",
  "더벨", "헬로티", "에너지경제", "약업신문",
  "메디파나뉴스", "바이오타임즈", "디일렉", "thelec", "더엘렉",
  "조선일보", "중앙일보", "동아일보"
];

const TRUST_LOW_SOURCES = [
  "핀포인트뉴스", "청년일보", "신아일보","서남투데이",
  "네이트", "브릿지경제", "비욘드포스트",
  "이코노뉴스", "잡포스트", "프라임경제",
  "트레이딩키", "강세토픽", "tradingkey", "mix vale",
  "더구루", "cnb뉴스", "cnbnews", "초이스경제",
  "뉴스팜", "ebn", "sedaily.com", "shinailbo", "헬로티", "헬로디디", "노컷뉴스", "경남도민일보", "cnbnews.com"
];

// ===================== 기본 유틸 =====================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function safeText(value = "") {
  return String(value || "").toLowerCase().trim();
}

function ensureNewsArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.news)) return value.news;
  if (Array.isArray(value?.full)) return value.full;
  return [];
}

function formatDateToIso(date) {
  return new Date(date).toISOString();
}

function countKeywordHits(text = "", keywords = []) {
  const normalized = safeText(text);
  return keywords.reduce((acc, keyword) => {
    return normalized.includes(safeText(keyword)) ? acc + 1 : acc;
  }, 0);
}

function extractSource(item) {
  const raw =
    item?.source?.title ||
    item?.creator ||
    item?.author ||
    "";

  if (raw) return String(raw).trim();

  const title = item?.title || "";
  const match = title.match(/\s-\s([^-\]]+)$/);
  return match ? match[1].trim() : "출처미상";
}

function cleanTitle(rawTitle = "") {
  return String(rawTitle)
    .replace(/\s-\s[^-]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isRecentNews(pubDate, days = 7) {
  if (!pubDate) return false;
  const time = new Date(pubDate).getTime();
  if (Number.isNaN(time)) return false;
  return (Date.now() - time) <= days * 24 * 60 * 60 * 1000;
}

function shouldKeepSpaceXLinkedNews(title = "", themeName = "") {
  if (themeName !== "SpaceX+xAI") return true;

  const text = safeText(title);

  const domesticLinkKeywords = [
    "인텔리안테크", "쎄트렉아이", "ap위성",
    "쏠리드", "에치에프알", "센서뷰",
    "오이솔루션", "케이엠더블유",
    "스타링크", "저궤도", "위성통신", "위성",
    "국내", "수혜", "공급", "납품", "안테나", "통신장비"
  ];

  return domesticLinkKeywords.some(k => text.includes(safeText(k)));
}

// ===================== 필터 =====================

function isLowValueNews(title = "") {
  const text = safeText(title);
  return GLOBAL_EXCLUDE_KEYWORDS.some(k => text.includes(safeText(k)));
}

function shouldExcludeNews(title = "", themeName = "") {
  const text = safeText(title);

  if ([...GLOBAL_EXCLUDE_KEYWORDS, ...BLOCKED_KEYWORDS].some(k => text.includes(safeText(k)))) {
    return true;
  }

  if (isHardExcludedNews(title)) return true;

  const themeExclude = (EXCLUDE_BY_THEME[themeName] || []).map(safeText);
  if (themeExclude.some(k => text.includes(k))) return true;

  return false;
}

function shouldKeepBusinessNews(title = "", themeName = "") {
  const text = safeText(title);

  if (themeName !== "우주항공" && themeName !== "방산") return true;

  const businessKeywords = [
    "계약", "수주", "공급", "납품", "수출", "양산",
    "개발", "생산", "체결", "선정", "사업", "확대",
    "기자재", "엔진", "발사", "위성", "전투기", "미사일", "smr", "원전"
  ];

  return businessKeywords.some(k => text.includes(safeText(k)));
}

// ===================== 점수 엔진 =====================

function getSourceTrustScore(source = "") {
  const s = safeText(source);
  if (!s) return 0;
  if (TRUST_HIGH_SOURCES.some(name => s.includes(safeText(name)))) return 50;
  if (TRUST_MID_SOURCES.some(name => s.includes(safeText(name)))) return 10;
  if (TRUST_LOW_SOURCES.some(name => s.includes(safeText(name)))) return -35;
  return 4;
}

function getRecencyScore(dateValue) {
  if (!dateValue) return 0;

  const pubTime = new Date(dateValue).getTime();
  if (Number.isNaN(pubTime)) return 0;

  const diffHours = (Date.now() - pubTime) / (1000 * 60 * 60);

  if (diffHours <= 3) return 20;
  if (diffHours <= 6) return 15;
  if (diffHours <= 12) return 10;
  if (diffHours <= 24) return 6;
  if (diffHours <= 48) return 2;
  return 0;
}

function getHardNewsScore(title = "", description = "") {
  const text = `${title} ${description}`;
  const hits = countKeywordHits(text, HARD_KEYWORDS);
  if (hits >= 3) return 24;
  if (hits === 2) return 16;
  if (hits === 1) return 8;
  return 0;
}

function getNoisePenalty(title = "") {
  const hits = countKeywordHits(title, NOISE_KEYWORDS);
  if (hits >= 3) return -24;
  if (hits === 2) return -16;
  if (hits === 1) return -8;
  return 0;
}

function getTitleQualityPenalty(title = "") {
  const t = String(title || "").trim();
  if (!t) return -20;
  if (t.length < 10) return -10;
  if (t.length < 14) return -6;
  return 0;
}

function getNumberSignalScore(title = "", description = "") {
  const text = `${title} ${description}`;
  return /[0-9]+(조|억|만|%|건|기|명)/.test(text) ? 6 : 0;
}

function getThemeRelevanceScore(title = "", theme = {}) {
  const text = safeText(title);
  let score = 0;

  const themeKeywordMap = {
    "반도체": ["반도체", "hbm", "파운드리", "후공정", "패키징", "tc본더", "하이브리드본딩", "cxl"],
    "원전": ["원전", "원자력", "smr", "한수원", "기자재"],
    "전력": ["전력", "변압기", "송배전", "전선", "ess", "데이터센터"],
    "로봇": ["로봇", "휴머노이드", "자동화", "협동로봇"],
    "바이오": ["바이오", "신약", "임상", "fda", "기술수출", "cdmo"],
    "우주항공": ["우주", "항공", "위성", "발사체", "누리호"],
    "SpaceX+xAI": ["spacex", "xai", "스타링크", "저궤도", "ai 데이터센터"],
    "방산": ["방산", "국방", "미사일", "탄약", "수출", "kf-21"]
  };

  for (const keyword of themeKeywordMap[theme.name] || []) {
    if (text.includes(safeText(keyword))) score += 2;
  }

  for (const stock of [...(theme.coreStocks || []), ...(theme.candidateStocks || [])]) {
    if (text.includes(safeText(stock))) score += 4;
  }

  return score;
}

function buildNewsScore(article = {}, theme = {}) {
  const title = article.title || "";
  const description = article.description || "";
  const source = article.source || "";
  const pubDate = article.pubDate || article.isoDate || article.publishedAt;

  if (shouldExcludeNews(title, theme.name)) return -1000;

  let score = 0;

  if (theme.name === "우주항공") {
  const text = safeText(title);

  const aeroKeywords = [
    "위성", "발사", "발사체", "공급", "수주", "계약",
    "항공우주", "쎄트렉아이", "한국항공우주", "한화에어로스페이스",
    "컨텍", "ap위성", "루미르", "제노코", "켄코아"
  ];

  if (aeroKeywords.some(k => text.includes(safeText(k)))) {
    score += 18;
  }
}

  score += getSourceTrustScore(source);
  score += getRecencyScore(pubDate);
  score += getHardNewsScore(title, description);
  score += getNoisePenalty(title);
  score += getTitleQualityPenalty(title);
  score += getNumberSignalScore(title, description);
  score += getThemeRelevanceScore(title, theme);

  if (theme.name === "SpaceX+xAI") {
    const text = safeText(title);

    const domesticKeywords = [
      "인텔리안테크", "쎄트렉아이", "ap위성",
      "쏠리드", "에치에프알", "센서뷰",
      "오이솔루션", "케이엠더블유",
      "국내", "수혜", "공급", "납품", "저궤도", "위성", "스타링크"
    ];

    if (domesticKeywords.some(k => text.includes(safeText(k)))) {
      score += 25;
    }
  }

  if (title.includes("?")) score -= 6;
  if (title.includes("...")) score -= 2;

// 사진/설명성 기사 패널티
const lowerTitle = safeText(title);

if (
  lowerTitle.includes("[사진") ||
  lowerTitle.includes("사진:") ||
  lowerTitle.includes("자료사진") ||
  lowerTitle.includes("포토뉴스") ||
  lowerTitle.includes("포토")
) {
  score -= 25;
}

// 설명성/가이드성 기사 패널티
if (
  lowerTitle.includes("란 무엇인가") ||
  lowerTitle.includes("전망") ||
  lowerTitle.includes("분석") ||
  lowerTitle.includes("가이드") ||
  lowerTitle.includes("정리")
) {
  score -= 10;
}

  return score;
}

// ===================== 정렬 / 중복 제거 =====================

function sortNewsByScore(news = []) {
  return [...ensureNewsArray(news)].sort((a, b) => {
    const scoreDiff = (b.score || 0) - (a.score || 0);
    if (scoreDiff !== 0) return scoreDiff;

    const aTime = new Date(a.pubDate || 0).getTime();
    const bTime = new Date(b.pubDate || 0).getTime();
    return bTime - aTime;
  });
}

function sortNewsForDisplay(news = []) {
  return [...ensureNewsArray(news)].sort((a, b) => {
    const aTrust = getSourceTrustScore(a.source || "");
    const bTrust = getSourceTrustScore(b.source || "");

    // 1순위: 언론사 신뢰도
    if (bTrust !== aTrust) return bTrust - aTrust;

    // 2순위: 점수
    if ((b.score || 0) !== (a.score || 0)) {
      return (b.score || 0) - (a.score || 0);
    }

    // 3순위: 최신성
    const aTime = new Date(a.pubDate || 0).getTime();
    const bTime = new Date(b.pubDate || 0).getTime();
    return bTime - aTime;
  });
}

function dedupeNews(news = []) {
  const list = ensureNewsArray(news);
  const seen = new Set();
  const deduped = [];

  for (const item of list) {
    if (!item || !item.title) continue;
    const key = String(item.title).trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

function normalizeHeadline(title = "") {
  return String(title || "")
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^\)]*\)/g, " ")
    .replace(/[“”"'`‘’·•,:;!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function headlineSimilarity(a = "", b = "") {
  const ta = normalizeHeadline(a);
  const tb = normalizeHeadline(b);

  if (!ta || !tb) return 0;
  if (ta === tb) return 1;

  const wordsA = new Set(ta.split(" ").filter(Boolean));
  const wordsB = new Set(tb.split(" ").filter(Boolean));
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;

  return union ? intersection / union : 0;
}

function limitNewsPerStock(news = [], stockPool = [], maxPerStock = 2, totalLimit = 10) {
  const stockCounts = {};
  const result = [];

  for (const item of news) {
    const title = item.title || "";

    // 1순위: 전역 대표 기업명 감지
    let matchedStock = detectPrimaryStock(title);

    // 2순위: 그래도 없으면 theme stockPool에서 다시 찾기
    if (!matchedStock) {
      matchedStock = stockPool.find(stock =>
        safeText(title).includes(safeText(stock))
      ) || null;
    }

    if (!matchedStock) {
      result.push(item);
    } else {
      stockCounts[matchedStock] = stockCounts[matchedStock] || 0;

      if (stockCounts[matchedStock] < maxPerStock) {
        stockCounts[matchedStock] += 1;
        result.push(item);
      }
    }

    if (result.length >= totalLimit) break;
  }

  return result;
}

// ===================== 뉴스 수집 =====================

async function parseGoogleNews(query, theme = null) {
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
  const feed = await parser.parseURL(rssUrl);

  const items = ensureNewsArray(feed.items).map(item => {
    const rawTitle = item.title || "제목 없음";
    return {
      title: cleanTitle(rawTitle),
      link: item.link || "#",
      source: extractSource(item),
      pubDate: item.pubDate || item.isoDate || "",
      description: item.description || ""
    };
  });

  const recentOnly = items.filter(item => isRecentNews(item.pubDate, 7));
  const base = recentOnly; // 7일 이내만 강제

  const filteredBase = base.filter(item => {
    if (isLowValueNews(item.title)) return false;
    return true;
  });

  const relevant = filteredBase.filter(item => {
    if (shouldExcludeNews(item.title, theme?.name || "")) return false;
    return true;
  });

  const finalBase = relevant.length ? relevant : filteredBase;

  const rescored = dedupeNews(finalBase).map(item => ({
    ...item,
    score: buildNewsScore(item, theme || {})
  }));

  return sortNewsByScore(rescored);
}

async function fetchNewsByQueries(queries = [], theme = null) {
  const merged = [];

  for (const query of queries) {
    const partial = ensureNewsArray(await parseGoogleNews(query, theme));
    merged.push(...partial);
    await sleep(120);
  }

  return dedupeNews(merged);
}

async function fetchThemeNews(theme, count = 10) {
  try {
    const targetCount = Math.min(count, 10);

    let news = await fetchNewsByQueries(theme.queries || [theme.query], theme);

    if (news.length < targetCount && (theme.fallbackQueries || []).length > 0) {
      const fallbackNews = await fetchNewsByQueries(theme.fallbackQueries, theme);
      news = dedupeNews([...news, ...fallbackNews]);
    }

    // 1차 필터
    let filteredNews = dedupeNews(news).filter(item => {
      const title = item.title || "";

      if (shouldExcludeNews(title, theme.name)) return false;

      return true;
    });

    // SpaceX+xAI는 연결 기사 충분할 때만 우선 적용
    if (theme.name === "SpaceX+xAI") {
      const linkedNews = filteredNews.filter(item =>
        shouldKeepSpaceXLinkedNews(item.title || "", theme.name)
      );

      if (linkedNews.length >= 10) {
        filteredNews = linkedNews;
      }
    }

  let rescoredNews = filteredNews
  .map(item => ({
    ...item,
    score: buildNewsScore(item, theme)
  }));

// 섹터별로 언론사 필터 강도 다르게
if (theme.name === "반도체" || theme.name === "원전" || theme.name === "바이오" || theme.name === "전력") {
  rescoredNews = rescoredNews.filter(item => {
    const trust = getSourceTrustScore(item.source || "");

    // 메이저/준메이저 기본 허용
    if (trust >= 18) return true;

    // 비메이저는 정말 강한 기사만 예외
    return (item.score || 0) >= 60;
  });
} else {
  // 우주항공/로봇/SpaceX+xAI/방산은 기사 풀이 적어 완화
  rescoredNews = rescoredNews.filter(item => {
    const trust = getSourceTrustScore(item.source || "");

    if (theme.name === "우주항공") {
    if (trust >= 4) return true;
    return (item.score || 0) >= 50;
  }

  if (trust >= 4) return true;
  return (item.score || 0) >= 65;
});
}

    const stockPool = [
      ...(theme.coreStocks || []),
      ...(theme.candidateStocks || []),
      ...getExtraCandidatePool(theme.name)
    ];

    const perStockLimitMap = {
      "바이오": 2,
      "전력": 2,
      "원전": 2,
      "방산": 2,
      "반도체": 2,
      "우주항공": 2,
      "로봇": 2,
      "SpaceX+xAI": 2
    };

    const perStockLimit = perStockLimitMap[theme.name] || 3;

    // 1차: 정상 점수 기사
    let selected = rescoredNews.filter(item => item.score > 0);

    // 2차: targetCount보다 적으면 컷 완화
    if (selected.length < targetCount) {
      selected = rescoredNews.filter(item => item.score >= -5);
    }

    // 3차: 우주항공/방산은 완화 재시도
    if (selected.length < targetCount && (theme.name === "방산")) {
      rescoredNews = dedupeNews(news)
        .filter(item => !shouldExcludeNews(item.title || "", theme.name))
        .map(item => ({
          ...item,
          score: buildNewsScore(item, theme)
        }));

      selected = rescoredNews.filter(item => item.score >= -8);
    }

    // 4차: 그래도 적으면 필터 통과 기사 전부 허용
    if (selected.length < targetCount) {
      selected = rescoredNews;
    }

    const rankedNews = sortNewsByScore(selected);
    const limitedNews = limitNewsPerStock(rankedNews, stockPool, perStockLimit, targetCount * 3);

    // 노출은 메이저 언론사 우선 + 점수 + 최신성
    let displayNews = sortNewsForDisplay(limitedNews);

    // ===== targetCount까지 실제 채움 =====
    // ===== targetCount까지 실제 채움 =====
if (displayNews.length < targetCount) {
  const fillPool = sortNewsForDisplay(
    dedupeNews(news).filter(item => {
      if (displayNews.some(x => x.title === item.title)) return false;
      if (shouldExcludeNews(item.title || "", theme.name)) return false;

      const trust = getSourceTrustScore(item.source || "");
      if (trust <= -25) return false;

      return true;
    })
  );

  displayNews = [...displayNews, ...fillPool]
    .filter((item, idx, arr) => arr.findIndex(x => x.title === item.title) === idx);
}

    return displayNews.slice(0, targetCount);
  } catch (error) {
    console.error(`뉴스 로드 실패: ${theme.name}`, error.message);
    return [];
  }
}

// ===================== 종목 / 브리핑 =====================

function analyzeTheme(themeName) {
  return THEME_SIGNALS[themeName] || {
    label: "📌 점검",
    className: "mid",
    insight: `${themeName} 뉴스 흐름 점검 필요`
  };
}

function extractStockMentions(news = [], stockPool = []) {
  const counts = {};
  for (const stock of stockPool) counts[stock] = 0;

  for (const item of ensureNewsArray(news)) {
    const text = `${item.title || ""} ${item.description || ""}`;
    for (const stock of stockPool) {
      if (text.includes(stock)) counts[stock] = (counts[stock] || 0) + 1;
    }
  }

  return counts;
}

function pickCoreStocks(theme, news = []) {
  const pool = [...(theme.coreStocks || [])];
  const counts = extractStockMentions(news, pool);

  return [...pool]
    .sort((a, b) => (counts[b] || 0) - (counts[a] || 0))
    .slice(0, 4);
}

function getAutoCandidateStocks(counts = {}, excludedStocks = [], minCount = 2) {
  return Object.entries(counts)
    .filter(([stock, count]) => count >= minCount && !excludedStocks.includes(stock))
    .sort((a, b) => b[1] - a[1])
    .map(([stock]) => stock)
    .slice(0, 3);
}

function nominalizeArray(arr = []) {
  return arr.map(text =>
    String(text || "")
      .replace(/합니다\./g, "중요")
      .replace(/입니다\./g, "핵심")
      .replace(/됩니다\./g, "가능")
      .trim()
  );
}

function generateStaticBrief(themeName) {
  const staticMap = {
    "반도체": [
      "반도체는 핵심 재료 강도와 지속성 중심 점검",
      "실제 계약·수주보다 장비·소부장 확산 여부 확인",
      "AI·HBM 이후 후공정·패키징 확산 여부 체크"
    ],
    "원전": [
      "원전은 정책보다 실수주와 공급 연결 여부 핵심",
      "기대감보다 실제 계약·기자재 공급 기사 확인",
      "단순 정책 헤드라인보다 수주 확대 여부 점검"
    ],
    "전력": [
      "전력은 설계·수주 기사 비중이 높을수록 강도 우위",
      "실제 계약과 송배전 확산 여부 확인",
      "데이터센터 수요의 변압기·송배전 확산 여부 점검"
    ],
    "로봇": [
      "로봇은 기대감보다 실제 도입·자동화 기사 비중 중요",
      "실제 계약·생산 연결 여부 확인",
      "단순 테마보다 실사용 기사 확대 여부 점검"
    ],
    "바이오": [
      "바이오는 임상·허가·기술수출 같은 실재료 핵심",
      "실제 이벤트 질과 연속성 확인",
      "기대감보다 허가·임상 단계 진전 여부 점검"
    ],
    "우주항공": [
      "우주항공은 국가 프로젝트보다 실수혜 연결이 중요",
      "발사·공급·개발 기사 비중 확인",
      "단순 테마보다 실계약 기사 확대 여부 점검"
    ],
    "SpaceX+xAI": [
      "SpaceX+xAI는 실연결 구조 검증이 우선",
      "해외 헤드라인보다 국내 연결 여부 확인",
      "단순 기대감보다 실질 수혜 기사 비중 점검"
    ],
    "방산": [
      "방산은 실제 계약·수출 기사 비중이 높을수록 강도 우위",
      "지정학 헤드라인보다 공급 계약 확인",
      "실제 수출·납품 기사 확대 여부 점검"
    ]
  };

  return staticMap[themeName] || [
    `${themeName} 뉴스 흐름 점검 필요`,
    "실질 재료 연결 여부 확인",
    "단순 기대감 기사보다 실제 기사 비중 점검"
  ];
}

function generateDynamicBrief(theme, news = []) {
  if (!news.length) return generateStaticBrief(theme.name);

  const titles = news.map(item => safeText(item.title));
  const hardCount = titles.filter(t => ["계약", "수주", "공급", "납품", "양산", "수출"].some(k => t.includes(safeText(k)))).length;
  const policyCount = titles.filter(t => ["정책", "정부", "예산", "지원", "로드맵"].some(k => t.includes(safeText(k)))).length;
  const expectationCount = titles.filter(t => ["기대", "전망", "관련주", "수혜", "mou", "추진"].some(k => t.includes(safeText(k)))).length;

  let lines = generateStaticBrief(theme.name);

  if (theme.name === "반도체") {
    if (hardCount >= 2) {
      lines = [
        "반도체는 핵심 재료 강도와 지속성 중심 점검",
        "실제 계약·수주 기사 비중 높아 강도 우위",
        "대형주 이후 장비·소부장 확산 여부 확인"
      ];
    }
  } else if (theme.name === "원전") {
    if (hardCount >= 2) {
      lines = [
        "원전은 실계약·수주 기사 비중 높아 강도 우위",
        "실제 계약과 공급 연결 여부 확인",
        "단순 정책 기대보다 수주 확대 여부 점검"
      ];
    }
  } else if (theme.name === "전력") {
    if (hardCount >= 2) {
      lines = [
        "전력은 설계·수주 기사 비중이 높아 강도 우위",
        "실제 계약과 송배전 연결 여부 확인",
        "데이터센터 수요의 변압기·송배전 확산 여부 점검"
      ];
    }
  } else if (theme.name === "로봇") {
    if (expectationCount >= 2) {
      lines = [
        "로봇은 기대감 기사 비중 높아 추격보다 확인 우선",
        "실제 도입·자동화 연결 여부 확인",
        "단순 테마보다 실도입 기사 확대 여부 점검"
      ];
    }
  } else if (theme.name === "바이오") {
    if (hardCount >= 2) {
      lines = [
        "바이오는 실계약·기술수출 기사 비중 높아 강도 우위",
        "임상·허가 진행 연속성 확인",
        "기대감보다 실재료 기사 질 점검"
      ];
    }
  } else if (theme.name === "우주항공") {
    lines = [
      "우주항공은 핵심 재료 강도와 지속성 중심 점검",
      "실제 발사·공급·개발 연결 여부 확인",
      "단순 테마보다 실계약 기사 확대 여부 점검"
    ];
  } else if (theme.name === "SpaceX+xAI") {
    lines = [
      "SpaceX+xAI는 기대감 기사 비중 높아 추격보다 확인 우선",
      "실제 국내 연결 여부 확인",
      "단순 테마보다 실질 수혜 기사 비중 점검"
    ];
  } else if (theme.name === "방산") {
    if (hardCount >= 2) {
      lines = [
        "방산은 실계약·수출 기사 비중 높아 강도 우위",
        "실제 공급·납품 연결 여부 확인",
        "지정학 헤드라인보다 수출 계약 기사 비중 점검"
      ];
    }
  }

  if (policyCount >= 2 && hardCount === 0) {
    lines[0] = `${theme.name}는 정책 기대보다 실수혜 연결 여부 핵심`;
  }

  return nominalizeArray(lines);
}

// ===================== 핵심뉴스 =====================

function debugTop(news, label = "DEBUG") {
  console.log(`\n==== ${label} ====`);
  ensureNewsArray(news).slice(0, 10).forEach((n, i) => {
    console.log(`${i + 1}. [${n.score || 0}] [${n.source || "-"}] ${n.title}`);
  });
}

function pickTopCoreNews(newsList = [], limit = 7) {
  const selected = [];
  const sourceCount = {};
  const themeCount = {};

  for (const item of newsList) {
    const source = item.source || "출처미상";
    const theme = item.themeName || "기타";

    if ((sourceCount[source] || 0) >= 2) continue;
    if ((themeCount[theme] || 0) >= 2) continue;

    const duplicated = selected.some(existing =>
      headlineSimilarity(existing.title, item.title) >= 0.68
    );
    if (duplicated) continue;

    selected.push(item);
    sourceCount[source] = (sourceCount[source] || 0) + 1;
    themeCount[theme] = (themeCount[theme] || 0) + 1;

    if (selected.length >= limit) break;
  }

  return selected;
}

function sortNewsByTime(news = []) {
  return [...ensureNewsArray(news)].sort((a, b) => {
    const aTime = new Date(a.pubDate || 0).getTime();
    const bTime = new Date(b.pubDate || 0).getTime();
    return bTime - aTime;
  });
}

function buildTopNewsFromThemes(themeResults = [], limit = 7) {
  const merged = themeResults.flatMap(result => {
    const themeName = result.theme?.name || "";
    const news = ensureNewsArray(result.news);

    return news.map(item => ({
      ...item,
      themeName,
      score: typeof item.score === "number"
        ? item.score
        : buildNewsScore(item, result.theme || {})
    }));
  });

  const validNews = merged
    .filter(item => item && item.title)
    .filter(item => !shouldExcludeNews(item.title, item.themeName))
    .filter(item => (item.score || 0) > 30)
    .filter(item => getSourceTrustScore(item.source || "") > -12 || (item.score || 0) >= 50);

  const ranked = sortNewsByScore(validNews);
  const selected = pickTopCoreNews(ranked, limit);

  debugTop(selected, "오늘 핵심뉴스 TOP");

  return {
    mustRead: selected.slice(0, 3),
    extra: selected.slice(3, limit),
    full: selected
  };
}

// ===================== TOP5 =====================

function scoreStockFromNews(stockName = "", newsList = [], theme = {}) {
  let score = 0;
  let mentionCount = 0;
  let hardNewsCount = 0;
  let topArticle = null;

  for (const article of ensureNewsArray(newsList)) {
    const text = `${article.title || ""} ${article.description || ""}`;
    const articleScore = article.score || 0;

    if (text.includes(stockName)) {
      mentionCount += 1;
      score += 8;
      score += Math.max(0, Math.floor(articleScore / 8));

      const hardHit = countKeywordHits(text, HARD_KEYWORDS);
      if (hardHit > 0) {
        hardNewsCount += 1;
        score += hardHit * 4;
      }

      if (!topArticle || articleScore > (topArticle.score || 0)) {
        topArticle = article;
      }
    }
  }

  // 핵심 종목 가점
  if ((theme.coreStocks || []).includes(stockName)) score += 12;

  // 후보 종목 가점
  if ((theme.candidateStocks || []).includes(stockName)) score += 4;

  // 직접 언급이 없어도 섹터 뉴스가 충분하면 최소 점수 부여
  if (mentionCount === 0 && ensureNewsArray(newsList).length >= 5) {
    const avgScore =
      ensureNewsArray(newsList).reduce((acc, item) => acc + (item.score || 0), 0) /
      Math.max(1, ensureNewsArray(newsList).length);

    score += Math.floor(avgScore / 6);
  }

  if (mentionCount === 1) score -= 1;

  return {
    stock: stockName,
    themeName: theme.name || "",
    score,
    mentionCount,
    hardNewsCount,
    topArticle
  };
}

function getTopPickTag(pick) {
  if ((pick.hardNewsCount || 0) >= 2) return "계약 강도";
  if ((pick.mentionCount || 0) >= 3) return "반복 언급";
  if ((pick.topArticle?.score || 0) >= 55) return "핵심뉴스";
  if (pick.themeName === "반도체") return "대형주 중심";
  if (pick.themeName === "전력") return "수요 연결";
  if (pick.themeName === "원전") return "정책 기대";
  if (pick.themeName === "방산") return "계약 강도";
  if (pick.themeName === "바이오") return "이벤트 중심";
  if (pick.themeName === "우주항공") return "뉴스 점검";
  if (pick.themeName === "로봇") return "기대감 구간";
  if (pick.themeName === "SpaceX+xAI") return "테마성 접근";
  return "기사 언급";
}

function mapTagToSignal(tag = "") {
  const map = {
    "계약 강도": { label: "🛡 계약 강도", className: "strong" },
    "반복 언급": { label: "📌 대형주 중심", className: "mid" },
    "핵심뉴스": { label: "⚡ 수요 연결", className: "strong" },
    "대형주 중심": { label: "📌 대형주 중심", className: "mid" },
    "수요 연결": { label: "⚡ 수요 연결", className: "strong" },
    "정책 기대": { label: "⚠️ 정책 기대", className: "mid" },
    "이벤트 중심": { label: "🧬 이벤트 중심", className: "mid" },
    "뉴스 점검": { label: "🚀 뉴스 점검", className: "mid" },
    "기대감 구간": { label: "🤖 기대감 구간", className: "mid" },
    "테마성 접근": { label: "🌐 테마성 접근", className: "mid" }
  };

  return map[tag] || { label: "📌 점검", className: "mid" };
}

function debugTopPicks(picks = []) {
  console.log(`\n==== 오늘 관심 종목 TOP5 ====`);
  picks.forEach((pick, i) => {
    console.log(`${i + 1}. [${pick.rawScore}] [${pick.theme}] ${pick.stock} | mentions=${pick.mentionCount} | hard=${pick.hardNewsCount}`);
  });
}

function buildTopPickCandidates(themeResults = [], limit = 5) {
  const allPicks = [];

  for (const result of themeResults) {
    const theme = result.theme || {};
    const news = ensureNewsArray(result.news);

    const stockPool = [
      ...(result.coreStocks || []),
      ...(result.candidateStocks || []),
      ...(result.autoDetectedStocks || []),
      ...getExtraCandidatePool(theme.name || "")
    ].filter(Boolean);

    const uniqueStockPool = [...new Set(stockPool)];

    for (const stockName of uniqueStockPool) {
      const pick = scoreStockFromNews(stockName, news, theme);

      if (pick.score >= -2) {
        const tag = getTopPickTag(pick);

        allPicks.push({
          stock: pick.stock,
          theme: pick.themeName,
          signal: mapTagToSignal(tag),
          reason: `${pick.themeName} ${pick.stock} 관련 강도 상대 우위`,
          rawScore: pick.score,
          mentionCount: pick.mentionCount,
          hardNewsCount: pick.hardNewsCount,
          articleTitle: pick.topArticle?.title || "",
          articleSource: pick.topArticle?.source || ""
        });
      }
    }
  }

  const ranked = allPicks.sort((a, b) => {
    if (b.rawScore !== a.rawScore) return b.rawScore - a.rawScore;
    if ((b.hardNewsCount || 0) !== (a.hardNewsCount || 0)) {
      return (b.hardNewsCount || 0) - (a.hardNewsCount || 0);
    }
    return (b.mentionCount || 0) - (a.mentionCount || 0);
  });

  const selected = [];
  const themeCount = {};

  // 1차: 섹터당 2개 제한
  for (const item of ranked) {
    if (selected.some(x => x.stock === item.stock)) continue;
    if ((themeCount[item.theme] || 0) >= 2) continue;

    selected.push(item);
    themeCount[item.theme] = (themeCount[item.theme] || 0) + 1;

    if (selected.length >= limit) break;
  }

  // 2차: 아직 부족하면 섹터 제한 완화
  if (selected.length < limit) {
    for (const item of ranked) {
      if (selected.some(x => x.stock === item.stock)) continue;
      selected.push(item);
      if (selected.length >= limit) break;
    }
  }

  // 3차: 그래도 부족하면 각 섹터 핵심주 1순위로 채움
  if (selected.length < limit) {
    for (const result of themeResults) {
      const theme = result.theme || {};
      const fallbackStock = (result.coreStocks || [])[0];

      if (!fallbackStock) continue;
      if (selected.some(x => x.stock === fallbackStock)) continue;

      selected.push({
        stock: fallbackStock,
        theme: theme.name || "",
        signal: mapTagToSignal("대형주 중심"),
        reason: `${theme.name} 핵심 종목 기본 반영`,
        rawScore: 1,
        mentionCount: 0,
        hardNewsCount: 0,
        articleTitle: "",
        articleSource: ""
      });

      if (selected.length >= limit) break;
    }
  }

  debugTopPicks(selected);

  return selected.slice(0, limit);
}

// ===================== 최종 조립 =====================

async function buildBriefing() {
  const results = [];

  for (const theme of THEMES) {
    const news = await fetchThemeNews(theme, 10);
    console.log(`[${theme.name}] news count:`, news.length);

    const signal = analyzeTheme(theme.name);
    const coreStocks = pickCoreStocks(theme, news);
    const baseCandidateStocks = [...(theme.candidateStocks || [])];

    let autoCandidates = [];
    const stockPool = [
  ...(theme.coreStocks || []),
  ...(theme.candidateStocks || []),
  ...getExtraCandidatePool(theme.name)
];

    if (stockPool.length > 0) {
      const counts = extractStockMentions(news, stockPool);

      const minCountMap = {
        "바이오": 1,
        "SpaceX+xAI": 1,
        "로봇": 1,
        "우주항공": 1
      };
      const minCount = minCountMap[theme.name] || 2;

      autoCandidates = getAutoCandidateStocks(
        counts,
        [...coreStocks, ...baseCandidateStocks],
        minCount
      );

      console.log(`${theme.name} counts:`, counts);
      console.log(`${theme.name} autoCandidates:`, autoCandidates);
    }

    const autoDetectedSet = new Set(autoCandidates);

    const candidateStocks = [...new Set([
      ...baseCandidateStocks,
      ...autoCandidates
    ])].slice(0, 7);

    const briefing = USE_DYNAMIC_BRIEFING
      ? generateDynamicBrief(theme, news)
      : generateStaticBrief(theme.name);

    console.log(`[${theme.name}] briefing:`, briefing);

    results.push({
      theme,
      news,
      signal,
      coreStocks,
      candidateStocks,
      autoCandidates,
      autoDetectedStocks: [...autoDetectedSet],
      briefing
    });

    await sleep(250);
  }

  const topNewsBundle = buildTopNewsFromThemes(results, 7);

  return {
    updatedAt: formatDateToIso(new Date()),
    sourceMode: "quality-first",
    themeResults: results,
    topNews: topNewsBundle.full,
    topNewsMustRead: topNewsBundle.mustRead,
    topNewsExtra: topNewsBundle.extra,
    topPicks: buildTopPickCandidates(results)
  };
}

// ===================== 서버 =====================

app.use(express.static(path.join(__dirname, "public")));

const STATS_FILE = path.join(__dirname, "stats.json");
const KST_TIMEZONE = "Asia/Seoul";

function getKSTDateString() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: KST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(now); // YYYY-MM-DD 형식
}

function createDefaultStats() {
  return {
    totalViews: 0,
    totalVisitors: 0,
    daily: {
      date: getKSTDateString(),
      views: 0,
      visitors: 0,
    },
    visitorIds: []
  };
}

function loadStats() {
  try {
    if (!fs.existsSync(STATS_FILE)) {
      const initialData = createDefaultStats();
      fs.writeFileSync(STATS_FILE, JSON.stringify(initialData, null, 2), "utf8");
      return initialData;
    }

    const raw = fs.readFileSync(STATS_FILE, "utf8");
    const parsed = JSON.parse(raw);

    // 기본값 보정
    if (!parsed.daily) {
      parsed.daily = {
        date: getKSTDateString(),
        views: 0,
        visitors: 0,
      };
    }

    if (!Array.isArray(parsed.visitorIds)) {
      parsed.visitorIds = [];
    }

    return parsed;
  } catch (error) {
    console.error("통계 파일 로드 오류:", error);
    return createDefaultStats();
  }
}

function saveStats(stats) {
  try {
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), "utf8");
  } catch (error) {
    console.error("통계 파일 저장 오류:", error);
  }
}

function resetDailyIfNeeded(stats) {
  const today = getKSTDateString();

  if (stats.daily.date !== today) {
    stats.daily = {
      date: today,
      views: 0,
      visitors: 0,
    };
  }

  return stats;
}

app.post("/api/stats/track", (req, res) => {
  try {
    const { visitorId } = req.body || {};

    if (!visitorId) {
      return res.status(400).json({
        success: false,
        message: "visitorId가 필요합니다.",
      });
    }

    const stats = resetDailyIfNeeded(loadStats());

    // 조회수는 페이지 열릴 때마다 증가
    stats.totalViews += 1;
    stats.daily.views += 1;

    // 전체 방문자 수: 처음 본 visitorId만 증가
    if (!stats.visitorIds.includes(visitorId)) {
      stats.visitorIds.push(visitorId);
      stats.totalVisitors += 1;
    }

    // 오늘 방문자 수: 오늘 처음 들어온 visitorId만 증가
    const todayVisitorKey = `todayVisitors_${stats.daily.date}`;
    if (!stats[todayVisitorKey]) {
      stats[todayVisitorKey] = [];
    }

    if (!stats[todayVisitorKey].includes(visitorId)) {
      stats[todayVisitorKey].push(visitorId);
      stats.daily.visitors += 1;
    }

    saveStats(stats);

    return res.json({
      success: true,
      stats: {
        totalViews: stats.totalViews,
        todayViews: stats.daily.views,
        totalVisitors: stats.totalVisitors,
        todayVisitors: stats.daily.visitors,
      },
    });
  } catch (error) {
    console.error("통계 track 오류:", error);
    return res.status(500).json({
      success: false,
      message: "통계 처리 중 오류가 발생했습니다.",
    });
  }
});

app.get("/api/stats", (req, res) => {
  try {
    const stats = resetDailyIfNeeded(loadStats());
    saveStats(stats);

    return res.json({
      success: true,
      stats: {
        totalViews: stats.totalViews,
        todayViews: stats.daily.views,
        totalVisitors: stats.totalVisitors,
        todayVisitors: stats.daily.visitors,
      },
    });
  } catch (error) {
    console.error("통계 조회 오류:", error);
    return res.status(500).json({
      success: false,
      message: "통계 조회 중 오류가 발생했습니다.",
    });
  }
});

app.get("/api/briefing", async (req, res) => {
  try {
    const now = Date.now();
    const force = req.query.force === "1";

    if (!force && cache.payload && cache.updatedAt && (now - cache.updatedAt < CACHE_TTL_MS)) {
      return res.json({
        ok: true,
        cached: true,
        stale: false,
        ...cache.payload
      });
    }

    const payload = await buildBriefing();

    cache = {
      updatedAt: now,
      payload
    };

    return res.json({
      ok: true,
      cached: false,
      stale: false,
      ...payload
    });
  } catch (error) {
    console.error("브리핑 생성 실패:", error);

    if (cache.payload) {
      return res.status(200).json({
        ok: true,
        cached: true,
        stale: true,
        ...cache.payload
      });
    }

    return res.status(500).json({
      ok: false,
      message: "브리핑 생성 실패"
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});