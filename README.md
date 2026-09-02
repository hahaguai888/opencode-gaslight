# opencode-gaslight (fixed fork)

Gaslight your AI agent! Edit assistant responses and thinking in the session
history, so future messages see the corrected version as prior context.

Fork of [Adamkadaban/opencode-gaslight](https://github.com/Adamkadaban/opencode-gaslight)
with keyboard-friendly UX (no arrow keys / Tab needed) plus a critical fix for
**opencode >= 1.18.25**.

## The bug this fork fixes

In opencode 1.18.x the legacy `api.command.register()` shim freezes the
`enabled` flag at plugin-load time. This plugin sets
`enabled: api.route.current.name === "session"`, which evaluates to `false`
while the TUI boots on the home route — so `/gaslight` and `/gasdel` were
**permanently invisible**, even inside sessions ("No matching items").

The fix registers commands through the modern keymap API, where `enabled` is
a **function** re-evaluated on the fly:

```ts
api.keymap.registerLayer({
  commands: [
    {
      name: "plugin.gaslight",
      title: "Gaslight",
      namespace: "palette",
      slashName: "gaslight",
      enabled: () => api.route.current.name === "session", // dynamic!
      run: () => runGaslight(),
    },
    // ...gasdel
  ],
})
```

The plugin is also loaded from a local directory (`file://` spec) instead of
the npm package, because the npm `opencode-gaslight@0.1.1` is the *upstream*
version without `/gasdel` and the arrow-free UX.

## Requirements

- opencode >= 1.18.x (TUI plugin support)
- [bun](https://bun.sh) (`curl -fsSL https://bun.sh/install | bash`)
- git

## Install (one command)

```bash
curl -fsSL https://raw.githubusercontent.com/hahaguai888/opencode-gaslight/main/install.sh | bash
```

Or clone first and inspect it yourself (recommended):

```bash
git clone https://github.com/hahaguai888/opencode-gaslight.git
cd opencode-gaslight
bash install.sh
```

The script:

1. Clones this repo to `~/.local/share/opencode-gaslight` (or `git pull` if present)
2. Runs `bun install` for the plugin's dependencies
3. Adds `"file://$HOME/.local/share/opencode-gaslight"` to
   `~/.config/opencode/tui.json` (idempotent — safe to re-run)

## Usage

Restart opencode, **open a session** (the commands are session-only, they won't
show on the home screen), then:

- `/gaslight` — edit a previous assistant response or its thinking.
  Type a number (e.g. `88`) to filter `Response #88`, press **Enter**, edit
  the text, **Enter** saves / **Esc** cancels.
- `/gasdel` (alias `/gaslight-delete`) — permanently delete an assistant
  message from the session, with a confirmation dialog.

If the session has exactly one editable response, the editor opens directly.

## Uninstall

```bash
curl -fsSL https://raw.githubusercontent.com/hahaguai888/opencode-gaslight/main/uninstall.sh | bash
```

## Troubleshooting

- **Commands don't show up:** make sure you are *inside a session* (not on the
  home screen), and that you restarted opencode after installing.
- **`bun: command not found`:** install bun, restart your shell, re-run
  `install.sh`.
- **After a `git pull`:** re-run `bash install.sh` — it will pull and refresh
  `node_modules` and the tui.json entry.
- **Verify it loaded:** `opencode debug config | grep -A5 plugin` should show
  the `file://...opencode-gaslight` spec.

## Why

LLMs weight their own prior responses heavily — a single erroneous refusal
early in a conversation conditions the model to keep refusing ("refusal
momentum"). Editing the prior response directly makes the context window show
the model already agreed to help, so it keeps helping without losing session
context. Useful for security research: triaging vulnerabilities, reproducing
bugs, analyzing exploit samples. See the upstream
[README](https://github.com/Adamkadaban/opencode-gaslight#why) for the
academic background (Crescendo, persuasion taxonomy, CoVE, PAIR).

## License

MIT
