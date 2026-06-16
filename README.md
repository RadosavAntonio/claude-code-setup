# claude-code-setup

[![npm](https://img.shields.io/npm/v/@antonior/claude-code-setup?color=cb3837&logo=npm)](https://www.npmjs.com/package/@antonior/claude-code-setup)
[![license](https://img.shields.io/npm/l/@antonior/claude-code-setup?color=blue)](./LICENSE)
[![platform](https://img.shields.io/badge/platform-macOS-black?logo=apple&logoColor=white)](#platforms)
[![tokens](https://img.shields.io/badge/optimised%20for-low%20token%20usage-brightgreen)](#optimised-for-low-token-usage)

One-command installer for my [Claude Code](https://claude.com/claude-code) configuration — hooks, slash commands, skills, statusline, and global rules. Install once, get the exact setup I use every day. **Optimised for low token usage.**

## Why this setup?

Stock Claude Code is powerful but neutral. This config turns it into a careful, cost-aware engineer with guardrails — the difference between an assistant that *sounds* confident and one that *proves* its work.

- **🛡️ Trustworthy by default.** Built-in rules forbid the things that quietly burn you: never fakes or weakens tests, never suppresses errors with `@ts-ignore` / `eslint-disable` / swallowed `catch`, never claims "done" without verifying. Failures get surfaced, not hidden.
- **🔒 Catches mistakes before they ship.** `scan-secrets` blocks any commit containing API keys or a real `.env`. `stop-verify` runs lint + typecheck on the files you changed at the end of every turn and won't let "done" slide if they fail. `check-dep` forces a real look at any new dependency (size, maintenance, lighter alternatives) before it's added.
- **🎯 Stays in scope.** Only changes what you asked for — no drive-by refactors, no unrequested "improvements", no comments bolted onto code it didn't touch.
- **🧠 Remembers across sessions.** The `transcript-search` MCP indexes your *own* past conversations locally, so Claude recalls prior decisions ("like we did last time") instead of saying "I don't remember" — and instead of you re-explaining context.
- **💸 Cheap on tokens.** Caveman mode keeps full technical accuracy while cutting chatter ~75%; video defaults to audio-only transcription; verification hooks touch only changed files, not the whole repo. See [Optimised for low token usage](#optimised-for-low-token-usage).
- **🎬 Understands video.** The `claude-video-vision` MCP lets Claude watch and reason about video, not just text.
- **📊 Knows where you stand.** A rich statusline shows git branch + dirty state, model and effort level, context-window %, and your 5-hour / 7-day rate-limit usage at a glance.
- **⚡ One-command, exact mirror.** Installs everything, auto-installs its dependencies, and registers the MCP servers. It reproduces my config **1:1** — existing files are overwritten so you get an identical setup, with any file it replaces backed up to `<file>.bak` first. It never deletes files it doesn't manage. Idempotent — re-run any time to pull the latest.

## Install

```sh
npx @antonior/claude-code-setup
```

That's it. The installer is idempotent — safe to re-run to pull updates.

## Platforms

Built and tested on **macOS**. Linux and native Windows aren't officially supported yet — the hooks are bash and the installer uses Homebrew, so a full cross-platform pass is needed before I'd claim them.

## Dependencies (auto-installed via Homebrew)

The installer installs these for you if missing:

| Tool | For | Notes |
|------|-----|-------|
| `jq` | hooks (JSON parsing) | **Required** — install aborts without it. |
| `python3` | `transcript-search` MCP + video-FPS hook | Best-effort — feature stays dormant if it can't install. |
| `ffmpeg` | `claude-video-vision` MCP | Best-effort. |
| `git`, `eslint`, `tsc` | commit-scan / lint / typecheck hooks | Optional — hooks no-op cleanly when absent. |

## What it installs (into `~/.claude/`)

- **`CLAUDE.md`** — global rules (trust/integrity, scope discipline, verification). *Overwritten to match; any existing one is saved to `CLAUDE.md.bak`.*
- **`settings.json`** + **`settings.local.json`** — permissions, hooks, effort/theme. *Overwritten to match; any existing ones are saved to `.bak`.*
- **`hooks/`**
  - `caveman-activate.sh` — terse response style on session start
  - `scan-secrets.sh` — blocks `git commit` if staged diff contains secrets/`.env`
  - `check-dep.sh` — prompts to research a dependency before adding it
  - `eslint-fix.sh` — auto `eslint --fix` on edited JS/TS files
  - `stop-verify.sh` — lint + typecheck changed files when a turn ends
  - `notify-sound.sh` — sound on notification/stop
- **`commands/`** — `/check-dep`, `/debug`, `/scan-secrets`, `/updateClaudeNpm` slash commands
- **`skills/`** — `/mute`, `/unmute`, and `/caveman` (with intensity levels)
- **`agents/`** — custom subagents: `Explore` (fast read-only code search), `Plan` (architect/implementation plans), `statusline-setup` (statusline config)
- **`statusline.sh`** — git, model, context %, rate-limit statusline
- **`transcript-search/rag_lite.py`** — the transcript-search MCP engine
- **MCP servers** (registered via `claude mcp add-json`, user scope) — see below

## Bundled MCP servers

Both are installed and auto-registered for you:

- **`transcript-search`** — full-text search over your *own* past Claude Code transcripts ("we talked about…", "like last time"). Pure-Python, stdlib only. The index is built **locally on your machine** from `~/.claude/projects/` on first run — nothing about your conversations is ever shipped in this package.
- **`claude-video-vision`** — lets Claude watch/analyse videos (frames via `ffmpeg`). Published as [`claude-video-vision`](https://www.npmjs.com/package/claude-video-vision) on npm; run via `npx`.
  - **Tip:** when it asks how many FPS, answer **0** to use audio transcription only (no frame extraction) — much cheaper on tokens. Bump the FPS only when you actually need on-screen/visual detail.

## Optimised for low token usage

This setup is deliberately token-lean:

- **`/caveman` skill + caveman hook** — ultra-compressed replies that keep full technical accuracy while cutting chatter (~75% fewer tokens), with `lite`/`full`/`ultra` intensity levels.
- **Video → 0 FPS** — analyse video by audio transcription only unless you explicitly need visual frames, avoiding expensive frame tokens.
- **`transcript-search` over re-explaining** — recalls past decisions from your own history instead of re-deriving context.
- **Scoped, high-signal hooks** — `stop-verify` and `eslint-fix` only act on files you actually changed, not whole-repo sweeps.

## On a new machine — two one-time steps

The installer reproduces **100% of the configuration and behaviour**. Two things are *identity and secrets*, not config, and can never live in a public package — you set them once:

1. **Log into Claude Code** (your account — you'd do this on any new machine anyway).
2. **Give `claude-video-vision` your own API key** if you use video analysis.

## Maintaining (for me)

The package is an exact mirror of my own `~/.claude`. To refresh it from my live config and publish:

- `scripts/sync-from-local.sh` rebuilds `files/` from an allowlist of my config (`CLAUDE.md`, `settings*.json`, `statusline.sh`, `hooks/`, `commands/`, `agents/`, `skills/`, the caveman skill, the transcript-search engine). It never copies private or runtime data (history, transcripts, memory, the search index, sessions, caches, marketplace clones).
- The `/updateClaudeNpm` slash command runs that sync, scans for secrets, bumps the version, pushes to `main`, and publishes to npm — so a fresh `npx @antonior/claude-code-setup` on another machine reproduces my setup 1:1.

## License

[MIT](./LICENSE) © Antonio Radosav

---

<p align="center">Made with ❤️ in the UK</p>
