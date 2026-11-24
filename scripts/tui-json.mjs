#!/usr/bin/env node
// Cross-platform helper to add/remove this plugin's spec in opencode's
// tui.json (idempotent, preserves all other keys).
//
//   bun scripts/tui-json.mjs <add|remove> <path-to-tui.json> [spec]
//
// `spec` is only used for `add`, e.g. "file:///home/you/.local/share/opencode-gaslight".
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname } from "node:path"

const MATCH = "opencode-gaslight"
const [mode, file, spec] = process.argv.slice(2)

if (!mode || !file || (mode !== "add" && mode !== "remove")) {
  console.error("usage: tui-json.mjs <add|remove> <path-to-tui.json> [spec]")
  process.exit(2)
}

let cfg = {}
try {
  // strip a possible UTF-8 BOM (Windows editors / PowerShell Set-Content add one)
  cfg = JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""))
} catch {
  cfg = {}
}
if (typeof cfg !== "object" || cfg === null || Array.isArray(cfg)) cfg = {}
if (!Array.isArray(cfg.plugin)) cfg.plugin = []

cfg.plugin = cfg.plugin.filter((p) => {
  const s = Array.isArray(p) ? p[0] : p
  return !String(s).includes(MATCH)
})

if (mode === "add") {
  if (!spec) {
    console.error("error: add requires a spec argument")
    process.exit(2)
  }
  cfg.plugin.push(spec)
}

mkdirSync(dirname(file), { recursive: true })
writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n")
console.log(JSON.stringify(cfg.plugin))
