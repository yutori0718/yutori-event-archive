const BASE_PATH = getBasePath();
const DATA_PATHS = {
  site: withBase("/data/site-content.json"),
  apex: withBase("/data/apex-custom.json"),
  wildcard: withBase("/data/wildcard-custom.json"),
  participation: withBase("/data/participation-history.json"),
};

const state = {
  site: {},
  apex: [],
  wildcard: [],
  participation: [],
};

const navItems = [
  { href: "/", label: "Top" },
  { href: "/apex-custom/", label: "Apexカスタム" },
  { href: "/wildcard-custom/", label: "ワイルドカード" },
  { href: "/participation-history/", label: "出場履歴" },
];

const page = document.body.dataset.page;
const app = document.querySelector("#app");

init();

async function init() {
  try {
    const [site, apex, wildcard, participation] = await Promise.all([
      loadJson(DATA_PATHS.site),
      loadJson(DATA_PATHS.apex),
      loadJson(DATA_PATHS.wildcard),
      loadJson(DATA_PATHS.participation),
    ]);
    state.site = site || {};
    state.apex = apex.events || [];
    state.wildcard = wildcard.events || [];
    state.participation = participation.entries || [];
    render();
  } catch (error) {
    app.innerHTML = layout(`
      <section class="section"><div class="section-inner">
        <div class="empty">データを読み込めませんでした。ローカル確認はサーバー起動後に開いてください。</div>
      </div></section>
    `);
    console.error(error);
  }
}

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path} could not be loaded`);
  return response.json();
}

function render() {
  if (page === "home") renderHome();
  if (page === "apex-list") renderEventList("apex");
  if (page === "apex-detail") renderEventDetail("apex");
  if (page === "apex-team") renderTeamDetail();
  if (page === "wildcard-list") renderEventList("wildcard");
  if (page === "wildcard-detail") renderEventDetail("wildcard");
  if (page === "participation") renderParticipation();
  if (page === "not-found") renderNotFound();
}

function layout(content) {
  return `
    <div class="site-shell">
      <header class="site-header">
        <div class="header-inner">
          <a class="brand" href="${withBase("/")}" aria-label="YUTORI EVENT ARCHIVE">
            <img class="brand-mark" src="${withBase("/images/common/dachshund-logo.svg")}" alt="" />
            <span class="brand-text">
              <span class="brand-title">YUTORI EVENT ARCHIVE</span>
              <span class="brand-sub">Apex Legends Custom Records</span>
            </span>
          </a>
          <nav class="nav" aria-label="メインナビゲーション">
            ${navItems.map((item) => `<a href="${withBase(item.href)}" ${isCurrent(item.href) ? 'aria-current="page"' : ""}>${item.label}</a>`).join("")}
          </nav>
        </div>
      </header>
      ${content}
      <footer class="site-footer">
        <div class="footer-inner">
          <div>YUTORI EVENT ARCHIVE / Apex Legends custom event records</div>
          <img src="${withBase("/images/common/dachshund-logo.svg")}" alt="" />
        </div>
      </footer>
    </div>
  `;
}

function isCurrent(href) {
  const path = stripBase(window.location.pathname);
  if (href === "/") return path === "/";
  return path.startsWith(href);
}

function renderHome() {
  const totalEvents = state.apex.length + state.wildcard.length;
  const home = state.site.home || {};
  app.innerHTML = layout(`
    <section class="hero">
      <div class="section-inner hero-grid">
        <div>
          ${home.heroEyebrow ? `<div class="eyebrow">${escapeHtml(home.heroEyebrow)}</div>` : ""}
          <h1>${escapeHtml(home.heroTitle || "YUTORI EVENT ARCHIVE")}</h1>
          ${home.heroCopy ? `<p class="hero-copy">${escapeHtml(home.heroCopy)}</p>` : ""}
          <div class="hero-actions">
            <a class="button" href="${withBase("/#custom-archive")}">${escapeHtml(home.apexButtonLabel || "Apexカスタムを見る")}</a>
            <a class="button secondary" href="${withBase("/participation-history/")}">${escapeHtml(home.historyButtonLabel || "出場履歴を見る")}</a>
          </div>
          <div class="ticker" aria-label="登録データ数">
            <div class="stat"><strong>${state.apex.length}</strong><span>${escapeHtml(home.apexStatLabel || "Apexカスタム")}</span></div>
            <div class="stat"><strong>${state.wildcard.length}</strong><span>${escapeHtml(home.wildcardStatLabel || "ワイルドカード")}</span></div>
            <div class="stat"><strong>${state.participation.length}</strong><span>${escapeHtml(home.historyStatLabel || "出場履歴")}</span></div>
            <div class="stat"><strong>${totalEvents}</strong><span>${escapeHtml(home.archiveStatLabel || "大会アーカイブ")}</span></div>
          </div>
        </div>
        <div class="hero-emblem">
          <div class="emblem-ring">
            <img src="${withBase("/images/common/dachshund-logo.svg")}" alt="ダックスフンドのシルエットロゴ" />
          </div>
        </div>
      </div>
    </section>
    <div id="custom-archive"></div>
    ${homeSection(home.apexSectionTitle || "Apexカスタム", home.apexSectionLead || "", state.apex, "/apex-custom/detail.html?id=", "/apex-custom/")}
    ${homeSection(home.wildcardSectionTitle || "Apexワイルドカードカスタム", home.wildcardSectionLead || "", state.wildcard, "/wildcard-custom/detail.html?id=", "/wildcard-custom/")}
  `);
}
function homeSection(title, lead, items, detailBase, listHref) {
  return `
    <section class="section">
      <div class="section-inner">
        <div class="section-head">
          <div>
            <h2>${title}</h2>
            ${lead ? `<p class="section-lead">${lead}</p>` : ""}
          </div>
          <a class="button secondary" href="${withBase(listHref)}">一覧へ</a>
        </div>
        <div class="grid">${items.slice(0, 3).map((item) => eventCard(item, detailBase)).join("")}</div>
      </div>
    </section>
  `;
}

function renderEventList(type) {
  const isApex = type === "apex";
  const items = state[type];
  const title = isApex ? "Apexカスタム" : "Apexワイルドカードカスタム";
  const lead = isApex
    ? "ゆとり主催の通常Apexカスタム大会を一覧化。詳細ページでチーム1〜20を選択し、各チーム3名を確認できます。"
    : "ワイルドカード形式の大会を一覧化。詳細ページで参加者30人の名前、配信URL、Xを確認できます。";
  const detailBase = isApex ? "/apex-custom/detail.html?id=" : "/wildcard-custom/detail.html?id=";

  app.innerHTML = layout(`
    ${pageHero(title, lead)}
    <section class="section">
      <div class="section-inner">
        <div class="grid">${items.map((item) => eventCard(item, detailBase)).join("") || empty("大会データがまだありません。")}</div>
      </div>
    </section>
  `);
}

function eventCard(item, detailBase) {
  return `
    <article class="card">
      <a href="${withBase(detailBase)}${encodeURIComponent(item.id)}">
        <div class="card-media">${imageOrPlaceholder(item.thumbnail, `${item.title} サムネイル`)}</div>
        <div class="card-body">
          <div class="meta-row">
            <span class="pill">${formatDate(item.date)}</span>
            <span class="pill purple">${escapeHtml(item.category || "Apex Custom")}</span>
          </div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.summary || item.description || "大会概要をJSONに追加できます。")}</p>
        </div>
      </a>
    </article>
  `;
}

function renderEventDetail(type) {
  const id = new URLSearchParams(window.location.search).get("id");
  const item = state[type].find((event) => event.id === id) || state[type][0];
  const isApex = type === "apex";
  const listHref = isApex ? "/apex-custom/" : "/wildcard-custom/";
  if (!item) {
    app.innerHTML = layout(`${pageHero("大会詳細", "大会データが見つかりません。")}<section class="section"><div class="section-inner">${empty("大会データがまだありません。")}</div></section>`);
    return;
  }

  app.innerHTML = layout(`
    ${pageHero(item.title, `${formatDate(item.date)} / ${item.category || "Apex Custom"}`, listHref)}
    <section class="section">
      <div class="section-inner detail-layout">
        <main>
          <article class="panel">
            <h2>大会概要</h2>
            <p class="content-text">${escapeHtml(item.description || item.summary || "")}</p>
          </article>
          ${imagePanel("大会サムネイル", item.thumbnail)}
          ${isApex ? imagePanel("チーム紹介画像", item.teamImage) : imagePanel("参加者一覧画像", item.teamImage)}
          ${isApex ? teamCardList(item) : participantList(item.participants)}
          ${wildcardMatchTeams(item.matchTeams)}
          ${resultTable(item.totalResults, "総合順位")}
          ${imagePanel("総合順位表画像", item.totalResultImage)}
          ${matchSection(item.matches)}
          ${videoSection("ED動画", item.edYoutubeUrl)}
          ${sponsorSection(item.sponsors)}
          ${memoSection(item.memo)}
        </main>
        <aside>
          <div class="panel">
            <h2>基本情報</h2>
            <dl class="kv">
              <div><dt>大会名</dt><dd>${escapeHtml(item.title)}</dd></div>
              <div><dt>開催日</dt><dd>${formatDate(item.date)}</dd></div>
              <div><dt>カテゴリ</dt><dd>${escapeHtml(item.category || "")}</dd></div>
              <div><dt>配信アーカイブ</dt><dd>${linkOrText(item.archiveUrl, "アーカイブを開く")}</dd></div>
            </dl>
          </div>
        </aside>
      </div>
    </section>
  `);
}

function renderTeamDetail() {
  const params = new URLSearchParams(window.location.search);
  const eventId = params.get("event");
  const teamId = params.get("team");
  const event = state.apex.find((entry) => entry.id === eventId) || state.apex[0];
  const teams = normalizeTeams(event?.teams || []);
  const team = teams.find((entry) => entry.id === teamId) || teams[0];

  if (!event || !team) {
    app.innerHTML = layout(`${pageHero("チーム詳細", "チームデータが見つかりません。")}<section class="section"><div class="section-inner">${empty("チームデータがまだありません。")}</div></section>`);
    return;
  }

  app.innerHTML = layout(`
    ${pageHero(team.name, `${event.title} / チーム`, `/apex-custom/detail.html?id=${encodeURIComponent(event.id)}`)}
    <section class="section">
      <div class="section-inner">
        <article class="panel">
          <div class="team-page-head">
            <div>
              <div class="eyebrow">Team</div>
              <h2>${escapeHtml(team.name)}</h2>
              ${team.note ? `<p class="content-text">${escapeHtml(team.note)}</p>` : ""}
            </div>
            <div class="team-thumb">${imageOrPlaceholder(team.thumbnail, `${team.name} サムネイル`)}</div>
          </div>
        </article>
        <section class="panel">
          <h2>メンバー</h2>
          <div class="standee-grid">
            ${team.members.map((member) => memberProfile(member)).join("")}
          </div>
        </section>
      </div>
    </section>
  `);
}

function renderParticipation() {
  app.innerHTML = layout(`
    ${pageHero("Apexカスタム出場履歴", "ゆとり自身が出場したApexカスタム大会の履歴。大会名、チーム名、メンバー、最終順位、配信アーカイブ、メモを管理できます。")}
    <section class="section">
      <div class="section-inner">
        <div class="history-list">
          ${state.participation.map(historyItem).join("") || empty("出場履歴がまだありません。")}
        </div>
      </div>
    </section>
  `);
}

function historyItem(item) {
  return `
    <article class="history-item">
      <div class="card-media">${imageOrPlaceholder(item.thumbnail, `${item.title} サムネイル`)}</div>
      <div>
        <div class="meta-row">
          <span class="pill">${formatDate(item.date)}</span>
          <span class="pill purple">${escapeHtml(item.finalRank || "順位未設定")}</span>
        </div>
        <h2>${escapeHtml(item.title)}</h2>
        <dl class="kv">
          <div><dt>チーム名</dt><dd>${escapeHtml(item.teamName || "")}</dd></div>
          <div><dt>メンバー</dt><dd>${escapeHtml((item.members || []).join(" / "))}</dd></div>
          <div><dt>配信アーカイブ</dt><dd>${linkOrText(item.archiveUrl, "アーカイブを開く")}</dd></div>
          <div><dt>メモ</dt><dd>${escapeHtml(item.memo || "")}</dd></div>
        </dl>
        ${item.teamImage ? `<div class="panel">${imageOrPlaceholder(item.teamImage, "チーム画像")}</div>` : ""}
      </div>
    </article>
  `;
}

function pageHero(title, lead, backHref = "") {
  return `
    <section class="hero page-hero">
      <div class="section-inner">
        <div class="eyebrow">YUTORI EVENT ARCHIVE</div>
        <h1>${escapeHtml(title)}</h1>
        <p class="hero-copy">${escapeHtml(lead)}</p>
        ${backHref ? `<div class="hero-actions"><a class="button secondary" href="${withBase(backHref)}">一覧へ戻る</a></div>` : ""}
      </div>
    </section>
  `;
}

function imagePanel(title, src) {
  if (!src) return "";
  return `
    <section class="panel">
      <h2>${title}</h2>
      <div class="image-frame">${imageOrPlaceholder(src, title)}</div>
    </section>
  `;
}

function teamCardList(event) {
  const normalized = normalizeTeams(event.teams || []);
  return `
    <section class="panel">
      <h2>チーム紹介</h2>
      <div class="team-card-grid">
        ${normalized.map((team) => `
          <a class="team-card" href="${withBase("/apex-custom/team.html")}?event=${encodeURIComponent(event.id)}&team=${encodeURIComponent(team.id)}">
            <div class="team-card-thumb">${imageOrPlaceholder(team.thumbnail, `${team.name} サムネイル`)}</div>
            <div>
              <h3>${escapeHtml(team.name)}</h3>
              <p>${escapeHtml(team.members.map((member) => member.name).join(" / "))}</p>
            </div>
          </a>
        `).join("")}
      </div>
    </section>
  `;
}

function normalizeTeams(teams) {
  return Array.from({ length: 20 }, (_, index) => {
    const existing = teams[index] || {};
    const members = normalizeMembers(existing.members, index);
    return {
      id: existing.id || `team-${index + 1}`,
      name: existing.name || `チーム${index + 1}`,
      thumbnail: existing.thumbnail || `/images/apex-custom/teams/team-${index + 1}/thumbnail.png`,
      members,
      note: existing.note || "",
    };
  });
}

function normalizeMembers(members = [], teamIndex = 0) {
  return Array.from({ length: 3 }, (_, memberIndex) => {
    const existing = members[memberIndex];
    if (typeof existing === "string") {
      return {
        name: existing,
        standImage: `/images/apex-custom/teams/team-${teamIndex + 1}/member-${memberIndex + 1}.png`,
        streamUrl: "",
      };
    }
    return {
      name: existing?.name || `チーム${teamIndex + 1} メンバー${memberIndex + 1}`,
      standImage: existing?.standImage || `/images/apex-custom/teams/team-${teamIndex + 1}/member-${memberIndex + 1}.png`,
      streamUrl: existing?.streamUrl || "",
    };
  });
}

function memberProfile(member) {
  return `
    <article class="standee-card">
      <div class="standee-image">${imageOrPlaceholder(member.standImage, `${member.name} 立ち絵`)}</div>
      <div class="standee-info">
        <h3>${escapeHtml(member.name)}</h3>
        ${member.streamUrl ? `<a class="mini-button" href="${member.streamUrl}" target="_blank" rel="noreferrer">配信</a>` : `<span class="mini-button disabled">配信</span>`}
      </div>
    </article>
  `;
}

function participantList(participants = []) {
  const normalized = normalizeParticipants(participants);
  return `
    <section class="panel">
      <h2>参加者一覧</h2>
      <div class="participant-list">
        ${normalized.map(participantCard).join("")}
      </div>
    </section>
  `;
}

function participantCard(participant, index) {
  const hasVisual = Boolean(participant.standImage);
  const hasLinks = Boolean(participant.streamUrl || participant.xUrl);
  const nameBlock = `
    <div>
      <span class="participant-number">${String(index + 1).padStart(2, "0")}</span>
      <h3>${escapeHtml(participant.name)}</h3>
    </div>
  `;

  if (!hasVisual && !hasLinks) {
    return `
      <article class="participant-card participant-card-name-only">
        ${nameBlock}
      </article>
    `;
  }

  return `
    <article class="participant-card">
      ${hasVisual ? `<div class="participant-visual">${imageOrPlaceholder(participant.standImage, `${participant.name} 立ち絵`)}</div>` : ""}
      ${nameBlock}
      ${hasLinks ? `
        <div class="link-row">
          ${participant.streamUrl ? `<a class="mini-button" href="${participant.streamUrl}" target="_blank" rel="noreferrer">配信</a>` : ""}
          ${participant.xUrl ? `<a class="mini-button purple" href="${participant.xUrl}" target="_blank" rel="noreferrer">X</a>` : ""}
        </div>
      ` : ""}
    </article>
  `;
}

function normalizeParticipants(participants) {
  return Array.from({ length: 30 }, (_, index) => {
    const existing = participants[index] || {};
    return {
      name: existing.name || `参加者${index + 1}`,
      standImage: existing.standImage || "",
      streamUrl: existing.streamUrl || "",
      xUrl: existing.xUrl || "",
    };
  });
}

function wildcardMatchTeams(matchTeams = []) {
  if (!matchTeams.length) return "";
  return `
    <section class="panel">
      <h2>各試合チーム構成</h2>
      <div class="match-grid">
        ${matchTeams.map((match) => `
          <article class="match-card">
            <h3>${escapeHtml(match.matchName)}</h3>
            <div class="match-body">
              ${(match.teams || []).map((team) => `
                <div class="match-team">
                  <strong>${escapeHtml(team.name)}</strong>
                  <ul>
                    ${(team.members || []).map((member) => `<li>${escapeHtml(member)}</li>`).join("")}
                  </ul>
                </div>
              `).join("")}
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function resultTable(results = [], title) {
  if (!results.length) return "";
  return `
    <section class="panel">
      <h2>${title}</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>順位</th><th>チーム名</th><th>ポイント</th><th>メモ</th></tr></thead>
          <tbody>
            ${results.map((row) => `<tr><td>${escapeHtml(row.rank)}</td><td>${escapeHtml(row.teamName)}</td><td>${escapeHtml(row.points || "")}</td><td>${escapeHtml(row.note || "")}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function matchSection(matches = []) {
  if (!matches.length) return "";
  return `
    <section class="panel">
      <h2>試合別記録</h2>
      <div class="match-grid">
        ${matches.map((match) => `
          <article class="match-card">
            <h3>${escapeHtml(match.matchName)}</h3>
            <div class="match-body">
              ${match.resultImage ? `<div class="image-frame">${imageOrPlaceholder(match.resultImage, `${match.matchName} 順位表`)}</div>` : ""}
              ${match.results ? compactResults(match.results) : ""}
              ${youtubeEmbed(match.youtubeUrl, `${match.matchName} 神視点動画`)}
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function compactResults(results) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>順位</th><th>チーム名</th><th>ポイント</th></tr></thead>
        <tbody>${results.map((row) => `<tr><td>${escapeHtml(row.rank)}</td><td>${escapeHtml(row.teamName)}</td><td>${escapeHtml(row.points || "")}</td></tr>`).join("")}</tbody>
      </table>
    </div>
  `;
}

function videoSection(title, url) {
  if (!url) return "";
  return `
    <section class="panel">
      <h2>${title}</h2>
      <div class="video-grid">${youtubeEmbed(url, title)}</div>
    </section>
  `;
}

function youtubeEmbed(url, title) {
  const id = getYoutubeId(url);
  if (!id) return `<div class="empty">${escapeHtml(title)} 未設定</div>`;
  return `
    <div class="video">
      <h3>${escapeHtml(title)}</h3>
      <iframe src="https://www.youtube.com/embed/${id}" title="${escapeHtml(title)}" allowfullscreen loading="lazy"></iframe>
    </div>
  `;
}

function sponsorSection(sponsors = []) {
  if (!sponsors.length) return "";
  return `
    <section class="panel">
      <h2>スポンサー紹介</h2>
      <div class="grid">
        ${sponsors.map((sponsor) => `
          <article class="card">
            <div class="card-body">
              <h3>${escapeHtml(sponsor.name)}</h3>
              <p>${escapeHtml(sponsor.description || "")}</p>
              ${linkOrText(sponsor.url, "スポンサーサイト")}
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function memoSection(memo) {
  if (!memo) return "";
  return `
    <section class="panel">
      <h2>メモ</h2>
      <p class="content-text">${escapeHtml(memo)}</p>
    </section>
  `;
}

function imageOrPlaceholder(src, alt) {
  if (!src) return `<div class="image-placeholder">画像準備中</div>`;
  const imageSrc = withBase(src);
  const fallbackSrc = src.startsWith("/images/") ? withBase(`/public${src}`) : "";
  return `<img src="${imageSrc}" alt="${escapeHtml(alt)}" data-fallback="${fallbackSrc}" onerror="if(this.dataset.fallback){this.src=this.dataset.fallback;this.dataset.fallback=''}else{this.replaceWith(Object.assign(document.createElement('div'),{className:'image-placeholder',textContent:'画像準備中'}))}" />`;
}

function linkOrText(url, label) {
  if (!url) return "未設定";
  return `<a class="button secondary" href="${url}" target="_blank" rel="noreferrer">${label}</a>`;
}

function getYoutubeId(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return parsed.pathname.slice(1);
    if (parsed.searchParams.get("v")) return parsed.searchParams.get("v");
    if (parsed.pathname.includes("/embed/")) return parsed.pathname.split("/embed/")[1];
    if (parsed.pathname.includes("/shorts/")) return parsed.pathname.split("/shorts/")[1];
  } catch {
    return "";
  }
  return "";
}

function formatDate(value) {
  if (!value) return "日付未設定";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function empty(message) {
  return `<div class="empty">${escapeHtml(message)}</div>`;
}

function renderNotFound() {
  app.innerHTML = layout(`
    ${pageHero("404", "ページが見つかりません。")}
    <section class="section"><div class="section-inner"><a class="button" href="${withBase("/")}">トップへ戻る</a></div></section>
  `);
}

function getBasePath() {
  const firstSegment = window.location.pathname.split("/").filter(Boolean)[0] || "";
  const pageRoots = new Set(["apex-custom", "wildcard-custom", "participation-history"]);
  if (!firstSegment || pageRoots.has(firstSegment)) return "";
  return `/${firstSegment}`;
}

function withBase(path) {
  if (!path || /^https?:\/\//.test(path)) return path;
  if (!path.startsWith("/")) return path;
  return `${BASE_PATH}${path}`;
}

function stripBase(path) {
  if (BASE_PATH && path.startsWith(BASE_PATH)) {
    return path.slice(BASE_PATH.length) || "/";
  }
  return path;
}
