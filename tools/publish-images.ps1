$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$sourceRoot = "C:\Users\Unknown\Desktop\サイト用"
$gitPath = "C:\Program Files\Git\cmd"
$ghPath = "C:\Users\Unknown\AppData\Local\Programs\GitHub CLI Portable\bin"
$env:Path = "$gitPath;$ghPath;$env:Path"

$mappings = @(
  @{ Source = "00-common"; Destination = "images\common" },
  @{ Source = "01-apex-custom-events"; Destination = "images\apex-custom" },
  @{ Source = "02-apex-custom-teams"; Destination = "images\apex-custom\teams" },
  @{ Source = "03-wildcard-events"; Destination = "images\wildcard-custom" },
  @{ Source = "04-wildcard-participants"; Destination = "images\wildcard-custom\participants" },
  @{ Source = "05-participation-history"; Destination = "images\participation-history" }
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
  Write-Host "No image changes found."
  exit 0
}

git add images public data assets *.html apex-custom wildcard-custom participation-history README.md .gitignore .nojekyll
$commitMessage = "Update site images $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
git commit -m $commitMessage
git push

Write-Host ""
Write-Host "Images published. GitHub Pages will update in a few minutes."
Write-Host "URL: https://yutori0718.github.io/yutori-event-archive/"
Write-Host "Copied images: $copied"
