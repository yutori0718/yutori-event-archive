const app = document.querySelector("#app");
const statusBox = document.querySelector("#status");
const tabs = [...document.querySelectorAll(".tab")];
const saveButton = document.querySelector("#saveButton");
const publishButton = document.querySelector("#publishButton");

let data;
let activeTab = "home";
let selected = {
  apex: 0,
  wildcard: 0,
  history: 0,
};

load();

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    collect();
    activeTab = tab.dataset.tab;
    tabs.forEach((item) => item.classList.toggle("active", item === tab));
    render();
  });
});

saveButton.addEventListener("click", async () => {
  collect();
  const result = await postJson("/api/save", data);
  setStatus(result.message || "保存しました。");
});

publishButton.addEventListener("click", async () => {
  collect();
  await postJson("/api/save", data);
  setStatus("GitHubへ公開中です...");
  const result = await postJson("/api/publish", {});
  setStatus(result.message || "公開しました。");
});

async function load() {
  const response = await fetch("/api/data");
  data = await response.json();
  setStatus("読み込み完了。編集後は「保存」、公開する場合は「GitHubへ公開」を押してください。");
  render();
}

function render() {
  if (!data) return;
  if (activeTab === "home") renderHome();
  if (activeTab === "apex") renderApex();
  if (activeTab === "wildcard") renderWildcard();
  if (activeTab === "history") renderHistory();
  if (activeTab === "images") renderImages();
}

function renderHome() {
  const home = data.site.home || {};
  app.innerHTML = `
    <section class="panel">
      <h2>Topページ</h2>
      <div class="grid">
        ${field("heroTitle", "メイン見出し", home.heroTitle)}
        ${field("heroCopy", "説明文", home.heroCopy)}
        ${field("apexButtonLabel", "Apexボタン", home.apexButtonLabel)}
        ${field("historyButtonLabel", "出場履歴ボタン", home.historyButtonLabel)}
        ${field("apexSectionTitle", "Apexカスタム見出し", home.apexSectionTitle)}
        ${field("wildcardSectionTitle", "ワイルドカード見出し", home.wildcardSectionTitle)}
      </div>
    </section>
  `;
}

function renderApex() {
  const events = data.apex.events || [];
  const event = events[selected.apex] || events[0];
  app.innerHTML = `
    <section class="panel">
      <h2>Apexカスタム</h2>
      ${eventSelect("apex", events)}
      ${event ? eventFields(event) : empty("大会データがありません。")}
    </section>
    ${event ? apexTeams(event) : ""}
  `;
  bindEventSelect("apex");
}

function renderWildcard() {
  const events = data.wildcard.events || [];
  const event = events[selected.wildcard] || events[0];
  app.innerHTML = `
    <section class="panel">
      <h2>ワイルドカード</h2>
      ${eventSelect("wildcard", events)}
      ${event ? eventFields(event) : empty("大会データがありません。")}
    </section>
    ${event ? wildcardParticipants(event) : ""}
    ${event ? wildcardMatchTeams(event) : ""}
  `;
  bindEventSelect("wildcard");
}

function renderHistory() {
  const entries = data.participation.entries || [];
  const entry = entries[selected.history] || entries[0];
  app.innerHTML = `
    <section class="panel">
      <h2>出場履歴</h2>
      ${historySelect(entries)}
      ${entry ? historyFields(entry) : empty("出場履歴がありません。")}
    </section>
  `;
  const select = document.querySelector("[data-select='history']");
  select?.addEventListener("change", () => {
    collect();
    selected.history = Number(select.value);
    render();
  });
}

function renderImages() {
  app.innerHTML = `
    <section class="panel">
      <h2>画像アップロード</h2>
      <p class="status">保存先は /images/... または /public/images/... から始まるパスにしてください。</p>
      <div class="grid">
        <label>保存先パス<input id="imagePath" value="/images/wildcard-custom/waika-vol1/thumbnail.png"></label>
        <label>画像ファイル<input id="imageFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"></label>
      </div>
      <div class="actions" style="margin-top:12px">
        <button id="uploadButton" class="primary">画像を保存</button>
      </div>
      <div id="imagePreview" class="preview" style="margin-top:12px"></div>
    </section>
  `;

  const fileInput = document.querySelector("#imageFile");
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    const preview = document.querySelector("#imagePreview");
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      preview.innerHTML = `<img src="${reader.result}" alt="">`;
    };
    reader.readAsDataURL(file);
  });

  document.querySelector("#uploadButton").addEventListener("click", async () => {
    const file = fileInput.files?.[0];
    if (!file) return setStatus("画像ファイルを選んでください。");
    const dataUrl = await readFileAsDataUrl(file);
    const result = await postJson("/api/upload-image", {
      path: document.querySelector("#imagePath").value,
      dataUrl,
    });
    setStatus(`画像を保存しました: ${result.path}`);
  });
}

function eventFields(event) {
  return `
    <div class="grid">
      ${field("id", "ID", event.id)}
      ${field("title", "大会名", event.title)}
      ${field("date", "開催日", event.date)}
      ${field("category", "カテゴリ", event.category)}
      ${field("thumbnail", "大会サムネイル", event.thumbnail)}
      ${field("teamImage", "チーム/参加者一覧画像", event.teamImage)}
      ${field("totalResultImage", "総合結果画像", event.totalResultImage)}
      ${field("archiveUrl", "配信URL", event.archiveUrl)}
      ${field("edYoutubeUrl", "ED YouTube URL", event.edYoutubeUrl)}
    </div>
    <div class="grid">
      ${area("summary", "一覧説明", event.summary)}
      ${area("description", "大会概要", event.description)}
      ${area("memo", "メモ", event.memo)}
    </div>
  `;
}

function apexTeams(event) {
  event.teams ||= [];
  return `
    <section class="panel">
      <h2>チーム紹介</h2>
      <div class="list">
        ${event.teams.map((team, index) => `
          <details>
            <summary>${escapeHtml(team.name || `チーム${index + 1}`)}</summary>
            <div class="grid">
              ${field(`team-${index}-id`, "チームID", team.id)}
              ${field(`team-${index}-name`, "チーム名", team.name)}
              ${field(`team-${index}-thumbnail`, "チーム紹介サムネ", team.thumbnail)}
              ${field(`team-${index}-note`, "メモ", team.note)}
            </div>
            <div class="grid three">
              ${[0, 1, 2].map((memberIndex) => field(`team-${index}-member-${memberIndex}`, `メンバー${memberIndex + 1}`, team.members?.[memberIndex]?.name || "")).join("")}
            </div>
          </details>
        `).join("")}
      </div>
    </section>
  `;
}

function wildcardParticipants(event) {
  event.participants ||= [];
  return `
    <section class="panel">
      <h2>参加者一覧</h2>
      <div class="list">
        ${Array.from({ length: 30 }, (_, index) => {
          const participant = event.participants[index] || {};
          return `
            <div class="row">
              <label>No.<input value="${index + 1}" disabled></label>
              ${field(`participant-${index}`, "名前", participant.name)}
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function wildcardMatchTeams(event) {
  event.matchTeams ||= [];
  return `
    <section class="panel">
      <h2>各試合チーム構成</h2>
      <div class="list">
        ${event.matchTeams.map((match, matchIndex) => `
          <details>
            <summary>${escapeHtml(match.matchName || `Match${matchIndex + 1}`)}</summary>
            ${field(`match-${matchIndex}-name`, "試合名", match.matchName)}
            <div class="list">
              ${(match.teams || []).map((team, teamIndex) => `
                <div class="row compact">
                  ${field(`match-${matchIndex}-team-${teamIndex}-name`, `チーム${teamIndex + 1}`, team.name)}
                  ${[0, 1, 2].map((memberIndex) => field(`match-${matchIndex}-team-${teamIndex}-member-${memberIndex}`, `メンバー${memberIndex + 1}`, team.members?.[memberIndex] || "")).join("")}
                </div>
              `).join("")}
            </div>
          </details>
        `).join("")}
      </div>
    </section>
  `;
}

function historyFields(entry) {
  return `
    <div class="grid">
      ${field("history-id", "ID", entry.id)}
      ${field("history-title", "大会名", entry.title)}
      ${field("history-date", "開催日", entry.date)}
      ${field("history-teamName", "チーム名", entry.teamName)}
      ${field("history-finalRank", "最終順位", entry.finalRank)}
      ${field("history-thumbnail", "サムネイル", entry.thumbnail)}
      ${field("history-teamImage", "チーム画像", entry.teamImage)}
      ${field("history-archiveUrl", "配信URL", entry.archiveUrl)}
    </div>
    <div class="grid three">
      ${[0, 1, 2].map((index) => field(`history-member-${index}`, `メンバー${index + 1}`, entry.members?.[index] || "")).join("")}
    </div>
    ${area("history-memo", "メモ", entry.memo)}
  `;
}

function collect() {
  if (!data) return;
  if (activeTab === "home") collectHome();
  if (activeTab === "apex") collectApex();
  if (activeTab === "wildcard") collectWildcard();
  if (activeTab === "history") collectHistory();
}

function collectHome() {
  data.site.home ||= {};
  for (const key of ["heroTitle", "heroCopy", "apexButtonLabel", "historyButtonLabel", "apexSectionTitle", "wildcardSectionTitle"]) {
    data.site.home[key] = value(key);
  }
}

function collectApex() {
  const event = data.apex.events?.[selected.apex];
  if (!event) return;
  collectEvent(event);
  event.teams = (event.teams || []).map((team, index) => ({
    ...team,
    id: value(`team-${index}-id`),
    name: value(`team-${index}-name`),
    thumbnail: value(`team-${index}-thumbnail`),
    note: value(`team-${index}-note`),
    members: [0, 1, 2].map((memberIndex) => ({
      ...(team.members?.[memberIndex] || {}),
      name: value(`team-${index}-member-${memberIndex}`),
    })),
  }));
}

function collectWildcard() {
  const event = data.wildcard.events?.[selected.wildcard];
  if (!event) return;
  collectEvent(event);
  event.participants = Array.from({ length: 30 }, (_, index) => ({
    ...(event.participants?.[index] || {}),
    name: value(`participant-${index}`),
  })).filter((participant) => participant.name);
  event.matchTeams = (event.matchTeams || []).map((match, matchIndex) => ({
    ...match,
    matchName: value(`match-${matchIndex}-name`),
    teams: (match.teams || []).map((team, teamIndex) => ({
      ...team,
      name: value(`match-${matchIndex}-team-${teamIndex}-name`),
      members: [0, 1, 2].map((memberIndex) => value(`match-${matchIndex}-team-${teamIndex}-member-${memberIndex}`)).filter(Boolean),
    })),
  }));
}

function collectHistory() {
  const entry = data.participation.entries?.[selected.history];
  if (!entry) return;
  entry.id = value("history-id");
  entry.title = value("history-title");
  entry.date = value("history-date");
  entry.teamName = value("history-teamName");
  entry.finalRank = value("history-finalRank");
  entry.thumbnail = value("history-thumbnail");
  entry.teamImage = value("history-teamImage");
  entry.archiveUrl = value("history-archiveUrl");
  entry.memo = value("history-memo");
  entry.members = [0, 1, 2].map((index) => value(`history-member-${index}`)).filter(Boolean);
}

function collectEvent(event) {
  for (const key of ["id", "title", "date", "category", "thumbnail", "teamImage", "totalResultImage", "archiveUrl", "edYoutubeUrl", "summary", "description", "memo"]) {
    event[key] = value(key);
  }
}

function eventSelect(type, events) {
  return `<select data-select="${type}">${events.map((event, index) => `<option value="${index}" ${index === selected[type] ? "selected" : ""}>${escapeHtml(event.title || event.id)}</option>`).join("")}</select>`;
}

function historySelect(entries) {
  return `<select data-select="history">${entries.map((entry, index) => `<option value="${index}" ${index === selected.history ? "selected" : ""}>${escapeHtml(entry.title || entry.id)}</option>`).join("")}</select>`;
}

function bindEventSelect(type) {
  const select = document.querySelector(`[data-select="${type}"]`);
  select?.addEventListener("change", () => {
    collect();
    selected[type] = Number(select.value);
    render();
  });
}

function field(name, label, current = "") {
  return `<label>${escapeHtml(label)}<input name="${escapeHtml(name)}" value="${escapeAttribute(current)}"></label>`;
}

function area(name, label, current = "") {
  return `<label>${escapeHtml(label)}<textarea name="${escapeHtml(name)}">${escapeHtml(current || "")}</textarea></label>`;
}

function value(name) {
  return document.querySelector(`[name="${CSS.escape(name)}"]`)?.value.trim() || "";
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok || result.ok === false) throw new Error(result.error || "エラーが発生しました。");
  return result;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function setStatus(message) {
  statusBox.textContent = message;
}

function empty(message) {
  return `<div class="status">${escapeHtml(message)}</div>`;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value = "") {
  return escapeHtml(value).replaceAll("\n", " ");
}
