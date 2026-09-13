import { decryptTeamDetail } from "./crypto-gate.js";

const BASE_PATH = getBasePath();
const DATA_PATHS = {
  apex: withBase("/data/apex-custom.json"),
  participation: withBase("/data/participation-history.json"),
};

const state = {
  apex: [],
  participation: [],
};

// パスワードで復号したチーム詳細を、このページを開いている間だけメモリ上に保持する
const unlockedTeams = new Map();

const navItems = [
  { href: "/", label: "Top" },
  { href: "/apex-custom/", label: "Apexカスタム" },
  { href: "/participation-history/", label: "出場履歴" },
];

const page = document.body.dataset.page;
const app = document.querySelector("#app");

init();

async function init() {
  app.addEventListener("submit", onSubmit);
  try {
    const [apex, participation] = await Promise.all([
      loadJson(DATA_PATHS.apex),
      loadJson(DATA_PATHS.participation),
    ]);
    state.apex = apex.events || [];
    state.participation = participation.entries || [];
    render();
  } catch (error) {
    app.innerHTML = layout(`
      <section class="section"><div class="section-inner">
        <div class="empty">データを読み込めませんでした。</div>
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
  if (page === "apex-list") renderEventList();
  if (page === "apex-detail") renderEventDetail();
  if (page === "participation") renderParticipation();
  if (page === "not-found") renderNotFound();
}

async function onSubmit(event) {
  const form = event.target.closest("[data-team-unlock]");
  if (!form) return;
  event.preventDefault();
  const teamId = form.dataset.teamUnlock;
  const password = form.elements.password.value;
  const messageEl = form.querySelector('[data-role="password-message"]');
  const eventItem = state.apex.find((entry) => (entry.teams || []).some((team) => team.id === teamId));
  const team = eventItem?.teams.find((entry) => entry.id === teamId);
  if (!team) return;
  messageEl.textContent = "確認中...";
  try {
    const detail = await decryptTeamDetail(password, team);
    unlockedTeams.set(teamId, detail);
    render();
  } catch {
    messageEl.textContent = "パスワードが違います。";
  }
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
  app.innerHTML = layout(`
    <section class="hero">
      <div class="section-inner hero-grid">
        <div>
          <div class="eyebrow">YUTORI EVENT ARCHIVE</div>
          <h1>Apex Legends 大会結果アーカイブ</h1>
          <p class="hero-copy">ゆとりが主催したApex Legendsカスタム大会の結果発表ページです。</p>
          <div class="hero-actions">
            <a class="button" href="${withBase("/apex-custom/")}">大会一覧を見る</a>
            <a class="button secondary" href="${withBase("/participation-history/")}">出場履歴を見る</a>
          </div>
        </div>
        <div class="hero-emblem">
          <div class="emblem-ring">
            <img src="${withBase("/images/common/dachshund-logo.svg")}" alt="ダックスフンドのシルエットロゴ" />
          </div>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="section-inner">
        <div class="section-head">
          <div><h2>Apexカスタム大会</h2></div>
          <a class="button secondary" href="${withBase("/apex-custom/")}">一覧へ</a>
        </div>
        <div class="grid">${state.apex.slice(0, 3).map(eventCard).join("") || empty("大会データがまだありません。")}</div>
      </div>
    </section>
  `);
}

function renderEventList() {
  app.innerHTML = layout(`
    ${pageHero("Apexカスタム大会", "ゆとり主催のApexカスタム大会一覧です。大会名をクリックすると結果発表ページを開きます。")}
    <section class="section">
      <div class="section-inner">
        <div class="grid">${state.apex.map(eventCard).join("") || empty("大会データがまだありません。")}</div>
      </div>
    </section>
  `);
}

function eventCard(event) {
  return `
    <article class="card">
      <a href="${withBase("/apex-custom/detail.html")}?id=${encodeURIComponent(event.id)}">
        <div class="card-body">
          <div class="meta-row">
            <span class="pill">${formatDate(event.date)}</span>
            ${event.status ? `<span class="pill purple">${escapeHtml(event.status)}</span>` : ""}
          </div>
          <h3>${escapeHtml(event.tournamentName || "(無題)")}</h3>
          ${event.rule ? `<p>${escapeHtml(event.rule)}</p>` : ""}
        </div>
      </a>
    </article>
  `;
}

function renderEventDetail() {
  const id = new URLSearchParams(window.location.search).get("id");
  const event = state.apex.find((entry) => entry.id === id) || state.apex[0];

  if (!event) {
    app.innerHTML = layout(`${pageHero("大会結果", "大会データが見つかりません。")}<section class="section"><div class="section-inner">${empty("大会データがまだありません。")}</div></section>`);
    return;
  }

  app.innerHTML = layout(`
    <section class="hero page-hero">
      <div class="section-inner">
        <div class="eyebrow">YUTORI EVENT ARCHIVE</div>
        <h1>${escapeHtml(event.tournamentName || "(無題)")}</h1>
        <div class="meta-row" style="margin-top:14px">
          <span class="pill">${formatDate(event.date)}</span>
          ${event.rule ? `<span class="pill purple">${escapeHtml(event.rule)}</span>` : ""}
          ${event.status ? `<span class="pill">${escapeHtml(event.status)}</span>` : ""}
        </div>
        <div class="hero-actions"><a class="button secondary" href="${withBase("/apex-custom/")}">一覧へ戻る</a></div>
      </div>
    </section>
    <section class="section">
      <div class="section-inner">
        ${mapProgressSection(event)}
        ${finalRankingSection(event)}
      </div>
    </section>
  `);
}

function mapProgressSection(event) {
  const maps = event.maps || [];
  if (!maps.length) return "";
  return `
    <section class="panel">
      <h2>マップ進行</h2>
      <div class="map-progress">
        ${maps
          .map((map, index) => {
            const done = Boolean(map.completed);
            return `
            <div class="map-step${done ? " done" : ""}">
              <span class="map-step-label">M${index + 1}</span>
              <span class="map-step-name">${escapeHtml(map.name)}</span>
              <span class="map-step-status">${done ? "終了済み" : "未実施"}</span>
            </div>
          `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function rankedTeamsList(event) {
  return (event.teams || [])
    .filter((team) => typeof team.point === "number" || typeof team.rank === "number")
    .slice()
    .sort((a, b) => {
      const rankA = typeof a.rank === "number" ? a.rank : Infinity;
      const rankB = typeof b.rank === "number" ? b.rank : Infinity;
      if (rankA !== rankB) return rankA - rankB;
      return (b.point || 0) - (a.point || 0);
    });
}

function finalRankingSection(event) {
  const ranked = rankedTeamsList(event);
  if (!ranked.length) return `<section class="panel"><h2>最終順位</h2>${empty("結果はまだ発表されていません。")}</section>`;
  const top3 = ranked.slice(0, 3);
  const rest = ranked.slice(3);
  const podiumOrder = { 1: "gold", 2: "silver", 3: "bronze" };
  return `
    <section class="panel">
      <h2>最終順位</h2>
      <div class="rank-podium">
        ${top3.map((team) => rankEntry(team, `rank-card ${podiumOrder[team.rank] || ""}`)).join("")}
      </div>
      ${rest.length ? `<div class="rank-list">${rest.map((team) => rankEntry(team, "rank-row")).join("")}</div>` : ""}
    </section>
  `;
}

function rankEntry(team, className) {
  const unlocked = unlockedTeams.get(team.id);
  return `
    <details class="${className}" ${unlocked ? "open" : ""}>
      <summary>
        <span class="rank-badge">${escapeHtml(placeLabel(team.rank))}</span>
        <span class="rank-team-name">${escapeHtml(team.name)}</span>
        <span class="rank-points">${escapeHtml(numOrDash(team.point))}pt</span>
        <span class="rank-chevron" aria-hidden="true"></span>
      </summary>
      <div class="rank-detail">
        ${unlocked ? teamDetailBody(unlocked) : passwordGate(team.id)}
      </div>
    </details>
  `;
}

function passwordGate(teamId) {
  return `
    <form class="password-gate" data-team-unlock="${escapeHtml(teamId)}">
      <p class="hint">チーム詳細（試合ごとの成績・メンバー個人成績）はパスワードで保護されています。<br />大会主催者から発行されたこのチームのパスワードを入力してください。</p>
      <div class="password-gate-row">
        <input type="password" name="password" placeholder="チームのパスワード" autocomplete="off" />
        <button class="button secondary" type="submit">開く</button>
      </div>
      <div class="password-gate-message hint" data-role="password-message"></div>
    </form>
  `;
}

function teamDetailBody(detail) {
  const matchNumbers = (detail.matchResults || []).map((result, index) => result.match ?? index + 1);
  const results = detail.matchResults || [];
  const findResult = (matchNo) => results.find((result) => Number(result.match) === matchNo) || {};

  return `
    <dl class="point-breakdown">
      <div><dt>マッチpt</dt><dd>${escapeHtml(numOrDash(detail.matchPoint))}</dd></div>
      <div><dt>ランクボーナス</dt><dd>${escapeHtml(numOrDash(detail.rankBonus))}</dd></div>
      <div><dt>最高順位</dt><dd>${escapeHtml(placeLabel(detail.bestPlace))}</dd></div>
    </dl>
    ${
      results.length
        ? `
    <div class="table-wrap">
      <table class="stat-table">
        <thead><tr><th>試合ごとのチーム成績</th>${matchNumbers.map((m) => `<th>M${m}</th>`).join("")}</tr></thead>
        <tbody>
          <tr><th>順位</th>${matchNumbers.map((m) => `<td>${placeLabel(findResult(m).teamRank)}</td>`).join("")}</tr>
          <tr><th>pt</th>${matchNumbers.map((m) => `<td>${numOrDash(findResult(m).teamPoint)}</td>`).join("")}</tr>
          <tr><th>キル</th>${matchNumbers.map((m) => `<td>${numOrDash(findResult(m).teamKills)}</td>`).join("")}</tr>
        </tbody>
      </table>
    </div>`
        : ""
    }
    ${
      (detail.members || []).length
        ? `
    <div class="member-stats">
      <h3>メンバー個人成績</h3>
      ${detail.members.map((member) => memberStatsTable(member, matchNumbers)).join("")}
    </div>`
        : ""
    }
  `;
}

function memberStatsTable(member, matchNumbers) {
  const damage = member.damageByMatch || [];
  const kills = member.killsByMatch || [];
  const totalDamage = typeof member.totalDamage === "number" ? member.totalDamage : sumArray(damage);
  const totalKills = typeof member.totalKills === "number" ? member.totalKills : sumArray(kills);
  return `
    <div class="table-wrap member-stat-table">
      <table class="stat-table">
        <thead><tr><th>${escapeHtml(member.name || "メンバー")}</th>${matchNumbers.map((m) => `<th>M${m}</th>`).join("")}<th>合計</th></tr></thead>
        <tbody>
          <tr><th>ダメージ</th>${matchNumbers.map((m, index) => `<td>${numOrDash(damage[index])}</td>`).join("")}<td>${totalDamage}</td></tr>
          <tr><th>キル</th>${matchNumbers.map((m, index) => `<td>${numOrDash(kills[index])}</td>`).join("")}<td>${totalKills}</td></tr>
        </tbody>
      </table>
    </div>
  `;
}

function sumArray(values = []) {
  return values.reduce((total, value) => total + (Number(value) || 0), 0);
}

function numOrDash(value) {
  return typeof value === "number" && !Number.isNaN(value) ? String(value) : "-";
}

function placeLabel(value) {
  return typeof value === "number" && !Number.isNaN(value) ? `${value}位` : "-";
}

function renderParticipation() {
  const archiveMonth = archiveCoverageLabel(state.participation);
  app.innerHTML = layout(`
    ${pageHero("Apexカスタム出場履歴", "ゆとり自身が出場したApexカスタム大会の履歴です。")}
    <section class="section">
      <div class="section-inner">
        ${archiveMonth ? `<div class="archive-coverage panel">出場履歴：${archiveMonth}まで掲載</div>` : ""}
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

function formatDate(value) {
  if (!value) return "日付未設定";
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function archiveCoverageLabel(items = []) {
  const latest = items
    .map((item) => parseDate(item.date))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  if (!latest) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
  }).format(latest);
}

function parseDate(value) {
  if (!value) return new Date(Number.NaN);
  const normalized = String(value).trim().replaceAll("/", "-");
  const match = normalized.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/);
  if (!match) return new Date(`${value}T00:00:00`);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3] || 1));
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
  const pageRoots = new Set(["apex-custom", "participation-history"]);
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
