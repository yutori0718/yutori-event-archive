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
  setStatus(result.message || "GitHubへ公開しました。");
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
  bindEventHandlers();
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
  data.apex.events ||= [];
  clampSelection("apex", data.apex.events);
  const event = data.apex.events[selected.apex];
  app.innerHTML = `
    <section class="panel">
      <h2>Apexカスタム</h2>
      <div class="actions inline-actions">
        <button class="primary" data-action="add-apex-event">Apexカスタムを追加</button>
      </div>
      ${eventSelect("apex", data.apex.events)}
      ${event ? eventFields(event, "apex") : empty("大会データがありません。")}
    </section>
    ${event ? apexTeams(event) : ""}
  `;
  bindEventSelect("apex");
}

function renderWildcard() {
  data.wildcard.events ||= [];
  clampSelection("wildcard", data.wildcard.events);
  const event = data.wildcard.events[selected.wildcard];
  app.innerHTML = `
    <section class="panel">
      <h2>ワイルドカード</h2>
      <div class="actions inline-actions">
        <button class="primary" data-action="add-wildcard-event">ワイルドカードカスタムを追加</button>
      </div>
      ${eventSelect("wildcard", data.wildcard.events)}
      ${event ? eventFields(event, "wildcard") : empty("大会データがありません。")}
    </section>
    ${event ? wildcardParticipants(event) : ""}
    ${event ? wildcardMatchTeams(event) : ""}
  `;
  bindEventSelect("wildcard");
}

function renderHistory() {
  data.participation.entries ||= [];
  clampSelection("history", data.participation.entries);
  const entry = data.participation.entries[selected.history];
  app.innerHTML = `
    <section class="panel">
      <h2>出場履歴</h2>
      <div class="actions inline-actions">
        <button class="primary" data-action="add-history">出場履歴を追加</button>
      </div>
      ${historySelect(data.participation.entries)}
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
      <p class="status">保存先は /images/... または /public/images/... から始まるパスにしてください。各編集欄の「PCから画像を選択」でも変更できます。</p>
      <div class="grid">
        <label>保存先パス<input id="imagePath" value="/images/wildcard-custom/waika-vol1/thumbnail.png"></label>
        <label>画像ファイル<input id="imageFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"></label>
      </div>
      <div class="actions inline-actions">
        <button id="uploadButton" class="primary">画像を保存</button>
      </div>
      <div id="imagePreview" class="preview"></div>
    </section>
  `;

  const fileInput = document.querySelector("#imageFile");
  fileInput.addEventListener("change", () => previewFile(fileInput, "#imagePreview"));
  document.querySelector("#uploadButton").addEventListener("click", async () => {
    const file = fileInput.files?.[0];
    if (!file) return setStatus("画像ファイルを選んでください。");
    const result = await uploadImage(document.querySelector("#imagePath").value, file);
    setStatus(`画像を保存しました: ${result.path}`);
  });
}

function eventFields(event, type) {
  return `
    <div class="grid">
      ${field("id", "ID", event.id)}
      ${field("title", "大会名", event.title)}
      ${field("date", "開催日", event.date)}
      ${field("category", "カテゴリ", event.category)}
      ${imageField("thumbnail", "大会サムネイル", event.thumbnail, defaultEventImagePath(type, event, "thumbnail.png"))}
      ${imageField("teamImage", "チーム/参加者一覧画像", event.teamImage, defaultEventImagePath(type, event, "team-list.png"))}
      ${imageField("totalResultImage", "総合結果画像", event.totalResultImage, defaultEventImagePath(type, event, "result-total.png"))}
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
      <div class="actions inline-actions">
        <button class="primary" data-action="add-apex-team">チームを追加</button>
      </div>
      <div class="list">
        ${event.teams.map((team, index) => `
          <details>
            <summary>${escapeHtml(team.name || `チーム${index + 1}`)}</summary>
            <div class="grid">
              ${field(`team-${index}-id`, "チームID", team.id)}
              ${field(`team-${index}-name`, "チーム名", team.name)}
              ${imageField(`team-${index}-thumbnail`, "チーム紹介サムネ", team.thumbnail, defaultTeamImagePath(event, index))}
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
        ${Array.from({ length: Math.max(30, event.participants.length) }, (_, index) => {
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
      <div class="actions inline-actions">
        <button class="primary" data-action="add-wildcard-match">試合を追加</button>
      </div>
      <div class="list">
        ${event.matchTeams.map((match, matchIndex) => `
          <details>
            <summary>${escapeHtml(match.matchName || `Match${matchIndex + 1}`)}</summary>
            <div class="actions inline-actions">
              <button data-action="add-wildcard-team" data-match-index="${matchIndex}">この試合にチームを追加</button>
            </div>
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
      ${imageField("history-thumbnail", "サムネイル", entry.thumbnail, defaultHistoryImagePath(entry, "thumbnail.png"))}
      ${imageField("history-teamImage", "チーム画像", entry.teamImage, defaultHistoryImagePath(entry, "team-image.png"))}
      ${field("history-archiveUrl", "配信URL", entry.archiveUrl)}
    </div>
    <div class="grid three">
      ${[0, 1, 2].map((index) => field(`history-member-${index}`, `メンバー${index + 1}`, entry.members?.[index] || "")).join("")}
    </div>
    ${area("history-memo", "メモ", entry.memo)}
  `;
}

function bindEventHandlers() {
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      collect();
      handleAction(button.dataset.action, button.dataset);
      render();
    });
  });

  document.querySelectorAll("[data-image-file]").forEach((input) => {
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      const targetName = input.dataset.imageFile;
      const pathInput = document.querySelector(`[name="${CSS.escape(targetName)}"]`);
      const defaultPath = input.dataset.defaultPath;
      const currentPath = pathInput.value.trim();
      const uploadPath = currentPath || defaultPath || `/images/uploads/${safeFileName(file.name)}`;
      const result = await uploadImage(uploadPath, file);
      pathInput.value = result.path;
      setStatus(`画像を保存しました: ${result.path}`);
    });
  });
}

function handleAction(action, dataset) {
  if (action === "add-apex-event") addApexEvent();
  if (action === "add-wildcard-event") addWildcardEvent();
  if (action === "add-history") addHistory();
  if (action === "add-apex-team") addApexTeam();
  if (action === "add-wildcard-match") addWildcardMatch();
  if (action === "add-wildcard-team") addWildcardTeam(Number(dataset.matchIndex));
}

function addApexEvent() {
  data.apex.events ||= [];
  const index = data.apex.events.length + 1;
  const id = `apex-custom-${index}`;
  data.apex.events.push({
    id,
    title: `Apexカスタム ${index}`,
    date: "",
    category: "Apexカスタム",
    summary: "",
    description: "",
    thumbnail: `/images/apex-custom/${id}/thumbnail.png`,
    teamImage: `/images/apex-custom/${id}/team-list.png`,
    totalResultImage: `/images/apex-custom/${id}/result-total.png`,
    archiveUrl: "",
    edYoutubeUrl: "",
    teams: [],
    matches: [],
    sponsors: [],
    memo: "",
  });
  selected.apex = data.apex.events.length - 1;
}

function addWildcardEvent() {
  data.wildcard.events ||= [];
  const index = data.wildcard.events.length + 1;
  const id = `wildcard-custom-${index}`;
  data.wildcard.events.push({
    id,
    title: `ワイルドカードカスタム ${index}`,
    date: "",
    category: "Apexワイルドカードカスタム",
    summary: "",
    description: "",
    thumbnail: `/images/wildcard-custom/${id}/thumbnail.png`,
    teamImage: `/images/wildcard-custom/${id}/team-list.png`,
    totalResultImage: `/images/wildcard-custom/${id}/result-total.png`,
    archiveUrl: "",
    edYoutubeUrl: "",
    participants: [],
    matchTeams: [],
    matches: [],
    sponsors: [],
    memo: "",
  });
  selected.wildcard = data.wildcard.events.length - 1;
}

function addHistory() {
  data.participation.entries ||= [];
  const index = data.participation.entries.length + 1;
  const id = `participation-${index}`;
  data.participation.entries.push({
    id,
    title: `出場履歴 ${index}`,
    date: "",
    teamName: "",
    members: ["", "", ""],
    finalRank: "",
    thumbnail: `/images/participation-history/${id}/thumbnail.png`,
    teamImage: `/images/participation-history/${id}/team-image.png`,
    archiveUrl: "",
    memo: "",
  });
  selected.history = data.participation.entries.length - 1;
}

function addApexTeam() {
  const event = data.apex.events?.[selected.apex];
  if (!event) return;
  event.teams ||= [];
  const index = event.teams.length + 1;
  event.teams.push({
    id: `team-${index}`,
    name: `チーム${index}`,
    thumbnail: `/images/apex-custom/${event.id}/teams/team-${index}/thumbnail.png`,
    members: [
      { name: "メンバー1", streamUrl: "" },
      { name: "メンバー2", streamUrl: "" },
      { name: "メンバー3", streamUrl: "" },
    ],
    note: "",
  });
}

function addWildcardMatch() {
  const event = data.wildcard.events?.[selected.wildcard];
  if (!event) return;
  event.matchTeams ||= [];
  const index = event.matchTeams.length + 1;
  event.matchTeams.push({
    matchName: `Match${index}`,
    teams: [],
  });
}

function addWildcardTeam(matchIndex) {
  const event = data.wildcard.events?.[selected.wildcard];
  const match = event?.matchTeams?.[matchIndex];
  if (!match) return;
  match.teams ||= [];
  const index = match.teams.length + 1;
  match.teams.push({
    name: `チーム ${index}`,
    members: ["", "", ""],
  });
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
  event.participants = Array.from({ length: Math.max(30, event.participants?.length || 0) }, (_, index) => ({
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
  if (!events.length) return "";
  return `<select data-select="${type}">${events.map((event, index) => `<option value="${index}" ${index === selected[type] ? "selected" : ""}>${escapeHtml(event.title || event.id)}</option>`).join("")}</select>`;
}

function historySelect(entries) {
  if (!entries.length) return "";
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

function imageField(name, label, current = "", defaultPath = "") {
  return `
    <label class="image-field">
      ${escapeHtml(label)}
      <input name="${escapeHtml(name)}" value="${escapeAttribute(current)}" placeholder="${escapeAttribute(defaultPath)}">
      <span class="file-button">
        PCから画像を選択
        <input data-image-file="${escapeHtml(name)}" data-default-path="${escapeAttribute(defaultPath)}" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml">
      </span>
    </label>
  `;
}

function area(name, label, current = "") {
  return `<label>${escapeHtml(label)}<textarea name="${escapeHtml(name)}">${escapeHtml(current || "")}</textarea></label>`;
}

function value(name) {
  return document.querySelector(`[name="${CSS.escape(name)}"]`)?.value.trim() || "";
}

async function uploadImage(path, file) {
  const dataUrl = await readFileAsDataUrl(file);
  return postJson("/api/upload-image", { path, dataUrl });
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

function previewFile(fileInput, previewSelector) {
  const file = fileInput.files?.[0];
  const preview = document.querySelector(previewSelector);
  if (!file || !preview) return;
  const reader = new FileReader();
  reader.onload = () => {
    preview.innerHTML = `<img src="${reader.result}" alt="">`;
  };
  reader.readAsDataURL(file);
}

function defaultEventImagePath(type, event, fileName) {
  const root = type === "apex" ? "apex-custom" : "wildcard-custom";
  return `/images/${root}/${event.id || "new-event"}/${fileName}`;
}

function defaultTeamImagePath(event, index) {
  return `/images/apex-custom/${event.id || "new-event"}/teams/team-${index + 1}/thumbnail.png`;
}

function defaultHistoryImagePath(entry, fileName) {
  return `/images/participation-history/${entry.id || "new-history"}/${fileName}`;
}

function clampSelection(type, items) {
  selected[type] = Math.min(Math.max(selected[type] || 0, 0), Math.max(items.length - 1, 0));
}

function safeFileName(name) {
  return name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "") || "image.png";
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
