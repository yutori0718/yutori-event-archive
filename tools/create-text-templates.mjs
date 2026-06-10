import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

const sourceRoot = path.join(os.homedir(), "Desktop", "サイト用");

await fs.mkdir(sourceRoot, { recursive: true });

await createCommonTemplates();
await createTopTemplates();
await createApexTemplates("ゆとり祭り", "ゆとり祭り");
await createApexTemplates("準備中", "Coming Soon ...");
await createWildcardTemplates("ワイカですがなにか？vo.1");
await createWildcardTemplates("ワイカですがなにか？vo.2");
await createHistoryTemplates();
await writeRootGuide();

async function createCommonTemplates() {
  const folder = path.join(sourceRoot, "共通");
  await fs.mkdir(folder, { recursive: true });
  await writeGuide(folder, `共通画像を入れるフォルダです。

画像:
- dachshund-logo.svg
- site-logo.svg
`);
}

async function createTopTemplates() {
  const folder = path.join(sourceRoot, "Topページ");
  await fs.mkdir(folder, { recursive: true });
  await writeIfMissing(path.join(folder, "小見出し.txt"), "Blue neon / Twitch purple / Dachshund emblem");
  await writeIfMissing(path.join(folder, "メイン見出し.txt"), "YUTORI EVENT ARCHIVE");
  await writeIfMissing(path.join(folder, "説明文.txt"), "ゆとりが主催・参加した Apex Legends カスタム大会の記録をまとめるアーカイブサイト。");
  await writeIfMissing(path.join(folder, "Apexボタン.txt"), "Apexカスタムを見る");
  await writeIfMissing(path.join(folder, "出場履歴ボタン.txt"), "出場履歴を見る");
  await writeIfMissing(path.join(folder, "Apexカスタム見出し.txt"), "Apexカスタム");
  await writeIfMissing(path.join(folder, "Apexカスタム説明.txt"), "");
  await writeIfMissing(path.join(folder, "ワイルドカード見出し.txt"), "Apexワイルドカードカスタム");
  await writeIfMissing(path.join(folder, "ワイルドカード説明.txt"), "");
  await writeGuide(folder, `Topページを更新するフォルダです。

編集できるtxt:
- 小見出し.txt
- メイン見出し.txt
- 説明文.txt
- Apexボタン.txt
- 出場履歴ボタン.txt
- Apexカスタム見出し.txt
- Apexカスタム説明.txt
- ワイルドカード見出し.txt
- ワイルドカード説明.txt

編集後は「画像を公開する.bat」をダブルクリックしてください。
`);
}

async function createApexTemplates(folderName, defaultTitle) {
  const folder = path.join(sourceRoot, "Apexカスタム", folderName);
  await fs.mkdir(folder, { recursive: true });
  await writeIfMissing(path.join(folder, "ページ名.txt"), defaultTitle);
  await writeIfMissing(path.join(folder, "一覧説明.txt"), "");
  await writeIfMissing(path.join(folder, "大会概要.txt"), "");
  await writeIfMissing(path.join(folder, "メモ.txt"), "");
  await writeIfMissing(path.join(folder, "開催日.txt"), "");
  await writeIfMissing(path.join(folder, "配信URL.txt"), "");
  await writeIfMissing(path.join(folder, "ED動画URL.txt"), "");
  await writeGuide(folder, `Apexカスタム大会ページを更新するフォルダです。

ページ内容txt:
- ページ名.txt
- 一覧説明.txt
- 大会概要.txt
- メモ.txt
- 開催日.txt
- 配信URL.txt
- ED動画URL.txt

画像:
- thumbnail.png
- team-list.png
- result-total.png
- match1.png など

チームは「チーム」フォルダ内で編集します。
`);

  for (let teamNo = 1; teamNo <= 20; teamNo++) {
    const teamFolder = path.join(folder, "チーム", `チーム${teamNo}`);
    await fs.mkdir(teamFolder, { recursive: true });
    await writeIfMissing(path.join(teamFolder, "チーム名.txt"), "");
    await writeIfMissing(path.join(teamFolder, "チームメモ.txt"), "");
    for (let memberNo = 1; memberNo <= 3; memberNo++) {
      await writeIfMissing(path.join(teamFolder, `メンバー${memberNo}名前.txt`), "");
      await writeIfMissing(path.join(teamFolder, `メンバー${memberNo}配信URL.txt`), "");
    }
    await writeGuide(teamFolder, `チーム${teamNo}を更新するフォルダです。

txt:
- チーム名.txt
- チームメモ.txt
- メンバー1名前.txt
- メンバー1配信URL.txt
- メンバー2名前.txt
- メンバー2配信URL.txt
- メンバー3名前.txt
- メンバー3配信URL.txt

画像:
- thumbnail.png
- member-1.png
- member-2.png
- member-3.png
`);
  }
}

async function createWildcardTemplates(folderName) {
  const folder = path.join(sourceRoot, "ワイルドカード", folderName);
  await fs.mkdir(folder, { recursive: true });
  await writeIfMissing(path.join(folder, "ページ名.txt"), folderName);
  await writeIfMissing(path.join(folder, "一覧説明.txt"), "");
  await writeIfMissing(path.join(folder, "大会概要.txt"), "");
  await writeIfMissing(path.join(folder, "メモ.txt"), "");
  await writeIfMissing(path.join(folder, "開催日.txt"), "");
  await writeIfMissing(path.join(folder, "配信URL.txt"), "");
  await writeIfMissing(path.join(folder, "ED動画URL.txt"), "");
  await writeGuide(folder, `ワイルドカード大会ページを更新するフォルダです。

ページ内容txt:
- ページ名.txt
- 一覧説明.txt
- 大会概要.txt
- メモ.txt
- 開催日.txt
- 配信URL.txt
- ED動画URL.txt

画像:
- thumbnail.png
- team-list.png
- result-total.png

参加者は「参加者」フォルダ内で編集します。
`);

  for (let participantNo = 1; participantNo <= 30; participantNo++) {
    const participantFolder = path.join(folder, "参加者", `参加者${participantNo}`);
    await fs.mkdir(participantFolder, { recursive: true });
    await writeIfMissing(path.join(participantFolder, "名前.txt"), "");
    await writeIfMissing(path.join(participantFolder, "X.txt"), "");
    await writeIfMissing(path.join(participantFolder, "配信URL.txt"), "");
    await writeGuide(participantFolder, `参加者${participantNo}を更新するフォルダです。

txt:
- 名前.txt
- X.txt
- 配信URL.txt

画像:
- stand.png
`);
  }
}

async function createHistoryTemplates() {
  const folder = path.join(sourceRoot, "出場履歴", "EXE Apex Custom");
  await fs.mkdir(folder, { recursive: true });
  await writeIfMissing(path.join(folder, "ページ名.txt"), "EXE Apex Custom");
  await writeIfMissing(path.join(folder, "開催日.txt"), "");
  await writeIfMissing(path.join(folder, "チーム名.txt"), "");
  await writeIfMissing(path.join(folder, "メンバー1名前.txt"), "");
  await writeIfMissing(path.join(folder, "メンバー2名前.txt"), "");
  await writeIfMissing(path.join(folder, "メンバー3名前.txt"), "");
  await writeIfMissing(path.join(folder, "最終順位.txt"), "");
  await writeIfMissing(path.join(folder, "配信URL.txt"), "");
  await writeIfMissing(path.join(folder, "メモ.txt"), "");
  await writeGuide(folder, `出場履歴を更新するフォルダです。

txt:
- ページ名.txt
- 開催日.txt
- チーム名.txt
- メンバー1名前.txt
- メンバー2名前.txt
- メンバー3名前.txt
- 最終順位.txt
- 配信URL.txt
- メモ.txt

画像:
- thumbnail.png
- team-image.png
`);
}

async function writeRootGuide() {
  await writeGuide(sourceRoot, `サイト更新用フォルダです。

使うフォルダ:
- Topページ
- 共通
- Apexカスタム
- ワイルドカード
- 出場履歴

画像やtxtを編集したら「画像を公開する.bat」をダブルクリックしてください。
`);
}

async function writeIfMissing(file, value) {
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, `${value}\n`, "utf8");
  }
}

async function writeGuide(folder, value) {
  await fs.writeFile(path.join(folder, "このフォルダの使い方.txt"), value, "utf8");
}
