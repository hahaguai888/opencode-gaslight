#!/usr/bin/env bash
# opencode-gaslight uninstaller.
set -euo pipefail

INSTALL_DIR="${OPENCODE_GASLIGHT_DIR:-$HOME/.local/share/opencode-gaslight}"
TUI_JSON="${OPENCODE_CONFIG_DIR:-$HOME/.config/opencode}/tui.json"

say() { printf '\033[1;36m[gaslight]\033[0m %s\n' "$*"; }

if [ -f "$INSTALL_DIR/scripts/tui-json.mjs" ] && command -v bun >/dev/null 2>&1; then
  bun "$INSTALL_DIR/scripts/tui-json.mjs" remove "$TUI_JSON" >/dev/null 2>&1 || true
  say "Removed plugin entry from $TUI_JSON"
fi

if [ -d "$INSTALL_DIR" ]; then
  rm -rf "$INSTALL_DIR"
  say "Removed $INSTALL_DIR"
fi

say "Uninstalled. Restart opencode to fully unload it."
