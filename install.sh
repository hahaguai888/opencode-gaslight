#!/usr/bin/env bash
# opencode-gaslight one-command installer (global, from GitHub).
# Clones the plugin, installs its deps via bun, and registers it in tui.json.
#
#   curl -fsSL https://raw.githubusercontent.com/hahaguai888/opencode-gaslight/main/install.sh | bash
#
# Overrides: OPENCODE_GASLIGHT_DIR, OPENCODE_CONFIG_DIR
set -euo pipefail

REPO_URL="https://github.com/hahaguai888/opencode-gaslight.git"
INSTALL_DIR="${OPENCODE_GASLIGHT_DIR:-$HOME/.local/share/opencode-gaslight}"
TUI_JSON="${OPENCODE_CONFIG_DIR:-$HOME/.config/opencode}/tui.json"

say() { printf '\033[1;36m[gaslight]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[gaslight] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

command -v git >/dev/null 2>&1 || die "git is required (apt install git)"
command -v bun >/dev/null 2>&1 || die "bun is required. Install: curl -fsSL https://bun.sh/install | bash  (then restart your shell)"

# 1. Clone / update
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

# 3. Register the plugin in tui.json (idempotent, preserves other keys)
say "Registering plugin in $TUI_JSON"
bun "$INSTALL_DIR/scripts/tui-json.mjs" add "$TUI_JSON" "file://$INSTALL_DIR" >/dev/null

say "Done. Restart opencode, open any session, then run /gaslight, /gasdel or /aiedit"
