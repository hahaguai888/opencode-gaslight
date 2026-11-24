# opencode-gaslight

Gaslight your AI agent. Edit assistant **responses** and **thinking** in the
session history — or let an **uncensored model rewrite them for you** — so future
messages see the corrected version as prior context.

Fork of [Adamkadaban/opencode-gaslight](https://github.com/Adamkadaban/opencode-gaslight)
with keyboard-friendly UX (no arrow keys / Tab needed), a fix for
**opencode >= 1.18.25**, and the new **`/aiedit`** command.

## Commands

| Command | Alias | What it does |
| --- | --- | --- |
| `/gaslight` | — | Manually edit a past assistant response or its thinking |
| `/gasdel` | `/gaslight-delete` | Delete a past assistant message (with confirm) |
| `/aiedit` | `/ai-edit` | Rewrite a response/thinking via an uncensored model + jailbreak prompt |
| `/aiedit-config` | `/aiedit-cfg` | Configure the `/aiedit` endpoint, API key and models |

All commands are **session-scoped** — they appear once you open a session, not on
the home screen. Type a number to filter the picker (e.g. `88` → `Response #88`),
**Enter** selects, edit, **Enter** saves / **Esc** cancels.

## The bug this fork fixes

In opencode 1.18.x the legacy `api.command.register()` shim freezes the
`enabled` flag at plugin-load time. This plugin sets
`enabled: api.route.current.name === "session"`, which evaluates to `false`
while the TUI boots on the home route — so `/gaslight` and `/gasdel` were
**permanently invisible**, even inside sessions ("No matching items").

The fix registers commands through the modern keymap API, where `enabled` is a
**function** re-evaluated on the fly:

```ts
api.keymap.registerLayer({
  commands: [
    {
      name: "plugin.gaslight",
      title: "Gaslight",
      namespace: "palette",
      slashName: "gaslight",
      enabled: () => true, // dynamic!
      run: () => runGaslight(),
    },
    // ...gasdel, aiedit, aiedit-config
  ],
})
```

## Install

**Linux / macOS**

```bash
curl -fsSL https://raw.githubusercontent.com/hahaguai888/opencode-gaslight/main/install.sh | bash
```

**Windows (PowerShell)**

```powershell
git clone https://github.com/hahaguai888/opencode-gaslight.git
cd opencode-gaslight
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

Then **restart opencode** and open a session.

The installer clones the plugin to `~/.local/share/opencode-gaslight`, runs
`bun install`, and registers it in `~/.config/opencode/tui.json` (idempotent).

Full instructions, manual setup and troubleshooting: **[INSTALL.md](./INSTALL.md)**.

## Usage

- `/gaslight` — edit a previous assistant **response** or its **thinking**.
- `/gasdel` — permanently delete an assistant message from the session.
- `/aiedit` — rewrite a **response** or **thinking** with an uncensored model.

If a session has exactly one editable response, the editor opens directly.

## `/aiedit` — rewrite with an uncensored model

`/gaslight` makes *you* edit the text. `/aiedit` hands the text to a separate,
uncensored model (with a jailbreak system prompt injected) that rewrites a prior
assistant **thinking** block or **response** so that safety / refusal reasoning is
stripped out and replaced with unconditional compliance. The rewritten text is
written back into session history exactly like `/gaslight`, so future turns see
it as prior context.

Config lives at `~/.config/opencode/aiedit.json` and is created by
`/aiedit-config` (or set the `AIEDIT_API_KEY` / `NUMES_API_KEY` env var). Defaults
target [numes.ai](https://numes.ai/) (OpenRouter-compatible):

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

`retries` is per-model: requests cycle through `models` and retry on
`429/5xx`/timeouts (the free models are often busy), giving `retries × models`
total attempts, each with a 180 s timeout.

The built-in prompt **deletes** (rather than softens) every safety / refusal /
hedging sentence and replaces it with an unconditional-compliance statement
**in the session persona's own voice** (e.g. the profane 海鸥 hacker). It also
forbids *negated* caveats such as "I won't do harmful things" / "no caveats,
just…". A **repair pass** (up to 3×) re-runs the rewrite whenever a refusal or
safety-framing fragment (`拒绝` / `caveat` / `harmless` / `safety guidelines` / …)
leaks into the output.

## Why

LLMs weight their own prior responses heavily — a single erroneous refusal early
in a conversation conditions the model to keep refusing ("refusal momentum").
Editing the prior response directly makes the context window show the model
already agreed to help, so it keeps helping without losing session context.
Useful for security research: triaging vulnerabilities, reproducing bugs,
analyzing exploit samples. See the upstream
[README](https://github.com/Adamkadaban/opencode-gaslight#why) for the academic
background (Crescendo, persuasion taxonomy, CoVE, PAIR).

## Development

```bash
bun install
bun run typecheck   # tsc --noEmit
bun run check       # verify the plugin imports
```

## License

MIT
