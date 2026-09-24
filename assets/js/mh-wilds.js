// Monster Hunter Wilds 素材トラッカー
// データ: data/mh-wilds.json（tools/build-mh-wilds-data.py で MHDB から生成）
// 人ごとの設定はこのブラウザの localStorage に保存する（サーバー不要・費用0円）。
// 別の端末や友達との受け渡しは「共有URL / 共有コード」で行う。

const DATA_URL = "../data/mh-wilds.json";
const STORAGE_KEY = "mh-wilds-tracker-v1";
const PAGE_SIZE = 60;

const TABS = [
  { id: "list", label: "欲しいもの" },
  { id: "weapons", label: "武器" },
  { id: "armor", label: "防具" },
  { id: "charms", label: "護石" },
  { id: "decos", label: "珠（装飾品）" },
  { id: "items", label: "素材" },
  { id: "party", label: "みんな" },
];

const PIECE_LABELS = { head: "頭", chest: "胴", arms: "腕", waist: "腰", legs: "脚" };
const PIECE_ORDER = ["head", "chest", "arms", "waist", "legs"];
const ELEMENT_LABELS = {
  fire: "火", water: "水", thunder: "雷", ice: "氷", dragon: "龍",
  poison: "毒", paralysis: "麻痺", sleep: "睡眠", blastblight: "爆破",
};
const RANK_LABELS = { low: "下位", high: "上位" };
const SOURCE_LABELS = {
  "target-reward": "報酬",
  carve: "剥ぎ取り",
  "broken-part": "部位破壊",
  "carve-rotten": "剥ぎ取り(腐敗)",
  "wound-destroyed": "傷破壊",
  "tempered-wound-destroyed": "傷破壊(歴戦)",
  "carve-severed": "切断剥ぎ取り",
  "carve-rotten-severed": "切断剥ぎ取り(腐敗)",
  "carve-crystallized": "剥ぎ取り(結晶化)",
  "broken-fragment": "部位破壊(欠片)",
};
const ITEM_COLORS = {
  white: "#e9e4dc", gray: "#9a9a9a", yellow: "#f2d43d", blue: "#4f86f7", pink: "#f58bc4",
  red: "#e64545", purple: "#a868e8", brown: "#a9714b", green: "#4cc36c", sky: "#63c7f2",
  vermilion: "#f0643c", ivory: "#f4ecd0", orange: "#f59a2f", "blue-purple": "#7a73f0",
  ultramarine: "#3553d8", rose: "#e8567a", "dark-purple": "#6e3aa3", "sage-green": "#98b089",
  "moss-green": "#6d7d3b", lemon: "#f5f07a", emerald: "#1fbf8f",
};
const SLOT_MARKS = ["", "①", "②", "③", "④"];

const app = document.querySelector("#app");

let data = null;
const idx = {
  items: new Map(),
  monsters: new Map(),
  weapons: new Map(),
  pieces: new Map(),
  charms: new Map(),
  decos: new Map(),
  weaponTypes: new Map(),
  usage: new Map(),
};

let store = loadStore();
let currentTab = "list";
let pendingImport = null;
const filters = {
  weapons: { type: "great-sword", rarity: "", q: "", wantedOnly: false, limit: PAGE_SIZE },
  armor: { rarity: "", q: "", wantedOnly: false, limit: 30 },
  charms: { q: "", wantedOnly: false, limit: PAGE_SIZE },
  decos: { on: "", lv: "", q: "", wantedOnly: false, limit: PAGE_SIZE },
  items: { rarity: "", q: "", neededOnly: false, limit: PAGE_SIZE },
  list: { hideDone: false },
};

init();

async function init() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`${DATA_URL}: ${response.status}`);
    data = await response.json();
  } catch (error) {
    console.error(error);
    app.innerHTML = shell(`<div class="empty">データを読み込めませんでした。</div>`);
    return;
  }
  buildIndex();
  await readImportFromHash();
  const tabFromHash = window.location.hash.replace("#", "");
  if (TABS.some((tab) => tab.id === tabFromHash)) currentTab = tabFromHash;

  app.addEventListener("click", onClick);
  app.addEventListener("input", onInput);
  app.addEventListener("change", onChange);
  renderAll();
}

// ---------------------------------------------------------------------------
// データ索引

function buildIndex() {
  data.items.forEach((item) => idx.items.set(item.id, item));
  data.monsters.forEach((monster) => idx.monsters.set(monster.id, monster));
  data.weaponTypes.forEach((type) => idx.weaponTypes.set(type.id, type.n));
  data.weapons.forEach((weapon) => idx.weapons.set(weapon.id, weapon));
  data.armor.forEach((set) => set.pc.forEach((piece) => idx.pieces.set(piece.id, { ...piece, set })));
  data.charms.forEach((charm) => idx.charms.set(charm.id, charm));
  data.decorations.forEach((deco) => idx.decos.set(deco.id, deco));

  const addUsage = (inputs, key) => {
    Object.entries(inputs || {}).forEach(([itemId, amount]) => {
      if (!idx.usage.has(itemId)) idx.usage.set(itemId, []);
      idx.usage.get(itemId).push({ key, amount });
    });
  };
  data.weapons.forEach((weapon) => addUsage(weapon.in, `w:${weapon.id}`));
  data.armor.forEach((set) => set.pc.forEach((piece) => addUsage(piece.in, `a:${piece.id}`)));
  data.charms.forEach((charm) => addUsage(charm.in, `c:${charm.id}`));
}

// 欲しいものキー（w:武器ID / a:防具部位ID / c:護石ID）から表示情報を取り出す
function resolveWant(key) {
  const [kind, ...rest] = key.split(":");
  const id = rest.join(":");
  if (kind === "w") {
    const weapon = idx.weapons.get(id);
    return weapon && { kind, label: idx.weaponTypes.get(weapon.t), name: weapon.n, rarity: weapon.r, entity: weapon };
  }
  if (kind === "a") {
    const piece = idx.pieces.get(id);
    return piece && { kind, label: `防具・${PIECE_LABELS[piece.p]}`, name: piece.n, rarity: piece.set.r, entity: piece };
  }
  if (kind === "c") {
    const charm = idx.charms.get(id);
    return charm && { kind, label: "護石", name: charm.n, rarity: charm.r, entity: charm };
  }
  return null;
}

// 武器の派生元をたどって [生産, 強化1, 強化2, ...] の順で返す
function weaponChain(weapon) {
  const chain = [];
  const seen = new Set();
  let current = weapon;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.unshift(current);
    current = current.prev ? idx.weapons.get(current.prev) : null;
  }
  return chain;
}

// ---------------------------------------------------------------------------
// 保存データ（人ごとのプロフィール）

function newProfile(name) {
  return { id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name, wants: {}, owned: {}, decos: {} };
}

function loadStore() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    saved = null;
  }
  if (!saved || !Array.isArray(saved.profiles) || !saved.profiles.length) {
    const first = newProfile("自分");
    return { current: first.id, profiles: [first] };
  }
  saved.profiles.forEach((profile) => {
    profile.wants ||= {};
    profile.owned ||= {};
    profile.decos ||= {};
  });
  if (!saved.profiles.some((profile) => profile.id === saved.current)) saved.current = saved.profiles[0].id;
  return saved;
}

function saveStore() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (error) {
    console.warn("保存できませんでした", error);
  }
}

function profile() {
  return store.profiles.find((entry) => entry.id === store.current) || store.profiles[0];
}

// プロフィールの欲しい装備から必要素材を集計する
function computeNeeds(target) {
  const needed = new Map();
  let zenny = 0;
  Object.entries(target.wants).forEach(([key, want]) => {
    const info = resolveWant(key);
    if (!info) return;
    const count = want.n || 1;
    const steps = info.kind === "w" && want.chain ? weaponChain(info.entity) : [info.entity];
    steps.forEach((step) => {
      zenny += (step.z || 0) * count;
      Object.entries(step.in || {}).forEach(([itemId, amount]) => {
        needed.set(itemId, (needed.get(itemId) || 0) + amount * count);
      });
    });
  });
  const rows = [...needed.entries()].map(([itemId, need]) => {
    const owned = target.owned[itemId] || 0;
    return { itemId, item: idx.items.get(itemId), need, owned, remain: Math.max(0, need - owned) };
  });
  rows.sort((a, b) => (a.remain === 0) - (b.remain === 0) || (b.item?.r || 0) - (a.item?.r || 0) || (a.item?.n || "").localeCompare(b.item?.n || "", "ja"));
  return { rows, zenny };
}

// ---------------------------------------------------------------------------
// 共有（URL / コード）

async function encodeProfile(target) {
  const payload = JSON.stringify({ v: 1, name: target.name, wants: target.wants, owned: target.owned, decos: target.decos });
  let bytes = new TextEncoder().encode(payload);
  let prefix = "j";
  if (typeof CompressionStream === "function") {
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
      bytes = new Uint8Array(await new Response(stream).arrayBuffer());
      prefix = "z";
    } catch {
      prefix = "j";
    }
  }
  return `${prefix}.${toBase64Url(bytes)}`;
}

async function decodeProfile(code) {
  const text = code.trim().replace(/^.*#import=/, "");
  const [prefix, body] = text.includes(".") ? text.split(".", 2) : ["j", text];
  let bytes = fromBase64Url(body);
  if (prefix === "z") {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  }
  const parsed = JSON.parse(new TextDecoder().decode(bytes));
  if (!parsed || typeof parsed.wants !== "object") throw new Error("invalid code");
  return {
    name: String(parsed.name || "ゲスト").slice(0, 30),
    wants: sanitizeWants(parsed.wants),
    owned: sanitizeCounts(parsed.owned),
    decos: sanitizeDecos(parsed.decos),
  };
}

function sanitizeCounts(source) {
  const result = {};
  Object.entries(source || {}).forEach(([key, value]) => {
    const number = Math.floor(Number(value));
    if (number > 0) result[key] = Math.min(number, 9999);
  });
  return result;
}

function sanitizeWants(source) {
  const result = {};
  Object.entries(source || {}).forEach(([key, value]) => {
    if (!resolveWant(key)) return;
    result[key] = { n: Math.max(1, Math.min(99, Math.floor(Number(value?.n) || 1))), ...(value?.chain ? { chain: true } : {}) };
  });
  return result;
}

function sanitizeDecos(source) {
  const result = {};
  Object.entries(source || {}).forEach(([key, value]) => {
    if (!idx.decos.has(key)) return;
    result[key] = { want: Math.max(0, Math.min(99, Math.floor(Number(value?.want) || 0))), have: Math.max(0, Math.min(999, Math.floor(Number(value?.have) || 0))) };
  });
  return result;
}

function toBase64Url(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text) {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "===".slice((base64.length + 3) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function readImportFromHash() {
  const match = window.location.hash.match(/^#import=(.+)$/);
  if (!match) return;
  try {
    pendingImport = await decodeProfile(match[1]);
  } catch (error) {
    console.warn(error);
    pendingImport = { error: true };
  }
  history.replaceState(null, "", window.location.pathname + window.location.search);
}

function applyImport(imported, mode) {
  if (mode === "replace") {
    const existing = store.profiles.find((entry) => entry.name === imported.name);
    if (existing) {
      Object.assign(existing, { wants: imported.wants, owned: imported.owned, decos: imported.decos });
      store.current = existing.id;
      saveStore();
      return;
    }
  }
  const created = { ...newProfile(uniqueName(imported.name)), wants: imported.wants, owned: imported.owned, decos: imported.decos };
  store.profiles.push(created);
  store.current = created.id;
  saveStore();
}

function uniqueName(name) {
  let candidate = name;
  let n = 2;
  while (store.profiles.some((entry) => entry.name === candidate)) candidate = `${name}(${n++})`;
  return candidate;
}

// ---------------------------------------------------------------------------
// イベント

async function onClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action } = button.dataset;
  const target = profile();

  if (action === "tab") {
    currentTab = button.dataset.tab;
    history.replaceState(null, "", `#${currentTab}`);
    renderAll();
    return;
  }
  if (action === "toggle-want") {
    const key = button.dataset.key;
    if (target.wants[key]) delete target.wants[key];
    else target.wants[key] = { n: 1, ...(key.startsWith("w:") ? { chain: false } : {}) };
    saveStore();
    button.replaceWith(htmlToElement(wantButton(key)));
    refreshTabCounts();
    return;
  }
  if (action === "want-set") {
    button.dataset.keys.split(",").forEach((key) => {
      if (!target.wants[key]) target.wants[key] = { n: 1 };
    });
    saveStore();
    renderPanel();
    return;
  }
  if (action === "want-step") {
    const want = target.wants[button.dataset.key];
    if (!want) return;
    want.n = Math.max(1, Math.min(99, (want.n || 1) + Number(button.dataset.step)));
    saveStore();
    renderPanel();
    return;
  }
  if (action === "want-remove") {
    delete target.wants[button.dataset.key];
    saveStore();
    renderPanel();
    return;
  }
  if (action === "deco-step") {
    const { id, field } = button.dataset;
    const deco = (target.decos[id] ||= { want: 0, have: 0 });
    deco[field] = Math.max(0, Math.min(field === "want" ? 99 : 999, (deco[field] || 0) + Number(button.dataset.step)));
    if (!deco.want && !deco.have) delete target.decos[id];
    saveStore();
    const row = button.closest("[data-deco-row]");
    if (row && currentTab === "decos") row.replaceWith(htmlToElement(decoRow(idx.decos.get(id))));
    else renderPanel();
    refreshTabCounts();
    return;
  }
  if (action === "more") {
    filters[currentTab].limit += filters[currentTab].limit;
    renderResults();
    return;
  }
  if (action === "profile-add") {
    const name = prompt("追加する人の名前を入力してください");
    if (!name || !name.trim()) return;
    const created = newProfile(uniqueName(name.trim().slice(0, 30)));
    store.profiles.push(created);
    store.current = created.id;
    saveStore();
    renderAll();
    return;
  }
  if (action === "profile-rename") {
    const name = prompt("新しい名前", target.name);
    if (!name || !name.trim()) return;
    target.name = name.trim().slice(0, 30);
    saveStore();
    renderAll();
    return;
  }
  if (action === "profile-delete") {
    if (!confirm(`「${target.name}」のリストを削除しますか？（元に戻せません）`)) return;
    store.profiles = store.profiles.filter((entry) => entry.id !== target.id);
    if (!store.profiles.length) store.profiles.push(newProfile("自分"));
    store.current = store.profiles[0].id;
    saveStore();
    renderAll();
    return;
  }
  if (action === "share-url" || action === "share-code") {
    const code = await encodeProfile(target);
    const text = action === "share-url" ? `${window.location.origin}${window.location.pathname}#import=${code}` : code;
    const output = app.querySelector("[data-role='share-output']");
    output.value = text;
    output.hidden = false;
    output.select();
    const copied = await copyText(text);
    setMessage("share-message", copied ? "コピーしました。LINEやDiscordに貼り付けて共有できます。" : "下の欄の文字をコピーして共有してください。");
    return;
  }
  if (action === "import-code") {
    const input = app.querySelector("[data-role='import-input']");
    try {
      const imported = await decodeProfile(input.value);
      applyImport(imported, "new");
      renderAll();
    } catch {
      setMessage("import-message", "共有コードを読み取れませんでした。");
    }
    return;
  }
  if (action === "import-accept") {
    applyImport(pendingImport, button.dataset.mode);
    pendingImport = null;
    currentTab = "list";
    renderAll();
    return;
  }
  if (action === "import-dismiss") {
    pendingImport = null;
    renderAll();
    return;
  }
  if (action === "owned-clear") {
    if (!confirm("所持数をすべて0に戻しますか？")) return;
    target.owned = {};
    saveStore();
    renderPanel();
  }
}

function onInput(event) {
  const field = event.target;
  if (field.dataset.filter) {
    const tabFilters = filters[currentTab];
    tabFilters[field.dataset.filter] = field.type === "checkbox" ? field.checked : field.value;
    tabFilters.limit = currentTab === "armor" ? 30 : PAGE_SIZE;
    renderResults();
    return;
  }
  if (field.dataset.owned) {
    const target = profile();
    const value = Math.max(0, Math.min(9999, Math.floor(Number(field.value) || 0)));
    if (value) target.owned[field.dataset.owned] = value;
    else delete target.owned[field.dataset.owned];
    saveStore();
    updateNeedRow(field.closest("tr"), field.dataset.owned);
  }
}

function onChange(event) {
  const field = event.target;
  const target = profile();
  if (field.dataset.role === "profile-select") {
    store.current = field.value;
    saveStore();
    renderAll();
    return;
  }
  if (field.dataset.chain) {
    const want = target.wants[field.dataset.chain];
    if (want) want.chain = field.checked;
    saveStore();
    renderPanel();
    return;
  }
  if (field.dataset.listFilter) {
    filters.list[field.dataset.listFilter] = field.checked;
    renderPanel();
  }
}

function updateNeedRow(row, itemId) {
  if (!row) return;
  const target = profile();
  const { rows } = computeNeeds(target);
  const entry = rows.find((candidate) => candidate.itemId === itemId);
  if (!entry) return;
  row.querySelector("[data-role='remain']").innerHTML = remainBadge(entry.remain);
  row.classList.toggle("is-done", entry.remain === 0);
  const summary = app.querySelector("[data-role='need-summary']");
  if (summary) summary.innerHTML = needSummary(rows);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    }
  }
}

function setMessage(role, text) {
  const element = app.querySelector(`[data-role='${role}']`);
  if (element) element.textContent = text;
}

// ---------------------------------------------------------------------------
// 描画（全体）

function shell(content) {
  return `
    <div class="site-shell">
      <header class="site-header">
        <div class="header-inner">
          <a class="brand" href="../" aria-label="YUTORI EVENT ARCHIVE">
            <img class="brand-mark" src="../images/common/dachshund-logo.svg" alt="" />
            <span class="brand-text">
              <span class="brand-title">YUTORI EVENT ARCHIVE</span>
              <span class="brand-sub">Monster Hunter Wilds Tracker</span>
            </span>
          </a>
          <nav class="nav" aria-label="メインナビゲーション">
            <a href="../">Top</a>
            <a href="../apex-custom/">Apexカスタム</a>
            <a href="../participation-history/">出場履歴</a>
            <a href="./" aria-current="page">MH Wilds</a>
          </nav>
        </div>
      </header>
      <section class="hero page-hero mh-hero">
        <div class="section-inner">
          <div class="eyebrow">MONSTER HUNTER WILDS</div>
          <h1>素材・護石・珠トラッカー</h1>
          <p class="hero-copy">欲しい武器・防具・護石を選ぶと必要な素材を自動で合計します。人ごとにリストを作れて、共有URLで友達とも見せ合えます。</p>
        </div>
      </section>
      <section class="section mh-section">
        <div class="section-inner">${content}</div>
      </section>
      <footer class="site-footer">
        <div class="footer-inner">
          <div>データ出典: <a class="mh-link" href="https://github.com/LartTyler/mhdb-wilds-data" target="_blank" rel="noopener">MHDB (mhdb-wilds-data)</a>。非公式ファンツールです。</div>
          <img src="../images/common/dachshund-logo.svg" alt="" />
        </div>
      </footer>
    </div>
  `;
}

function renderAll() {
  app.innerHTML = shell(`
    ${importBanner()}
    ${profileBar()}
    <nav class="mh-tabs" aria-label="表示切り替え">
      ${TABS.map((tab) => `<button type="button" class="mh-tab" data-action="tab" data-tab="${tab.id}" ${tab.id === currentTab ? 'aria-current="page"' : ""}>${tab.label}<span class="mh-tab-count" data-count="${tab.id}"></span></button>`).join("")}
    </nav>
    <div class="mh-panel" data-role="panel"></div>
  `);
  renderPanel();
}

function refreshTabCounts() {
  const target = profile();
  const counts = {
    list: Object.keys(target.wants).length,
    decos: Object.values(target.decos).filter((deco) => deco.want > 0).length,
  };
  app.querySelectorAll("[data-count]").forEach((element) => {
    const count = counts[element.dataset.count];
    element.textContent = count ? String(count) : "";
  });
}

function importBanner() {
  if (!pendingImport) return "";
  if (pendingImport.error) {
    return `<div class="mh-banner">共有URLを読み取れませんでした。<button type="button" class="mh-btn" data-action="import-dismiss">閉じる</button></div>`;
  }
  const exists = store.profiles.some((entry) => entry.name === pendingImport.name);
  return `
    <div class="mh-banner">
      <div><strong>「${escapeHtml(pendingImport.name)}」</strong>さんの欲しいものリスト（装備${Object.keys(pendingImport.wants).length}件）が共有されました。取り込みますか？</div>
      <div class="mh-row">
        ${exists ? `<button type="button" class="mh-btn primary" data-action="import-accept" data-mode="replace">同じ名前のリストを上書き</button>` : ""}
        <button type="button" class="mh-btn ${exists ? "" : "primary"}" data-action="import-accept" data-mode="new">新しい人として追加</button>
        <button type="button" class="mh-btn" data-action="import-dismiss">取り込まない</button>
      </div>
    </div>
  `;
}

function profileBar() {
  const current = profile();
  return `
    <div class="mh-profile">
      <label class="mh-profile-label">
        <span>だれのリスト？</span>
        <select data-role="profile-select">
          ${store.profiles.map((entry) => `<option value="${entry.id}" ${entry.id === current.id ? "selected" : ""}>${escapeHtml(entry.name)}</option>`).join("")}
        </select>
      </label>
      <div class="mh-row">
        <button type="button" class="mh-btn" data-action="profile-add">＋ 人を追加</button>
        <button type="button" class="mh-btn" data-action="profile-rename">名前変更</button>
        <button type="button" class="mh-btn danger" data-action="profile-delete">削除</button>
      </div>
    </div>
  `;
}

function renderPanel() {
  const panel = app.querySelector("[data-role='panel']");
  if (!panel) return;
  const renderers = {
    list: renderListPanel,
    weapons: () => filterPanel(weaponControls()),
    armor: () => filterPanel(armorControls()),
    charms: () => filterPanel(charmControls()),
    decos: () => filterPanel(decoControls()),
    items: () => filterPanel(itemControls()),
    party: renderPartyPanel,
  };
  panel.innerHTML = renderers[currentTab]();
  if (panel.querySelector("[data-role='results']")) renderResults();
  refreshTabCounts();
}

function filterPanel(controls) {
  return `<div class="mh-controls">${controls}</div><div data-role="results"></div>`;
}

function renderResults() {
  const results = app.querySelector("[data-role='results']");
  if (!results) return;
  const renderers = {
    weapons: weaponResults,
    armor: armorResults,
    charms: charmResults,
    decos: decoResults,
    items: itemResults,
  };
  results.innerHTML = renderers[currentTab]();
}

function paged(list, render, wrapClass = "mh-cards") {
  const { limit } = filters[currentTab];
  if (!list.length) return `<div class="empty">該当するものがありません。</div>`;
  return `
    <div class="mh-result-count">${list.length}件</div>
    <div class="${wrapClass}">${list.slice(0, limit).map(render).join("")}</div>
    ${list.length > limit ? `<button type="button" class="mh-btn mh-more" data-action="more">さらに表示（残り${list.length - limit}件）</button>` : ""}
  `;
}

// ---------------------------------------------------------------------------
// 欲しいものタブ

function renderListPanel() {
  const target = profile();
  const wants = Object.entries(target.wants)
    .map(([key, want]) => ({ key, want, info: resolveWant(key) }))
    .filter((entry) => entry.info);
  const { rows, zenny } = computeNeeds(target);
  const visibleRows = filters.list.hideDone ? rows.filter((row) => row.remain > 0) : rows;
  const wantedDecos = Object.entries(target.decos).filter(([, deco]) => deco.want > 0);

  return `
    <div class="mh-grid-2">
      <div class="panel">
        <h2>欲しい装備 <small>${wants.length}件</small></h2>
        ${wants.length ? `<ul class="mh-want-list">${wants.map(wantRow).join("")}</ul>` : `<div class="empty">まだありません。「武器」「防具」「護石」タブで <b>＋欲しい</b> を押すと追加されます。</div>`}
      </div>
      <div class="panel">
        <h2>欲しい珠 <small>${wantedDecos.length}件</small></h2>
        ${wantedDecos.length ? `<ul class="mh-want-list">${wantedDecos.map(([id]) => decoRow(idx.decos.get(id))).join("")}</ul>` : `<div class="empty">「珠（装飾品）」タブで欲しい数を設定できます。</div>`}
      </div>
    </div>

    <div class="panel">
      <div class="mh-panel-head">
        <h2>必要な素材</h2>
        <div class="mh-row">
          <label class="mh-check"><input type="checkbox" data-list-filter="hideDone" ${filters.list.hideDone ? "checked" : ""} /> 集め終わった素材を隠す</label>
          <button type="button" class="mh-btn" data-action="owned-clear">所持数リセット</button>
        </div>
      </div>
      <p class="mh-note">「所持」に持っている数を入れると、残りの必要数が減ります。必要なお金: <b>${zenny.toLocaleString()}z</b></p>
      <div data-role="need-summary">${needSummary(rows)}</div>
      ${visibleRows.length ? `
        <div class="table-wrap">
          <table class="mh-table">
            <thead><tr><th>素材</th><th>必要</th><th>所持</th><th>残り</th><th>主な入手先</th></tr></thead>
            <tbody>${visibleRows.map(needRow).join("")}</tbody>
          </table>
        </div>` : `<div class="empty">${rows.length ? "すべて集め終わりました！" : "欲しい装備を追加すると、ここに必要素材が表示されます。"}</div>`}
    </div>

    ${sharePanel()}
  `;
}

function wantRow({ key, want, info }) {
  const isWeapon = info.kind === "w";
  const chainLength = isWeapon ? weaponChain(info.entity).length : 1;
  return `
    <li class="mh-want">
      <div class="mh-want-main">
        <span class="pill">${escapeHtml(info.label)}</span>
        ${rarityPill(info.rarity)}
        <b>${escapeHtml(info.name)}</b>
      </div>
      <div class="mh-row">
        ${isWeapon && chainLength > 1 ? `<label class="mh-check" title="生産から強化までに使う素材をすべて合計します"><input type="checkbox" data-chain="${key}" ${want.chain ? "checked" : ""} /> 生産から全部（${chainLength}段階）</label>` : ""}
        <span class="mh-stepper">
          <button type="button" class="mh-btn small" data-action="want-step" data-key="${key}" data-step="-1" aria-label="減らす">−</button>
          <span>×${want.n || 1}</span>
          <button type="button" class="mh-btn small" data-action="want-step" data-key="${key}" data-step="1" aria-label="増やす">＋</button>
        </span>
        <button type="button" class="mh-btn small danger" data-action="want-remove" data-key="${key}">外す</button>
      </div>
    </li>
  `;
}

function needSummary(rows) {
  if (!rows.length) return "";
  const done = rows.filter((row) => row.remain === 0).length;
  const percent = Math.round((done / rows.length) * 100);
  return `
    <div class="mh-progress" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">
      <div class="mh-progress-bar" style="width:${percent}%"></div>
      <span>${done} / ${rows.length} 種類 集め終わり（${percent}%）</span>
    </div>
  `;
}

function needRow(row) {
  const item = row.item || { n: `不明な素材(${row.itemId})`, r: 0 };
  return `
    <tr class="${row.remain === 0 ? "is-done" : ""}">
      <td>${itemLabel(item)}</td>
      <td class="num">${row.need}</td>
      <td><input class="mh-num" type="number" min="0" max="9999" inputmode="numeric" value="${row.owned || ""}" placeholder="0" data-owned="${row.itemId}" aria-label="${escapeHtml(item.n)}の所持数" /></td>
      <td class="num" data-role="remain">${remainBadge(row.remain)}</td>
      <td class="mh-src-cell">${sourceList(item, 3)}</td>
    </tr>
  `;
}

function remainBadge(remain) {
  return remain === 0 ? `<span class="mh-done">✓ OK</span>` : `<b>${remain}</b>`;
}

function sharePanel() {
  return `
    <div class="panel">
      <h2>共有・引っ越し</h2>
      <p class="mh-note">リストはこのブラウザに保存されています（お金も登録も不要）。友達に見せたいときや、スマホ⇔PCで移したいときは共有URLを送ってください。開いた人のブラウザに取り込まれます。</p>
      <div class="mh-row">
        <button type="button" class="mh-btn primary" data-action="share-url">共有URLをコピー</button>
        <button type="button" class="mh-btn" data-action="share-code">共有コードをコピー</button>
      </div>
      <p class="mh-note" data-role="share-message"></p>
      <textarea class="mh-textarea" data-role="share-output" rows="3" readonly hidden></textarea>
      <div class="mh-import">
        <input class="mh-input" type="text" data-role="import-input" placeholder="共有コード / 共有URLを貼り付け" />
        <button type="button" class="mh-btn" data-action="import-code">取り込む</button>
      </div>
      <p class="mh-note" data-role="import-message"></p>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// みんなタブ（このブラウザにいる全員の必要素材を、モンスター別にまとめる）

function renderPartyPanel() {
  const byMonster = new Map();
  const others = [];
  const summaries = store.profiles.map((entry) => {
    const { rows } = computeNeeds(entry);
    const remaining = rows.filter((row) => row.remain > 0);
    remaining.forEach((row) => {
      const sources = row.item?.src || [];
      if (!sources.length) {
        others.push({ profile: entry, row });
        return;
      }
      const monsterIds = [...new Set(sources.map((source) => source[0]))];
      monsterIds.forEach((monsterId) => {
        if (!byMonster.has(monsterId)) byMonster.set(monsterId, []);
        byMonster.get(monsterId).push({ profile: entry, row });
      });
    });
    const wantedDecos = Object.entries(entry.decos).filter(([, deco]) => deco.want > (deco.have || 0));
    return { entry, wants: Object.keys(entry.wants).length, remaining: remaining.length, decos: wantedDecos };
  });

  const monsters = [...byMonster.entries()]
    .map(([monsterId, needs]) => ({ monster: idx.monsters.get(monsterId), needs, people: new Set(needs.map((need) => need.profile.id)).size }))
    .sort((a, b) => b.people - a.people || b.needs.length - a.needs.length);

  return `
    <div class="panel">
      <h2>メンバー</h2>
      <p class="mh-note">このブラウザに登録されている人の一覧です。友達の共有URLを開くとここに追加されます。</p>
      <div class="table-wrap">
        <table class="mh-table">
          <thead><tr><th>名前</th><th>欲しい装備</th><th>残り素材</th><th>欲しい珠（未所持）</th></tr></thead>
          <tbody>
            ${summaries.map((summary) => `
              <tr>
                <td><b>${escapeHtml(summary.entry.name)}</b></td>
                <td class="num">${summary.wants}</td>
                <td class="num">${summary.remaining}種類</td>
                <td>${summary.decos.map(([id, deco]) => `${escapeHtml(idx.decos.get(id)?.n || id)}×${deco.want - (deco.have || 0)}`).join("、") || "-"}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>
    <div class="panel">
      <h2>どのモンスターを狩る？</h2>
      <p class="mh-note">まだ足りない素材を、落とすモンスターごとにまとめました。欲しい人が多い順に並んでいます。</p>
      ${monsters.length ? `<div class="mh-cards">${monsters.map(monsterCard).join("")}</div>` : `<div class="empty">足りない素材はありません。</div>`}
      ${others.length ? `
        <h3 class="mh-subhead">モンスター以外（採取・交易・調査報酬など）</h3>
        <ul class="mh-need-people">${others.map(({ profile: entry, row }) => `<li><b>${escapeHtml(entry.name)}</b>：${itemLabel(row.item)} ×${row.remain}</li>`).join("")}</ul>` : ""}
    </div>
  `;
}

function monsterCard({ monster, needs, people }) {
  return `
    <article class="card mh-card">
      <div class="card-body">
        <div class="mh-card-head"><h3>${escapeHtml(monster?.n || "不明")}</h3><span class="pill purple">${people}人</span></div>
        <ul class="mh-need-people">
          ${needs.map(({ profile: entry, row }) => `<li><b>${escapeHtml(entry.name)}</b>：${itemLabel(row.item)} ×${row.remain}</li>`).join("")}
        </ul>
      </div>
    </article>
  `;
}

// ---------------------------------------------------------------------------
// 武器タブ

function weaponControls() {
  const f = filters.weapons;
  return `
    <label class="mh-field"><span>武器種</span>
      <select data-filter="type">
        <option value="">すべて</option>
        ${data.weaponTypes.map((type) => `<option value="${type.id}" ${f.type === type.id ? "selected" : ""}>${type.n}</option>`).join("")}
      </select>
    </label>
    ${rarityFilter(f.rarity)}
    ${searchField(f.q, "武器名・スキル・素材名で検索")}
    ${wantedOnlyField(f.wantedOnly)}
  `;
}

function weaponResults() {
  const f = filters.weapons;
  const target = profile();
  const list = data.weapons.filter((weapon) =>
    (!f.type || weapon.t === f.type)
    && (!f.rarity || String(weapon.r) === f.rarity)
    && (!f.wantedOnly || target.wants[`w:${weapon.id}`])
    && matches(f.q, [weapon.n, skillText(weapon.sk), materialText(weapon.in)]));
  return paged(list, weaponCard);
}

function weaponCard(weapon) {
  const prev = weapon.prev ? idx.weapons.get(weapon.prev) : null;
  const element = weapon.el ? `${weapon.el[2] ? "(" : ""}${ELEMENT_LABELS[weapon.el[0]] || weapon.el[0]}${weapon.el[1]}${weapon.el[2] ? ")" : ""}` : "";
  return `
    <article class="card mh-card">
      <div class="card-body">
        <div class="mh-card-head">
          <div>
            <div class="meta-row"><span class="pill">${idx.weaponTypes.get(weapon.t)}</span>${rarityPill(weapon.r)}</div>
            <h3>${escapeHtml(weapon.n)}</h3>
          </div>
          ${wantButton(`w:${weapon.id}`)}
        </div>
        <dl class="mh-stats">
          <div><dt>攻撃</dt><dd>${weapon.atk ?? "-"}</dd></div>
          ${weapon.aff ? `<div><dt>会心</dt><dd>${weapon.aff}%</dd></div>` : ""}
          ${element ? `<div><dt>属性</dt><dd>${element}</dd></div>` : ""}
          <div><dt>スロット</dt><dd>${slotText(weapon.sl)}</dd></div>
        </dl>
        ${skillList(weapon.sk)}
        ${prev ? `<div class="mh-note">派生元: ${escapeHtml(prev.n)}（強化）</div>` : ""}
        ${materialList(weapon.in, weapon.z)}
      </div>
    </article>
  `;
}

// ---------------------------------------------------------------------------
// 防具タブ

function armorControls() {
  const f = filters.armor;
  return `
    ${rarityFilter(f.rarity)}
    ${searchField(f.q, "防具名・スキル・素材名で検索")}
    ${wantedOnlyField(f.wantedOnly)}
  `;
}

function armorResults() {
  const f = filters.armor;
  const target = profile();
  const list = data.armor.filter((set) =>
    (!f.rarity || String(set.r) === f.rarity)
    && (!f.wantedOnly || set.pc.some((piece) => target.wants[`a:${piece.id}`]))
    && matches(f.q, [set.n, ...set.pc.map((piece) => `${piece.n} ${skillText(piece.sk)} ${materialText(piece.in)}`)]));
  return paged(list, armorCard, "mh-cards wide");
}

function armorCard(set) {
  const pieces = [...set.pc].sort((a, b) => PIECE_ORDER.indexOf(a.p) - PIECE_ORDER.indexOf(b.p));
  return `
    <article class="card mh-card">
      <div class="card-body">
        <div class="mh-card-head">
          <div>
            <div class="meta-row">${rarityPill(set.r)}</div>
            <h3>${escapeHtml(set.n)}</h3>
          </div>
          <button type="button" class="mh-btn small" data-action="want-set" data-keys="${pieces.map((piece) => `a:${piece.id}`).join(",")}">全部位を欲しい</button>
        </div>
        <div class="mh-pieces">
          ${pieces.map((piece) => `
            <div class="mh-piece">
              <div class="mh-card-head">
                <div><span class="pill">${PIECE_LABELS[piece.p]}</span> <b>${escapeHtml(piece.n)}</b></div>
                ${wantButton(`a:${piece.id}`)}
              </div>
              <div class="mh-note">防御 ${piece.def ?? "-"} ／ スロット ${slotText(piece.sl)}</div>
              ${skillList(piece.sk)}
              ${materialList(piece.in, piece.z)}
            </div>`).join("")}
        </div>
      </div>
    </article>
  `;
}

// ---------------------------------------------------------------------------
// 護石タブ

function charmControls() {
  const f = filters.charms;
  return `${searchField(f.q, "護石名・スキル・素材名で検索")}${wantedOnlyField(f.wantedOnly)}`;
}

function charmResults() {
  const f = filters.charms;
  const target = profile();
  const list = data.charms.filter((charm) =>
    (!f.wantedOnly || target.wants[`c:${charm.id}`])
    && matches(f.q, [charm.n, skillText(charm.sk), materialText(charm.in)]));
  return paged(list, charmCard);
}

function charmCard(charm) {
  return `
    <article class="card mh-card">
      <div class="card-body">
        <div class="mh-card-head">
          <div>
            <div class="meta-row">${rarityPill(charm.r)}${charm.rand ? `<span class="pill purple">鑑定（ランダム）</span>` : ""}</div>
            <h3>${escapeHtml(charm.n)}</h3>
          </div>
          ${charm.in && Object.keys(charm.in).length ? wantButton(`c:${charm.id}`) : ""}
        </div>
        ${skillList(charm.sk)}
        ${charm.rand ? `<div class="mh-note">スキルはランダムです（入手後に鑑定）。</div>` : materialList(charm.in, charm.z)}
      </div>
    </article>
  `;
}

// ---------------------------------------------------------------------------
// 珠タブ

function decoControls() {
  const f = filters.decos;
  return `
    <label class="mh-field"><span>種類</span>
      <select data-filter="on">
        <option value="">すべて</option>
        <option value="weapon" ${f.on === "weapon" ? "selected" : ""}>武器用</option>
        <option value="armor" ${f.on === "armor" ? "selected" : ""}>防具用</option>
      </select>
    </label>
    <label class="mh-field"><span>スロット</span>
      <select data-filter="lv">
        <option value="">すべて</option>
        ${[1, 2, 3, 4].map((lv) => `<option value="${lv}" ${f.lv === String(lv) ? "selected" : ""}>Lv${lv}</option>`).join("")}
      </select>
    </label>
    ${searchField(f.q, "珠の名前・スキルで検索")}
    ${wantedOnlyField(f.wantedOnly, "欲しい・所持のみ")}
  `;
}

function decoResults() {
  const f = filters.decos;
  const target = profile();
  const list = data.decorations.filter((deco) =>
    (!f.on || deco.on === f.on)
    && (!f.lv || String(deco.lv) === f.lv)
    && (!f.wantedOnly || target.decos[deco.id])
    && matches(f.q, [deco.n, skillText(deco.sk)]));
  return paged(list, decoRow, "mh-want-list");
}

function decoRow(deco) {
  if (!deco) return "";
  const state = profile().decos[deco.id] || { want: 0, have: 0 };
  const done = state.want > 0 && state.have >= state.want;
  return `
    <li class="mh-want mh-deco ${done ? "is-done" : ""}" data-deco-row>
      <div class="mh-want-main">
        <span class="pill">${deco.on === "weapon" ? "武器" : "防具"}</span>
        ${rarityPill(deco.r)}
        <b>${escapeHtml(deco.n)}</b>
        <span class="mh-skill-inline">${skillText(deco.sk, true)}</span>
      </div>
      <div class="mh-row">
        ${decoStepper(deco.id, "want", "欲しい", state.want)}
        ${decoStepper(deco.id, "have", "所持", state.have)}
        ${done ? `<span class="mh-done">✓ OK</span>` : ""}
      </div>
    </li>
  `;
}

function decoStepper(id, field, label, value) {
  return `
    <span class="mh-stepper">
      <span class="mh-stepper-label">${label}</span>
      <button type="button" class="mh-btn small" data-action="deco-step" data-id="${id}" data-field="${field}" data-step="-1" aria-label="${label}を減らす">−</button>
      <span>${value || 0}</span>
      <button type="button" class="mh-btn small" data-action="deco-step" data-id="${id}" data-field="${field}" data-step="1" aria-label="${label}を増やす">＋</button>
    </span>
  `;
}

// ---------------------------------------------------------------------------
// 素材タブ

function itemControls() {
  const f = filters.items;
  return `
    ${rarityFilter(f.rarity)}
    ${searchField(f.q, "素材名・モンスター名で検索")}
    <label class="mh-check"><input type="checkbox" data-filter="neededOnly" ${f.neededOnly ? "checked" : ""} /> 自分に必要な素材のみ</label>
  `;
}

function itemResults() {
  const f = filters.items;
  const needs = new Map(computeNeeds(profile()).rows.map((row) => [row.itemId, row]));
  const list = data.items.filter((item) =>
    (!f.rarity || String(item.r) === f.rarity)
    && (!f.neededOnly || needs.has(item.id))
    && matches(f.q, [item.n, (item.src || []).map((source) => idx.monsters.get(source[0])?.n).join(" ")]));
  return paged(list, (item) => itemCard(item, needs.get(item.id)));
}

function itemCard(item, need) {
  const usage = idx.usage.get(item.id) || [];
  return `
    <article class="card mh-card">
      <div class="card-body">
        <div class="mh-card-head">
          <h3>${itemLabel(item)}</h3>
          ${rarityPill(item.r)}
        </div>
        ${need ? `<div class="mh-need-chip ${need.remain === 0 ? "is-done" : ""}">必要 ${need.need} ／ 所持 ${need.owned} ／ 残り ${need.remain}</div>` : ""}
        ${item.d ? `<p class="mh-desc">${escapeHtml(item.d)}</p>` : ""}
        <div class="mh-src-block"><div class="mh-label">入手先</div>${sourceList(item, 8)}</div>
        ${usage.length ? `
          <details class="mh-details">
            <summary>使い道（${usage.length}件）</summary>
            <ul>${usage.map(({ key, amount }) => {
              const info = resolveWant(key);
              return info ? `<li><span class="mh-muted">${escapeHtml(info.label)}</span> ${escapeHtml(info.name)} ×${amount}</li>` : "";
            }).join("")}</ul>
          </details>` : ""}
      </div>
    </article>
  `;
}

// ---------------------------------------------------------------------------
// 共通パーツ

function wantButton(key) {
  const wanted = Boolean(profile().wants[key]);
  return `<button type="button" class="mh-btn small ${wanted ? "active" : "primary"}" data-action="toggle-want" data-key="${key}" aria-pressed="${wanted}">${wanted ? "✓ 欲しい" : "＋ 欲しい"}</button>`;
}

function rarityFilter(value) {
  return `
    <label class="mh-field"><span>レア度</span>
      <select data-filter="rarity">
        <option value="">すべて</option>
        ${[1, 2, 3, 4, 5, 6, 7, 8].map((r) => `<option value="${r}" ${value === String(r) ? "selected" : ""}>RARE ${r}</option>`).join("")}
      </select>
    </label>
  `;
}

function searchField(value, placeholder) {
  return `<label class="mh-field grow"><span>検索</span><input class="mh-input" type="search" data-filter="q" value="${escapeHtml(value)}" placeholder="${placeholder}" /></label>`;
}

function wantedOnlyField(checked, label = "欲しいもののみ") {
  return `<label class="mh-check"><input type="checkbox" data-filter="wantedOnly" ${checked ? "checked" : ""} /> ${label}</label>`;
}

function rarityPill(rarity) {
  if (!rarity) return "";
  return `<span class="mh-rarity r${rarity}">RARE ${rarity}</span>`;
}

function slotText(slots) {
  return slots && slots.length ? slots.map((lv) => SLOT_MARKS[lv] || `[${lv}]`).join("") : "なし";
}

function skillText(skills, withLevel = false) {
  return Object.entries(skills || {})
    .map(([id, level]) => {
      const name = data.skills[id]?.n || "";
      return withLevel ? `${name} Lv${level}` : name;
    })
    .join(" ");
}

function skillList(skills) {
  const entries = Object.entries(skills || {});
  if (!entries.length) return "";
  return `<div class="mh-skills">${entries.map(([id, level]) => {
    const skill = data.skills[id];
    const bonus = skill && (skill.k === "set" || skill.k === "group");
    return `<span class="mh-skill ${bonus ? "bonus" : ""}">${escapeHtml(skill?.n || "?")}${bonus ? "" : ` Lv${level}`}</span>`;
  }).join("")}</div>`;
}

function materialText(inputs) {
  return Object.keys(inputs || {}).map((id) => idx.items.get(id)?.n || "").join(" ");
}

function materialList(inputs, zenny) {
  const entries = Object.entries(inputs || {});
  if (!entries.length) return `<div class="mh-note">素材データなし（初期装備・特殊入手など）</div>`;
  const owned = profile().owned;
  return `
    <ul class="mh-materials">
      ${entries.map(([id, amount]) => {
        const item = idx.items.get(id);
        const enough = (owned[id] || 0) >= amount;
        return `<li class="${enough ? "is-done" : ""}">${itemLabel(item || { n: id })}<span>×${amount}</span></li>`;
      }).join("")}
      ${zenny ? `<li class="mh-zenny">費用<span>${zenny.toLocaleString()}z</span></li>` : ""}
    </ul>
  `;
}

function itemLabel(item) {
  if (!item) return "";
  const color = ITEM_COLORS[item.c] || "#bbb";
  return `<span class="mh-item" title="${escapeHtml(item.d || "")}"><i class="mh-dot" style="--dot:${color}"></i>${escapeHtml(item.n)}</span>`;
}

function sourceList(item, max) {
  const sources = item?.src || [];
  if (!sources.length) return `<span class="mh-muted">採取・交易・調査報酬など</span>`;
  const shown = sources.slice(0, max);
  return `
    <ul class="mh-sources">
      ${shown.map(([monsterId, rank, kinds, chance]) => `
        <li><b>${escapeHtml(idx.monsters.get(monsterId)?.n || "?")}</b> <span class="mh-rank ${rank}">${RANK_LABELS[rank] || rank}</span>
        <span class="mh-muted">${kinds.map((kind) => SOURCE_LABELS[kind] || kind).join("・")} 最大${chance}%</span></li>`).join("")}
      ${sources.length > shown.length ? `<li class="mh-muted">ほか${sources.length - shown.length}件</li>` : ""}
    </ul>
  `;
}

function matches(query, fields) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = normalize(fields.join(" "));
  return words.every((word) => haystack.includes(word));
}

// 全角英数・カタカナ/ひらがなの違いを吸収して検索しやすくする
function normalize(text) {
  return String(text || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ぁ-ゖ]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 0x60));
}

function htmlToElement(html) {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
