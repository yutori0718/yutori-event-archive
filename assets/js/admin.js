const OWNER = "yutori0718";
const REPO = "yutori-event-archive";
const BRANCH = "main";
const DATA_PATH = "data/apex-custom.json";
const TOKEN_KEY = "yutoriAdminToken";
const API = "https://api.github.com";

const root = document.querySelector("#admin-app");

const state = {
  token: localStorage.getItem(TOKEN_KEY) || "",
  view: "login",
  busy: false,
  message: "",
  messageType: "info",
  data: null,
  sha: null,
  editingId: null,
  form: null,
};

init();

async function init() {
  root.addEventListener("click", onClick);
  root.addEventListener("input", onInput);
  root.addEventListener("change", onChange);
  if (state.token) {
    await loginWithToken(state.token, { silent: true });
  } else {
    render();
  }
}

// ---------- GitHub API ----------

async function ghRequest(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${state.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    throw new Error(body?.message || `GitHub APIエラー (${response.status})`);
  }
  return body;
}

async function fetchRepoInfo() {
  return ghRequest(`/repos/${OWNER}/${REPO}`);
}

async function fetchDataFile() {
  const result = await ghRequest(`/repos/${OWNER}/${REPO}/contents/${DATA_PATH}?ref=${BRANCH}`);
  const json = JSON.parse(decodeUtf8Base64(result.content));
  return { json, sha: result.sha };
}

async function saveDataFile(json, message) {
  const content = encodeUtf8Base64(`${JSON.stringify(json, null, 2)}\n`);
  const result = await ghRequest(`/repos/${OWNER}/${REPO}/contents/${DATA_PATH}`, {
    method: "PUT",
    body: JSON.stringify({ message, content, sha: state.sha, branch: BRANCH }),
  });
  state.sha = result.content.sha;
}

async function uploadImageFile(repoPath, file) {
  const cleanPath = repoPath.replace(/^\//, "");
  const dataUrl = await fileToDataUrl(file);
  const base64 = dataUrl.split(",")[1];
  let sha;
  try {
    const existing = await ghRequest(`/repos/${OWNER}/${REPO}/contents/${cleanPath}?ref=${BRANCH}`);
    sha = existing.sha;
  } catch {
    sha = undefined;
  }
  const body = { message: `Upload ${cleanPath}`, content: base64, branch: BRANCH };
  if (sha) body.sha = sha;
  const result = await ghRequest(`/repos/${OWNER}/${REPO}/contents/${cleanPath}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return result.content.download_url || "";
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function decodeUtf8Base64(base64) {
  const binary = atob(base64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

function encodeUtf8Base64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

// ---------- Auth ----------

async function loginWithToken(token, { silent = false } = {}) {
  state.token = token.trim();
  state.busy = true;
  if (!silent) render();
  try {
    const repo = await fetchRepoInfo();
    if (repo.permissions?.push !== true) {
      throw new Error("このトークンには書き込み権限がありません。Contents を Read and write にしたトークンでログインしてください。");
    }
    localStorage.setItem(TOKEN_KEY, state.token);
    const { json, sha } = await fetchDataFile();
    state.data = json;
    state.sha = sha;
    state.view = "dashboard";
    state.message = "";
  } catch (error) {
    localStorage.removeItem(TOKEN_KEY);
    state.token = "";
    state.view = "login";
    state.message = error.message || "ログインに失敗しました。";
    state.messageType = "error";
  } finally {
    state.busy = false;
    render();
  }
}

function logout() {
  localStorage.removeItem(TOKEN_KEY);
  state.token = "";
  state.data = null;
  state.sha = null;
  state.view = "login";
  state.message = "";
  render();
}

// ---------- Event handling (delegation) ----------

function onClick(event) {
  const actionEl = event.target.closest("[data-action]");
  if (!actionEl) return;
  const action = actionEl.dataset.action;
  const index = actionEl.dataset.index !== undefined ? Number(actionEl.dataset.index) : undefined;
  const teamIndex = actionEl.dataset.teamIndex !== undefined ? Number(actionEl.dataset.teamIndex) : undefined;

  if (action === "login-submit") {
    event.preventDefault();
    const input = root.querySelector("#token-input");
    if (input?.value.trim()) loginWithToken(input.value.trim());
    return;
  }
  if (action === "logout") return logout();
  if (action === "create-event") return openForm(null);
  if (action === "edit-event") return openForm(state.data.events.find((entry) => entry.id === actionEl.dataset.id));
  if (action === "cancel-form") return closeForm();
  if (action === "save-event") return handleSave();
  if (action === "delete-event") return handleDeleteEvent();
  if (action === "add-map") return addMap();
  if (action === "remove-map") return removeMap(index);
  if (action === "add-team") return addTeam();
  if (action === "remove-team") return removeTeam(index);
  if (action === "upload-image") {
    const fileInput = actionEl.parentElement.querySelector('input[type="file"]');
    fileInput?.click();
    return;
  }
}

function onChange(event) {
  const target = event.target;
  if (target.matches('input[type="file"][data-image-path]')) {
    const file = target.files?.[0];
    if (file) handleImageUpload(target.dataset.imagePath, file, target);
    return;
  }
  if (target.matches("[data-hidden-section]")) {
    const section = target.dataset.hiddenSection;
    const set = new Set(state.form.hiddenSections || []);
    if (target.checked) set.add(section);
    else set.delete(section);
    state.form.hiddenSections = Array.from(set);
    return;
  }
}

function onInput(event) {
  const target = event.target;
  const path = target.dataset.path;
  if (!path || !state.form) return;
  const type = target.dataset.type || "text";
  let value = target.value;
  if (type === "number") value = value === "" ? null : Number(value);
  setPath(state.form, path, value);
}

// ---------- Form helpers ----------

function blankEvent() {
  return {
    id: "",
    title: "",
    date: "",
    category: "Apexカスタム",
    summary: "",
    description: "",
    thumbnail: "",
    teamImage: "",
    totalResultImage: "",
    archiveUrl: "",
    edYoutubeUrl: "",
    memo: "",
    hiddenSections: ["totalResults", "totalResultImage", "matches"],
    maps: ["マップ1", "マップ2", "マップ3"],
    teams: [],
    matches: [],
    totalResults: [],
    sponsors: [],
  };
}

function blankTeam(matchCount) {
  return {
    id: `team-${Date.now().toString(36)}`,
    name: "",
    thumbnail: "",
    note: "",
    rank: null,
    point: null,
    matchPoint: null,
    rankBonus: null,
    bestPlace: null,
    matchResults: Array.from({ length: matchCount }, (_, i) => ({
      match: i + 1,
      teamRank: null,
      teamPoint: null,
      teamKills: null,
    })),
    members: Array.from({ length: 3 }, () => blankMember(matchCount)),
  };
}

function blankMember(matchCount) {
  return {
    name: "",
    standImage: "",
    streamUrl: "",
    damageByMatch: Array.from({ length: matchCount }, () => null),
    killsByMatch: Array.from({ length: matchCount }, () => null),
  };
}

function openForm(event) {
  state.editingId = event ? event.id : null;
  state.form = event ? normalizeFormEvent(event) : blankEvent();
  state.view = "form";
  state.message = "";
  render();
}

function normalizeFormEvent(event) {
  const clone = JSON.parse(JSON.stringify(event));
  clone.maps = clone.maps || [];
  clone.hiddenSections = clone.hiddenSections || [];
  const matchCount = clone.maps.length;
  clone.teams = (clone.teams || []).map((team) => normalizeFormTeam(team, matchCount));
  return clone;
}

function normalizeFormTeam(team, matchCount) {
  const matchResults = Array.from({ length: matchCount }, (_, i) => {
    const existing = (team.matchResults || []).find((entry) => Number(entry.match) === i + 1) || team.matchResults?.[i];
    return {
      match: i + 1,
      teamRank: existing?.teamRank ?? null,
      teamPoint: existing?.teamPoint ?? null,
      teamKills: existing?.teamKills ?? null,
    };
  });
  const members = Array.from({ length: 3 }, (_, i) => {
    const existing = team.members?.[i] || {};
    return {
      name: existing.name || "",
      standImage: existing.standImage || "",
      streamUrl: existing.streamUrl || "",
      damageByMatch: Array.from({ length: matchCount }, (_, j) => existing.damageByMatch?.[j] ?? null),
      killsByMatch: Array.from({ length: matchCount }, (_, j) => existing.killsByMatch?.[j] ?? null),
    };
  });
  return {
    id: team.id || `team-${Date.now().toString(36)}`,
    name: team.name || "",
    thumbnail: team.thumbnail || "",
    note: team.note || "",
    rank: team.rank ?? null,
    point: team.point ?? null,
    matchPoint: team.matchPoint ?? null,
    rankBonus: team.rankBonus ?? null,
    bestPlace: team.bestPlace ?? null,
    matchResults,
    members,
  };
}

function closeForm() {
  state.view = "dashboard";
  state.form = null;
  state.editingId = null;
  render();
}

function syncMatchCount() {
  const n = state.form.maps.length;
  state.form.teams.forEach((team) => {
    team.matchResults = Array.from({ length: n }, (_, i) => {
      const existing = team.matchResults[i];
      return {
        match: i + 1,
        teamRank: existing?.teamRank ?? null,
        teamPoint: existing?.teamPoint ?? null,
        teamKills: existing?.teamKills ?? null,
      };
    });
    team.members.forEach((member) => {
      member.damageByMatch = Array.from({ length: n }, (_, i) => member.damageByMatch[i] ?? null);
      member.killsByMatch = Array.from({ length: n }, (_, i) => member.killsByMatch[i] ?? null);
    });
  });
}

function addMap() {
  state.form.maps.push(`マップ${state.form.maps.length + 1}`);
  syncMatchCount();
  render();
}

function removeMap(index) {
  if (state.form.maps.length <= 1) {
    alert("マップ(試合)は最低1件必要です。");
    return;
  }
  if (!confirm(`M${index + 1} を削除します。全チームのその試合の成績データも削除されます。よろしいですか？`)) return;
  state.form.maps.splice(index, 1);
  syncMatchCount();
  render();
}

function addTeam() {
  state.form.teams.push(blankTeam(state.form.maps.length));
  render();
}

function removeTeam(index) {
  const team = state.form.teams[index];
  if (!confirm(`「${team.name || "チーム未設定"}」を削除しますか？`)) return;
  state.form.teams.splice(index, 1);
  render();
}

async function handleImageUpload(fallbackPath, file, inputEl) {
  const statusEl = inputEl.parentElement.querySelector(".upload-status");
  const textInput = inputEl.parentElement.querySelector('input[type="text"][data-path]');
  const path = (textInput?.value.trim() || fallbackPath).trim();
  if (statusEl) statusEl.textContent = "アップロード中...";
  try {
    await uploadImageFile(path, file);
    if (statusEl) statusEl.textContent = "アップロード完了";
    if (textInput) {
      textInput.value = path;
      setPath(state.form, textInput.dataset.path, path);
    }
  } catch (error) {
    if (statusEl) statusEl.textContent = `失敗: ${error.message}`;
  }
}

function validateForm(form) {
  const errors = [];
  if (!form.title.trim()) errors.push("大会名を入力してください。");
  if (!state.editingId) {
    if (!/^[a-z0-9-]+$/.test(form.id.trim())) {
      errors.push("IDは半角英小文字・数字・ハイフンのみで入力してください。");
    } else if (state.data.events.some((entry) => entry.id === form.id.trim())) {
      errors.push("同じIDの大会がすでに存在します。");
    }
  }
  return errors;
}

async function handleSave() {
  const errors = validateForm(state.form);
  if (errors.length) {
    state.message = errors.join("\n");
    state.messageType = "error";
    render();
    return;
  }
  state.busy = true;
  state.message = "";
  render();
  try {
    const { json, sha } = await fetchDataFile();
    state.data = json;
    state.sha = sha;
    state.data.events = state.data.events || [];
    const cleaned = JSON.parse(JSON.stringify(state.form));
    if (state.editingId) {
      const index = state.data.events.findIndex((entry) => entry.id === state.editingId);
      if (index === -1) throw new Error("編集対象の大会が見つかりませんでした（他の場所で削除された可能性があります）。");
      state.data.events[index] = cleaned;
    } else {
      cleaned.id = cleaned.id.trim();
      state.data.events.push(cleaned);
    }
    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    await saveDataFile(state.data, `${state.editingId ? "Update" : "Add"} apex event: ${cleaned.title} (${stamp})`);
    state.view = "dashboard";
    state.message = "保存しました。数十秒〜数分でサイトに反映されます。";
    state.messageType = "info";
    state.form = null;
    state.editingId = null;
  } catch (error) {
    state.message = `保存に失敗しました: ${error.message}`;
    state.messageType = "error";
  } finally {
    state.busy = false;
    render();
  }
}

async function handleDeleteEvent() {
  if (!state.editingId) return;
  if (!confirm(`「${state.form.title}」を削除します。この操作は取り消せません。よろしいですか？`)) return;
  state.busy = true;
  state.message = "";
  render();
  try {
    const { json, sha } = await fetchDataFile();
    state.data = json;
    state.sha = sha;
    state.data.events = (state.data.events || []).filter((entry) => entry.id !== state.editingId);
    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    await saveDataFile(state.data, `Delete apex event: ${state.editingId} (${stamp})`);
    state.view = "dashboard";
    state.message = "削除しました。";
    state.messageType = "info";
    state.form = null;
    state.editingId = null;
  } catch (error) {
    state.message = `削除に失敗しました: ${error.message}`;
    state.messageType = "error";
  } finally {
    state.busy = false;
    render();
  }
}

function setPath(obj, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((acc, key) => acc[key], obj);
  target[last] = value;
}

// ---------- Rendering ----------

function render() {
  if (state.view === "login") return renderLogin();
  if (state.view === "dashboard") return renderDashboard();
  if (state.view === "form") return renderForm();
}

function shell(content) {
  root.innerHTML = `
    <div class="admin-shell${state.busy ? " busy" : ""}">
      <header class="admin-header">
        <div>
          <div class="brand-title">YUTORI EVENT ARCHIVE 管理者ページ</div>
          <div class="brand-sub">Apexカスタム大会 結果入力</div>
        </div>
        ${state.view !== "login" ? `<button class="button secondary" data-action="logout">ログアウト</button>` : ""}
      </header>
      <main class="admin-main">${content}</main>
    </div>
  `;
}

function messageBanner() {
  if (!state.message) return "";
  return `<div class="message-banner ${state.messageType === "error" ? "error" : ""}">${escapeHtml(state.message)}</div>`;
}

function renderLogin() {
  shell(`
    <div class="admin-login">
      <div>
        <div class="eyebrow">LOGIN</div>
        <h1>管理者ログイン</h1>
      </div>
      ${messageBanner()}
      <p class="hint">
        GitHubで「このリポジトリ(yutori-event-archive)」の「Contents: Read and write」権限だけを付けた
        Fine-grained personal access token を発行し、下に貼り付けてログインしてください。<br />
        （GitHub → 右上アイコン → Settings → Developer settings → Personal access tokens → Fine-grained tokens）<br />
        トークンはこの端末のブラウザにのみ保存されます。共有PCで使った場合は、使用後に必ずログアウトしてください。
      </p>
      <form>
        <div class="field">
          <label for="token-input">Personal Access Token</label>
          <input id="token-input" type="password" autocomplete="off" placeholder="github_pat_..." />
        </div>
        <button class="button" data-action="login-submit" type="submit">ログイン</button>
      </form>
    </div>
  `);
}

function renderDashboard() {
  const events = state.data.events || [];
  shell(`
    ${messageBanner()}
    <div class="admin-toolbar">
      <h1>Apexカスタム大会一覧</h1>
      <button class="button" data-action="create-event">＋ 新規大会を作成</button>
    </div>
    <div class="event-list">
      ${
        events
          .map(
            (event) => `
        <div class="event-row">
          <div>
            <div class="event-row-title">${escapeHtml(event.title || "(無題)")}</div>
            <div class="event-row-meta">${escapeHtml(event.date || "日付未設定")} ・ ${escapeHtml(event.id)}</div>
          </div>
          <button class="button secondary" data-action="edit-event" data-id="${escapeHtml(event.id)}">編集</button>
        </div>
      `,
          )
          .join("") || `<div class="empty">まだ大会がありません。「＋ 新規大会を作成」から追加してください。</div>`
      }
    </div>
  `);
}

function renderForm() {
  const form = state.form;
  const matchCount = form.maps.length;
  shell(`
    ${messageBanner()}
    <h1>${state.editingId ? "大会を編集" : "新規大会を作成"}</h1>

    <section class="form-section">
      <h2>基本情報</h2>
      ${
        state.editingId
          ? `<div class="field"><label>ID</label><input type="text" value="${escapeHtml(form.id)}" disabled /></div>`
          : `<div class="field"><label>ID（半角英数字とハイフン。例: yutori-fes-vol3）</label><input type="text" data-path="id" value="${escapeHtml(form.id)}" /></div>`
      }
      <div class="field"><label>大会名</label><input type="text" data-path="title" value="${escapeHtml(form.title)}" /></div>
      <div class="field-row">
        <div class="field"><label>開催日</label><input type="text" data-path="date" value="${escapeHtml(form.date)}" placeholder="2026-09-12" /></div>
        <div class="field"><label>カテゴリ</label><input type="text" data-path="category" value="${escapeHtml(form.category)}" /></div>
      </div>
      <div class="field"><label>一覧カードの説明</label><textarea data-path="summary">${escapeHtml(form.summary)}</textarea></div>
      <div class="field"><label>大会概要</label><textarea data-path="description">${escapeHtml(form.description)}</textarea></div>
      ${imageField("大会サムネイル", "thumbnail", form.thumbnail, eventImageSuggestion(form, "thumbnail"))}
      ${imageField("チーム紹介画像", "teamImage", form.teamImage, eventImageSuggestion(form, "teamImage"))}
      <div class="field-row">
        <div class="field"><label>配信アーカイブURL</label><input type="url" data-path="archiveUrl" value="${escapeHtml(form.archiveUrl)}" /></div>
        <div class="field"><label>ED動画YouTube URL</label><input type="url" data-path="edYoutubeUrl" value="${escapeHtml(form.edYoutubeUrl)}" /></div>
      </div>
      <div class="field"><label>メモ</label><textarea data-path="memo">${escapeHtml(form.memo)}</textarea></div>
      <div class="field">
        <label>非表示にするセクション</label>
        <div class="checkbox-row">
          ${["totalResults", "totalResultImage", "matches", "finalRanking", "mapProgress"]
            .map(
              (key) => `
            <label><input type="checkbox" data-hidden-section="${key}" ${form.hiddenSections.includes(key) ? "checked" : ""} /> ${key}</label>
          `,
            )
            .join("")}
        </div>
      </div>
    </section>

    <section class="form-section">
      <h2>マップ進行（試合数：${matchCount}）</h2>
      ${form.maps
        .map(
          (mapName, index) => `
        <div class="map-row">
          <span>M${index + 1}</span>
          <div class="field"><input type="text" data-path="maps.${index}" value="${escapeHtml(mapName)}" /></div>
          <button class="icon-button" data-action="remove-map" data-index="${index}" type="button">削除</button>
        </div>
      `,
        )
        .join("")}
      <button class="button secondary" data-action="add-map" type="button">＋ マップ（試合）を追加</button>
    </section>

    <section class="form-section">
      <h2>チーム・最終結果（${form.teams.length}チーム）</h2>
      <p class="hint">順位・ポイントを入力したチームだけが公開ページの「最終順位」に表示されます。</p>
      ${form.teams.map((team, teamIndex) => teamBlock(team, teamIndex, matchCount, form)).join("")}
      <button class="button secondary" data-action="add-team" type="button">＋ チームを追加</button>
    </section>

    <div class="form-actions">
      <div class="left">
        <button class="button" data-action="save-event" type="button">保存してサイトに反映</button>
        <button class="button secondary" data-action="cancel-form" type="button">キャンセル</button>
      </div>
      <div class="right">
        ${state.editingId ? `<button class="icon-button" data-action="delete-event" type="button">この大会を削除</button>` : ""}
      </div>
    </div>
  `);
}

function imageField(label, path, value, suggested) {
  const imagePath = value || suggested;
  return `
    <div class="field">
      <label>${label}</label>
      <div class="upload-row">
        <input type="text" data-path="${path}" value="${escapeHtml(value)}" placeholder="/images/apex-custom/..." />
        <button class="button secondary" data-action="upload-image" type="button">画像を選択</button>
        <input type="file" accept="image/*" data-image-path="${escapeHtml(imagePath)}" hidden />
        <span class="upload-status hint"></span>
      </div>
    </div>
  `;
}

function eventImageSuggestion(form, kind) {
  const id = (form.id || "new-event").trim() || "new-event";
  const map = { thumbnail: "thumbnail.png", teamImage: "team-list.png", totalResultImage: "result-total.png" };
  return `/images/apex-custom/${id}/${map[kind] || "image.png"}`;
}

function teamImageSuggestion(form, teamIndex) {
  const id = (form.id || "new-event").trim() || "new-event";
  return `/images/apex-custom/${id}/チーム/チーム${teamIndex + 1}/thumbnail.png`;
}

function teamBlock(team, teamIndex, matchCount, form) {
  return `
    <details class="team-block">
      <summary>
        <span>チーム${teamIndex + 1}${team.name ? `：${escapeHtml(team.name)}` : ""}</span>
      </summary>
      <div class="team-block-body">
        <div class="field-row">
          <div class="field"><label>チーム名</label><input type="text" data-path="teams.${teamIndex}.name" value="${escapeHtml(team.name)}" /></div>
          <div class="field"><label>メモ</label><input type="text" data-path="teams.${teamIndex}.note" value="${escapeHtml(team.note)}" /></div>
        </div>
        ${imageField("チームサムネイル", `teams.${teamIndex}.thumbnail`, team.thumbnail, teamImageSuggestion(form, teamIndex))}
        <div class="field-row">
          <div class="field"><label>最終順位</label><input type="number" data-type="number" data-path="teams.${teamIndex}.rank" value="${numValue(team.rank)}" /></div>
          <div class="field"><label>合計ポイント</label><input type="number" data-type="number" data-path="teams.${teamIndex}.point" value="${numValue(team.point)}" /></div>
          <div class="field"><label>マッチpt</label><input type="number" data-type="number" data-path="teams.${teamIndex}.matchPoint" value="${numValue(team.matchPoint)}" /></div>
          <div class="field"><label>ランクボーナス</label><input type="number" data-type="number" data-path="teams.${teamIndex}.rankBonus" value="${numValue(team.rankBonus)}" /></div>
          <div class="field"><label>最高順位</label><input type="number" data-type="number" data-path="teams.${teamIndex}.bestPlace" value="${numValue(team.bestPlace)}" /></div>
        </div>

        <div class="table-wrap">
          <table class="stat-grid-table">
            <thead><tr><th>試合ごとのチーム成績</th>${Array.from({ length: matchCount }, (_, m) => `<th>M${m + 1}</th>`).join("")}</tr></thead>
            <tbody>
              <tr><th>順位</th>${statCells(teamIndex, "matchResults", "teamRank", matchCount, team.matchResults)}</tr>
              <tr><th>pt</th>${statCells(teamIndex, "matchResults", "teamPoint", matchCount, team.matchResults)}</tr>
              <tr><th>キル</th>${statCells(teamIndex, "matchResults", "teamKills", matchCount, team.matchResults)}</tr>
            </tbody>
          </table>
        </div>

        ${team.members.map((member, memberIndex) => memberBlock(member, teamIndex, memberIndex, matchCount)).join("")}

        <button class="icon-button" data-action="remove-team" data-index="${teamIndex}" type="button">このチームを削除</button>
      </div>
    </details>
  `;
}

function statCells(teamIndex, arrayKey, field, matchCount, rows) {
  return Array.from({ length: matchCount }, (_, m) => {
    const value = rows[m]?.[field];
    return `<td><input type="number" data-type="number" data-path="teams.${teamIndex}.${arrayKey}.${m}.${field}" value="${numValue(value)}" /></td>`;
  }).join("");
}

function memberBlock(member, teamIndex, memberIndex, matchCount) {
  return `
    <div class="member-block">
      <div class="field"><label>メンバー${memberIndex + 1} 名前</label><input type="text" data-path="teams.${teamIndex}.members.${memberIndex}.name" value="${escapeHtml(member.name)}" /></div>
      <div class="table-wrap">
        <table class="stat-grid-table">
          <thead><tr><th>成績</th>${Array.from({ length: matchCount }, (_, m) => `<th>M${m + 1}</th>`).join("")}</tr></thead>
          <tbody>
            <tr><th>ダメージ</th>${memberCells(teamIndex, memberIndex, "damageByMatch", matchCount, member.damageByMatch)}</tr>
            <tr><th>キル</th>${memberCells(teamIndex, memberIndex, "killsByMatch", matchCount, member.killsByMatch)}</tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function memberCells(teamIndex, memberIndex, field, matchCount, values) {
  return Array.from({ length: matchCount }, (_, m) => {
    return `<td><input type="number" data-type="number" data-path="teams.${teamIndex}.members.${memberIndex}.${field}.${m}" value="${numValue(values[m])}" /></td>`;
  }).join("");
}

function numValue(value) {
  return value === null || value === undefined ? "" : value;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
