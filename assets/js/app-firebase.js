import { decryptTeamDetail } from "./crypto-gate.js";
import { listEvents, getEvent } from "./firebase-data.js";

const state = { events: [] };
const unlockedTeams = new Map();

const page = document.body.dataset.page;
const app = document.querySelector("#app");

init();

async function init() {
  app.addEventListener("submit", onSubmit);
  try {
    state.events = await listEvents();
    render();
  } catch (error) {
    app.innerHTML = layout(`
      <section class="section"><div class="section-inner">
        <div class="empty">データを読み込めませんでした（Firestoreの設定をご確認ください）。</div>
      </div></section>
    `);
    console.error(error);
  }
}

function render() {
  if (page === "firebase-list") renderEventList();
  if (page === "firebase-detail") renderEventDetail();
}

async function onSubmit(event) {
  const form = event.target.closest("[data-team-unlock]");
  if (!form) return;
  event.preventDefault();
  const teamId = form.dataset.teamUnlock;
  const password = form.elements.password.value;
  const messageEl = form.querySelector('[data-role="password-message"]');
  const eventItem = state.events.find((entry) => (entry.teams || []).some((team) => team.id === teamId));
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
          <a class="brand" href="./" aria-label="YUTORI EVENT ARCHIVE">
            <img class="brand-mark" src="../images/common/dachshund-logo.svg" alt="" />
            <span class="brand-text">
              <span class="brand-title">YUTORI EVENT ARCHIVE</span>
              <span class="brand-sub">Firebase版デモ</span>
            </span>
          </a>
        </div>
      </header>
      ${content}
      <footer class="site-footer">
        <div class="footer-inner">
          <div>Firebase (Firestore) 版の結果発表ページデモ</div>
          <img src="../images/common/dachshund-logo.svg" alt="" />
        </div>
      </footer>
    </div>
  `;
}

function renderEventList() {
  app.innerHTML = layout(`
    ${pageHero("Apexカスタム大会（Firebase版）", "Firestoreから読み込んだ大会一覧です。大会名をクリックすると結果発表ページを開きます。")}
    <section class="section">
      <div class="section-inner">
        <div class="grid">${state.events.map(eventCard).join("") || empty("大会データがまだありません。")}</div>
      </div>
    </section>
  `);
}

function eventCard(event) {
  return `
    <article class="card">
      <a href="detail.html?id=${encodeURIComponent(event.id)}">
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
  const event = state.events.find((entry) => entry.id === id) || state.events[0];

  if (!event) {
    app.innerHTML = layout(`${pageHero("大会結果", "大会データが見つかりません。")}<section class="section"><div class="section-inner">${empty("大会データがまだありません。")}</div></section>`);
    return;
  }

  app.innerHTML = layout(`
    <section class="hero page-hero">
      <div class="section-inner">
        <div class="eyebrow">YUTORI EVENT ARCHIVE / Firebase版</div>
        <h1>${escapeHtml(event.tournamentName || "(無題)")}</h1>
        <div class="meta-row" style="margin-top:14px">
          <span class="pill">${formatDate(event.date)}</span>
          ${event.rule ? `<span class="pill purple">${escapeHtml(event.rule)}</span>` : ""}
          ${event.status ? `<span class="pill">${escapeHtml(event.status)}</span>` : ""}
        </div>
        <div class="hero-actions"><a class="button secondary" href="./">一覧へ戻る</a></div>
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

const MEMBER_STAT_FIELDS = [
  { key: "kills", label: "キル" },
  { key: "damage", label: "ダメージ" },
  { key: "assists", label: "アシスト" },
  { key: "knockdowns", label: "ダウン" },
  { key: "revives", label: "復活" },
  { key: "respawns", label: "リスポーン" },
  { key: "shots", label: "ショット" },
  { key: "hits", label: "命中" },
  { key: "headshots", label: "ヘッドショット" },
];

function memberStatsTable(member, matchNumbers) {
  const stats = member.statsByMatch || [];
  const totals = {};
  MEMBER_STAT_FIELDS.forEach(({ key }) => {
    totals[key] = sumArray(stats.map((entry) => entry?.[key]));
  });
  totals.survivalTime = sumArray(stats.map((entry) => entry?.survivalTime));
  const accPct = totals.shots ? (totals.hits / totals.shots) * 100 : null;
  const hsrPct = totals.shots ? (totals.headshots / totals.shots) * 100 : null;

  return `
    <div class="table-wrap member-stat-table">
      <table class="stat-table">
        <thead><tr><th>${escapeHtml(member.name || "メンバー")}</th>${matchNumbers.map((m) => `<th>M${m}</th>`).join("")}<th>合計</th></tr></thead>
        <tbody>
          ${MEMBER_STAT_FIELDS.map(
            ({ key, label }) => `
          <tr><th>${label}</th>${matchNumbers.map((m, index) => `<td>${numOrDash(stats[index]?.[key])}</td>`).join("")}<td>${numOrDash(totals[key])}</td></tr>`,
          ).join("")}
          <tr><th>生存時間</th>${matchNumbers.map((m, index) => `<td>${formatSurvival(stats[index]?.survivalTime)}</td>`).join("")}<td>${formatSurvival(totals.survivalTime)}</td></tr>
          <tr><th>命中率(Acc%)</th>${matchNumbers.map(() => `<td>-</td>`).join("")}<td>${formatPercent(accPct)}</td></tr>
          <tr><th>ヘッドショット率(HSR%)</th>${matchNumbers.map(() => `<td>-</td>`).join("")}<td>${formatPercent(hsrPct)}</td></tr>
        </tbody>
      </table>
    </div>
  `;
}

function formatSurvival(totalSeconds) {
  if (typeof totalSeconds !== "number" || Number.isNaN(totalSeconds)) return "-";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return `${value.toFixed(1)}%`;
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

function pageHero(title, lead) {
  return `
    <section class="hero page-hero">
      <div class="section-inner">
        <div class="eyebrow">YUTORI EVENT ARCHIVE / Firebase版</div>
        <h1>${escapeHtml(title)}</h1>
        <p class="hero-copy">${escapeHtml(lead)}</p>
      </div>
    </section>
  `;
}

function formatDate(value) {
  if (!value) return "日付未設定";
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
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
