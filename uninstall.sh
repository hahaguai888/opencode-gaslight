#!/usr/bin/env bash
# opencode-gaslight uninstaller
set -euo pipefail

INSTALL_DIR="${OPENCODE_GASLIGHT_DIR:-$HOME/.local/share/opencode-gaslight}"
TUI_JSON="${OPENCODE_CONFIG_DIR:-$HOME/.config/opencode}/tui.json"

say() { printf '\033[1;36m[gaslight]\033[0m %s\n' "$*"; }

if [ -f "$TUI_JSON" ] && command -v bun >/dev/null 2>&1; then
  bun -e "
    const fs = require('fs')
    const path = process.argv[1]
    try {
      const cfg = JSON.parse(fs.readFileSync(path, 'utf8'))
      if (Array.isArray(cfg.plugin)) {
        cfg.plugin = cfg.plugin.filter((p) => {
          const s = Array.isArray(p) ? p[0] : p
          return !String(s).includes('opencode-gaslight')
        })
        fs.writeFileSync(path, JSON.stringify(cfg, null, 2) + '\n')
      }
    } catch {}
  " "$TUI_JSON" || true
  say "Removed plugin entry from $TUI_JSON"
fi

if [ -d "$INSTALL_DIR" ]; then
  rm -rf "$INSTALL_DIR"
  say "Removed $INSTALL_DIR"
fi

say "Uninstalled. Restart opencode to fully unload it."
