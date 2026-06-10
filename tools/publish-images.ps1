$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$sourceRoot = "C:\Users\Unknown\Desktop\サイト用"
$gitPath = "C:\Program Files\Git\cmd"
$ghPath = "C:\Users\Unknown\AppData\Local\Programs\GitHub CLI Portable\bin"
$env:Path = "$gitPath;$ghPath;$env:Path"

$mappings = @(
  @{ Source = "00_共通"; Destination = "images\common" },
  @{ Source = "01_Apexカスタム大会"; Destination = "images\apex-custom" },
  @{ Source = "02_Apexカスタム_チーム"; Destination = "images\apex-custom\teams" },
  @{ Source = "03_ワイルドカード大会"; Destination = "images\wildcard-custom" },
  @{ Source = "04_ワイルドカード参加者"; Destination = "images\wildcard-custom\participants" },
  @{ Source = "05_出場履歴"; Destination = "images\participation-history" }
)

$extensions = @(".png", ".jpg", ".jpeg", ".webp", ".svg")
$copied = 0

foreach ($mapping in $mappings) {
  $source = Join-Path $sourceRoot $mapping.Source
  $destination = Join-Path $repoRoot $mapping.Destination

  if (-not (Test-Path $source)) {
    New-Item -ItemType Directory -Force -Path $source | Out-Null
  }
  New-Item -ItemType Directory -Force -Path $destination | Out-Null

  Get-ChildItem -Path $source -Recurse -File | Where-Object {
    $extensions -contains $_.Extension.ToLowerInvariant()
  } | ForEach-Object {
    $relative = $_.FullName.Substring($source.Length).TrimStart("\")
    $target = Join-Path $destination $relative
    $targetDir = Split-Path $target -Parent
    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
    Copy-Item -LiteralPath $_.FullName -Destination $target -Force
    $copied++
  }
}

Set-Location $repoRoot
$status = git status --short

if (-not $status) {
  Write-Host "画像の変更はありません。"
  exit 0
}

git add images public data assets *.html apex-custom wildcard-custom participation-history README.md .gitignore .nojekyll
$commitMessage = "Update site images $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
git commit -m $commitMessage
git push

Write-Host ""
Write-Host "画像を公開しました。GitHub Pagesへは数十秒から数分で反映されます。"
Write-Host "公開URL: https://yutori0718.github.io/yutori-event-archive/"
Write-Host "コピーした画像数: $copied"
