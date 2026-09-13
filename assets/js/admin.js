import { decryptTeamDetail, encryptTeamDetail, generatePassword } from "./crypto-gate.js";

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
  if (action === "regen-password") return regenPassword(index);
  if (action === "reset-team-password") return resetTeamPassword(index);
  if (action === "unlock-team") return unlockTeam(index);
}

function onInput(event) {
  const target = event.target;
  const path = target.dataset.path;
  if (!path || !state.form) return;
  const type = target.dataset.type || "text";
  let value = target.value;
  if (type === "number") value = value === "" ? null : Number(value);
  if (type === "checkbox") value = target.checked;
  setPath(state.form, path, value);
}

// ---------- Form helpers ----------

function blankEvent() {
  return {
    id: "",
    tournamentName: "",
    date: "",
    rule: "",
    status: "",
    maps: [blankMap(1), blankMap(2), blankMap(3)],
    teams: [],
  };
}

function blankMap(number) {
  return { name: `マップ${number}`, completed: false };
}

function blankDetail(matchCount) {
  return {
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
    damageByMatch: Array.from({ length: matchCount }, () => null),
    killsByMatch: Array.from({ length: matchCount }, () => null),
  };
}

function blankTeam(matchCount) {
  return {
    id: `team-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    rank: null,
    teamNo: null,
    name: "",
    point: null,
    passwordState: "new",
    activePassword: generatePassword(),
    unlockAttempt: "",
    unlockError: "",
    detail: blankDetail(matchCount),
  };
}

function normalizeFormTeam(team, matchCount) {
  return {
    id: team.id,
    rank: team.rank ?? null,
    teamNo: team.teamNo ?? null,
    name: team.name || "",
    point: team.point ?? null,
    passwordState: team.passwordCipher ? "locked" : "new",
    activePassword: team.passwordCipher ? "" : generatePassword(),
    unlockAttempt: "",
    unlockError: "",
    passwordSalt: team.passwordSalt,
    passwordIv: team.passwordIv,
    passwordCipher: team.passwordCipher,
    detail: team.passwordCipher ? null : blankDetail(matchCount),
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
  const maps = (event.maps || []).map((map, index) => ({
    name: map.name || `マップ${index + 1}`,
    completed: Boolean(map.completed),
  }));
  return {
    id: event.id,
    tournamentName: event.tournamentName || "",
    date: event.date || "",
    rule: event.rule || "",
    status: event.status || "",
    maps,
    teams: (event.teams || []).map((team) => normalizeFormTeam(team, maps.length)),
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
    if (!team.detail) return; // ロック中のチームは復号しないと試合数を変更できない
    team.detail.matchResults = Array.from({ length: n }, (_, i) => {
      const existing = team.detail.matchResults[i];
      return {
        match: i + 1,
        teamRank: existing?.teamRank ?? null,
        teamPoint: existing?.teamPoint ?? null,
        teamKills: existing?.teamKills ?? null,
      };
    });
    team.detail.members.forEach((member) => {
      member.damageByMatch = Array.from({ length: n }, (_, i) => member.damageByMatch[i] ?? null);
      member.killsByMatch = Array.from({ length: n }, (_, i) => member.killsByMatch[i] ?? null);
    });
  });
}

function addMap() {
  state.form.maps.push(blankMap(state.form.maps.length + 1));
  syncMatchCount();
  render();
}

function removeMap(index) {
  if (state.form.maps.length <= 1) {
    alert("マップ(試合)は最低1件必要です。");
    return;
  }
  if (!confirm(`M${index + 1} を削除します。ロック解除済みチームのその試合の成績データも削除されます。よろしいですか？`)) return;
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

function regenPassword(index) {
  const team = state.form.teams[index];
  team.activePassword = generatePassword();
  render();
}

function resetTeamPassword(index) {
  const team = state.form.teams[index];
  if (!confirm("パスワードをリセットすると、これまでの試合結果・個人成績データは復元できなくなり、白紙から入力し直すことになります。よろしいですか？")) return;
  team.passwordState = "reset";
  team.activePassword = generatePassword();
  team.detail = blankDetail(state.form.maps.length);
  team.unlockError = "";
  render();
}

async function unlockTeam(index) {
  const team = state.form.teams[index];
  const input = root.querySelector(`[data-unlock-input="${index}"]`);
  const password = input?.value || "";
  if (!password) return;
  try {
    const detail = await decryptTeamDetail(password, team);
    team.detail = detail;
    team.passwordState = "unlocked";
    team.activePassword = password;
    team.unlockError = "";
    syncMatchCount();
  } catch {
    team.unlockError = "パスワードが違います。";
  }
  render();
}

function validateForm(form) {
  const errors = [];
  if (!form.tournamentName.trim()) errors.push("大会名を入力してください。");
  if (!state.editingId) {
    if (!/^[a-z0-9-]+$/.test(form.id.trim())) {
      errors.push("IDは半角英小文字・数字・ハイフンのみで入力してください。");
    } else if (state.data.events.some((entry) => entry.id === form.id.trim())) {
      errors.push("同じIDの大会がすでに存在します。");
    }
  }
  form.teams.forEach((team, index) => {
    if (team.passwordState !== "locked" && !team.activePassword.trim()) {
      errors.push(`チーム${index + 1}のパスワードが空です。`);
    }
  });
  return errors;
}

async function buildTeamForSave(team) {
  const base = {
    id: team.id,
    rank: team.rank,
    teamNo: team.teamNo,
    name: team.name,
    point: team.point,
  };
  if (team.passwordState === "locked") {
    return { ...base, passwordSalt: team.passwordSalt, passwordIv: team.passwordIv, passwordCipher: team.passwordCipher };
  }
  const encrypted = await encryptTeamDetail(team.activePassword.trim(), team.detail);
  return { ...base, ...encrypted };
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
    const cleaned = {
      id: state.editingId || state.form.id.trim(),
      tournamentName: state.form.tournamentName,
      date: state.form.date,
      rule: state.form.rule,
      status: state.form.status,
      maps: [...state.form.maps],
      teams: await Promise.all(state.form.teams.map(buildTeamForSave)),
    };
    if (state.editingId) {
      const index = state.data.events.findIndex((entry) => entry.id === state.editingId);
      if (index === -1) throw new Error("編集対象の大会が見つかりませんでした（他の場所で削除された可能性があります）。");
      state.data.events[index] = cleaned;
    } else {
      state.data.events.push(cleaned);
    }
    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    await saveDataFile(state.data, `${state.editingId ? "Update" : "Add"} apex event: ${cleaned.tournamentName} (${stamp})`);
    state.view = "dashboard";
    state.message = "保存しました。数十秒〜数分でサイトに反映されます。新しく発行したパスワードは今のうちに控えておいてください。";
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
  if (!confirm(`「${state.form.tournamentName}」を削除します。この操作は取り消せません。よろしいですか？`)) return;
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
            <div class="event-row-title">${escapeHtml(event.tournamentName || "(無題)")}</div>
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
      <div class="field"><label>大会名</label><input type="text" data-path="tournamentName" value="${escapeHtml(form.tournamentName)}" /></div>
      <div class="field-row">
        <div class="field"><label>開催日時</label><input type="text" data-path="date" value="${escapeHtml(form.date)}" placeholder="2026/09/12(Sat) 21:00〜" /></div>
        <div class="field"><label>ルール</label><input type="text" data-path="rule" value="${escapeHtml(form.rule)}" placeholder="バトルロワイヤル・トリオ 20チーム" /></div>
        <div class="field"><label>ステータス</label><input type="text" data-path="status" value="${escapeHtml(form.status)}" placeholder="全5マッチ終了" /></div>
      </div>
    </section>

    <section class="form-section">
      <h2>マップ進行（試合数：${matchCount}）</h2>
      <p class="hint">ロック中（パスワード未解除）のチームは、試合数を変えてもデータが自動更新されません。試合数を変える前にロック解除してください。</p>
      ${form.maps
        .map(
          (map, index) => `
        <div class="map-row">
          <span>M${index + 1}</span>
          <div class="field"><input type="text" data-path="maps.${index}.name" value="${escapeHtml(map.name)}" /></div>
          <label class="map-done-toggle">
            <input type="checkbox" data-type="checkbox" data-path="maps.${index}.completed" ${map.completed ? "checked" : ""} />
            終了済み
          </label>
          <button class="icon-button" data-action="remove-map" data-index="${index}" type="button">削除</button>
        </div>
      `,
        )
        .join("")}
      <button class="button secondary" data-action="add-map" type="button">＋ マップ（試合）を追加</button>
    </section>

    <section class="form-section">
      <h2>チーム・最終結果（${form.teams.length}チーム）</h2>
      <p class="hint">順位・ポイントを入力したチームだけが公開ページの「最終順位」に表示されます。試合ごとの成績・メンバー個人成績はチームごとのパスワードで保護されます。</p>
      ${form.teams.map((team, teamIndex) => teamBlock(team, teamIndex, matchCount)).join("")}
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

function teamBlock(team, teamIndex, matchCount) {
  return `
    <details class="team-block" open>
      <summary>
        <span>チーム${teamIndex + 1}${team.name ? `：${escapeHtml(team.name)}` : ""}</span>
      </summary>
      <div class="team-block-body">
        <div class="field-row">
          <div class="field"><label>チーム名</label><input type="text" data-path="teams.${teamIndex}.name" value="${escapeHtml(team.name)}" /></div>
          <div class="field"><label>チーム番号</label><input type="number" data-type="number" data-path="teams.${teamIndex}.teamNo" value="${numValue(team.teamNo)}" /></div>
          <div class="field"><label>最終順位</label><input type="number" data-type="number" data-path="teams.${teamIndex}.rank" value="${numValue(team.rank)}" /></div>
          <div class="field"><label>合計ポイント</label><input type="number" data-type="number" data-path="teams.${teamIndex}.point" value="${numValue(team.point)}" /></div>
        </div>

        ${passwordSection(team, teamIndex, matchCount)}

        <button class="icon-button" data-action="remove-team" data-index="${teamIndex}" type="button">このチームを削除</button>
      </div>
    </details>
  `;
}

function passwordSection(team, teamIndex, matchCount) {
  if (team.passwordState === "locked") {
    return `
      <div class="password-box">
        <p class="hint">🔒 このチームの詳細データ（試合結果・個人成績）はパスワードで保護されています。編集するにはパスワードを入力してください。</p>
        <div class="field-row">
          <div class="field"><input type="password" data-unlock-input="${teamIndex}" placeholder="現在のパスワード" /></div>
          <button class="button secondary" data-action="unlock-team" data-index="${teamIndex}" type="button">ロック解除して編集</button>
          <button class="icon-button" data-action="reset-team-password" data-index="${teamIndex}" type="button">パスワードを忘れた（作り直す）</button>
        </div>
        ${team.unlockError ? `<div class="message-banner error">${escapeHtml(team.unlockError)}</div>` : ""}
      </div>
    `;
  }

  return `
    <div class="password-box">
      <div class="field-row">
        <div class="field">
          <label>このチームのパスワード（チームに共有してください。保存後は再表示できません）</label>
          <input type="text" data-path="teams.${teamIndex}.activePassword" value="${escapeHtml(team.activePassword)}" />
        </div>
        <button class="button secondary" data-action="regen-password" data-index="${teamIndex}" type="button">再生成</button>
      </div>
      ${teamDetailFields(team, teamIndex, matchCount)}
    </div>
  `;
}

function teamDetailFields(team, teamIndex, matchCount) {
  const detail = team.detail;
  return `
    <div class="field-row">
      <div class="field"><label>マッチpt</label><input type="number" data-type="number" data-path="teams.${teamIndex}.detail.matchPoint" value="${numValue(detail.matchPoint)}" /></div>
      <div class="field"><label>ランクボーナス</label><input type="number" data-type="number" data-path="teams.${teamIndex}.detail.rankBonus" value="${numValue(detail.rankBonus)}" /></div>
      <div class="field"><label>最高順位</label><input type="number" data-type="number" data-path="teams.${teamIndex}.detail.bestPlace" value="${numValue(detail.bestPlace)}" /></div>
    </div>

    <div class="table-wrap">
      <table class="stat-grid-table">
        <thead><tr><th>試合ごとのチーム成績</th>${Array.from({ length: matchCount }, (_, m) => `<th>M${m + 1}</th>`).join("")}</tr></thead>
        <tbody>
          <tr><th>順位</th>${statCells(teamIndex, "teamRank", matchCount, detail.matchResults)}</tr>
          <tr><th>pt</th>${statCells(teamIndex, "teamPoint", matchCount, detail.matchResults)}</tr>
          <tr><th>キル</th>${statCells(teamIndex, "teamKills", matchCount, detail.matchResults)}</tr>
        </tbody>
      </table>
    </div>

    ${detail.members.map((member, memberIndex) => memberBlock(member, teamIndex, memberIndex, matchCount)).join("")}
  `;
}

function statCells(teamIndex, field, matchCount, rows) {
  return Array.from({ length: matchCount }, (_, m) => {
    const value = rows[m]?.[field];
    return `<td><input type="number" data-type="number" data-path="teams.${teamIndex}.detail.matchResults.${m}.${field}" value="${numValue(value)}" /></td>`;
  }).join("");
}

function memberBlock(member, teamIndex, memberIndex, matchCount) {
  return `
    <div class="member-block">
      <div class="field"><label>メンバー${memberIndex + 1} 名前</label><input type="text" data-path="teams.${teamIndex}.detail.members.${memberIndex}.name" value="${escapeHtml(member.name)}" /></div>
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
    return `<td><input type="number" data-type="number" data-path="teams.${teamIndex}.detail.members.${memberIndex}.${field}.${m}" value="${numValue(values[m])}" /></td>`;
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
