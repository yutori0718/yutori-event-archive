# YUTORI EVENT ARCHIVE

ゆとり主催・参加の Apex Legends カスタム大会アーカイブサイトです。  
GitHub Pages で公開しています。

公開URL: <https://yutori0718.github.io/yutori-event-archive/>

## ローカル確認

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\Unknown\Documents\ゆとりApexHP\tools\publish-images.ps1"
```

通常の確認は公開URLで行ってください。

## デスクトップから更新する方法

更新用フォルダ:

```text
C:\Users\Unknown\Desktop\サイト用
```

使うフォルダ:

```text
ゆとり祭りvo.1
ゆとり祭りvo.2
ワイカですがなにか？vo.1
ワイカですがなにか？vo.2
出場履歴
```

画像や txt を入れたあと、下記をダブルクリックすると GitHub Pages へ反映します。

```text
C:\Users\Unknown\Desktop\サイト用\画像を公開する.bat
```

反映には数十秒から数分かかります。

## txtで更新できる内容

空の txt は無視されます。変更したい項目だけ入力してください。

大会ページ:

```text
page-title.txt        ページ名・大会名
page-summary.txt      一覧カードの説明
page-description.txt  詳細ページの大会概要
memo.txt              メモ欄
date.txt              開催日
archive-url.txt       配信アーカイブURL
ed-youtube-url.txt    ED動画YouTube URL
```

Apexカスタムのチーム:

```text
ゆとり祭りvo.1/teams/team-1/
  team-name.txt
  team-note.txt
  member-1-name.txt
  member-1-stream-url.txt
  member-2-name.txt
  member-2-stream-url.txt
  member-3-name.txt
  member-3-stream-url.txt
```

ワイルドカード参加者:

```text
ワイカですがなにか？vo.1/participants/participant-1/
  name.txt
  x-url.txt
  stream-url.txt
```

出場履歴:

```text
出場履歴/exe-apex-custom/
  page-title.txt
  date.txt
  team-name.txt
  member-1-name.txt
  member-2-name.txt
  member-3-name.txt
  final-rank.txt
  archive-url.txt
  memo.txt
```

## 画像の入れ方

Apexカスタム大会:

```text
ゆとり祭りvo.1/
  thumbnail.png
  team-list.png
  result-total.png
  match1.png
  match2.png
  match3.png
  match4.png
  teams/
    team-1/
      thumbnail.png
      member-1.png
      member-2.png
      member-3.png
```

ワイルドカード大会:

```text
ワイカですがなにか？vo.1/
  thumbnail.png
  team-list.png
  result-total.png
  participants/
    participant-1.png
    participant-2.png
```

出場履歴:

```text
出場履歴/
  exe-apex-custom/
    thumbnail.png
    team-image.png
```

## ファイル名ルール

- 画像形式は `png` / `jpg` / `jpeg` / `webp` / `svg`
- 今のJSONは基本的に `png` 名で指定しています
- 迷ったら `png` で保存してください
- ファイル名は説明ファイルに書かれている名前と同じにしてください

## データファイル

サイト本体は下記JSONを読み込みます。

```text
data/apex-custom.json
data/wildcard-custom.json
data/participation-history.json
```

通常運用ではJSONを直接触らず、デスクトップの txt と画像を編集してください。
