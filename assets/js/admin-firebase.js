import { decryptTeamDetail, encryptTeamDetail, generatePassword } from "./crypto-gate.js";
import { login, logout as firebaseLogout, watchAuth, listEvents, getEvent, saveEvent, deleteEvent } from "./firebase-data.js";

const TEAM_PASSWORDS_KEY = "yutoriFirebaseTeamPasswords";

const root = document.querySelector("#admin-app");

const state = {
  user: null,
  teamPasswords: loadTeamPasswords(),
  view: "login",
  busy: false,
  message: "",
  messageType: "info",
  events: [],
  editingId: null,
  form: null,
};

init();

function init() {
  root.addEventListener("click", onClick);
  root.addEventListener("input", onInput);
  watchAuth(async (user) => {
    state.user = user;
    if (user) {
      await loadDashboard();
    } else {
      state.view = "login";
      render();
    }
  });
}

function loadTeamPasswords() {
  try {
    return JSON.parse(localStorage.getItem(TEAM_PASSWORDS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveTeamPasswords() {
  localStorage.setItem(TEAM_PASSWORDS_KEY, JSON.stringify(state.teamPasswords));
}

async function loadDashboard() {
  state.busy = true;
  render();
  try {
    state.events = await listEvents();
    state.view = "dashboard";
    state.message = "";
  } catch (error) {
    state.message = `データの取得に失敗しました: ${error.message}`;
    state.messageType = "error";
  } finally {
    state.busy = false;
    render();
  }
}

// ---------- Auth ----------

async function handleLogin(email, password) {
  if (!email.trim() || !password) {
    state.message = "メールアドレスとパスワードを入力してください。";
    state.messageType = "error";
    return render();
  }
  state.busy = true;
  state.message = "";
  render();
  try {
    await login(email.trim(), password);
    // watchAuth のコールバックが呼ばれ、そちらでダッシュボードへ遷移する
  } catch (error) {
    state.message = "ログインに失敗しました。メールアドレスまたはパスワードが違います。";
    state.messageType = "error";
    alert(state.message);
  } finally {
    state.busy = false;
    render();
  }
}

async function handleLogout() {
  await firebaseLogout();
  state.events = [];
  state.form = null;
  state.editingId = null;
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
    const email = root.querySelector("#login-email")?.value || "";
    const password = root.querySelector("#login-password")?.value || "";
    handleLogin(email, password);
    return;
  }
  if (action === "logout") return handleLogout();
  if (action === "create-event") return openForm(null);
  if (action === "edit-event") return openForm(actionEl.dataset.id);
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

// ---------- Form helpers (event/team/member schema shared with the GitHub-based admin) ----------

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

function blankMemberMatchStats() {
  return {
    kills: null,
    damage: null,
    assists: null,
    knockdowns: null,
    revives: null,
    respawns: null,
    shots: null,
    hits: null,
    headshots: null,
    survivalTime: null,
  };
}

function blankMember(matchCount) {
  return {
    name: "",
    statsByMatch: Array.from({ length: matchCount }, () => blankMemberMatchStats()),
  };
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
  const remembered = state.teamPasswords[team.id];
  return {
    id: team.id,
    rank: team.rank ?? null,
    teamNo: team.teamNo ?? null,
    name: team.name || "",
    point: team.point ?? null,
    passwordState: team.passwordCipher ? "locked" : "new",
    activePassword: team.passwordCipher ? remembered || "" : generatePassword(),
    unlockAttempt: "",
    unlockError: "",
    passwordSalt: team.passwordSalt,
    passwordIv: team.passwordIv,
    passwordCipher: team.passwordCipher,
    detail: team.passwordCipher ? null : blankDetail(matchCount),
  };
}

async function openForm(id) {
  if (!id) {
    state.editingId = null;
    state.form = blankEvent();
    state.view = "form";
    state.message = "";
    return render();
  }
  state.busy = true;
  render();
  try {
    const event = await getEvent(id);
    if (!event) throw new Error("大会データが見つかりませんでした。");
    state.editingId = id;
    state.form = normalizeFormEvent(event);
    state.view = "form";
    state.message = "";
  } catch (error) {
    state.message = error.message;
    state.messageType = "error";
  } finally {
    state.busy = false;
    render();
  }
  if (state.form) await autoUnlockTeams();
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

async function autoUnlockTeams() {
  const targets = state.form.teams.filter(
    (team) => team.passwordState === "locked" && state.teamPasswords[team.id],
  );
  if (!targets.length) return;
  await Promise.all(
    targets.map(async (team) => {
      try {
        const detail = await decryptTeamDetail(state.teamPasswords[team.id], team);
        team.detail = detail;
        team.passwordState = "unlocked";
        team.activePassword = state.teamPasswords[team.id];
      } catch {
        // 記憶されたパスワードが合わない場合はロックのままにする
      }
    }),
  );
  syncMatchCount();
  render();
}

function syncMatchCount() {
  const n = state.form.maps.length;
  state.form.teams.forEach((team) => {
    if (!team.detail) return;
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
      member.statsByMatch = Array.from({ length: n }, (_, i) => member.statsByMatch[i] ?? blankMemberMatchStats());
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
  state.form.teams[index].activePassword = generatePassword();
  render();
}

function resetTeamPassword(index) {
  const team = state.form.teams[index];
  if (!confirm("⚠️ これまで入力した試合結果・個人成績データは元に戻せなくなり、白紙になります。本当にパスワードを作り直しますか？")) return;
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
    state.teamPasswords[team.id] = password;
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
    } else if (state.events.some((entry) => entry.id === form.id.trim())) {
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
    return render();
  }
  state.busy = true;
  state.message = "";
  render();
  try {
    const id = state.editingId || state.form.id.trim();
    const cleaned = {
      tournamentName: state.form.tournamentName,
      date: state.form.date,
      rule: state.form.rule,
      status: state.form.status,
      maps: [...state.form.maps],
      teams: await Promise.all(state.form.teams.map(buildTeamForSave)),
    };
    await saveEvent(id, cleaned);

    // 保存直後に読み直して、本当に反映されたか確認する
    const verify = await getEvent(id);
    if (!verify) {
      throw new Error("保存を送信しましたが、Firestore上のデータに反映されていることを確認できませんでした。もう一度お試しください。");
    }

    state.form.teams.forEach((team) => {
      if (team.passwordState !== "locked") {
        state.teamPasswords[team.id] = team.activePassword.trim();
      }
    });
    saveTeamPasswords();

    state.events = await listEvents();
    state.view = "dashboard";
    state.message = "保存し、Firestore上のデータで反映を確認しました。";
    state.messageType = "info";
    state.form = null;
    state.editingId = null;
  } catch (error) {
    state.message = `保存に失敗しました: ${error.message}`;
    state.messageType = "error";
    alert(state.message);
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
    const targetId = state.editingId;
    await deleteEvent(targetId);
    const verify = await getEvent(targetId);
    if (verify) {
      throw new Error("削除を送信しましたが、Firestore上のデータからまだ消えていないことを確認しました。もう一度お試しください。");
    }
    state.events = await listEvents();
    state.view = "dashboard";
    state.message = "削除し、Firestore上のデータで反映を確認しました。";
    state.messageType = "info";
    state.form = null;
    state.editingId = null;
  } catch (error) {
    state.message = `削除に失敗しました: ${error.message}`;
    state.messageType = "error";
    alert(state.message);
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
          <div class="brand-title">YUTORI EVENT ARCHIVE 管理者ページ（Firebase版）</div>
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
        <div class="eyebrow">LOGIN（Firebase版）</div>
        <h1>管理者ログイン</h1>
      </div>
      ${messageBanner()}
      <p class="hint">Firebase Authenticationに登録したメールアドレスとパスワードでログインします。GitHubのトークンは不要です。</p>
      <form>
        <div class="field">
          <label for="login-email">メールアドレス</label>
          <input id="login-email" type="email" autocomplete="username" value="yutoridesuga.30@gmail.com" />
        </div>
        <div class="field">
          <label for="login-password">パスワード</label>
          <input id="login-password" type="password" autocomplete="current-password" />
        </div>
        <button class="button" data-action="login-submit" type="submit">ログイン</button>
      </form>
    </div>
  `);
}

function renderDashboard() {
  const events = state.events || [];
  shell(`
    ${messageBanner()}
    <div class="admin-toolbar">
      <h1>Apexカスタム大会一覧（Firebase版）</h1>
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
        <p class="hint">🔒 このチームの詳細データ（試合結果・個人成績）はパスワードで保護されています。通常はこの端末で以前入力したパスワードが自動で使われますが、うまく開けない場合は下に入力してください。</p>
        <div class="field-row">
          <div class="field"><input type="password" data-unlock-input="${teamIndex}" placeholder="現在のパスワード" /></div>
          <button class="button secondary" data-action="unlock-team" data-index="${teamIndex}" type="button">ロック解除して編集</button>
        </div>
        ${team.unlockError ? `<div class="message-banner error">${escapeHtml(team.unlockError)}</div>` : ""}
        <button class="icon-button" data-action="reset-team-password" data-index="${teamIndex}" type="button">⚠️ パスワードが分からない場合はここから作り直す（これまでの試合結果・個人成績は消えます）</button>
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
      <p class="hint">命中率(Acc%)・ヘッドショット率(HSR%)は、ショット数・命中数・ヘッドショット数の合計から公開ページで自動計算されます。</p>
      <div class="table-wrap">
        <table class="stat-grid-table">
          <thead><tr><th>成績</th>${Array.from({ length: matchCount }, (_, m) => `<th>M${m + 1}</th>`).join("")}</tr></thead>
          <tbody>
            ${MEMBER_STAT_FIELDS.map(
              ({ key, label }) => `
            <tr><th>${label}</th>${memberStatCells(teamIndex, memberIndex, key, matchCount, member.statsByMatch)}</tr>`,
            ).join("")}
            <tr><th>生存時間(秒)</th>${memberStatCells(teamIndex, memberIndex, "survivalTime", matchCount, member.statsByMatch)}</tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function memberStatCells(teamIndex, memberIndex, field, matchCount, statsByMatch) {
  return Array.from({ length: matchCount }, (_, m) => {
    const value = statsByMatch[m]?.[field];
    return `<td><input type="number" data-type="number" data-path="teams.${teamIndex}.detail.members.${memberIndex}.statsByMatch.${m}.${field}" value="${numValue(value)}" /></td>`;
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
