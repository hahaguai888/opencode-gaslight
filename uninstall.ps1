#!/usr/bin/env pwsh
# opencode-gaslight uninstaller for Windows.
#
#   powershell -ExecutionPolicy Bypass -File .\uninstall.ps1
$ErrorActionPreference = "Stop"

$InstallDir = if ($env:OPENCODE_GASLIGHT_DIR) { $env:OPENCODE_GASLIGHT_DIR } else { Join-Path $HOME ".local\share\opencode-gaslight" }
$ConfigDir  = if ($env:OPENCODE_CONFIG_DIR)   { $env:OPENCODE_CONFIG_DIR }   else { Join-Path $HOME ".config\opencode" }
$TuiJson    = Join-Path $ConfigDir "tui.json"

function Say($msg) { Write-Host "[gaslight] $msg" -ForegroundColor Cyan }

$patcher = Join-Path $InstallDir "scripts\tui-json.mjs"
if ((Test-Path $patcher) -and (Get-Command bun -ErrorAction SilentlyContinue)) {
  bun $patcher remove $TuiJson
  Say "Removed plugin entry from $TuiJson"
}

if (Test-Path $InstallDir) {
  Remove-Item -Recurse -Force $InstallDir
  Say "Removed $InstallDir"
}

Say "Uninstalled. Restart opencode to fully unload it."
