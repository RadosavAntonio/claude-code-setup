# claude-code-setup

[![npm](https://img.shields.io/npm/v/@antonior/claude-code-setup?color=cb3837&logo=npm)](https://www.npmjs.com/package/@antonior/claude-code-setup)
[![license](https://img.shields.io/npm/l/@antonior/claude-code-setup?color=blue)](./LICENSE)
[![platform](https://img.shields.io/badge/platform-macOS-black?logo=apple)](#platform)

One-command installer for my [Claude Code](https://claude.com/claude-code) configuration — hooks, slash commands, skills, statusline, and global rules. Install once, get the exact setup I use every day.

## Install

```sh
npx @antonior/claude-code-setup
```

That's it. The installer is idempotent — safe to re-run to pull updates.

## Platform

**macOS only.** The hooks and statusline use macOS-native tools (`afplay` for sound, BSD `date -r`, Homebrew for `jq`). On Linux/Windows the installer runs but the sound and statusline-clock features won't work.

## Prerequisites

| Tool | Required? | Notes |
|------|-----------|-------|
| `jq` | **Yes** | Hooks parse JSON with it. Auto-installed via Homebrew if missing. |
| `git` | Optional | Commit-scan and verify hooks no-op outside a git repo. |
| `eslint` / `tsc` | Optional | Auto-fix and verify hooks no-op if not in `node_modules`. |

## What it installs (into `~/.claude/`)

- **`CLAUDE.md`** — global rules (trust/integrity, scope discipline, verification). *Skipped if you already have one — merge manually.*
- **`settings.json`** — permissions, hooks, model/effort/theme. *Smart-merged with any existing file; never overwritten.*
- **`hooks/`**
  - `caveman-activate.sh` — terse response style on session start
  - `scan-secrets.sh` — blocks `git commit` if staged diff contains secrets/`.env`
  - `check-dep.sh` — prompts to research a dependency before adding it
  - `eslint-fix.sh` — auto `eslint --fix` on edited JS/TS files
  - `stop-verify.sh` — lint + typecheck changed files when a turn ends
  - `notify-sound.sh` — sound on notification/stop
- **`commands/`** — `/check-dep`, `/debug`, `/scan-secrets` slash commands
- **`skills/`** — `/mute`, `/unmute`
- **`statusline.sh`** — git, model, context %, rate-limit statusline

## Optional MCP servers

`CLAUDE.md` references two MCP servers that are **not bundled** (they need their own setup). Without them, the related instructions simply don't fire:

- **`transcript-search`** — powers the "past conversations are indexed" behaviour
- **`claude-video-vision`** — video analysis

Install these separately if you want the full experience.

## Notes on the shared config

Two items from my personal setup are intentionally **stripped** from the published version:

- `skipDangerousModePermissionPrompt` — I won't disable a safety prompt on your machine.
- The video-FPS `UserPromptSubmit` hook — it depends on `python3` and an unbundled MCP server.

## License

[MIT](./LICENSE) © Antonio Radosav

---

<p align="center">Made with ❤️ in the UK</p>
