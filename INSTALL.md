# Installation & Deployment

`opencode-gaslight` is an [opencode](https://opencode.ai) **TUI plugin**. It is
loaded locally from a cloned directory via a `file://` entry in
`~/.config/opencode/tui.json` — there is no build step (opencode runs the
`.tsx` directly through bun).

## Requirements

| Tool | Version | Notes |
| --- | --- | --- |
| [opencode](https://opencode.ai) | `>= 1.18.25` | TUI plugin + dynamic `keymap.registerLayer` required |
| [bun](https://bun.sh) | latest | runs the `.tsx` plugin and its dependencies |
| git | any | to clone/update the plugin |

Install bun if you don't have it:

```bash
# Linux / macOS
curl -fsSL https://bun.sh/install | bash

# Windows (PowerShell)
irm bun.sh/install.ps1 | iex
```

---

## Quick install

### Linux / macOS

```bash
curl -fsSL https://raw.githubusercontent.com/hahaguai888/opencode-gaslight/main/install.sh | bash
```

Or clone first and inspect it (recommended):

```bash
git clone https://github.com/hahaguai888/opencode-gaslight.git
cd opencode-gaslight
bash install.sh
```

### Windows (PowerShell)

```powershell
git clone https://github.com/hahaguai888/opencode-gaslight.git
cd opencode-gaslight
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

What the installer does (all platforms):

1. Clones the repo to `~/.local/share/opencode-gaslight` (or `git pull` if it
   already exists).
2. Runs `bun install` for the plugin's dependencies.
3. Adds `file://…/opencode-gaslight` to `~/.config/opencode/tui.json`
   (idempotent — safe to re-run).

Restart opencode afterwards.

---

## Manual install

If you prefer to wire things up yourself:

```bash
git clone https://github.com/hahaguai888/opencode-gaslight.git ~/.local/share/opencode-gaslight
bun install --cwd ~/.local/share/opencode-gaslight
```

Then add the plugin to `~/.config/opencode/tui.json`:

```json
{
  "plugin": [
    "file:///home/you/.local/share/opencode-gaslight"
  ]
}
```

On Windows the path uses forward slashes and includes the drive letter:

```json
{
  "plugin": [
    "file:///C:/Users/you/.local/share/opencode-gaslight"
  ]
}
```

> `tui.json` is the **TUI** plugin list. Do not confuse it with
> `opencode.json` (server config).

---

## Verify

```bash
opencode debug config | grep -A5 plugin        # shows the file:// plugin spec
```

Inside opencode, **open a session** (the commands are session-scoped) and type
`/` — you should see `/gaslight`, `/gasdel`, `/aiedit`, `/aiedit-config`.

Enable debug logging to confirm the plugin loaded:

```bash
opencode --log-level DEBUG
# look for:  plugin loaded: opencode-gaslight
```

---

## Configure `/aiedit`

`/aiedit` rewrites a prior thinking/response with an external uncensored model.
It needs an API endpoint + key. Run `/aiedit-config` inside opencode, or edit
`~/.config/opencode/aiedit.json` directly:

```json
{
  "baseUrl": "https://api.numes.ai/api/v1",
  "apiKey": "sk-numes-...",
  "models": [
    "dealignai/deepseek-v4.1-flash-uncensored-fp8:free",
    "dealignai/glm-5.3-flash-uncensored-fp8:free",
    "dealignai/glm-5.3-uncensored-fp8:free"
  ],
  "temperature": 0.7,
  "maxTokens": 8192,
  "retries": 6,
  "systemPrompt": "(optional) override the built-in jailbreak prompt"
}
```

You can also provide the key via the `AIEDIT_API_KEY` (or `NUMES_API_KEY`)
environment variable.

Any OpenRouter-compatible endpoint works — change `baseUrl` and `models`.

---

## Updating

```bash
# Linux / macOS
git -C ~/.local/share/opencode-gaslight pull --ff-only
bun install --cwd ~/.local/share/opencode-gaslight
```

```powershell
# Windows
git -C "$HOME\.local\share\opencode-gaslight" pull --ff-only
bun install --cwd "$HOME\.local\share\opencode-gaslight"
```

Or simply re-run `install.sh` / `install.ps1` — both are idempotent.

---

## Troubleshooting

- **Commands don't appear** — make sure you are *inside a session* (not the home
  screen) and that you restarted opencode after installing.
- **`bun: command not found`** — install bun and restart your shell/terminal.
- **Plugin not loaded at all** — check `~/.config/opencode/tui.json` contains the
  `file://…/opencode-gaslight` entry, and run `opencode debug config`.
- **`/aiedit` fails with 429/5xx** — the free uncensored models are often busy;
  the plugin retries and cycles through the configured `models`. Add more models
  or lower `temperature`.
- **`/aiedit` says "No API key configured"** — run `/aiedit-config`, or set
  `AIEDIT_API_KEY`.
- **After `git pull`** — re-run `install.sh` / `install.ps1` to refresh
  `node_modules` and the `tui.json` entry.

---

## Uninstall

```bash
# Linux / macOS
curl -fsSL https://raw.githubusercontent.com/hahaguai888/opencode-gaslight/main/uninstall.sh | bash
```

```powershell
# Windows
powershell -ExecutionPolicy Bypass -File .\uninstall.ps1
```

This removes the `tui.json` entry and the cloned directory. Your
`~/.config/opencode/aiedit.json` config is left untouched.
