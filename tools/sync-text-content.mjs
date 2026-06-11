import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(os.homedir(), "Desktop", "サイト用");

const apexEvents = [
  { folder: path.join("Apexカスタム", "ゆとり祭り"), id: "yutori-fes-vol1" },
  { folder: path.join("Apexカスタム", "準備中"), id: "yutori-fes-vol2" },
];

const wildcardEvents = [
  { folder: path.join("ワイルドカード", "ワイカですがなにか？vo.1"), id: "waika-vol1" },
  { folder: path.join("ワイルドカード", "ワイカですがなにか？vo.2"), id: "waika-vol2" },
];

let changed = 0;

await syncSiteContent();
await syncApex();
await syncWildcard();
await syncParticipation();

console.log(`Synced text files: ${changed}`);

async function syncSiteContent() {
  const file = path.join(repoRoot, "data", "site-content.json");
  const data = await readJson(file);
  data.home ||= {};

  const folder = path.join(sourceRoot, "Topページ");
  changed += await applyTextFields(folder, data.home, {
    "小見出し.txt": "heroEyebrow",
    "メイン見出し.txt": "heroTitle",
    "説明文.txt": "heroCopy",
    "Apexボタン.txt": "apexButtonLabel",
    "出場履歴ボタン.txt": "historyButtonLabel",
    "Apexカスタム見出し.txt": "apexSectionTitle",
    "Apexカスタム説明.txt": "apexSectionLead",
    "ワイルドカード見出し.txt": "wildcardSectionTitle",
    "ワイルドカード説明.txt": "wildcardSectionLead",
  });

  await writeJson(file, data);
}

async function syncApex() {
  const file = path.join(repoRoot, "data", "apex-custom.json");
  const data = await readJson(file);

  for (const config of apexEvents) {
    const event = data.events.find((entry) => entry.id === config.id);
    if (!event) continue;

    const folder = path.join(sourceRoot, config.folder);
    changed += await applyTextFields(folder, event, {
      "ページ名.txt": "title",
      "一覧説明.txt": "summary",
      "大会概要.txt": "description",
      "メモ.txt": "memo",
      "開催日.txt": "date",
      "配信URL.txt": "archiveUrl",
      "ED動画URL.txt": "edYoutubeUrl",
    });

    for (let teamIndex = 0; teamIndex < 20; teamIndex++) {
      const teamNo = teamIndex + 1;
      const team = event.teams?.[teamIndex];
      if (!team) continue;

      const teamFolder = path.join(folder, "チーム", `チーム${teamNo}`);
      changed += await applyTextFields(teamFolder, team, {
        "チーム名.txt": "name",
        "チームメモ.txt": "note",
      });

      for (let memberIndex = 0; memberIndex < 3; memberIndex++) {
        const memberNo = memberIndex + 1;
        const member = team.members?.[memberIndex];
        if (!member || typeof member === "string") continue;

        changed += await applyTextFields(teamFolder, member, {
          [`メンバー${memberNo}名前.txt`]: "name",
          [`メンバー${memberNo}配信URL.txt`]: "streamUrl",
        });
      }
    }
  }

  await writeJson(file, data);
}

async function syncWildcard() {
  const file = path.join(repoRoot, "data", "wildcard-custom.json");
  const data = await readJson(file);

  for (const config of wildcardEvents) {
    const event = data.events.find((entry) => entry.id === config.id);
    if (!event) continue;

    const folder = path.join(sourceRoot, config.folder);
    changed += await applyTextFields(folder, event, {
      "ページ名.txt": "title",
      "一覧説明.txt": "summary",
      "大会概要.txt": "description",
      "メモ.txt": "memo",
      "開催日.txt": "date",
      "配信URL.txt": "archiveUrl",
      "ED動画URL.txt": "edYoutubeUrl",
    });

    for (let participantIndex = 0; participantIndex < 30; participantIndex++) {
      const participantNo = participantIndex + 1;
      const participant = event.participants?.[participantIndex];
      if (!participant) continue;

      const participantFolder = path.join(folder, "参加者", `参加者${participantNo}`);
      changed += await applyTextFields(participantFolder, participant, {
        "名前.txt": "name",
        "X.txt": "xUrl",
        "配信URL.txt": "streamUrl",
      });
    }
  }

  await writeJson(file, data);
}

async function syncParticipation() {
  const file = path.join(repoRoot, "data", "participation-history.json");
  const data = await readJson(file);
  data.entries ||= [];

  const historyRoot = path.join(sourceRoot, "出場履歴");
  const folders = await listDirectories(historyRoot);

  for (const folderName of folders) {
    const folder = path.join(historyRoot, folderName);
    const id = folderName === "EXE Apex Custom" ? "exe-apex-custom" : slugify(folderName);
    let entry = data.entries.find((item) => item.id === id);
    if (!entry) {
      entry = {
        id,
        title: folderName,
        date: "",
        teamName: "",
        members: ["", "", ""],
        finalRank: "",
        thumbnail: "",
        teamImage: "",
        archiveUrl: "",
        memo: "",
      };
      data.entries.push(entry);
    }

    changed += await applyTextFields(folder, entry, {
      "ページ名.txt": "title",
      "開催日.txt": "date",
      "チーム名.txt": "teamName",
      "最終順位.txt": "finalRank",
      "配信URL.txt": "archiveUrl",
      "メモ.txt": "memo",
    });

    const members = [...(entry.members || [])];
    for (let memberIndex = 0; memberIndex < 3; memberIndex++) {
      const text = await readTextIfExists(path.join(folder, `メンバー${memberIndex + 1}名前.txt`));
      if (text !== null) {
        members[memberIndex] = text;
        changed++;
      }
    }
    entry.members = members;

    const thumbnail = await findImage(folder, "thumbnail");
    if (thumbnail) entry.thumbnail = `/images/participation-history/${folderName}/${thumbnail}`;

    const teamImage = await findImage(folder, "team-image");
    if (teamImage) entry.teamImage = `/images/participation-history/${folderName}/${teamImage}`;
  }

  await writeJson(file, data);
}

async function listDirectories(folder) {
  try {
    const entries = await fs.readdir(folder, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function findImage(folder, baseName) {
  try {
    const entries = await fs.readdir(folder, { withFileTypes: true });
    const image = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .find((name) => {
        const lower = name.toLowerCase();
        return lower === `${baseName}.png`
          || lower === `${baseName}.jpg`
          || lower === `${baseName}.jpeg`
          || lower === `${baseName}.webp`
          || lower.startsWith(`${baseName}.png.`)
          || lower.startsWith(`${baseName}.jpg.`)
          || lower.startsWith(`${baseName}.jpeg.`)
          || lower.startsWith(`${baseName}.webp.`);
      });
    return image || "";
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}

function slugify(value) {
  const ascii = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (ascii) return ascii;
  const hex = [...value].map((char) => char.codePointAt(0).toString(16)).join("-");
  return `history-${hex}`;
}

async function applyTextFields(folder, target, mapping) {
  let count = 0;
  for (const [fileName, fieldName] of Object.entries(mapping)) {
    const text = await readTextIfExists(path.join(folder, fileName));
    if (text !== null) {
      target[fieldName] = text;
      count++;
    }
  }
  return count;
}

async function readTextIfExists(file) {
  try {
    const value = await fs.readFile(file, "utf8");
    const text = value.replace(/^\uFEFF/, "").trim();
    return text ? text : null;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function writeJson(file, data) {
  await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}
