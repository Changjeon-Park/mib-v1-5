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

function renderTopNews(news) {
  const mustRead = news.slice(0, 3);
  const moreNews = news.slice(3);

  topNews.innerHTML = `
    <div class="section-label">시장 요약</div>
    <h2 class="summary-title">🔥 오늘 핵심 뉴스</h2>
    ${
      news.length === 0
        ? `<div class="empty">표시할 핵심 뉴스가 없습니다.</div>`
        : `
          <div style="margin-bottom: 14px;">
            <div style="font-size:13px; color:#94a3b8; margin-bottom:8px;">🔥 MUST READ</div>
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
                  <div style="font-size:13px; color:#94a3b8; margin-bottom:8px;">추가 체크 뉴스</div>
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

function renderTopPicks(picks) {
  topPicks.innerHTML = `
    <div class="section-label">투자 아이디어</div>
    <h2 class="summary-title">💰 오늘 관심 종목 TOP 3</h2>
    ${
      picks.length === 0
        ? `<div class="empty">추천 종목이 없습니다.</div>`
        : picks.map(pick => `
          <div class="pick-card">
            <div class="pick-header">
              <div>
                <div class="pick-name">${pick.stock}</div>
                <div class="pick-theme">${pick.theme} 테마</div>
              </div>
              <span class="signal ${pick.signal.className}">${pick.signal.label}</span>
            </div>
            <div class="pick-reason">${pick.reason}</div>
          </div>
        `).join("")
    }
  `;
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

  return `
    <section class="card">
      <div class="card-header">
        <div class="card-title-row">
          <h2 class="card-title">${theme.name}</h2>
          <span class="signal ${signal.className}">${signal.label}</span>
        </div>
        <div class="card-keyword">검색어: ${theme.query}</div>
        <div class="insight">${signal.insight}</div>
      </div>
      <div class="card-body">
        <div class="block">
          <div class="block-title">오늘 한줄 브리핑</div>
          <div class="briefing-lines">
            ${briefing.map(line => `<div class="briefing-line">${line}</div>`).join("")}
          </div>
        </div>

        <div class="block">
          <div class="block-title">관심 종목</div>
          <div class="stock-tags">
            ${coreStocks.map(stock => `<span class="stock-tag">${stock}</span>`).join("")}
          </div>
        </div>

        <div class="block">
          <div class="block-title">후보 종목</div>
          <div class="stock-tags">
            ${
              candidateStocks.length
                ? candidateStocks.map(stock => `
                    <span class="stock-tag candidate">
                      ${stock}${autoCandidates.includes(stock) ? " (자동)" : ""}
                    </span>
                  `).join("")
                : `<span class="stock-tag candidate">오늘은 신규 후보 부각 약함</span>`
            }
          </div>
        </div>

        <div class="block">
          <div class="block-title">대표 뉴스 ${news.length}개</div>
          <div class="news-list">
            ${
              news.length === 0
                ? `<div class="empty">관련 뉴스가 없습니다.</div>`
                : news.map(item => `
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
  renderHeroTags(payload.themeResults);
  renderTopNews(payload.topNews || []);
  renderTopPicks(payload.topPicks || []);
  dashboard.innerHTML = payload.themeResults.map(createThemeCard).join("");
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