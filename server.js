const express = require("express");
const path = require("path");
const Parser = require("rss-parser");

const app = express();
const parser = new Parser({
  customFields: {
    item: ["source"]
  }
});

const PORT = process.env.PORT || 3000;

const themes = [
  {
    name: "반도체",
    query: "HBM OR AI 반도체 OR 파운드리 OR 삼성전자 OR SK하이닉스 OR 한미반도체",
    fallbackQuery: "반도체 OR 후공정 OR 소부장 OR CXL OR TC본더",
    coreStocks: ["삼성전자", "SK하이닉스", "한미반도체", "리노공업"],
    candidateStocks: ["ISC", "테크윙", "이오테크닉스", "하나마이크론"]
  },
  {
    name: "원전",
    query: "SMR OR 원전 수출 OR 두산에너빌리티 OR 한전기술 OR 한국전력",
    fallbackQuery: "원전 OR 원자력 OR 체코 원전 OR 원전 기자재",
    coreStocks: ["두산에너빌리티", "한전기술", "한국전력", "비에이치아이"],
    candidateStocks: ["보성파워텍", "일진파워", "우진", "우리기술"]
  },
  {
    name: "전력",
    query: "데이터센터 전력 OR AI 전력 수요 OR 변압기 OR LS ELECTRIC OR 효성중공업",
    fallbackQuery: "전력 인프라 OR 송배전 OR 전선 OR ESS",
    coreStocks: ["LS ELECTRIC", "효성중공업", "제룡전기", "HD현대일렉트릭"],
    candidateStocks: ["가온전선", "대한전선", "일진전기", "광명전기"]
  },
  {
    name: "로봇",
    query: "휴머노이드 OR 산업용 로봇 OR 두산로보틱스 OR 레인보우로보틱스",
    fallbackQuery: "로봇 OR 자동화 OR 협동로봇 OR 제조 자동화",
    coreStocks: ["두산로보틱스", "레인보우로보틱스", "로보스타", "유일로보틱스"],
    candidateStocks: ["로보티즈", "뉴로메카", "에브리봇", "삼익THK"]
  },
  {
    name: "바이오",
    query: "임상 3상 OR FDA 승인 OR 기술수출 OR 셀트리온 OR 삼성바이오로직스",
    fallbackQuery: "바이오 OR 신약 OR CDMO OR 항암제 OR 바이오시밀러",
    coreStocks: ["셀트리온", "삼성바이오로직스", "알테오젠", "유한양행"],
    candidateStocks: ["리가켐바이오", "펩트론", "에스티팜", "보로노이"]
  },
  {
    name: "우주항공",
    query: "위성 OR 발사체 OR 우주항공 OR 한화에어로스페이스 OR 쎄트렉아이",
    fallbackQuery: "우주항공 OR 위성 OR 발사체 OR 누리호 OR 저궤도 위성",
    coreStocks: ["한화에어로스페이스", "쎄트렉아이", "컨텍", "한국항공우주"],
    candidateStocks: ["제노코", "켄코아에어로스페이스", "루미르", "AP위성"]
  },
  {
    name: "SpaceX+xAI",
    query: "SpaceX OR 스타링크 OR xAI OR 머스크 OR 나스닥 상장",
    fallbackQuery: "SpaceX OR xAI OR 스타링크 OR 우주 인터넷 OR 머스크",
    coreStocks: ["에이치브이엠", "스피어", "미래에셋증권", "아주IB투자"],
    candidateStocks: ["LB인베스트먼트", "SV인베스트먼트", "TS인베스트먼트", "컴퍼니케이"]
  },
  {
    name: "방산",
    query: "방산 OR 국방 수출 OR 한화에어로스페이스 OR 현대로템 OR LIG넥스원",
    fallbackQuery: "방산 OR 방위산업 OR 무기체계 OR 미사일 OR 탄약",
    coreStocks: ["한화에어로스페이스", "현대로템", "LIG넥스원", "풍산"],
    candidateStocks: ["빅텍", "스페코", "퍼스텍", "휴니드"]
  }
];

const preferredSources = [
  "한국경제", "매일경제", "아주경제", "조선비즈", "머니투데이",
  "연합뉴스", "전자신문", "서울경제", "이데일리", "뉴시스"
];

let cache = {
  updatedAt: null,
  payload: null
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatDateToIso(date) {
  return new Date(date).toISOString();
}

function isRecentNews(pubDate, days = 7) {
  if (!pubDate) return false;
  const date = new Date(pubDate);
  if (Number.isNaN(date.getTime())) return false;

  const now = Date.now();
  const diff = now - date.getTime();
  const limit = days * 24 * 60 * 60 * 1000;
  return diff >= 0 && diff <= limit;
}

function cleanTitle(title) {
  if (!title) return "제목 없음";
  const parts = title.split(" - ");
  if (parts.length > 1) parts.pop();
  return parts.join(" - ").trim();
}

function extractSource(item) {
  if (item.source) {
    if (typeof item.source === "string") return item.source.trim();
    if (typeof item.source === "object" && item.source._) return String(item.source._).trim();
  }

  const title = item.title || "";
  const parts = title.split(" - ");
  if (parts.length > 1) return parts[parts.length - 1].trim();

  return "출처미상";
}

function normalizeText(text) {
  return (text || "").replace(/[^\w가-힣]/g, "").toLowerCase().trim();
}

function sourcePriority(source) {
  const idx = preferredSources.findIndex(name => source.includes(name));
  return idx === -1 ? 0 : preferredSources.length - idx;
}

function headlinePriority(title) {
  let score = 0;

  if (
    title.includes("수주") ||
    title.includes("계약") ||
    title.includes("투자") ||
    title.includes("확대") ||
    title.includes("승인")
  ) score += 3;

  if (
    title.includes("정책") ||
    title.includes("실적") ||
    title.includes("기술") ||
    title.includes("공급")
  ) score += 2;

  if (
    title.includes("지연") ||
    title.includes("감소") ||
    title.includes("하락") ||
    title.includes("리스크")
  ) score -= 2;

  return score;
}

function recencyPriority(pubDate) {
  if (!pubDate) return 0;
  const date = new Date(pubDate);
  if (Number.isNaN(date.getTime())) return 0;

  const hours = (Date.now() - date.getTime()) / (1000 * 60 * 60);

  if (hours <= 6) return 8;
  if (hours <= 12) return 6;
  if (hours <= 24) return 5;
  if (hours <= 48) return 3;
  if (hours <= 72) return 1;
  return 0;
}

function dedupeNews(news) {
  const seen = new Set();
  const result = [];

  for (const item of news) {
    const key = normalizeText(item.title);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }

  return result;
}

function sortNews(news) {
  return news.sort((a, b) => {
    const dateA = new Date(a.pubDate).getTime() || 0;
    const dateB = new Date(b.pubDate).getTime() || 0;
    if (b.score !== a.score) return b.score - a.score;
    return dateB - dateA;
  });
}

async function parseGoogleNews(query) {
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
  const feed = await parser.parseURL(rssUrl);

  const items = (feed.items || []).map(item => {
    const rawTitle = item.title || "제목 없음";
    const source = extractSource(item);
    const pubDate = item.pubDate || item.isoDate || "";
    const title = cleanTitle(rawTitle);

    return {
      title,
      link: item.link || "#",
      source,
      pubDate,
      score: sourcePriority(source) + headlinePriority(title) + recencyPriority(pubDate)
    };
  });

  const recentOnly = items.filter(item => isRecentNews(item.pubDate, 7));
  const base = recentOnly.length ? recentOnly : items;

  return sortNews(dedupeNews(base));
}

async function fetchThemeNews(theme, count = 6) {
  try {
    let news = await parseGoogleNews(theme.query);

    if (news.length < 3 && theme.fallbackQuery) {
      const fallbackNews = await parseGoogleNews(theme.fallbackQuery);
      news = sortNews(dedupeNews([...news, ...fallbackNews]));
    }

    return news.slice(0, count);
  } catch (error) {
    console.error(`뉴스 로드 실패: ${theme.name}`, error.message);
    return [];
  }
}

function analyzeTheme(themeName) {
  const map = {
    "반도체": ["📌 대형주 중심", "mid", "반도체는 대형주뿐 아니라 장비·소부장 확산 여부가 중요합니다."],
    "원전": ["⚠️ 정책 기대", "mid", "원전은 정책 기사보다 실제 수주·수출 기사 비중이 더 중요합니다."],
    "전력": ["⚡ 수요 연결", "strong", "전력은 데이터센터 전력 수요와 설비 증설 기사 연결이 핵심입니다."],
    "로봇": ["🤖 기대감 구간", "mid", "로봇은 기대감 기사와 실제 자동화 기사 구분이 중요합니다."],
    "바이오": ["💊 이벤트 중심", "strong", "바이오는 임상·FDA·기술수출 같은 이벤트가 핵심입니다."],
    "우주항공": ["🚀 뉴스 점검", "mid", "우주항공은 인프라·국가 프로젝트 기사 비중이 중요합니다."],
    "SpaceX+xAI": ["🌐 테마성 접근", "mid", "SpaceX+xAI는 머스크 생태계 테마 확산 속도를 봐야 합니다."],
    "방산": ["🛡️ 계약 강도", "strong", "방산은 지정학보다 실제 계약·수출 기사일 때 강도가 큽니다."]
  };

  const [label, className, insight] = map[themeName] || ["📌 점검", "mid", "추가 확인이 필요합니다."];
  return { label, className, insight };
}

function scoreStocks(stockList, news) {
  const scoreMap = {};
  stockList.forEach(stock => {
    scoreMap[stock] = 0;
    news.forEach(item => {
      if (item.title.includes(stock)) scoreMap[stock] += 4;
      if (
        item.title.includes("수주") ||
        item.title.includes("계약") ||
        item.title.includes("투자") ||
        item.title.includes("확대")
      ) scoreMap[stock] += 1;
    });
  });
  return Object.entries(scoreMap).sort((a, b) => b[1] - a[1]);
}

function pickCoreStocks(theme, news) {
  return scoreStocks(theme.coreStocks, news).slice(0, 4).map(([name]) => name);
}

function pickCandidateStocks(theme, news) {
  return scoreStocks(theme.candidateStocks, news)
    .filter(([, score]) => score > 0)
    .slice(0, 4)
    .map(([name]) => name);
}

function generateBrief(themeName, coreStocks, candidateStocks) {
  const a = coreStocks.slice(0, 3).join(", ");
  const b = candidateStocks.slice(0, 3).join(", ");

  const base = {
    "반도체": [
      "- 반도체는 대형주뿐 아니라 후공정·검사장비·소부장으로 재료가 번지는지 보셔야 합니다.",
      "- 전공정보다 후공정·패키징 뉴스가 많아지면 장비주 강도가 더 세질 수 있습니다.",
      `- 핵심 종목은 ${a} 중심으로 보시면 됩니다.`,
      b ? `- 후보 종목은 ${b} 등 밸류체인 확산주입니다.` : "- 오늘은 신규 후보 확산이 약하고 대형주 중심 흐름입니다.",
      "- 뉴스가 대형주에서 장비주로 확산되는지 여부가 핵심입니다."
    ],
    "원전": [
      "- 원전은 정책보다 실제 수주·수출·MOU 기사 비중이 중요합니다.",
      "- 정책 기대 기사만 많으면 강도가 약할 수 있습니다.",
      `- 핵심 종목은 ${a} 중심으로 보시면 됩니다.`,
      b ? `- 후보 종목은 ${b} 같은 기자재/보조설비 계열입니다.` : "- 오늘은 신규 후보 부각이 약해 대장주 중심 접근이 유효합니다.",
      "- 체코·중동·동유럽 수출 기사 연결 여부가 중요합니다."
    ],
    "전력": [
      "- 전력은 데이터센터 전력 수요가 변압기·전선·송배전으로 연결될 때 강합니다.",
      "- 단순 정책보다 실제 설비 증설 기사 여부가 더 중요합니다.",
      `- 핵심 종목은 ${a} 중심으로 체크하시면 됩니다.`,
      b ? `- 후보 종목은 ${b} 등 전선/변압기 확산주입니다.` : "- 오늘은 핵심 종목 위주 흐름입니다.",
      "- 실제 수주·증설 기사와 연결될 때 매매 강도가 좋아집니다."
    ],
    "로봇": [
      "- 로봇은 기대감 기사보다 산업 자동화·실사용 기사 비중을 더 봐야 합니다.",
      "- 기대감 기사 위주라면 변동성만 크고 추세 지속성은 약할 수 있습니다.",
      `- 핵심 종목은 ${a} 중심으로 보시면 됩니다.`,
      b ? `- 후보 종목은 ${b} 등 중소형 로봇주입니다.` : "- 오늘은 대표 로봇주 중심 흐름입니다.",
      "- 실제 사업화 연결 기사 여부가 중요합니다."
    ],
    "바이오": [
      "- 바이오는 임상·FDA·기술수출 같은 이벤트가 붙을 때 강도가 가장 높습니다.",
      "- 기대감 기사만 많으면 종목별 차별화가 커질 수 있습니다.",
      `- 핵심 종목은 ${a} 중심으로 체크하시면 됩니다.`,
      b ? `- 후보 종목은 ${b} 등 임상/신약 기대 종목입니다.` : "- 오늘은 이벤트 보유 종목 중심 흐름입니다.",
      "- 뉴스 개수보다 이벤트의 질이 중요합니다."
    ],
    "우주항공": [
      "- 우주항공은 위성·발사체·인프라 구축 기사일 때 지속성이 좋아집니다.",
      "- 해외 이슈만 많으면 국내 수혜 강도는 약할 수 있습니다.",
      `- 핵심 종목은 ${a} 중심으로 보시면 됩니다.`,
      b ? `- 후보 종목은 ${b} 등 위성/항공 부품 확산주입니다.` : "- 오늘은 대표 우주항공주 중심 접근이 적절합니다.",
      "- 국가 프로젝트 기사 비중이 중요합니다."
    ],
    "SpaceX+xAI": [
      "- SpaceX+xAI는 머스크 생태계 테마 확산 속도로 움직이는 경우가 많습니다.",
      "- 국내 직접 수혜 연결고리가 약한 종목은 과열 주의가 필요합니다.",
      `- 핵심 종목은 ${a} 중심으로 체크하시면 됩니다.`,
      b ? `- 후보 종목은 ${b} 등 투자/벤처 연결주입니다.` : "- 오늘은 핵심 종목 중심 반응이 강합니다.",
      "- 기사 강도보다 테마 확산 속도가 빠른 섹터입니다."
    ],
    "방산": [
      "- 방산은 지정학 뉴스보다 실제 계약·수출 기사일 때 종목 강도가 큽니다.",
      "- 지정학 기사만 많으면 변동성은 커도 지속성은 약할 수 있습니다.",
      `- 핵심 종목은 ${a} 중심으로 보시면 됩니다.`,
      b ? `- 후보 종목은 ${b} 등 중소형 방산 확산주입니다.` : "- 오늘은 대형 방산주 중심 흐름입니다.",
      "- 계약 상대국·납품 규모 같은 정보가 중요합니다."
    ]
  };

  return base[themeName] || ["- 추가 해석 정보가 필요합니다."];
}

function buildTopNewsFromThemes(themeResults, count = 5) {
  const merged = [];
  themeResults.forEach(result => merged.push(...result.news));
  return sortNews(dedupeNews(merged)).slice(0, count);
}

function buildTopPickCandidates(themeResults) {
  return themeResults
    .map(result => ({
      stock: result.coreStocks[0] || result.theme.coreStocks[0] || "대표종목",
      theme: result.theme.name,
      signal: result.signal,
      reason: `${result.theme.name} 뉴스 흐름상 ${result.coreStocks[0] || result.theme.coreStocks[0]} 관련 강도가 상대적으로 높습니다.`,
      rawScore: result.signal.className === "strong" ? 3 : 2
    }))
    .sort((a, b) => b.rawScore - a.rawScore)
    .slice(0, 3);
}

async function buildBriefing() {
  const results = [];

  for (const theme of themes) {
    const news = await fetchThemeNews(theme, 6);
    const signal = analyzeTheme(theme.name);
    const coreStocks = pickCoreStocks(theme, news);
    const candidateStocks = pickCandidateStocks(theme, news);
    const briefing = generateBrief(theme.name, coreStocks, candidateStocks);

    results.push({
      theme,
      news,
      signal,
      coreStocks,
      candidateStocks,
      briefing
    });

    await sleep(250);
  }

  const payload = {
    updatedAt: formatDateToIso(new Date()),
    themeResults: results,
    topNews: buildTopNewsFromThemes(results, 5),
    topPicks: buildTopPickCandidates(results)
  };

  return payload;
}

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/briefing", async (req, res) => {
  try {
    const now = Date.now();
    const force = req.query.force === "1";

    if (!force && cache.payload && cache.updatedAt && now - cache.updatedAt < 5 * 60 * 1000) {
      return res.json({
        ok: true,
        cached: true,
        ...cache.payload
      });
    }

    const payload = await buildBriefing();

    cache = {
      updatedAt: now,
      payload
    };

    res.json({
      ok: true,
      cached: false,
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

    res.status(500).json({
      ok: false,
      message: "브리핑 데이터를 불러오지 못했습니다."
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`서버 실행: http://localhost:${PORT}`);
});