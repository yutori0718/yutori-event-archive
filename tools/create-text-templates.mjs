import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

const sourceRoot = path.join(os.homedir(), "Desktop", "サイト用");

const apexEvents = [
  { folder: "ゆとり祭りvo.1", title: "ゆとり祭り", description: "ゆとり主催の通常Apexカスタム大会。" },
  { folder: "ゆとり祭りvo.2", title: "Coming Soon ...", description: "Coming Soon ..." },
];

const wildcardEvents = [
  { folder: "ワイカですがなにか？vo.1", title: "ワイカですがなにか？ Vol.1" },
  { folder: "ワイカですがなにか？vo.2", title: "ワイカですがなにか？ Vol.2" },
];

await fs.mkdir(sourceRoot, { recursive: true });

for (const event of apexEvents) {
  const folder = path.join(sourceRoot, event.folder);
  await fs.mkdir(folder, { recursive: true });
  await writeIfMissing(path.join(folder, "page-title.txt"), event.title);
  await writeIfMissing(path.join(folder, "page-summary.txt"), "");
  await writeIfMissing(path.join(folder, "page-description.txt"), event.description);
  await writeIfMissing(path.join(folder, "memo.txt"), "");
  await writeIfMissing(path.join(folder, "date.txt"), "");
  await writeIfMissing(path.join(folder, "archive-url.txt"), "");
  await writeIfMissing(path.join(folder, "ed-youtube-url.txt"), "");

  for (let teamNo = 1; teamNo <= 20; teamNo++) {
    const teamFolder = path.join(folder, "teams", `team-${teamNo}`);
    await fs.mkdir(teamFolder, { recursive: true });
    await writeIfMissing(path.join(teamFolder, "team-name.txt"), `チーム${teamNo}`);
    await writeIfMissing(path.join(teamFolder, "team-note.txt"), "");
    for (let memberNo = 1; memberNo <= 3; memberNo++) {
      await writeIfMissing(path.join(teamFolder, `member-${memberNo}-name.txt`), `メンバー${memberNo}`);
      await writeIfMissing(path.join(teamFolder, `member-${memberNo}-stream-url.txt`), "");
    }
  }
}

for (const event of wildcardEvents) {
  const folder = path.join(sourceRoot, event.folder);
  await fs.mkdir(folder, { recursive: true });
  await writeIfMissing(path.join(folder, "page-title.txt"), event.title);
  await writeIfMissing(path.join(folder, "page-summary.txt"), "");
  await writeIfMissing(path.join(folder, "page-description.txt"), "");
  await writeIfMissing(path.join(folder, "memo.txt"), "");
  await writeIfMissing(path.join(folder, "date.txt"), "");
  await writeIfMissing(path.join(folder, "archive-url.txt"), "");
  await writeIfMissing(path.join(folder, "ed-youtube-url.txt"), "");

  for (let participantNo = 1; participantNo <= 30; participantNo++) {
    const participantFolder = path.join(folder, "participants", `participant-${participantNo}`);
    await fs.mkdir(participantFolder, { recursive: true });
    await writeIfMissing(path.join(participantFolder, "name.txt"), `参加者${participantNo}`);
    await writeIfMissing(path.join(participantFolder, "x-url.txt"), "");
    await writeIfMissing(path.join(participantFolder, "stream-url.txt"), "");
  }
}

const historyFolder = path.join(sourceRoot, "出場履歴", "exe-apex-custom");
await fs.mkdir(historyFolder, { recursive: true });
await writeIfMissing(path.join(historyFolder, "page-title.txt"), "EXE Apex Custom");
await writeIfMissing(path.join(historyFolder, "date.txt"), "");
await writeIfMissing(path.join(historyFolder, "team-name.txt"), "");
await writeIfMissing(path.join(historyFolder, "member-1-name.txt"), "");
await writeIfMissing(path.join(historyFolder, "member-2-name.txt"), "");
await writeIfMissing(path.join(historyFolder, "member-3-name.txt"), "");
await writeIfMissing(path.join(historyFolder, "final-rank.txt"), "");
await writeIfMissing(path.join(historyFolder, "archive-url.txt"), "");
await writeIfMissing(path.join(historyFolder, "memo.txt"), "");

async function writeIfMissing(file, value) {
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, `${value}\n`, "utf8");
  }
}
