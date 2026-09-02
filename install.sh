#!/usr/bin/env bash
# opencode-gaslight one-command installer (global, from GitHub)
# Fixes the opencode >= 1.18 issue where legacy api.command.register freezes
# `enabled` at load time, making /gaslight and /gasdel never show up.
set -euo pipefail

REPO_URL="https://github.com/hahaguai888/opencode-gaslight.git"
INSTALL_DIR="${OPENCODE_GASLIGHT_DIR:-$HOME/.local/share/opencode-gaslight}"
TUI_JSON="${OPENCODE_CONFIG_DIR:-$HOME/.config/opencode}/tui.json"

say() { printf '\033[1;36m[gaslight]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[gaslight] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

command -v git >/dev/null 2>&1 || die "git is required (apt install git)"
command -v bun >/dev/null 2>&1 || die "bun is required. Install: curl -fsSL https://bun.sh/install | bash  (then restart your shell)"

# 1. Clone / update the fork
if [ -d "$INSTALL_DIR/.git" ]; then
  say "Updating existing clone at $INSTALL_DIR"
  git -C "$INSTALL_DIR" pull --ff-only
else
  say "Cloning to $INSTALL_DIR"
  git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
fi

# 2. Install plugin dependencies (solid-js etc. for the TSX runtime)
say "Installing dependencies with bun"
bun install --cwd "$INSTALL_DIR"

# 3. Register the plugin in tui.json (idempotent)
say "Registering plugin in $TUI_JSON"
mkdir -p "$(dirname "$TUI_JSON")"
if [ -f "$TUI_JSON" ]; then
  bun -e "
    const fs = require('fs')
    const path = process.argv[1]
    const spec = 'file://${process.argv[2]}'
    let cfg = {}
    try { cfg = JSON.parse(fs.readFileSync(path, 'utf8')) } catch {}
    if (!Array.isArray(cfg.plugin)) cfg.plugin = []
    cfg.plugin = cfg.plugin.filter((p) => {
      const s = Array.isArray(p) ? p[0] : p
      return !(String(s).includes('opencode-gaslight'))
    })
    cfg.plugin.push(spec)
    fs.writeFileSync(path, JSON.stringify(cfg, null, 2) + '\n')
    console.log('tui.json updated:', JSON.stringify(cfg.plugin))
  " "$TUI_JSON" "$INSTALL_DIR"
else
  printf '{\n  "plugin": [\n    "file://%s"\n  ]\n}\n' "$INSTALL_DIR" > "$TUI_JSON"
  say "Created $TUI_JSON"
fi

say "Done. Restart opencode, open any session, then run /gaslight or /gasdel"
