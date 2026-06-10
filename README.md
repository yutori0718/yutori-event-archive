# YUTORI EVENT ARCHIVE

ゆとりが主催・参加した Apex Legends カスタム大会の履歴をまとめる静的アーカイブサイトです。  
GitHub Pages でそのまま公開でき、サーバー代 0 円運用を想定しています。

## ローカル起動

このサイトはビルド不要です。JSON を読み込むため、ファイルを直接開かずにローカルサーバーで確認してください。

```powershell
python -m http.server 5173
```

起動後、ブラウザで開きます。

```text
http://localhost:5173/
```

Python がない場合は、任意の静的サーバーでこのフォルダを公開してください。

## ページ構成

- `/` トップページ
- `/apex-custom/` Apexカスタム一覧
- `/apex-custom/detail.html?id=yutori-fes-vol1` Apexカスタム詳細
- `/wildcard-custom/` Apexワイルドカードカスタム一覧
- `/wildcard-custom/detail.html?id=waika-vol1` Apexワイルドカードカスタム詳細
- `/participation-history/` Apexカスタム出場履歴

## データ編集

大会情報は `data/` 以下の JSON を編集します。

- `data/apex-custom.json` Apexカスタム
- `data/wildcard-custom.json` Apexワイルドカードカスタム
- `data/participation-history.json` 出場履歴

大会を追加するときは、既存データをコピーして `id`、`title`、`date`、画像パス、順位、YouTube URL を差し替えてください。  
詳細ページの URL は `detail.html?id=大会id` になります。

## Apexカスタムのチーム紹介

`data/apex-custom.json` の `teams` にチーム1〜20を登録できます。  
詳細ページではチーム名とチームサムネイルの一覧が表示され、各チームカードからチームごとのページを開けます。

```json
{
  "id": "team-1",
  "name": "チーム1",
  "thumbnail": "/images/apex-custom/teams/team-1/thumbnail.png",
  "members": [
    {
      "name": "メンバー1",
      "standImage": "/images/apex-custom/teams/team-1/member-1.png",
      "streamUrl": "https://www.twitch.tv/example"
    },
    {
      "name": "メンバー2",
      "standImage": "/images/apex-custom/teams/team-1/member-2.png",
      "streamUrl": ""
    },
    {
      "name": "メンバー3",
      "standImage": "/images/apex-custom/teams/team-1/member-3.png",
      "streamUrl": ""
    }
  ],
  "note": "任意メモ"
}
```

チーム詳細ページでは、上から「チーム」「チーム名」「メンバー3名の立ち絵」「立ち絵の下に名前」「配信URLボタン」の順で表示します。  
20チーム未満の場合も、足りない分は自動でチーム枠として表示されます。

## ワイルドカードカスタムの参加者一覧

`data/wildcard-custom.json` の `participants` に30人分の参加者を登録できます。  
詳細ページでは「参加者一覧」として、名前・立ち絵・X・配信を表示します。

```json
{
  "name": "参加者1",
  "standImage": "/images/wildcard-custom/participants/participant-1.png",
  "xUrl": "https://x.com/example",
  "streamUrl": "https://www.twitch.tv/example"
}
```

30人未満の場合も、足りない分は参加者枠として表示されます。

## YouTube URL 追加方法

ED動画は `edYoutubeUrl` に設定します。

```json
"edYoutubeUrl": "https://www.youtube.com/watch?v=XXXXXXXXXXX"
```

神視点動画は `matches` の各試合に設定します。

```json
{
  "matchName": "Match1",
  "resultImage": "/images/apex-custom/yutori-fes-vol2/result-match1.png",
  "youtubeUrl": "https://www.youtube.com/watch?v=XXXXXXXXXXX"
}
```

対応形式は通常URL、`youtu.be`、埋め込みURL、Shorts URLです。

## 画像追加方法

画像は `images/` 以下に置きます。JSON には `/images/...` から始まるパスを書いてください。  
Vite / Astro に移行する場合の慣例に合わせて `public/images/` に置いた画像も、同じ JSON パスで表示できるようにしてあります。  
画像が未設定、またはファイルが存在しない場合は「画像準備中」と表示されます。

## デスクトップ画像置き場から公開する方法

`C:\Users\Unknown\Desktop\サイト用` に画像置き場を用意しています。  
画像を入れたあと、同じフォルダにある `画像を公開する.bat` をダブルクリックすると、サイト用の `images/` へコピーして GitHub Pages へ公開します。

```text
C:\Users\Unknown\Desktop\サイト用
  00-common
  01-apex-custom-events
  02-apex-custom-teams
  03-wildcard-events
  04-wildcard-participants
  05-participation-history
  画像を公開する.bat
  使い方.txt
```

反映には数十秒から数分かかります。

```text
images/
  common/
    dachshund-logo.svg
    site-logo.svg
  apex-custom/
    yutori-fes-vol1/
      thumbnail.png
      team-list.png
      result-total.png
      match1.png
  wildcard-custom/
    waika-vol1/
      thumbnail.png
      team-list.png
      result-total.png
  participation-history/
    exe-apex-custom/
      thumbnail.png
      team-image.png
```

## 画像ファイル名ルール

- 英数字とハイフンで統一
- 日本語ファイル名は使わない
- スペースは使わない
- 形式は `png` / `jpg` / `webp` 推奨
- 例: `team-list.png`、`result-total.png`、`result-match1.png`

## GitHub Pages 公開手順

1. GitHub に新規リポジトリを作成します。
2. このフォルダの中身をリポジトリにアップロードします。
3. GitHub の `Settings` → `Pages` を開きます。
4. `Build and deployment` の Source を `Deploy from a branch` にします。
5. Branch は `main`、Folder は `/root` を選びます。
6. 保存後、表示された GitHub Pages URL にアクセスします。

## 独自ドメイン設定メモ

GitHub Pages の `Custom domain` に所有ドメインを入力します。  
DNS 側では、GitHub Pages の案内に従って `A` レコードまたは `CNAME` レコードを設定してください。

独自ドメインが決まったら、リポジトリ直下に `CNAME` ファイルを作り、1行だけドメインを書きます。

```text
archive.example.com
```

独自ドメイン費用だけ年間費用が発生します。GitHub Pages のホスティング費用は無料運用できます。

## デザイン

- メインカラー: `#1DA1F2`
- サブカラー: `#0F172A`
- アクセントカラー: `#9146FF`
- 背景: ブラック / ダークネイビー
- ロゴ: ダックスフンドのシルエットを使った青ネオン風エンブレム
