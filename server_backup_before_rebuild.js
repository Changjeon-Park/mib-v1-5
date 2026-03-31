const express = require("express");
const path = require("path");
const RSSParser = require("rss-parser");

const app = express();
const parser = new RSSParser({
  timeout: 15000,
  customFields: {
    item: ["media:content", "description"]
  }
});

const PORT = process.env.PORT || 10001;

let cache = {
  updatedAt: 0,
  payload: null
};

const USE_DYNAMIC_BRIEFING = true;

// ===================== 테마 정의 =====================

const themes = [
  {
    name: "반도체",
    query: "반도체 HBM 패키징 후공정 AI칩",
    fallbackQuery: "반도체 HBM TC본더 패키징",
    coreStocks: ["삼성전자", "SK하이닉스", "한미반도체", "리노공업"],
    candidateStocks: ["ISC", "테크윙", "이오테크닉스", "하나마이크론", "솔브레인"]
  },
  {
    name: "원전",
    query: "원전 SMR 수주 원자력 기자재",
    fallbackQuery: "원전 SMR 한수원 수출",
    coreStocks: ["두산에너빌리티", "한전기술", "한국전력", "비에이치아이"],
    candidateStocks: ["보성파워텍", "일진파워", "우진", "우리기술"]
  },
  {
    name: "전력",
    query: "전력 변압기 송배전 전선 데이터센터",
    fallbackQuery: "변압기 전선 전력기기 데이터센터",
    coreStocks: ["LS ELECTRIC", "HD현대일렉트릭", "효성중공업", "제룡전기"],
    candidateStocks: ["가온전선", "대한전선", "일진전기", "광명전기"]
  },
  {
    name: "로봇",
    query: "로봇 휴머노이드 자동화 협동로봇",
    fallbackQuery: "휴머노이드 로봇 자동화",
    coreStocks: ["두산로보틱스", "레인보우로보틱스", "현대로템", "현대오토에버"],
    candidateStocks: ["로보티즈", "뉴로메카", "현대무벡스", "삼익THK", "LG이노텍"]
  },
  {
    name: "바이오",
    query: "바이오 임상 허가 신약 기술수출",
    fallbackQuery: "바이오 임상 FDA 기술수출",
    coreStocks: ["셀트리온", "삼성바이오로직스", "알테오젠", "유한양행"],
    candidateStocks: ["에이비엘바이오", "에이프릴바이오", "파마리서치", "리가켐바이오", "펩트론", "에스티팜"]
  },
  {
    name: "우주항공",
    query: "우주항공 위성 발사체 항공우주",
    fallbackQuery: "위성 발사체 우주항공",
    coreStocks: ["한화에어로스페이스", "쎄트렉아이", "컨텍", "한국항공우주"],
    candidateStocks: ["제노코", "켄코아에어로스페이스", "루미르", "AP위성"]
  },
  {
    name: "SpaceX+xAI",
    query: "SpaceX xAI 스타링크 AI 데이터센터 머스크",
    fallbackQuery: "SpaceX xAI 스타링크",
    coreStocks: ["인텔리안테크", "쎄트렉아이", "AP위성"],
    candidateStocks: ["쏠리드", "에치에프알", "센서뷰", "오이솔루션", "케이엠더블유"]
  },
  {
    name: "방산",
    query: "방산 수주 수출 KF-21 미사일 국방",
    fallbackQuery: "방산 수출 계약 KF-21",
    coreStocks: ["한화에어로스페이스", "현대로템", "LIG넥스원", "풍산"],
    candidateStocks: ["빅텍", "스페코", "퍼스텍", "휴니드"]
  }
];

const THEME_SIGNALS = {
  "반도체": { label: "📌 대형주 중심", className: "mid", insight: "반도체는 대형주보다 장비·소부장 확산 여부가 핵심" },
  "원전": { label: "⚠️ 정책 기대", className: "mid", insight: "원전은 정책 기대보다 실제 수주 연결 여부가 핵심" },
  "전력": { label: "⚡ 수요 연결", className: "strong", insight: "전력은 데이터센터 수요의 변압기·송배전 확산 여부가 핵심" },
  "로봇": { label: "🤖 기대감 구간", className: "mid", insight: "로봇은 테마 확산보다 실도입 기사 비중 확인이 중요" },
  "바이오": { label: "🧬 이벤트 중심", className: "mid", insight: "바이오는 임상·허가·기술수출 같은 실재료가 핵심" },
  "우주항공": { label: "🚀 뉴스 점검", className: "mid", insight: "우주항공은 국가 프로젝트보다 실제 연결 종목 압축이 중요" },
  "SpaceX+xAI": { label: "🌐 테마성 접근", className: "mid", insight: "SpaceX+xAI는 실연결고리 확인이 핵심" },
  "방산": { label: "🛡 계약 강도", className: "strong", insight: "방산은 지정학보다 실제 계약·수출 기사 비중이 핵심" }
};

// ===================== 키워드 / 소스 =====================

const GLOBAL_EXCLUDE_KEYWORDS = [
  "부고", "인사", "칼럼", "사설", "오피니언", "인터뷰",
  "포토", "화보", "영상", "만평", "오늘의 운세"
];

const BLOCKED_KEYWORDS = [
  "안산시", "안산시장", "안산",
  "대학교", "대학", "교수", "학과", "캠퍼스", "학생",
  "총장", "산학협력", "대학원", "논문", "입시", "수시", "정시"
];

const EXCLUDE_BY_THEME = {
  "우주항공": ["야구", "축구", "연예", "드라마"],
  "방산": ["정치 공방", "지지율"],
  "로봇": ["반려로봇 장난감"]
};

const NOISE_KEYWORDS = [
  "특징주", "급등", "급락", "상한가", "하한가",
  "수혜주", "관련주", "테마주", "왜 오르나", "왜 떨어지나",
  "주목", "기대감", "추천", "목표가", "매수", "매도",
  "전망", "상승", "하락", "강세", "약세", "들썩", "술렁"
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
  "디지털타임스", "헤럴드경제"
];

const TRUST_MID_SOURCES = [
  "데일리안", "아이뉴스24", "지디넷코리아", "ZDNet Korea",
  "더벨", "헬로티", "에너지경제", "약업신문",
  "메디파나뉴스", "바이오타임즈", "디일렉", "thelec", "더엘렉"
];

const TRUST_LOW_SOURCES = [
  "핀포인트뉴스", "청년일보", "신아일보",
  "네이트", "브릿지경제", "비욘드포스트",
  "이코노뉴스", "잡포스트", "프라임경제"
];

const foreignOnlyKeywords = [
  "엔비디아", "nvidia", "tesla", "테슬라", "spacex", "xai",
  "openai", "마이크로소프트", "microsoft", "amazon", "구글", "google",
  "meta", "애플", "apple", "tsmc", "asml", "intel"
];

const domesticLinkedKeywords = [
  "삼성", "sk", "한화", "현대", "lg", "셀트리온",
  "두산", "한국", "국내", "수출", "공급", "납품"
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

function countKeywordHits(text = "", keywords = []) {
  const normalized = safeText(text);
  return keywords.reduce((acc, keyword) => {
    return normalized.includes(safeText(keyword)) ? acc + 1 : acc;
  }, 0);
}

function formatDateToIso(date) {
  return new Date(date).toISOString();
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
  const diff = Date.now() - time;
  return diff <= days * 24 * 60 * 60 * 1000;
}

// ===================== 필터 =====================

function isLowValueNews(title = "") {
  const text = safeText(title);
  return GLOBAL_EXCLUDE_KEYWORDS.some(k => text.includes(safeText(k)));
}

function isForeignOnlyNews(title = "", themeName = "") {
  const text = safeText(title);

  if (themeName === "SpaceX+xAI") return false;

  const hasForeign = foreignOnlyKeywords.some(k => text.includes(safeText(k)));
  const hasDomestic = domesticLinkedKeywords.some(k => text.includes(safeText(k)));

  if (!hasForeign) return false;
  if (hasDomestic) return false;

  return true;
}

function shouldExcludeNews(title = "", themeName = "") {
  const text = safeText(title);

  const globalExclude = [
    ...GLOBAL_EXCLUDE_KEYWORDS,
    ...BLOCKED_KEYWORDS
  ].map(safeText);

  if (globalExclude.some(k => text.includes(k))) return true;

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
    "기자재", "엔진", "발사", "위성", "전투기", "미사일"
  ];

  return businessKeywords.some(k => text.includes(safeText(k)));
}

// ===================== 점수 =====================

function getSourceTrustScore(source = "") {
  const s = safeText(source);
  if (!s) return 0;
  if (TRUST_HIGH_SOURCES.some(name => s.includes(safeText(name)))) return 30;
  if (TRUST_MID_SOURCES.some(name => s.includes(safeText(name)))) return 18;
  if (TRUST_LOW_SOURCES.some(name => s.includes(safeText(name)))) return -12;
  return 8;
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

function themeRelevanceScore(title = "", theme = {}) {
  const text = safeText(title);
  let score = 0;

  const themeKeywordMap = {
    "반도체": ["반도체", "hbm", "파운드리", "후공정", "패키징", "tc본더", "cxl"],
    "원전": ["원전", "원자력", "smr", "체코", "기자재"],
    "전력": ["전력", "변압기", "송배전", "전선", "ess", "데이터센터"],
    "로봇": ["로봇", "휴머노이드", "자동화", "협동로봇"],
    "바이오": ["바이오", "신약", "임상", "fda", "기술수출", "cdmo"],
    "우주항공": ["우주", "항공", "위성", "발사체", "누리호"],
    "SpaceX+xAI": ["spacex", "xai", "스타링크", "저궤도", "ai 데이터센터"],
    "방산": ["방산", "국방", "미사일", "탄약", "수출", "무기체계", "kf-21"]
  };

  const keywords = themeKeywordMap[theme.name] || [];
  for (const keyword of keywords) {
    if (text.includes(safeText(keyword))) score += 2;
  }

  const stockKeywords = [...(theme.coreStocks || []), ...(theme.candidateStocks || [])];
  for (const stock of stockKeywords) {
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
  score += getSourceTrustScore(source);
  score += getRecencyScore(pubDate);
  score += getHardNewsScore(title, description);
  score += getNoisePenalty(title);
  score += getTitleQualityPenalty(title);
  score += getNumberSignalScore(title, description);
  score += themeRelevanceScore(title, theme);

  if (title.includes("?")) score -= 6;
  if (title.includes("...")) score -= 2;

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

function limitNewsPerStock(news = [], stockPool = [], maxPerStock = 3, totalLimit = 10) {
  const stockCounts = {};
  const result = [];

  for (const item of news) {
    const title = item.title || "";
    const matchedStock = stockPool.find(stock => title.includes(stock));

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
    const source = extractSource(item);
    const pubDate = item.pubDate || item.isoDate || "";

    return {
      title: cleanTitle(rawTitle),
      link: item.link || "#",
      source,
      pubDate,
      description: item.description || ""
    };
  });

  const recentOnly = items.filter(item => isRecentNews(item.pubDate, 7));
  const base = recentOnly.length ? recentOnly : items;

  const filteredBase = base.filter(item => {
    if (isLowValueNews(item.title)) return false;
    if (isForeignOnlyNews(item.title, theme?.name || "")) return false;
    return true;
  });

  const finalRawBase = filteredBase.length ? filteredBase : base;
  const relevant = finalRawBase.filter(item => !shouldExcludeNews(item.title, theme?.name || ""));
  const finalBase = relevant.length ? relevant : finalRawBase;

  const rescored = dedupeNews(finalBase).map(item => ({
    ...item,
    score: buildNewsScore(item, theme || {})
  }));

  return sortNewsByScore(rescored);
}

async function fetchThemeNews(theme, count = 10) {
  try {
    let news = ensureNewsArray(await parseGoogleNews(theme.query, theme));

    if (news.length < 3 && theme.fallbackQuery) {
      const fallbackNews = ensureNewsArray(await parseGoogleNews(theme.fallbackQuery, theme));
      news = dedupeNews([...news, ...fallbackNews]);
    }

    const filteredNews = dedupeNews(news).filter(item => {
      const title = item.title || "";
      if (shouldExcludeNews(title, theme.name)) return false;
      if ((theme.name === "우주항공" || theme.name === "방산") && !shouldKeepBusinessNews(title, theme.name)) {
        return false;
      }
      return true;
    });

    const rescoredNews = filteredNews
      .map(item => ({
        ...item,
        score: buildNewsScore(item, theme)
      }))
      .filter(item => item.score > 0);

    const stockPool = [...(theme.coreStocks || []), ...(theme.candidateStocks || [])];
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
    const rankedNews = sortNewsByScore(rescoredNews);
    const limitedNews = limitNewsPerStock(rankedNews, stockPool, perStockLimit, count * 2);

    return limitedNews.slice(0, count);
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
    insight: `${themeName}는 오늘 뉴스 흐름 점검이 필요합니다.`
  };
}

function pickCoreStocks(theme, news = []) {
  const pool = [...(theme.coreStocks || [])];
  const counts = extractStockMentions(news, pool);

  const sorted = [...pool].sort((a, b) => (counts[b] || 0) - (counts[a] || 0));
  return sorted.slice(0, 4);
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

function getAutoCandidateStocks(counts = {}, excludedStocks = [], minCount = 2) {
  return Object.entries(counts)
    .filter(([stock, count]) => count >= minCount && !excludedStocks.includes(stock))
    .sort((a, b) => b[1] - a[1])
    .map(([stock]) => stock)
    .slice(0, 3);
}

function nominalizeSentence(text = "") {
  return String(text || "")
    .replace(/합니다\./g, "중요")
    .replace(/입니다\./g, "핵심")
    .replace(/됩니다\./g, "가능")
    .trim();
}

function nominalizeArray(arr = []) {
  return arr.map(nominalizeSentence);
}

function generateStaticBrief(themeName) {
  return [
    `${themeName}는 핵심 재료의 강도와 지속성을 중심으로 확인`,
    "오늘 뉴스 흐름이 실제 계약·수주·실적과 연결되는지 점검",
    "단순 기대감 기사보다 실질 재료 기사 비중이 높을수록 테마 강도 우위"
  ];
}

function generateDynamicBrief(theme, news = []) {
  if (!news.length) return generateStaticBrief(theme.name);

  const titles = news.map(item => safeText(item.title));
  const contractCount = titles.filter(t => ["수주", "계약", "공급", "납품", "양산", "수출"].some(k => t.includes(safeText(k)))).length;
  const policyCount = titles.filter(t => ["정책", "정부", "예산", "지원", "로드맵"].some(k => t.includes(safeText(k)))).length;
  const expectationCount = titles.filter(t => ["기대", "전망", "관련주", "수혜", "mou", "추진"].some(k => t.includes(safeText(k)))).length;

  let line1 = `${theme.name}는 핵심 재료 강도와 지속성 중심 점검`;
  let line2 = "실제 계약·수주·실적 연결 여부 확인 필요";
  let line3 = "단순 기대감보다 실질 재료 기사 비중 확대 여부 점검";

  if (contractCount >= 2) {
    line1 = `${theme.name}는 실계약·수주 기사 비중이 높아 강도 우위`;
  } else if (policyCount >= 2) {
    line1 = `${theme.name}는 정책 기대보다 실제 수혜 연결 확인 필요`;
  } else if (expectationCount >= 2) {
    line1 = `${theme.name}는 기대감 기사 비중 높아 추격보다 확인 우선`;
  }

  if (theme.name === "반도체") {
    line3 = "대형주 이후 장비·소부장 확산 여부 확인";
  } else if (theme.name === "전력") {
    line3 = "데이터센터 수요의 변압기·송배전 확산 여부 점검";
  } else if (theme.name === "바이오") {
    line3 = "임상·허가·기술수출 같은 실재료 확인";
  } else if (theme.name === "방산") {
    line3 = "지정학 헤드라인보다 실제 수출·공급 계약 비중 점검";
  }

  return nominalizeArray([line1, line2, line3]);
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

function buildTopNewsFromThemes(themeResults = [], limit = 7) {
  const merged = themeResults.flatMap(result => {
    const themeName = result.theme?.name || "";
    const news = ensureNewsArray(result.news);

    return news.map(item => ({
      ...item,
      themeName,
      score: typeof item.score === "number" ? item.score : buildNewsScore(item, result.theme || {})
    }));
  });

  const validNews = merged
    .filter(item => item && item.title)
    .filter(item => !shouldExcludeNews(item.title, item.themeName))
    .filter(item => (item.score || 0) > 25);

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

    if (!text.includes(stockName)) continue;

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

  if ((theme.coreStocks || []).includes(stockName)) score += 10;
  if (mentionCount === 0) score -= 1000;
  if (mentionCount === 1) score -= 2;

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
  if ((pick.hardNewsCount || 0) >= 2) return "계약/수주";
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
    "계약/수주": { label: "🛡 계약 강도", className: "strong" },
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
    console.log(`${i + 1}. [${pick.score}] [${pick.theme}] ${pick.stock} | mentions=${pick.mentionCount} | hard=${pick.hardNewsCount}`);
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
      ...(result.autoDetectedStocks || [])
    ].filter(Boolean);

    const uniqueStockPool = [...new Set(stockPool)];

    for (const stockName of uniqueStockPool) {
      const pick = scoreStockFromNews(stockName, news, theme);

      if (pick.score > 0) {
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

  const ranked = allPicks.sort((a, b) => b.rawScore - a.rawScore);

  const selected = [];
  const themeCount = {};

  for (const item of ranked) {
    if (selected.some(x => x.stock === item.stock)) continue;
    if ((themeCount[item.theme] || 0) >= 2) continue;

    selected.push(item);
    themeCount[item.theme] = (themeCount[item.theme] || 0) + 1;

    if (selected.length >= limit) break;
  }

  debugTopPicks(selected);
  return selected;
}

// ===================== 최종 조립 =====================

async function buildBriefing() {
  const results = [];

  for (const theme of themes) {
    const news = await fetchThemeNews(theme, 10);
    console.log(`[${theme.name}] news count:`, news.length);

    const signal = analyzeTheme(theme.name);
    const coreStocks = pickCoreStocks(theme, news);
    const baseCandidateStocks = [...(theme.candidateStocks || [])];

    let autoCandidates = [];
    const stockPool = [...(theme.coreStocks || []), ...(theme.candidateStocks || [])];

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

app.get("/api/briefing", async (req, res) => {
  try {
    const now = Date.now();
    const force = req.query.force === "1";

    if (!force && cache.payload && cache.updatedAt && now - cache.updatedAt < 5 * 60 * 1000) {
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