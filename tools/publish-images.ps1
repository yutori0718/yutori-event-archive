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
  @{ Source = "00-common"; Destination = "images\common" },
  @{ Source = "01-apex-custom-events"; Destination = "images\apex-custom" },
  @{ Source = "02-apex-custom-teams"; Destination = "images\apex-custom\teams" },
  @{ Source = "03-wildcard-events"; Destination = "images\wildcard-custom" },
  @{ Source = "04-wildcard-participants"; Destination = "images\wildcard-custom\participants" },
  @{ Source = "05-participation-history"; Destination = "images\participation-history" },

  @{ Source = (TextFromCodes @(0x3086, 0x3068, 0x308A, 0x796D, 0x308A)) + "vo.1"; Destination = "images\apex-custom\yutori-fes-vol1" },
  @{ Source = (TextFromCodes @(0x3086, 0x3068, 0x308A, 0x796D, 0x308A)) + "vo.2"; Destination = "images\apex-custom\yutori-fes-vol2" },
  @{ Source = (TextFromCodes @(0x30EF, 0x30A4, 0x30AB, 0x3067, 0x3059, 0x304C, 0x306A, 0x306B, 0x304B, 0xFF1F)) + "vo.1"; Destination = "images\wildcard-custom\waika-vol1" },
  @{ Source = (TextFromCodes @(0x30EF, 0x30A4, 0x30AB, 0x3067, 0x3059, 0x304C, 0x306A, 0x306B, 0x304B, 0xFF1F)) + "vo.2"; Destination = "images\wildcard-custom\waika-vol2" },
  @{ Source = TextFromCodes @(0x51FA, 0x5834, 0x5C65, 0x6B74); Destination = "images\participation-history" }
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
