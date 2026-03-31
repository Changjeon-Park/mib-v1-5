const USE_DYNAMIC_BRIEFING = true;
const USE_NOMINAL_STYLE = true;
const ENTITY_LIMITS_BY_THEME = {
  "바이오": [
    ["LG화학"],
    ["셀트리온"],
    ["삼성바이오로직스"],
    ["알테오젠"],
    ["유한양행"]
  ],
  "우주항공": [
    ["한국항공우주", "KAI"],
    ["한화에어로스페이스", "한화에어로"],
    ["쎄트렉아이"],
    ["컨텍"],
    ["인텔리안테크"],
    ["루미르"],
    ["AP위성"],
    ["제노코"]
  ],
  "반도체": [
    ["삼성전자"],
    ["SK하이닉스", "하이닉스"],
    ["한미반도체"],
    ["리노공업"]
  ],
  "원전": [
    ["두산에너빌리티", "두산에너"],
    ["한전기술"],
    ["한국전력", "한전"]
  ],
  "전력": [
    ["효성중공업", "효성중공"],
    ["LS ELECTRIC", "LS일렉트릭", "LS ELECTRIC"],
    ["HD현대일렉트릭", "현대일렉트릭"],
    ["제룡전기"]
  ],
  "로봇": [
    ["두산로보틱스"],
    ["레인보우로보틱스", "레인보우"],
    ["현대오토에버"],
    ["로보티즈"],
    ["뉴로메카"]
  ],
  "SpaceX+xAI": [
    ["인텔리안테크"],
    ["쎄트렉아이"],
    ["AP위성"],
    ["한화에어로스페이스", "한화에어로"],
    ["컨텍"],
    ["루미르"]
  ],
  "방산": [
    ["한화에어로스페이스", "한화에어로"],
    ["현대로템"],
    ["LIG넥스원", "넥스원"],
    ["풍산"]
  ]
};

function nominalizeSentence(text = "") {
  if (!USE_NOMINAL_STYLE || !text) return text;

  let t = String(text).trim();

  const replacements = [
    [/확인하셔야 합니다\./g, "확인 필요"],
    [/확인해야 합니다\./g, "확인 필요"],
    [/체크해야 합니다\./g, "체크 필요"],
    [/보셔야 합니다\./g, "체크 필요"],
    [/살펴봐야 합니다\./g, "점검 필요"],
    [/봐야 합니다\./g, "확인 필요"],

    [/중요합니다\./g, "중요"],
    [/핵심입니다\./g, "핵심"],
    [/관건입니다\./g, "관건"],
    [/포인트입니다\./g, "핵심 포인트"],

    [/가능성이 있습니다\./g, "가능성"],
    [/가능성이 높습니다\./g, "가능성 높음"],
    [/이어질 가능성이 있습니다\./g, "관심 지속 가능"],
    [/이어질 가능성이 높습니다\./g, "관심 지속 가능성 높음"],

    [/집중될 수 있습니다\./g, "반응 집중 가능"],
    [/커질 수 있습니다\./g, "강도 확대 가능"],
    [/강할 수 있습니다\./g, "강도 우위 가능"],
    [/세질 수 있습니다\./g, "강도 확대 가능"],
    [/약해질 수 있습니다\./g, "탄력 둔화 가능"],

    [/유지되는지 확인해야 합니다\./g, "유지 여부 확인 필요"],
    [/높아지는지 확인해야 합니다\./g, "비중 확대 여부 확인 필요"],
    [/넘어가는지 확인해야 합니다\./g, "실행 단계 진입 여부 확인 필요"],
    [/이어지는지 확인해야 합니다\./g, "흐름 지속 여부 확인 필요"],

    [/뉴스 흐름상 /g, ""],
    [/관련 강도가 상대적으로 높습니다\./g, "관련 강도 상대 우위"],
    [/비중이 더 중요합니다\./g, "비중이 핵심"],
    [/확산 여부가 중요합니다\./g, "확산 여부가 핵심"],
    [/기사 성격 구분이 중요합니다\./g, "기사 성격 구분이 중요"],

    [/비중이 높아 오늘 시장 관심이 이어질 가능성이 있습니다\./g, "기사 비중 우위, 시장 관심 지속 가능"],
    [/상대적으로 해석이 강한 구간입니다\./g, "상대 강도 우위 구간"],
    [/중기 기대감이 유입되는 흐름입니다\./g, "중기 기대감 유입 구간"],
    [/단기 테마성 반응 가능성을 우선 보셔야 합니다\./g, "단기 테마 반응 가능 구간"],
    [/실질 재료 기사와 기대감 기사가 혼재되어 있어 뉴스의 질을 구분해서 볼 필요가 있습니다\./g, "실질 재료와 기대감 기사 혼재, 뉴스 질 구분 필요"],

    [/오늘은 신규 후보 부각 약함/g, "신규 후보 부각 약함"],
    [/검색어: /g, "검색어 · "],
    [/ \(자동\)/g, " · 자동"],

    [/입니다\./g, ""],
    [/합니다\./g, ""],
    [/됩니다\./g, ""],
    [/있습니다\./g, "있음"]
  ];

  for (const item of replacements) {
    if (!Array.isArray(item) || item.length !== 2) continue;
    const [pattern, replacement] = item;
    t = t.replace(pattern, replacement);
  }

  return t.replace(/\s{2,}/g, " ").trim();
}

function normalizeTitle(title = "") {
  return title
    .toLowerCase()
    .replace(/[“”"'‘’]/g, "")
    .replace(/[^\w가-힣\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function limitSimilarNews(newsList = [], maxPerTopic = 2) {
  const map = {};

  return newsList.filter(item => {
    const key = normalizeTitle(item.title).slice(0, 15);

    if (!map[key]) {
      map[key] = 1;
      return true;
    }

    if (map[key] < maxPerTopic) {
      map[key]++;
      return true;
    }

    return false;
  });
}

function nominalizeArray(arr = []) {
  return (arr || []).map(item => nominalizeSentence(item));
}

function displayText(text = "") {
  return nominalizeSentence(text);
}
// 기존 함수들 계속...

const dashboard = document.getElementById("dashboard");
const heroTags = document.getElementById("heroTags");
const refreshBtn = document.getElementById("refreshBtn");
const topNews = document.getElementById("topNews");
const topPicks = document.getElementById("topPicks");
const updateTime = document.getElementById("updateTime");

let isLoading = false;
let lastPayload = null;

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderHeroTags(themeResults) {
  heroTags.innerHTML = themeResults
    .map(item => `<span class="tag">${item.theme.name}</span>`)
    .join("");
}

function calculateStockScore(themeResult, stock) {
  const news = themeResult.news || [];
  const mentionCount = countStockMentions(news, stock);

  // 기사 직접 언급 없으면 제외
  if (mentionCount === 0) return null;

  let score = 0;

  if (mentionCount >= 3) score += 6;
  else if (mentionCount === 2) score += 5;
  else score += 3;

  const mustRead = news.slice(0, 3);
  const inMustRead = mustRead.some(item => (item.title || "").includes(stock));
  if (inMustRead) score += 2;

  const coreStocks = themeResult.coreStocks || themeResult.theme?.coreStocks || [];
  const candidateStocks = themeResult.candidateStocks || themeResult.theme?.candidateStocks || [];

  if (coreStocks.includes(stock)) score += 1;
  else if (candidateStocks.includes(stock)) score += 0.5;

  return {
    stock,
    score,
    theme: themeResult.theme?.name || themeResult.theme || "",
    signal: themeResult.signal || { className: "event", label: "뉴스 기반" },
    reason: `${themeResult.theme?.name || themeResult.theme || ""} 기사 직접 언급 기반`
  };
}

function renderTopNews(news) {
  const mustRead = news.slice(0, 3);
  const moreNews = news.slice(3);

  topNews.innerHTML = `
    <div class="section-label">${displayText("시장 요약")}</div>
    <h2 class="summary-title">${displayText("🔥 오늘 핵심 뉴스")}</h2>
    ${
      news.length === 0
        ? `<div class="empty">${displayText("표시할 핵심 뉴스가 없습니다.")}</div>`
        : `
          <div style="margin-bottom: 14px;">
            <div style="font-size:13px; color:#94a3b8; margin-bottom:8px;">${displayText("🔥 MUST READ")}</div>
            ${mustRead.map((item, index) => `
              <div class="summary-news-item">
                <a class="summary-news-link" href="${item.link}" target="_blank" rel="noopener noreferrer">
                  ${index + 1}. ${item.title}
                </a>
                <div class="summary-news-meta">${item.source}${formatDate(item.pubDate) ? " · " + formatDate(item.pubDate) : ""}</div>
              </div>
            `).join("")}
          </div>

          ${
            moreNews.length > 0
              ? `
                <div>
                  <div style="font-size:13px; color:#94a3b8; margin-bottom:8px;">${displayText("추가 체크 뉴스")}</div>
                  ${moreNews.map((item, index) => `
                    <div class="summary-news-item">
                      <a class="summary-news-link" href="${item.link}" target="_blank" rel="noopener noreferrer">
                        ${index + 4}. ${item.title}
                      </a>
                      <div class="summary-news-meta">${item.source}${formatDate(item.pubDate) ? " · " + formatDate(item.pubDate) : ""}</div>
                    </div>
                  `).join("")}
                </div>
              `
              : ""
          }
        `
    }
  `;
}

function countStockMentions(newsList = [], stockName = "") {
  return (newsList || []).filter(item =>
    (item.title || "").includes(stockName)
  ).length;
}

function buildTopPicks(themeResults = []) {
  let candidates = [];

  themeResults.forEach(themeResult => {
    const coreStocks = themeResult.coreStocks || themeResult.theme?.coreStocks || [];
    const candidateStocks = themeResult.candidateStocks || themeResult.theme?.candidateStocks || [];

    const stocks = [...coreStocks, ...candidateStocks];

    stocks.forEach(stock => {
      const scored = calculateStockScore(themeResult, stock);
      if (scored) candidates.push(scored);
    });
  });

  candidates.sort((a, b) => b.score - a.score);

  const final = [];
  const usedStocks = new Set();
  const themeCount = {};

  for (const item of candidates) {
    if (usedStocks.has(item.stock)) continue;

    const currentThemeCount = themeCount[item.theme] || 0;
    if (currentThemeCount >= 2) continue;

    final.push(item);
    usedStocks.add(item.stock);
    themeCount[item.theme] = currentThemeCount + 1;

    if (final.length === 5) break;
  }

  return final;
}

function renderTopPicks(picks) {
  topPicks.innerHTML = `
    <div class="section-label">${displayText("투자 아이디어")}</div>
    <h2 class="summary-title">${displayText("💰 오늘 관심 종목 TOP 5")}</h2>
    ${
      picks.length === 0
        ? `<div class="empty">${displayText("추천 종목이 없습니다.")}</div>`
        : picks.map(pick => `
          <div class="pick-card">
            <div class="pick-header">
              <div>
                <div class="pick-name">${pick.stock}</div>
                <div class="pick-theme">${displayText(`${pick.theme} 테마`)}</div>
              </div>
              <span class="signal ${pick.signal.className}">${displayText(pick.signal.label)}</span>
            </div>
            <div class="pick-reason">${displayText(pick.reason)}</div>
          </div>
        `).join("")
    }
  `;
}

function buildThemeInsight(theme, news = []) {
  const titles = news.map(item => (item.title || "").toLowerCase());

  const count = (keywords = []) =>
    titles.filter(title => keywords.some(k => title.includes(k.toLowerCase()))).length;

  const contractCount = count(["수주", "계약", "체결", "공급", "납품", "선정", "수출", "양산"]);
  const realCount = count(["도입", "적용", "생산", "가동", "운영", "상용화", "자동화", "출하", "매출"]);
  const policyCount = count(["정책", "정부", "지원", "예산", "로드맵", "규제", "완화"]);
  const expectationCount = count(["기대", "전망", "부각", "관련주", "수혜", "확산", "검토", "추진", "mou"]);

  if (theme.name === "방산") {
    if (contractCount >= 2) return "방산은 지정학보다 실제 계약·수출 기사 비중이 핵심";
    if (policyCount >= 2) return "방산은 정책·제도 이슈보다 수출 연결성 확인이 우선";
    if (expectationCount >= 2) return "방산은 헤드라인보다 실수출 기사 비중 확인이 중요";
    return "방산은 지정학 헤드라인보다 실계약 기사 확인이 우선";
  }

  if (theme.name === "SpaceX+xAI") {
    if (realCount >= 1 || contractCount >= 1) return "SpaceX+xAI는 테마 확산보다 실제 연결고리 확인이 핵심";
    return "SpaceX+xAI는 머스크 생태계 확산보다 실수혜 구조 검증이 우선";
  }

  if (theme.name === "반도체") {
    if (realCount >= 2 || contractCount >= 2) return "반도체는 AI·HBM 이후 후공정·패키징 확산 구간";
    return "반도체는 대형주보다 장비·소부장 확산 여부가 핵심";
  }

  if (theme.name === "원전") {
    if (contractCount >= 2) return "원전은 정책보다 실제 수주·공급 기사 비중 우위 구간";
    return "원전은 정책 기대보다 실제 수주 연결 여부가 핵심";
  }

  if (theme.name === "전력") return "전력은 데이터센터 수요의 변압기·송배전 확산 여부가 핵심";

  if (theme.name === "로봇") {
    if (realCount >= 2) return "로봇은 기대감보다 실제 도입·자동화 기사 비중이 핵심";
    return "로봇은 테마 확산보다 실도입 기사 비중 확인이 중요";
  }

  if (theme.name === "바이오") return "바이오는 이벤트 수보다 임상·허가 기사 질이 핵심";
  if (theme.name === "우주항공") return "우주항공은 국가 프로젝트보다 실수혜 연결 종목 압축이 중요";

  if (contractCount >= 2) return `${theme.name}는 실제 계약·공급 기사 비중 우위 구간`;
  if (realCount >= 2) return `${theme.name}는 실도입·생산 기사 비중 우위 구간`;
  if (policyCount >= 2) return `${theme.name}는 정책 기사 중심, 실행 단계 확인 필요`;
  if (expectationCount >= 2) return `${theme.name}는 기대감 기사 중심 단기 테마 구간`;

  return `${theme.name}는 실질 재료와 기대감 기사 혼재 구간`;
}

function limitNewsPerCompany(newsList = [], companyName = "", maxCount = 2) {
  if (!companyName) return newsList;

  let count = 0;
  return newsList.filter(item => {
    const title = item.title || "";
    if (title.includes(companyName)) {
      if (count >= maxCount) return false;
      count++;
    }
    return true;
  });
}

function limitNewsPerEntity(newsList = [], aliases = [], maxCount = 2) {
  if (!aliases || aliases.length === 0) return newsList;

  let count = 0;

  return newsList.filter(item => {
    const title = item.title || "";
    const matched = aliases.some(alias => title.includes(alias));

    if (matched) {
      if (count >= maxCount) return false;
      count++;
    }

    return true;
  });
}

function titleTokens(title = "") {
  const stopwords = [
    "기자", "단독", "속보", "관련", "돌입", "진입", "착수", "추진",
    "발표", "공개", "확인", "전망", "가능성", "확대", "강화"
  ];

  return normalizeTitle(title)
    .split(" ")
    .filter(token => token.length >= 2 && !stopwords.includes(token));
}

function calcSimilarity(titleA = "", titleB = "") {
  const a = new Set(titleTokens(titleA));
  const b = new Set(titleTokens(titleB));

  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }

  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

function limitSimilarNews(newsList = [], maxPerTopic = 2, similarityThreshold = 0.55) {
  const groups = [];

  for (const item of newsList) {
    const foundGroup = groups.find(group =>
      calcSimilarity(group[0].title || "", item.title || "") >= similarityThreshold
    );

    if (foundGroup) {
      if (foundGroup.length < maxPerTopic) {
        foundGroup.push(item);
      }
    } else {
      groups.push([item]);
    }
  }

  return groups.flat();
}

function getNewsLimit(newsList = []) {
  if (!newsList || newsList.length === 0) return 0;

  // 10개 이상이면 최대 10개
  if (newsList.length >= 10) return 10;

  // 5~9개면 그대로 사용
  if (newsList.length >= 5) return newsList.length;

  // 5개 미만이면 있는 만큼 그대로
  return newsList.length;
}

function createThemeCard(result) {
  const {
    theme,
    news,
    signal,
    coreStocks,
    candidateStocks,
    briefing,
    autoCandidates = []
  } = result;

let filteredNews = limitSimilarNews(news || [], 2);

// 전 섹터 공통 엔티티 제한
const entityGroups = ENTITY_LIMITS_BY_THEME[theme.name] || [];
entityGroups.forEach(aliases => {
  filteredNews = limitNewsPerEntity(filteredNews, aliases, 2);
});

const limit = getNewsLimit(filteredNews);
const displayNews = filteredNews.slice(0, limit);

  return `
    <section class="card">
      <div class="card-header">
        <div class="card-title-row">
          <h2 class="card-title">${theme.name}</h2>
          <span class="signal ${signal.className}">${displayText(signal.label)}</span>
        </div>
        <div class="card-keyword">${displayText(`검색어: ${theme.query}`)}</div>
        <div class="insight">${displayText(buildThemeInsight(theme, news))}</div>
      </div>
      <div class="card-body">
        <div class="block">
          <div class="block-title">${displayText("오늘 한줄 브리핑")}</div>
          <div class="briefing-lines">
            ${briefing.map(line => `<div class="briefing-line">${displayText(line)}</div>`).join("")}
          </div>
        </div>

        <div class="block">
          <div class="block-title">${displayText("관심 종목")}</div>
          <div class="stock-tags">
            ${coreStocks.map(stock => `<span class="stock-tag">${stock}</span>`).join("")}
          </div>
        </div>

        <div class="block">
          <div class="block-title">${displayText("후보 종목")}</div>
          <div class="stock-tags">
            ${
              candidateStocks.length
                ? candidateStocks.map(stock => `
                    <span class="stock-tag candidate">
                      ${stock}${autoCandidates.includes(stock) ? displayText(" (자동)") : ""}
                    </span>
                  `).join("")
                : `<span class="stock-tag candidate">${displayText("오늘은 신규 후보 부각 약함")}</span>`
            }
          </div>
        </div>

        <div class="block">
  <div class="block-title">${displayText(`대표 뉴스 ${displayNews.length}개`)}</div>
  <div class="news-list">
    ${
      displayNews.length === 0
        ? `<div class="empty">${displayText("관련 뉴스가 없습니다.")}</div>`
        : displayNews.map(item => `
          <div class="news-item">
            <a class="news-title" href="${item.link}" target="_blank" rel="noopener noreferrer">${item.title}</a>
            <div class="news-meta">${item.source}${formatDate(item.pubDate) ? " · " + formatDate(item.pubDate) : ""}</div>
          </div>
        `).join("")
    }
  </div>
</div>
</div>
</section>
  `;
}

function renderDashboard(payload) {
  lastPayload = payload;

  updateTime.textContent = `마지막 업데이트: ${new Date(payload.updatedAt).toLocaleString("ko-KR")}`;
  renderHeroTags(payload.themeResults || []);
  renderTopNews(payload.topNews || []);
  renderTopPicks(payload.topPicks || []);
  dashboard.innerHTML = (payload.themeResults || []).map(createThemeCard).join("");
}

async function loadBriefing(force = false) {
  if (isLoading) return;

  isLoading = true;
  refreshBtn.disabled = true;
  refreshBtn.textContent = "불러오는 중...";

  if (!lastPayload) {
    topNews.innerHTML = `<div class="loading">핵심 뉴스를 불러오는 중입니다...</div>`;
    topPicks.innerHTML = `<div class="loading">추천 종목을 계산하는 중입니다...</div>`;
    dashboard.innerHTML = `<div class="loading">뉴스를 불러오는 중입니다...</div>`;
  }

  try {
    const res = await fetch(`/api/briefing${force ? "?force=1" : ""}`);
    const data = await res.json();

    if (!data.ok) {
      throw new Error(data.message || "브리핑 로드 실패");
    }

    renderDashboard(data);
  } catch (error) {
    console.error(error);

    if (lastPayload) {
      updateTime.textContent = `업데이트 실패, 이전 데이터 유지`;
      renderDashboard(lastPayload);
    } else {
      topNews.innerHTML = `<div class="empty">핵심 뉴스 로드 실패</div>`;
      topPicks.innerHTML = `<div class="empty">추천 종목 계산 실패</div>`;
      dashboard.innerHTML = `<div class="empty">브리핑을 불러오지 못했습니다.</div>`;
    }
  } finally {
    isLoading = false;
    refreshBtn.disabled = false;
    refreshBtn.textContent = "새로고침";
  }
}

refreshBtn.addEventListener("click", () => loadBriefing(true));
loadBriefing(false);