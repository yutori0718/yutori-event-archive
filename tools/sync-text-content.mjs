import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(os.homedir(), "Desktop", "サイト用");

const apexEvents = [
  { folder: "ゆとり祭りvo.1", id: "yutori-fes-vol1" },
  { folder: "ゆとり祭りvo.2", id: "yutori-fes-vol2" },
];

const wildcardEvents = [
  { folder: "ワイカですがなにか？vo.1", id: "waika-vol1" },
  { folder: "ワイカですがなにか？vo.2", id: "waika-vol2" },
];

const participationEntries = [
  { folder: path.join("出場履歴", "exe-apex-custom"), id: "exe-apex-custom" },
];

let changed = 0;

await syncApex();
await syncWildcard();
await syncParticipation();

console.log(`Synced text files: ${changed}`);

async function syncApex() {
  const file = path.join(repoRoot, "data", "apex-custom.json");
  const data = await readJson(file);

  for (const config of apexEvents) {
    const event = data.events.find((entry) => entry.id === config.id);
    if (!event) continue;

    const folder = path.join(sourceRoot, config.folder);
    changed += await applyTextFields(folder, event, {
      "page-title.txt": "title",
      "page-summary.txt": "summary",
      "page-description.txt": "description",
      "memo.txt": "memo",
      "date.txt": "date",
      "archive-url.txt": "archiveUrl",
      "ed-youtube-url.txt": "edYoutubeUrl",
    });

    for (let teamIndex = 0; teamIndex < 20; teamIndex++) {
      const teamNo = teamIndex + 1;
      const team = event.teams?.[teamIndex];
      if (!team) continue;

      const teamFolder = path.join(folder, "teams", `team-${teamNo}`);
      changed += await applyTextFields(teamFolder, team, {
        "team-name.txt": "name",
        "team-note.txt": "note",
      });

      for (let memberIndex = 0; memberIndex < 3; memberIndex++) {
        const memberNo = memberIndex + 1;
        const member = team.members?.[memberIndex];
        if (!member || typeof member === "string") continue;

        changed += await applyTextFields(teamFolder, member, {
          [`member-${memberNo}-name.txt`]: "name",
          [`member-${memberNo}-stream-url.txt`]: "streamUrl",
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
      "page-title.txt": "title",
      "page-summary.txt": "summary",
      "page-description.txt": "description",
      "memo.txt": "memo",
      "date.txt": "date",
      "archive-url.txt": "archiveUrl",
      "ed-youtube-url.txt": "edYoutubeUrl",
    });

    for (let participantIndex = 0; participantIndex < 30; participantIndex++) {
      const participantNo = participantIndex + 1;
      const participant = event.participants?.[participantIndex];
      if (!participant) continue;

      const participantFolder = path.join(folder, "participants", `participant-${participantNo}`);
      changed += await applyTextFields(participantFolder, participant, {
        "name.txt": "name",
        "x-url.txt": "xUrl",
        "stream-url.txt": "streamUrl",
      });
    }
  }

  await writeJson(file, data);
}

async function syncParticipation() {
  const file = path.join(repoRoot, "data", "participation-history.json");
  const data = await readJson(file);

  for (const config of participationEntries) {
    const entry = data.entries.find((item) => item.id === config.id);
    if (!entry) continue;

    const folder = path.join(sourceRoot, config.folder);
    changed += await applyTextFields(folder, entry, {
      "page-title.txt": "title",
      "date.txt": "date",
      "team-name.txt": "teamName",
      "final-rank.txt": "finalRank",
      "archive-url.txt": "archiveUrl",
      "memo.txt": "memo",
    });

    const members = [...(entry.members || [])];
    for (let memberIndex = 0; memberIndex < 3; memberIndex++) {
      const text = await readTextIfExists(path.join(folder, `member-${memberIndex + 1}-name.txt`));
      if (text !== null) {
        members[memberIndex] = text;
        changed++;
      }
    }
    entry.members = members;
  }

  await writeJson(file, data);
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
