#!/usr/bin/env pwsh
# opencode-gaslight installer for Windows.
# Clones/updates the plugin, installs its deps, and registers it in tui.json.
#
#   powershell -ExecutionPolicy Bypass -File .\install.ps1
#
# Overrides: $env:OPENCODE_GASLIGHT_DIR, $env:OPENCODE_CONFIG_DIR
$ErrorActionPreference = "Stop"

$RepoUrl    = "https://github.com/hahaguai888/opencode-gaslight.git"
$InstallDir = if ($env:OPENCODE_GASLIGHT_DIR) { $env:OPENCODE_GASLIGHT_DIR } else { Join-Path $HOME ".local\share\opencode-gaslight" }
$ConfigDir  = if ($env:OPENCODE_CONFIG_DIR)   { $env:OPENCODE_CONFIG_DIR }   else { Join-Path $HOME ".config\opencode" }
$TuiJson    = Join-Path $ConfigDir "tui.json"

function Say($msg) { Write-Host "[gaslight] $msg" -ForegroundColor Cyan }
function Die($msg) { Write-Host "[gaslight] ERROR: $msg" -ForegroundColor Red; exit 1 }

if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Die "git is required" }
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) { Die "bun is required. Install: irm bun.sh/install.ps1 | iex  (then reopen your terminal)" }

# 1. Clone or update
if (Test-Path (Join-Path $InstallDir ".git")) {
  Say "Updating existing clone at $InstallDir"
  git -C $InstallDir pull --ff-only
} else {
  Say "Cloning to $InstallDir"
  git clone --depth 1 $RepoUrl $InstallDir
}

# 2. Install plugin dependencies
Say "Installing dependencies with bun"
bun install --cwd $InstallDir

# 3. Register plugin in tui.json (idempotent, preserves other keys)
Say "Registering plugin in $TuiJson"
New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null
$spec = "file:///" + ($InstallDir -replace '\\', '/')
bun "$InstallDir\scripts\tui-json.mjs" add $TuiJson $spec

Say "Done. Restart opencode, open any session, then run /gaslight, /gasdel or /aiedit"
