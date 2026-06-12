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

## Dependencies (auto-installed via Homebrew)

The installer installs these for you if missing:

| Tool | For | Notes |
|------|-----|-------|
| `jq` | hooks (JSON parsing) | **Required** — install aborts without it. |
| `python3` | `transcript-search` MCP + video-FPS hook | Best-effort — feature stays dormant if it can't install. |
| `ffmpeg` | `claude-video-vision` MCP | Best-effort. |
| `git`, `eslint`, `tsc` | commit-scan / lint / typecheck hooks | Optional — hooks no-op cleanly when absent. |

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
- **`skills/`** — `/mute`, `/unmute`, and `/caveman` (with intensity levels)
- **`statusline.sh`** — git, model, context %, rate-limit statusline
- **`transcript-search/rag_lite.py`** — the transcript-search MCP engine
- **MCP servers** (registered via `claude mcp add-json`, user scope) — see below

## Bundled MCP servers

Both are installed and auto-registered for you:

- **`transcript-search`** — full-text search over your *own* past Claude Code transcripts ("we talked about…", "like last time"). Pure-Python, stdlib only. The index is built **locally on your machine** from `~/.claude/projects/` on first run — nothing about your conversations is ever shipped in this package.
- **`claude-video-vision`** — lets Claude watch/analyse videos (frames via `ffmpeg`). Published as [`claude-video-vision`](https://www.npmjs.com/package/claude-video-vision) on npm; run via `npx`.

## On a new machine — two one-time steps

The installer reproduces **100% of the configuration and behaviour**. Two things are *identity and secrets*, not config, and can never live in a public package — you set them once:

1. **Log into Claude Code** (your account — you'd do this on any new machine anyway).
2. **Give `claude-video-vision` your own API key** if you use video analysis.

## Intentionally not shipped

- `skipDangerousModePermissionPrompt` — this disables a safety confirmation. I won't flip that on your machine by default; enable it yourself if you want it.

## License

[MIT](./LICENSE) © Antonio Radosav

---

<p align="center">Made with ❤️ in the UK</p>
