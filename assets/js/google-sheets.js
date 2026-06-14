export async function applyGoogleSheetsData(state, configPath) {
  let config;
  try {
    config = await loadJson(configPath);
  } catch {
    return;
  }

  if (!config?.enabled) return;

  const sheets = config.sheets || {};
  await Promise.all([
    safeApply(() => applySiteContent(state, sheets.siteContent), "siteContent"),
    safeApply(() => applyEvents(state.apex, sheets.apexEvents), "apexEvents"),
    safeApply(() => applyApexTeams(state.apex, sheets.apexTeams), "apexTeams"),
    safeApply(() => applyEvents(state.wildcard, sheets.wildcardEvents), "wildcardEvents"),
    safeApply(() => applyWildcardParticipants(state.wildcard, sheets.wildcardParticipants), "wildcardParticipants"),
    safeApply(() => applyWildcardMatchTeams(state.wildcard, sheets.wildcardMatchTeams), "wildcardMatchTeams"),
    safeApply(() => applyParticipationHistory(state, sheets.participationHistory), "participationHistory"),
  ]);
}

async function safeApply(task, name) {
  try {
    await task();
  } catch (error) {
    console.warn(`Google Sheets "${name}" could not be loaded. JSON fallback is used.`, error);
  }
}

async function applySiteContent(state, url) {
  const rows = await loadCsvRows(url);
  if (!rows.length) return;
  state.site.home ||= {};
  for (const row of rows) {
    const key = pick(row, ["key", "項目", "field"]);
    const value = pick(row, ["value", "内容", "text"]);
    if (key && value) state.site.home[key] = value;
  }
}

async function applyEvents(events, url) {
  const rows = await loadCsvRows(url);
  for (const row of rows) {
    const id = pick(row, ["id", "ID"]);
    if (!id) continue;
    const event = findOrCreate(events, id);
    copyFields(row, event, {
      title: ["title", "大会名"],
      date: ["date", "開催日"],
      category: ["category", "カテゴリ"],
      summary: ["summary", "一覧説明"],
      description: ["description", "大会概要"],
      thumbnail: ["thumbnail", "サムネイル"],
      teamImage: ["teamImage", "参加者一覧画像", "チーム紹介画像"],
      totalResultImage: ["totalResultImage", "総合結果画像"],
      archiveUrl: ["archiveUrl", "配信URL"],
      edYoutubeUrl: ["edYoutubeUrl", "ED動画URL"],
      memo: ["memo", "メモ"],
    });
  }
}

async function applyApexTeams(events, url) {
  const rows = await loadCsvRows(url);
  const grouped = groupBy(rows, (row) => pick(row, ["eventId", "大会ID"]));
  for (const [eventId, eventRows] of grouped) {
    const event = events.find((entry) => entry.id === eventId);
    if (!event) continue;
    event.teams = eventRows.map((row) => ({
      id: pick(row, ["teamId", "チームID"]) || `team-${pick(row, ["teamNo", "チーム番号"]) || event.teams?.length + 1 || 1}`,
      name: pick(row, ["teamName", "チーム名"]),
      thumbnail: pick(row, ["thumbnail", "チームサムネイル"]),
      note: pick(row, ["note", "メモ"]),
      members: [1, 2, 3].map((number) => ({
        name: pick(row, [`member${number}`, `メンバー${number}`]),
        standImage: pick(row, [`member${number}Image`, `メンバー${number}立ち絵`]),
        streamUrl: pick(row, [`member${number}StreamUrl`, `メンバー${number}配信URL`]),
      })),
    }));
  }
}

async function applyWildcardParticipants(events, url) {
  const rows = await loadCsvRows(url);
  const grouped = groupBy(rows, (row) => pick(row, ["eventId", "大会ID"]));
  for (const [eventId, eventRows] of grouped) {
    const event = events.find((entry) => entry.id === eventId);
    if (!event) continue;
    event.participants = eventRows
      .sort((a, b) => numberValue(pick(a, ["number", "番号"])) - numberValue(pick(b, ["number", "番号"])))
      .map((row) => ({
        name: pick(row, ["name", "名前"]),
        standImage: pick(row, ["standImage", "立ち絵"]),
        streamUrl: pick(row, ["streamUrl", "配信URL"]),
        xUrl: pick(row, ["xUrl", "X"]),
      }))
      .filter((participant) => participant.name);
  }
}

async function applyWildcardMatchTeams(events, url) {
  const rows = await loadCsvRows(url);
  const byEvent = groupBy(rows, (row) => pick(row, ["eventId", "大会ID"]));
  for (const [eventId, eventRows] of byEvent) {
    const event = events.find((entry) => entry.id === eventId);
    if (!event) continue;
    const byMatch = groupBy(eventRows, (row) => pick(row, ["matchName", "試合名"]));
    event.matchTeams = Array.from(byMatch, ([matchName, matchRows]) => ({
      matchName,
      teams: matchRows
        .sort((a, b) => numberValue(pick(a, ["teamNo", "チーム番号"])) - numberValue(pick(b, ["teamNo", "チーム番号"])))
        .map((row) => ({
          name: pick(row, ["teamName", "チーム名"]) || `チーム ${pick(row, ["teamNo", "チーム番号"])}`,
          members: [1, 2, 3].map((number) => pick(row, [`member${number}`, `メンバー${number}`])).filter(Boolean),
        })),
    }));
  }
}

async function applyParticipationHistory(state, url) {
  const rows = await loadCsvRows(url);
  if (!rows.length) return;
  state.participation = rows.map((row) => ({
    id: pick(row, ["id", "ID"]),
    title: pick(row, ["title", "大会名"]),
    date: pick(row, ["date", "開催日"]),
    teamName: pick(row, ["teamName", "チーム名"]),
    members: [1, 2, 3].map((number) => pick(row, [`member${number}`, `メンバー${number}`])).filter(Boolean),
    finalRank: pick(row, ["finalRank", "最終順位"]),
    thumbnail: pick(row, ["thumbnail", "サムネイル"]),
    teamImage: pick(row, ["teamImage", "チーム画像"]),
    archiveUrl: pick(row, ["archiveUrl", "配信URL"]),
    memo: pick(row, ["memo", "メモ"]),
  })).filter((entry) => entry.id && entry.title);
}

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path} could not be loaded`);
  return response.json();
}

async function loadCsvRows(url) {
  if (!url) return [];
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} could not be loaded`);
  return parseCsv(await response.text());
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }
  row.push(value);
  rows.push(row);

  const headers = rows.shift()?.map((header) => header.trim()) || [];
  return rows
    .filter((line) => line.some((cell) => cell.trim()))
    .map((line) => Object.fromEntries(headers.map((header, index) => [header, (line[index] || "").trim()])));
}

function findOrCreate(items, id) {
  let item = items.find((entry) => entry.id === id);
  if (!item) {
    item = { id };
    items.push(item);
  }
  return item;
}

function copyFields(source, target, mapping) {
  for (const [field, aliases] of Object.entries(mapping)) {
    const value = pick(source, aliases);
    if (value) target[field] = value;
  }
}

function pick(row, keys) {
  for (const key of keys) {
    if (row[key]) return row[key].trim();
  }
  return "";
}

function groupBy(rows, getKey) {
  const map = new Map();
  for (const row of rows) {
    const key = getKey(row);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

function numberValue(value) {
  return Number.parseInt(value || "0", 10) || 0;
}
