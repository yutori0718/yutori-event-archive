$ErrorActionPreference = "Stop"

function TextFromCodes($codes) {
  return [string]::Concat(($codes | ForEach-Object { [char]$_ }))
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$desktop = [Environment]::GetFolderPath("Desktop")
$sourceRoot = Join-Path $desktop (TextFromCodes @(0x30B5, 0x30A4, 0x30C8, 0x7528))
$gitPath = "C:\Program Files\Git\cmd"
$ghPath = "C:\Users\Unknown\AppData\Local\Programs\GitHub CLI Portable\bin"
$env:Path = "$gitPath;$ghPath;$env:Path"
$nodePath = "C:\Users\Unknown\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

$mappings = @(
  @{ Source = TextFromCodes @(0x5171, 0x901A); Destination = "images\common" },
  @{ Source = "Apex" + (TextFromCodes @(0x30AB, 0x30B9, 0x30BF, 0x30E0)) + "\" + (TextFromCodes @(0x3086, 0x3068, 0x308A, 0x796D, 0x308A)); Destination = "images\apex-custom\yutori-fes-vol1" },
  @{ Source = "Apex" + (TextFromCodes @(0x30AB, 0x30B9, 0x30BF, 0x30E0)) + "\" + (TextFromCodes @(0x6E96, 0x5099, 0x4E2D)); Destination = "images\apex-custom\yutori-fes-vol2" },
  @{ Source = (TextFromCodes @(0x30EF, 0x30A4, 0x30EB, 0x30C9, 0x30AB, 0x30FC, 0x30C9)) + "\" + (TextFromCodes @(0x30EF, 0x30A4, 0x30AB, 0x3067, 0x3059, 0x304C, 0x306A, 0x306B, 0x304B, 0xFF1F)) + "vo.1"; Destination = "images\wildcard-custom\waika-vol1" },
  @{ Source = (TextFromCodes @(0x30EF, 0x30A4, 0x30EB, 0x30C9, 0x30AB, 0x30FC, 0x30C9)) + "\" + (TextFromCodes @(0x30EF, 0x30A4, 0x30AB, 0x3067, 0x3059, 0x304C, 0x306A, 0x306B, 0x304B, 0xFF1F)) + "vo.2"; Destination = "images\wildcard-custom\waika-vol2" },
  @{ Source = (TextFromCodes @(0x51FA, 0x5834, 0x5C65, 0x6B74)) + "\EXE Apex Custom"; Destination = "images\participation-history\exe-apex-custom" }
)

$extensions = @(".png", ".jpg", ".jpeg", ".webp", ".svg")
$copied = 0

if (Test-Path $nodePath) {
  & $nodePath (Join-Path $PSScriptRoot "sync-text-content.mjs")
} else {
  node (Join-Path $PSScriptRoot "sync-text-content.mjs")
}

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

git add images public data assets *.html apex-custom wildcard-custom participation-history README.md .gitignore .nojekyll tools
$commitMessage = "Update site images $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
git commit -m $commitMessage
git push

Write-Host ""
Write-Host "Images published. GitHub Pages will update in a few minutes."
Write-Host "URL: https://yutori0718.github.io/yutori-event-archive/"
Write-Host "Copied images: $copied"
